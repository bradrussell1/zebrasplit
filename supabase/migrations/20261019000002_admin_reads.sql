-- ---------------------------------------------------------------------------
-- Reads for the admin portal.
--
-- Every table in the app is scoped to trip members by row-level security, which
-- is exactly right for the app and useless for an owner looking at the whole
-- business. These functions are the only way past it: each one is security
-- definer and each one starts by checking public.is_admin(), so the gate is in
-- the database and not in the page.
-- ---------------------------------------------------------------------------

create or replace function private.require_admin() returns void
language plpgsql stable set search_path = public, private as $$
begin
  if not public.is_admin() then raise exception 'admins only' using errcode = '42501'; end if;
end $$;

-- ---------------------------------------------------------------------------
-- Overview
-- ---------------------------------------------------------------------------
create or replace function public.admin_overview()
returns jsonb language plpgsql stable security definer set search_path = public, private as $$
declare r jsonb;
begin
  perform private.require_admin();
  select jsonb_build_object(
    'users', jsonb_build_object(
      'total', (select count(*) from users where deleted_at is null),
      'new_7d', (select count(*) from users where deleted_at is null and created_at >= now() - interval '7 days'),
      'with_payment', (select count(distinct user_id) from payment_handles)
    ),
    'trips', jsonb_build_object(
      'total', (select count(*) from trips),
      'open', (select count(*) from trips where status = 'open'),
      'settled', (select count(*) from trips where status = 'settled'),
      'archived', (select count(*) from trips where status = 'archived'),
      'new_7d', (select count(*) from trips where created_at >= now() - interval '7 days')
    ),
    'expenses', jsonb_build_object(
      'total', (select count(*) from expenses where deleted_at is null),
      'cents', (select coalesce(sum(base_amount_cents), 0) from expenses where deleted_at is null),
      'new_7d', (select count(*) from expenses where deleted_at is null and created_at >= now() - interval '7 days')
    ),
    'settlements', jsonb_build_object(
      'total', (select count(*) from settlements),
      'cents', (select coalesce(sum(amount_cents), 0) from settlements),
      'paid', (select count(*) from settlements where status <> 'pending')
    ),
    'receipts', jsonb_build_object(
      'total', (select count(*) from receipts),
      'cost_usd', (select coalesce(sum(cost_estimate_usd), 0) from receipts),
      'failed', (select count(*) from receipts where status = 'failed')
    ),
    'feedback_new', (select count(*) from feedback where status = 'new'),
    'invites', jsonb_build_object(
      'total', (select count(*) from invites),
      'accepted', (select count(*) from invites where status = 'accepted')
    )
  ) into r;
  return r;
end $$;

-- ---------------------------------------------------------------------------
-- Users
-- ---------------------------------------------------------------------------
create or replace function public.admin_users(p_search text default null, p_limit int default 100, p_offset int default 0)
returns table (
  id uuid, display_name text, email text, phone text, created_at timestamptz,
  platforms text[], trips bigint, expenses bigint, last_active timestamptz
) language plpgsql stable security definer set search_path = public, private as $$
begin
  perform private.require_admin();
  return query
  select u.id, u.display_name, u.email, u.phone, u.created_at,
         array(select h.platform::text from payment_handles h where h.user_id = u.id order by h.platform),
         (select count(*) from trip_members m where m.user_id = u.id and m.removed_at is null),
         (select count(*) from expenses e where e.created_by = u.id and e.deleted_at is null),
         (select max(m.last_active_at) from trip_members m where m.user_id = u.id)
    from users u
   where u.deleted_at is null
     and (p_search is null or btrim(p_search) = ''
          or u.display_name ilike '%' || p_search || '%'
          or u.email ilike '%' || p_search || '%'
          or u.phone like '%' || p_search || '%')
   order by u.created_at desc
   limit greatest(1, least(p_limit, 500)) offset greatest(0, p_offset);
end $$;

-- ---------------------------------------------------------------------------
-- Trips and the money inside them
-- ---------------------------------------------------------------------------
create or replace function public.admin_trips(p_limit int default 100, p_offset int default 0)
returns table (
  id uuid, title text, status text, base_currency text, created_at timestamptz,
  members bigint, done bigint, expenses bigint, cents bigint, settled_cents bigint
) language plpgsql stable security definer set search_path = public, private as $$
begin
  perform private.require_admin();
  return query
  select t.id, t.title, t.status::text, t.base_currency, t.created_at,
         (select count(*) from trip_members m where m.trip_id = t.id and m.removed_at is null),
         (select count(*) from trip_members m where m.trip_id = t.id and m.removed_at is null and m.done_at is not null),
         (select count(*) from expenses e where e.trip_id = t.id and e.deleted_at is null),
         (select coalesce(sum(e.base_amount_cents), 0) from expenses e where e.trip_id = t.id and e.deleted_at is null),
         (select coalesce(sum(s.amount_cents), 0) from settlements s where s.trip_id = t.id and s.status <> 'pending')
    from trips t
   order by t.created_at desc
   limit greatest(1, least(p_limit, 500)) offset greatest(0, p_offset);
