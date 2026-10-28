-- Admin portal v2 (2026-10-28): a date range on every read, the money that is still
-- outstanding and how old it is, how fast Dazzles settle, which rail carries the
-- payments, how often the receipt reader is corrected, group health, a per-person
-- drawer, "invited by", and quick filters on the people list.
--
-- p_since: null = all time; otherwise only rows created at or after it. Each
-- function keeps the admin gate (private.require_admin) exactly as before.

-- ---------------------------------------------------------------------------
-- Overview
-- ---------------------------------------------------------------------------
drop function if exists public.admin_overview();
create or replace function public.admin_overview(p_since timestamptz default null)
returns jsonb language plpgsql stable security definer set search_path = public, private as $$
declare r jsonb; s timestamptz := coalesce(p_since, '-infinity'::timestamptz);
begin
  perform private.require_admin();
  select jsonb_build_object(
    'users', jsonb_build_object(
      'total', (select count(*) from users where deleted_at is null and created_at >= s),
      'new_7d', (select count(*) from users where deleted_at is null and created_at >= now() - interval '7 days'),
      'with_payment', (select count(distinct h.user_id) from payment_handles h join users u on u.id = h.user_id where u.deleted_at is null and u.created_at >= s)
    ),
    'trips', jsonb_build_object(
      'total', (select count(*) from trips where created_at >= s),
      'open', (select count(*) from trips where status = 'open' and created_at >= s),
      'settled', (select count(*) from trips where status = 'settled' and created_at >= s),
      'archived', (select count(*) from trips where status = 'archived' and created_at >= s),
      'new_7d', (select count(*) from trips where created_at >= now() - interval '7 days'),
      'avg_members', (select round(avg(n), 1) from (select count(*) n from trip_members m join trips t on t.id = m.trip_id where m.removed_at is null and t.created_at >= s group by t.id) z),
      -- expenses per active day: a Dazzle's expense count over the days between its first and last expense
      'expenses_per_day', (select round(avg(n::numeric / greatest(1, (last_d - first_d) + 1)), 2)
                             from (select count(*) n, min(e.created_at)::date first_d, max(e.created_at)::date last_d
                                     from expenses e join trips t on t.id = e.trip_id
                                    where e.deleted_at is null and t.created_at >= s group by t.id) z)
    ),
    'expenses', jsonb_build_object(
      'total', (select count(*) from expenses where deleted_at is null and created_at >= s),
      'cents', (select coalesce(sum(base_amount_cents), 0) from expenses where deleted_at is null and created_at >= s),
      'new_7d', (select count(*) from expenses where deleted_at is null and created_at >= now() - interval '7 days'),
      'from_receipt', (select count(*) from expenses where deleted_at is null and created_at >= s and receipt_id is not null),
      'manual', (select count(*) from expenses where deleted_at is null and created_at >= s and receipt_id is null)
    ),
    'settlements', jsonb_build_object(
      'total', (select count(*) from settlements where created_at >= s),
      'paid', (select count(*) from settlements where status <> 'pending' and created_at >= s),
      'paid_cents', (select coalesce(sum(amount_cents), 0) from settlements where status <> 'pending' and created_at >= s),
      'pending_cents', (select coalesce(sum(amount_cents), 0) from settlements where status = 'pending' and created_at >= s),
      'pending_lt7_cents', (select coalesce(sum(amount_cents), 0) from settlements where status = 'pending' and created_at >= s and created_at > now() - interval '7 days'),
      'pending_gt30_cents', (select coalesce(sum(amount_cents), 0) from settlements where status = 'pending' and created_at >= s and created_at <= now() - interval '30 days'),
      -- days from the last logged expense to the Dazzle being settled
      'avg_days_to_settle', (select round(avg(extract(epoch from (t.settled_at - x.last_expense)) / 86400)::numeric, 1)
                               from trips t
                               join lateral (select max(e.created_at) last_expense from expenses e where e.trip_id = t.id and e.deleted_at is null) x on true
                              where t.settled_at is not null and x.last_expense is not null and t.created_at >= s),
      'settled_trips', (select count(*) from trips where settled_at is not null and created_at >= s),
      -- which rail carried each marked payment; no platform recorded = settled by hand
      'rails', (select coalesce(jsonb_agg(jsonb_build_object('rail', z.rail, 'payments', z.n, 'cents', z.c) order by z.n desc), '[]'::jsonb)
                  from (select coalesce(platform::text, 'manual') rail, count(*) n, sum(amount_cents) c
                          from settlements where status <> 'pending' and created_at >= s group by 1) z)
    ),
    'receipts', jsonb_build_object(
      'total', (select count(*) from receipts where created_at >= s),
      'cost_usd', (select coalesce(sum(cost_estimate_usd), 0) from receipts where created_at >= s),
      'avg_cost_usd', (select round(coalesce(avg(cost_estimate_usd), 0), 4) from receipts where created_at >= s and cost_estimate_usd > 0),
      'failed', (select count(*) from receipts where status = 'failed' and created_at >= s),
      'read', (select count(*) from receipts where status in ('ready', 'needs_review') and created_at >= s),
      'corrected', (select count(*) from receipts r where r.status in ('ready', 'needs_review') and r.created_at >= s
                      and exists (select 1 from receipt_items i where i.receipt_id = r.id and i.edited_by_user)),
      'lines', (select count(*) from receipt_items i join receipts r on r.id = i.receipt_id where r.created_at >= s),
      'lines_edited', (select count(*) from receipt_items i join receipts r on r.id = i.receipt_id where r.created_at >= s and i.edited_by_user)
    ),
    'feedback_new', (select count(*) from feedback where status = 'new'),
    'invites', jsonb_build_object(
      'total', (select count(*) from invites where created_at >= s),
      'accepted', (select count(*) from invites where status = 'accepted' and created_at >= s),
      'pending', (select count(*) from invites where status = 'pending' and expires_at > now() and created_at >= s)
    )
  ) into r;
  return r;
