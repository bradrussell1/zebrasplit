-- Admin portal v3 (2026-10-28): the archive of every Dazzle (members, expenses,
-- payments, receipts in one call), list views behind the overview numbers
-- (expenses, receipts, payments), and the admin's right to look at a receipt photo.

-- ---------------------------------------------------------------------------
-- Expenses, newest first
-- ---------------------------------------------------------------------------
create or replace function public.admin_expenses(p_since timestamptz default null, p_limit int default 200, p_offset int default 0, p_trip uuid default null)
returns table (
  id uuid, trip_id uuid, trip_title text, description text, category text, subcategory text,
  amount_cents int, currency text, base_amount_cents int, split_type text, nights int,
  paid_by text, people int, receipt_id uuid, created_by text, created_at timestamptz, deleted_at timestamptz
) language plpgsql stable security definer set search_path = public, private as $$
declare s timestamptz := coalesce(p_since, '-infinity'::timestamptz);
begin
  perform private.require_admin();
  return query
  select e.id, e.trip_id, t.title, e.description, e.category, e.subcategory,
         e.amount_cents, e.currency, e.base_amount_cents, e.split_type::text, e.nights,
         (select string_agg(coalesce(public.first_name(p.user_id), 'Someone'), ', ' order by p.base_amount_cents desc) from expense_payers p where p.expense_id = e.id),
         (select count(*)::int from expense_shares sh where sh.expense_id = e.id),
         e.receipt_id, public.first_name(e.created_by), e.created_at, e.deleted_at
    from expenses e join trips t on t.id = e.trip_id
   where e.created_at >= s and (p_trip is null or e.trip_id = p_trip)
     and (p_trip is not null or e.deleted_at is null)
   order by e.created_at desc
   limit greatest(1, least(p_limit, 1000)) offset greatest(0, p_offset);
end $$;

-- ---------------------------------------------------------------------------
-- Receipts, newest first (the photo is fetched by the portal with a signed URL)
-- ---------------------------------------------------------------------------
create or replace function public.admin_receipts(p_since timestamptz default null, p_limit int default 200, p_offset int default 0, p_trip uuid default null)
returns table (
  id uuid, trip_id uuid, trip_title text, expense_id uuid, storage_path text, status text, model text,
  merchant text, receipt_date date, currency text, printed_total_cents int, subtotal_cents int,
  reconciled boolean, error text, attempts int, cost_usd numeric, lines int, lines_edited int,
  created_by text, created_at timestamptz
) language plpgsql stable security definer set search_path = public, private as $$
declare s timestamptz := coalesce(p_since, '-infinity'::timestamptz);
begin
  perform private.require_admin();
  return query
  select r.id, r.trip_id, t.title, r.expense_id, r.storage_path, r.status, r.model,
         r.merchant, r.receipt_date, r.currency, r.printed_total_cents, r.subtotal_cents,
         r.reconciled, r.error, r.attempts, coalesce(r.cost_estimate_usd, 0),
         (select count(*)::int from receipt_items i where i.receipt_id = r.id),
         (select count(*)::int from receipt_items i where i.receipt_id = r.id and i.edited_by_user),
         public.first_name(r.created_by), r.created_at
    from receipts r join trips t on t.id = r.trip_id
   where r.created_at >= s and (p_trip is null or r.trip_id = p_trip)
   order by r.created_at desc
   limit greatest(1, least(p_limit, 1000)) offset greatest(0, p_offset);
end $$;

-- ---------------------------------------------------------------------------
-- Payments (settlements), newest first
-- ---------------------------------------------------------------------------
create or replace function public.admin_settlements(p_since timestamptz default null, p_limit int default 200, p_offset int default 0, p_trip uuid default null)
returns table (
  id uuid, trip_id uuid, trip_title text, from_name text, to_name text, amount_cents int, currency text,
  status text, platform text, created_at timestamptz, marked_at timestamptz, confirmed_at timestamptz
) language plpgsql stable security definer set search_path = public, private as $$
declare s timestamptz := coalesce(p_since, '-infinity'::timestamptz);
begin
  perform private.require_admin();
  return query
  select x.id, x.trip_id, t.title, public.first_name(x.from_user), public.first_name(x.to_user), x.amount_cents, t.base_currency,
         x.status::text, x.platform::text, x.created_at, x.marked_at, x.confirmed_at
    from settlements x join trips t on t.id = x.trip_id
   where x.created_at >= s and (p_trip is null or x.trip_id = p_trip)
   order by x.created_at desc
   limit greatest(1, least(p_limit, 1000)) offset greatest(0, p_offset);
end $$;