end $$;

create or replace function public.admin_categories()
returns table (category text, subcategory text, expenses bigint, cents bigint, share numeric)
language plpgsql stable security definer set search_path = public, private as $$
begin
  perform private.require_admin();
  return query
  with total as (select nullif(sum(base_amount_cents), 0) as c from expenses where deleted_at is null)
  select e.category, coalesce(e.subcategory, '—'), count(*), coalesce(sum(e.base_amount_cents), 0),
         round(coalesce(sum(e.base_amount_cents), 0)::numeric / (select c from total), 4)
    from expenses e
   where e.deleted_at is null
   group by e.category, e.subcategory
   order by 4 desc;
end $$;

create or replace function public.admin_split_types()
returns table (split_type text, expenses bigint, cents bigint)
language plpgsql stable security definer set search_path = public, private as $$
begin
  perform private.require_admin();
  return query
  select e.split_type::text, count(*), coalesce(sum(e.base_amount_cents), 0)
    from expenses e where e.deleted_at is null
   group by e.split_type order by 2 desc;
end $$;

-- ---------------------------------------------------------------------------
-- Models: what the receipt reader is costing and how often it is corrected
-- ---------------------------------------------------------------------------
create or replace function public.admin_models()
returns table (
  model text, receipts bigint, reconciled bigint, failed bigint,
  cost_usd numeric, lines_read bigint, lines_edited bigint, correction_rate numeric
) language plpgsql stable security definer set search_path = public, private as $$
begin
  perform private.require_admin();
  return query
  select coalesce(r.model, '—') as model,
         count(distinct r.id),
         count(distinct r.id) filter (where r.reconciled),
         count(distinct r.id) filter (where r.status = 'failed'),
         round(coalesce(sum(distinct r.cost_estimate_usd), 0), 4),
         count(i.id),
         count(i.id) filter (where i.edited_by_user),
         round(count(i.id) filter (where i.edited_by_user)::numeric / nullif(count(i.id), 0), 4)
    from receipts r left join receipt_items i on i.receipt_id = r.id
   group by r.model
   order by 2 desc;
end $$;

-- ---------------------------------------------------------------------------
-- Integrations: what the database can actually tell us about them. Anything
-- needing a live probe (Twilio balance, Sentry) is checked by the page itself.
-- ---------------------------------------------------------------------------
create or replace function public.admin_integrations()
returns jsonb language plpgsql stable security definer set search_path = public, private as $$
declare r jsonb;
begin
  perform private.require_admin();
  select jsonb_build_object(
    'sms', jsonb_build_object(
      'invites_sent', (select count(*) from invites),
      'last_invite', (select max(created_at) from invites)
    ),
    'push', jsonb_build_object(
      'devices', (select count(*) from devices),
      'notifications', (select count(*) from notification_log),
      'last_notification', (select max(created_at) from notification_log)
    ),
    'ai', jsonb_build_object(
      'receipts', (select count(*) from receipts),
      'last_receipt', (select max(created_at) from receipts),
      'settings', public.admin_settings()
    ),
    'events', jsonb_build_object(
      'total', (select count(*) from client_events),
      'last', (select max(at) from client_events)
    )
  ) into r;
  return r;
end $$;

-- ---------------------------------------------------------------------------
-- Feedback: the table already allows an admin to select and update, so the
-- portal reads it directly. This is just the status change, so the page cannot
-- write anything else.
-- ---------------------------------------------------------------------------
create or replace function public.admin_set_feedback_status(p_id uuid, p_status public.feedback_status)
returns void language plpgsql security definer set search_path = public, private as $$
begin
  perform private.require_admin();
  update feedback
     set status = p_status,
         handled_at = case when p_status in ('done', 'wontfix') then now() else null end
   where id = p_id;
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'admin_overview()', 'admin_users(text,int,int)', 'admin_trips(int,int)', 'admin_categories()',
    'admin_split_types()', 'admin_models()', 'admin_integrations()',
    'admin_set_feedback_status(uuid,public.feedback_status)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