end $$;

-- ---------------------------------------------------------------------------
-- People: date range, quick filters, who invited them, where they stand
--   p_filter: all | debt (owes a pending payment or is net negative in an open
--             Dazzle) | no_payment (no payment handle) | invited (a pending
--             invite to a number with no account yet; rows are invites)
-- ---------------------------------------------------------------------------
drop function if exists public.admin_users(text, int, int);
create or replace function public.admin_users(p_search text default null, p_limit int default 100, p_offset int default 0, p_since timestamptz default null, p_filter text default 'all')
returns table (
  id uuid, kind text, display_name text, email text, phone text, created_at timestamptz,
  platforms text[], trips bigint, expenses bigint, last_active timestamptz,
  invited_by text, net_cents bigint, owes_cents bigint
) language plpgsql stable security definer set search_path = public, private as $$
declare s timestamptz := coalesce(p_since, '-infinity'::timestamptz); q text := nullif(btrim(coalesce(p_search, '')), '');
begin
  perform private.require_admin();
  if p_filter = 'invited' then
    return query
    select i.id, 'invite'::text, null::text, null::text, i.phone, i.created_at, '{}'::text[], 0::bigint, 0::bigint, null::timestamptz,
           public.first_name(i.invited_by), 0::bigint, 0::bigint
      from invites i
     where i.status = 'pending' and i.expires_at > now() and i.created_at >= s
       and not exists (select 1 from users u where u.phone = i.phone and u.deleted_at is null)
       and (q is null or i.phone like '%' || q || '%')
     order by i.created_at desc
     limit greatest(1, least(p_limit, 500)) offset greatest(0, p_offset);
    return;
  end if;
  return query
  with base as (
    select u.id, u.display_name, u.email, u.phone, u.created_at,
           array(select h.platform::text from payment_handles h where h.user_id = u.id order by h.platform) as platforms,
           (select count(*) from trip_members m where m.user_id = u.id and m.removed_at is null) as trips,
           (select count(*) from expenses e where e.created_by = u.id and e.deleted_at is null) as expenses,
           (select max(m.last_active_at) from trip_members m where m.user_id = u.id) as last_active,
           (select public.first_name(i.invited_by) from invites i
             where i.phone = u.phone and i.status = 'accepted' and i.invited_by <> u.id
             order by i.created_at limit 1) as invited_by,
           (coalesce((select sum(p.base_amount_cents) from expense_payers p join expenses e on e.id = p.expense_id join trips t on t.id = e.trip_id
                       where p.user_id = u.id and e.deleted_at is null and t.status = 'open'), 0)
          - coalesce((select sum(sh.base_share_cents) from expense_shares sh join expenses e on e.id = sh.expense_id join trips t on t.id = e.trip_id
                       where sh.user_id = u.id and e.deleted_at is null and t.status = 'open'), 0))::bigint as net_cents,
           coalesce((select sum(st.amount_cents) from settlements st where st.from_user = u.id and st.status = 'pending'), 0)::bigint as owes_cents
      from users u
     where u.deleted_at is null and u.created_at >= s
       and (q is null or u.display_name ilike '%' || q || '%' or u.email ilike '%' || q || '%' or u.phone like '%' || q || '%')
  )
  select b.id, 'user'::text, b.display_name, b.email, b.phone, b.created_at, b.platforms, b.trips, b.expenses, b.last_active, b.invited_by, b.net_cents, b.owes_cents
    from base b
   where p_filter = 'all'
      or (p_filter = 'debt' and (b.owes_cents > 0 or b.net_cents < 0))
      or (p_filter = 'no_payment' and cardinality(b.platforms) = 0)
   order by b.created_at desc
   limit greatest(1, least(p_limit, 500)) offset greatest(0, p_offset);
