-- ---------------------------------------------------------------------------
-- Payment handles: where a person can be paid at close-out.
--
-- Venmo, Cash App and PayPal only. Zelle has no public API, no developer
-- programme and no reliable deep link (it lives inside each bank's own app),
-- so paying by Zelle stays a "paid another way" settlement, marked by hand.
--
-- The handle belongs to the RECIPIENT: a payer can only be routed to a
-- platform the person they owe has actually registered.
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.pay_platform as enum ('venmo', 'cashapp', 'paypal');
exception when duplicate_object then null;
end $$;

create table if not exists public.payment_handles (
  user_id uuid not null references public.users (id) on delete cascade,
  platform public.pay_platform not null,
  handle text not null check (btrim(handle) <> '' and length(btrim(handle)) <= 30),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, platform)
);

comment on table public.payment_handles is
  'Where a user can be paid. One row per platform per user; the app writes these, never money.';

-- The platform this person prefers to be paid on; advisory, the payer may override.
alter table public.users add column if not exists default_pay_platform public.pay_platform;

-- ---------------------------------------------------------------------------
-- Backfill from the single venmo_username column this replaces.
-- ---------------------------------------------------------------------------
insert into public.payment_handles (user_id, platform, handle)
select id, 'venmo', btrim(venmo_username)
  from public.users
 where venmo_username is not null and btrim(venmo_username) <> ''
on conflict (user_id, platform) do nothing;

update public.users u
   set default_pay_platform = 'venmo'
 where u.default_pay_platform is null
   and exists (select 1 from public.payment_handles h
                where h.user_id = u.id and h.platform = 'venmo');

-- users.venmo_username stays as the legacy mirror: the web guest view still reads
-- it (apps/web/src/lib/trip.ts), so keep it in step with the venmo handle rather
-- than migrating two clients at once.
create or replace function public.sync_venmo_username()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (tg_op = 'DELETE') then
    if old.platform = 'venmo' then
      update public.users set venmo_username = null where id = old.user_id;
    end if;
    return old;
  end if;
  if new.platform = 'venmo' then
    update public.users set venmo_username = btrim(new.handle) where id = new.user_id;
  end if;
  return new;
end $$;

drop trigger if exists payment_handles_sync_venmo on public.payment_handles;
create trigger payment_handles_sync_venmo
  after insert or update or delete on public.payment_handles
  for each row execute function public.sync_venmo_username();

-- ---------------------------------------------------------------------------
-- RLS: you manage your own handles; people you share a Dazzle with can read
-- them, because that is exactly who needs to pay you.
-- ---------------------------------------------------------------------------
alter table public.payment_handles enable row level security;

drop policy if exists handles_select on public.payment_handles;
create policy handles_select on public.payment_handles for select
  using (user_id = auth.uid() or public.shares_trip_with(user_id));

drop policy if exists handles_write on public.payment_handles;
create policy handles_write on public.payment_handles for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Which platform a settlement is being paid on. Null means "the recipient's
-- default, decided when the payer opens it"; it is recorded once they pick.
-- ---------------------------------------------------------------------------
alter table public.settlements add column if not exists platform public.pay_platform;

-- The payer chooses the platform, and only while the payment is still pending.
create or replace function public.set_settlement_platform(p_settlement uuid, p_platform public.pay_platform)
returns void language plpgsql security definer set search_path = public as $$
declare s record;
begin
  select * into s from public.settlements where id = p_settlement;
  if s.id is null then raise exception 'settlement not found' using errcode = 'P0002'; end if;
  if s.from_user <> auth.uid() then raise exception 'only the payer can choose the platform' using errcode = '42501'; end if;
  if s.status <> 'pending' then raise exception 'this payment is already marked paid' using errcode = '42501'; end if;
  if not exists (select 1 from public.payment_handles h where h.user_id = s.to_user and h.platform = p_platform) then
    raise exception 'they have not added that payment method' using errcode = 'P0002';
  end if;
  update public.settlements set platform = p_platform where id = s.id;
end $$;

revoke all on function public.set_settlement_platform(uuid, public.pay_platform) from public;
grant execute on function public.set_settlement_platform(uuid, public.pay_platform) to authenticated;

-- ---------------------------------------------------------------------------
-- Sign-up now sends a platform and handle instead of a bare Venmo username, so
-- the new account already has somewhere to be paid. Metadata keys: pay_platform,
-- pay_handle. venmo_username is still honoured for older clients.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_platform public.pay_platform; v_handle text;
begin
  insert into public.users (id, phone, email, display_name, venmo_username)
  values (new.id, new.phone,
          coalesce(nullif(new.email, ''), nullif(new.raw_user_meta_data->>'email', '')),
          nullif(new.raw_user_meta_data->>'display_name', ''),
          nullif(new.raw_user_meta_data->>'venmo_username', ''))
  on conflict (id) do update set
    phone = coalesce(excluded.phone, public.users.phone),
    email = coalesce(excluded.email, public.users.email),
    display_name = coalesce(public.users.display_name, excluded.display_name),
    venmo_username = coalesce(public.users.venmo_username, excluded.venmo_username);

  v_handle := btrim(coalesce(new.raw_user_meta_data->>'pay_handle', new.raw_user_meta_data->>'venmo_username', ''));
  begin
    v_platform := coalesce(nullif(new.raw_user_meta_data->>'pay_platform', ''), 'venmo')::public.pay_platform;
  exception when invalid_text_representation then v_platform := 'venmo';
  end;

  if v_handle <> '' then
    insert into public.payment_handles (user_id, platform, handle)
    values (new.id, v_platform, v_handle)
    on conflict (user_id, platform) do nothing;
    update public.users set default_pay_platform = coalesce(default_pay_platform, v_platform) where id = new.id;
  end if;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert or update of phone, email on auth.users
  for each row execute function public.handle_new_auth_user();