-- ---------------------------------------------------------------------------
-- One Dazzle, whole: the archive entry
-- ---------------------------------------------------------------------------
create or replace function public.admin_trip_detail(p_trip uuid)
returns jsonb language plpgsql stable security definer set search_path = public, private as $$
declare r jsonb;
begin
  perform private.require_admin();
  select jsonb_build_object(
    'trip', (select jsonb_build_object('id', t.id, 'title', t.title, 'description', t.description, 'status', t.status, 'currency', t.base_currency,
                                       'start_date', t.start_date, 'end_date', t.end_date, 'created_at', t.created_at, 'settled_at', t.settled_at,
                                       'last_activity_at', t.last_activity_at, 'owner', public.first_name(t.created_by),
                                       'closeout_override_at', t.closeout_override_at)
               from trips t where t.id = p_trip),
    'members', (select coalesce(jsonb_agg(jsonb_build_object(
                  'user_id', m.user_id, 'name', coalesce(u.display_name, u.phone, 'No name yet'), 'email', u.email, 'phone', u.phone,
                  'role', m.role, 'done', m.done_at is not null, 'joined_at', m.joined_at, 'joined_via', m.joined_via, 'removed_at', m.removed_at,
                  'paid_cents', coalesce((select sum(p.base_amount_cents) from expense_payers p join expenses e on e.id = p.expense_id where e.trip_id = p_trip and e.deleted_at is null and p.user_id = m.user_id), 0),
                  'share_cents', coalesce((select sum(sh.base_share_cents) from expense_shares sh join expenses e on e.id = sh.expense_id where e.trip_id = p_trip and e.deleted_at is null and sh.user_id = m.user_id), 0)
                ) order by (m.role = 'owner') desc, m.joined_at), '[]'::jsonb)
                 from trip_members m join users u on u.id = m.user_id where m.trip_id = p_trip),
    'expenses', (select coalesce(jsonb_agg(jsonb_build_object(
                  'id', e.id, 'description', e.description, 'category', e.category, 'subcategory', e.subcategory,
                  'amount_cents', e.amount_cents, 'currency', e.currency, 'base_amount_cents', e.base_amount_cents, 'tip_cents', e.tip_cents,
                  'split_type', e.split_type, 'nights', e.nights, 'receipt_id', e.receipt_id, 'created_at', e.created_at, 'deleted_at', e.deleted_at,
                  'created_by', public.first_name(e.created_by),
                  'payers', (select coalesce(jsonb_agg(jsonb_build_object('name', public.first_name(p.user_id), 'cents', p.base_amount_cents) order by p.base_amount_cents desc), '[]'::jsonb) from expense_payers p where p.expense_id = e.id),
                  'shares', (select coalesce(jsonb_agg(jsonb_build_object('name', public.first_name(sh.user_id), 'cents', sh.base_share_cents) order by sh.base_share_cents desc), '[]'::jsonb) from expense_shares sh where sh.expense_id = e.id)
                ) order by e.created_at desc), '[]'::jsonb)
                 from expenses e where e.trip_id = p_trip),
    'settlements', (select coalesce(jsonb_agg(jsonb_build_object(
                  'id', x.id, 'from_name', public.first_name(x.from_user), 'to_name', public.first_name(x.to_user), 'amount_cents', x.amount_cents,
                  'status', x.status, 'platform', x.platform, 'created_at', x.created_at, 'marked_at', x.marked_at, 'confirmed_at', x.confirmed_at
                ) order by x.created_at), '[]'::jsonb)
                 from settlements x where x.trip_id = p_trip),
    'receipts', (select coalesce(jsonb_agg(jsonb_build_object(
                  'id', r.id, 'storage_path', r.storage_path, 'status', r.status, 'model', r.model, 'merchant', r.merchant, 'receipt_date', r.receipt_date,
                  'printed_total_cents', r.printed_total_cents, 'currency', r.currency, 'cost_usd', coalesce(r.cost_estimate_usd, 0), 'expense_id', r.expense_id,
                  'created_by', public.first_name(r.created_by), 'created_at', r.created_at,
                  'items', (select coalesce(jsonb_agg(jsonb_build_object('name', i.name, 'cents', i.line_total_cents, 'kind', i.kind, 'edited', i.edited_by_user) order by i.position), '[]'::jsonb) from receipt_items i where i.receipt_id = r.id)
                ) order by r.created_at desc), '[]'::jsonb)
                 from receipts r where r.trip_id = p_trip),
    'invites', (select coalesce(jsonb_agg(jsonb_build_object('phone', i.phone, 'status', i.status, 'invited_by', public.first_name(i.invited_by), 'created_at', i.created_at) order by i.created_at), '[]'::jsonb)
                 from invites i where i.trip_id = p_trip),
    'history', (select coalesce(jsonb_agg(jsonb_build_object('action', h.action, 'actor', public.first_name(h.actor_id), 'expense_id', h.expense_id, 'at', h.at) order by h.at desc), '[]'::jsonb)
                 from (select * from expense_history where trip_id = p_trip order by at desc limit 200) h)
  ) into r;
  return r;
end $$;

-- ---------------------------------------------------------------------------
-- An admin may look at any receipt or cover photo (read only). The portal asks
-- for a short signed URL as the signed-in admin; nothing is made public.
-- ---------------------------------------------------------------------------
drop policy if exists admin_reads_receipts on storage.objects;
create policy admin_reads_receipts on storage.objects for select
  using (bucket_id in ('receipts', 'covers') and public.is_admin());

do $$
declare f text;
begin
  foreach f in array array[
    'admin_expenses(timestamptz,int,int,uuid)', 'admin_receipts(timestamptz,int,int,uuid)',
    'admin_settlements(timestamptz,int,int,uuid)', 'admin_trip_detail(uuid)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