end $$;

-- one person, for the drawer
create or replace function public.admin_user_detail(p_user uuid)
returns jsonb language plpgsql stable security definer set search_path = public, private as $$
declare r jsonb;
begin
  perform private.require_admin();
  select jsonb_build_object(
    'user', (select jsonb_build_object('id', u.id, 'display_name', u.display_name, 'email', u.email, 'phone', u.phone, 'created_at', u.created_at, 'deleted', u.deleted_at is not null)
               from users u where u.id = p_user),
    'trips', (select coalesce(jsonb_agg(jsonb_build_object(
                 'id', t.id, 'title', t.title, 'status', t.status, 'currency', t.base_currency, 'role', m.role,
                 'done', m.done_at is not null, 'joined_at', m.joined_at,
                 'net_cents', coalesce((select sum(p.base_amount_cents) from expense_payers p join expenses e on e.id = p.expense_id where e.trip_id = t.id and e.deleted_at is null and p.user_id = p_user), 0)
                            - coalesce((select sum(sh.base_share_cents) from expense_shares sh join expenses e on e.id = sh.expense_id where e.trip_id = t.id and e.deleted_at is null and sh.user_id = p_user), 0)
               ) order by t.last_activity_at desc), '[]'::jsonb)
                from trip_members m join trips t on t.id = m.trip_id
               where m.user_id = p_user and m.removed_at is null),
    'owes_cents', (select coalesce(sum(amount_cents), 0) from settlements where from_user = p_user and status = 'pending'),
    'owed_cents', (select coalesce(sum(amount_cents), 0) from settlements where to_user = p_user and status = 'pending'),
    'stripes', (select count(*) from trip_members where user_id = p_user and removed_at is null and done_at is not null),
    'outfit', (select jsonb_build_object('head', ch.name, 'faceneck', cf.name, 'body', cb.name)
                 from user_outfit o
                 left join cosmetics ch on ch.id = o.head left join cosmetics cf on cf.id = o.faceneck left join cosmetics cb on cb.id = o.body
                where o.user_id = p_user),
    'cosmetics_owned', (select count(*) from user_cosmetics where user_id = p_user),
    'platforms', (select coalesce(jsonb_agg(jsonb_build_object('platform', h.platform, 'handle', h.handle) order by h.platform), '[]'::jsonb) from payment_handles h where h.user_id = p_user),
    'invited_by', (select public.first_name(i.invited_by) from invites i join users u on u.phone = i.phone
                    where u.id = p_user and i.status = 'accepted' and i.invited_by <> p_user order by i.created_at limit 1),
    'invites_sent', (select count(*) from invites where invited_by = p_user),
    'invites_accepted', (select count(*) from invites where invited_by = p_user and status = 'accepted'),
    'feedback', (select count(*) from feedback f where f.user_id = p_user)
  ) into r;
  return r;
end $$;

-- ---------------------------------------------------------------------------
-- Data tab: date range everywhere; every split type listed, even at zero
-- ---------------------------------------------------------------------------
drop function if exists public.admin_trips(int, int);
create or replace function public.admin_trips(p_limit int default 100, p_offset int default 0, p_since timestamptz default null)
returns table (
  id uuid, title text, status text, base_currency text, created_at timestamptz,
  members bigint, done bigint, expenses bigint, cents bigint, settled_cents bigint
) language plpgsql stable security definer set search_path = public, private as $$
declare s timestamptz := coalesce(p_since, '-infinity'::timestamptz);
begin
  perform private.require_admin();
  return query
  select t.id, t.title, t.status::text, t.base_currency, t.created_at,
         (select count(*) from trip_members m where m.trip_id = t.id and m.removed_at is null),
         (select count(*) from trip_members m where m.trip_id = t.id and m.removed_at is null and m.done_at is not null),
         (select count(*) from expenses e where e.trip_id = t.id and e.deleted_at is null),
         (select coalesce(sum(e.base_amount_cents), 0) from expenses e where e.trip_id = t.id and e.deleted_at is null),
         (select coalesce(sum(x.amount_cents), 0) from settlements x where x.trip_id = t.id and x.status <> 'pending')
    from trips t
   where t.created_at >= s
   order by t.created_at desc
   limit greatest(1, least(p_limit, 500)) offset greatest(0, p_offset);
end $$;

drop function if exists public.admin_categories();
create or replace function public.admin_categories(p_since timestamptz default null)
returns table (category text, subcategory text, expenses bigint, cents bigint, share numeric)
language plpgsql stable security definer set search_path = public, private as $$
declare s timestamptz := coalesce(p_since, '-infinity'::timestamptz);
begin
  perform private.require_admin();
  return query
  with total as (select nullif(sum(base_amount_cents), 0) as c from expenses where deleted_at is null and created_at >= s)
  select e.category, coalesce(e.subcategory, '—'), count(*), coalesce(sum(e.base_amount_cents), 0),
         round(coalesce(sum(e.base_amount_cents), 0)::numeric / (select c from total), 4)
    from expenses e
   where e.deleted_at is null and e.created_at >= s
   group by e.category, e.subcategory
   order by 4 desc;
end $$;

drop function if exists public.admin_split_types();
create or replace function public.admin_split_types(p_since timestamptz default null)
returns table (split_type text, expenses bigint, cents bigint, from_receipt bigint)
language plpgsql stable security definer set search_path = public, private as $$
declare s timestamptz := coalesce(p_since, '-infinity'::timestamptz);
begin
  perform private.require_admin();
  return query
  select k.v::text,
         count(e.id),
         coalesce(sum(e.base_amount_cents), 0),
         count(e.id) filter (where e.receipt_id is not null)
    from unnest(enum_range(null::public.split_type)) as k(v)
    left join expenses e on e.split_type = k.v and e.deleted_at is null and e.created_at >= s
   group by k.v
   order by 2 desc, 1;
end $$;

drop function if exists public.admin_models();
create or replace function public.admin_models(p_since timestamptz default null)
returns table (
  model text, receipts bigint, reconciled bigint, failed bigint,
  cost_usd numeric, lines_read bigint, lines_edited bigint, correction_rate numeric
) language plpgsql stable security definer set search_path = public, private as $$
declare s timestamptz := coalesce(p_since, '-infinity'::timestamptz);
begin
  perform private.require_admin();
  return query
  select coalesce(r.model, '—') as model,
         count(distinct r.id),
         count(distinct r.id) filter (where r.reconciled),
         count(distinct r.id) filter (where r.status = 'failed'),
         round(coalesce((select sum(x.cost_estimate_usd) from receipts x where coalesce(x.model, '—') = coalesce(r.model, '—') and x.created_at >= s), 0), 4),
         count(i.id),
         count(i.id) filter (where i.edited_by_user),
         round(count(i.id) filter (where i.edited_by_user)::numeric / nullif(count(i.id), 0), 4)
    from receipts r left join receipt_items i on i.receipt_id = r.id
   where r.created_at >= s
   group by r.model
   order by 2 desc;
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'admin_overview(timestamptz)', 'admin_users(text,int,int,timestamptz,text)', 'admin_user_detail(uuid)',
    'admin_trips(int,int,timestamptz)', 'admin_categories(timestamptz)', 'admin_split_types(timestamptz)', 'admin_models(timestamptz)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
