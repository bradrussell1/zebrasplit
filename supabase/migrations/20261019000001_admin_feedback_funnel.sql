-- ---------------------------------------------------------------------------
-- Groundwork for the admin portal on the marketing site:
--   1. who counts as an admin, and admin-only read access
--   2. feedback, from inside the app and from the website form
--   3. the receipt models, moved out of Edge Function env vars so they can be
--      swapped without a redeploy
--   4. onboarding events, which the existing allow-list could not accept
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 1. Admins
--
-- Membership is a row in a private table, not a column on public.users, so a
-- member of your Dazzle can never read who the admins are.
-- ---------------------------------------------------------------------------
create table if not exists private.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  added_at timestamptz not null default now(),
  note text
);

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = private, public as $$
  select exists (select 1 from private.admins a where a.user_id = auth.uid());
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

comment on function public.is_admin() is
  'True when the caller is in private.admins. The admin portal gates every read on this, so the database enforces it rather than the page.';

-- ---------------------------------------------------------------------------
-- 2. Feedback
--
-- Two sources: signed-in users from inside the app, and anyone from the form on
-- the website. The website path takes an email because there is no session to
-- read one from; the in-app path ignores whatever it is sent and uses the
-- account's own address.
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.feedback_source as enum ('app', 'web');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.feedback_status as enum ('new', 'reading', 'done', 'wontfix');
exception when duplicate_object then null;
end $$;

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users (id) on delete set null,
  email text,
  title text not null check (btrim(title) <> '' and length(title) <= 120),
  body text not null check (btrim(body) <> '' and length(body) <= 4000),
  source public.feedback_source not null default 'web',
  status public.feedback_status not null default 'new',
  platform text,
  app_version text,
  created_at timestamptz not null default now(),
  handled_at timestamptz
);
create index if not exists feedback_status_created on public.feedback (status, created_at desc);

alter table public.feedback enable row level security;

-- nobody reads feedback through the API; the portal reads it as an admin
drop policy if exists feedback_admin_read on public.feedback;
create policy feedback_admin_read on public.feedback for select using (public.is_admin());

drop policy if exists feedback_admin_update on public.feedback;
create policy feedback_admin_update on public.feedback for update using (public.is_admin()) with check (public.is_admin());

-- Writes go through this function so neither caller can set status, user_id or
-- timestamps, and so the in-app path cannot spoof somebody else's address.
create or replace function public.submit_feedback(
  p_title text,
  p_body text,
  p_email text default null,
  p_platform text default null,
  p_app_version text default null
) returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_email text; v_source public.feedback_source;
begin
  if btrim(coalesce(p_title, '')) = '' or btrim(coalesce(p_body, '')) = '' then
    raise exception 'feedback needs a title and a description' using errcode = '22023';
  end if;

  if v_uid is null then
    v_source := 'web';
    v_email := nullif(btrim(lower(p_email)), '');
    if v_email is null or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
      raise exception 'enter an email address we can reply to' using errcode = '22023';
    end if;
  else
    v_source := 'app';
    -- the account's own address, never what the client sent
    select u.email into v_email from public.users u where u.id = v_uid;
  end if;

  insert into public.feedback (user_id, email, title, body, source, platform, app_version)
  values (v_uid, v_email, left(btrim(p_title), 120), left(btrim(p_body), 4000), v_source,
          left(p_platform, 20), left(p_app_version, 40));
end $$;

revoke all on function public.submit_feedback(text, text, text, text, text) from public;
grant execute on function public.submit_feedback(text, text, text, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Receipt models as configuration
--
-- receipt-parse read RECEIPT_MODEL / RECEIPT_RETRY_MODEL from its environment,
-- so changing a model meant redeploying the function. They live here now and
-- receipt_settings() hands them to the worker, which keeps the env vars as a
-- fallback for anything not yet written.
-- ---------------------------------------------------------------------------
insert into private.config (key, value) values ('receipt_model', 'claude-sonnet-5') on conflict (key) do nothing;
insert into private.config (key, value) values ('receipt_retry_model', 'claude-opus-5') on conflict (key) do nothing;

create or replace function public.receipt_settings()
returns jsonb language sql stable security definer set search_path = private as $$
  select jsonb_build_object(
    'ai_enabled', coalesce(private.config_get('receipt_ai_enabled'), 'true') = 'true',
    'daily_limit', coalesce(nullif(private.config_get('receipt_daily_limit'), '')::int, 30),
    'model', nullif(private.config_get('receipt_model'), ''),
    'retry_model', nullif(private.config_get('receipt_retry_model'), '')
  );
$$;
revoke all on function public.receipt_settings() from public;
grant execute on function public.receipt_settings() to authenticated, service_role;

-- Admin-only read and write of the whole settings block, for the Models tab.
create or replace function public.admin_settings()
returns jsonb language sql stable security definer set search_path = private, public as $$
  select case when public.is_admin() then (
    select jsonb_object_agg(key, value) from private.config
     where key in ('receipt_ai_enabled', 'receipt_daily_limit', 'receipt_model', 'receipt_retry_model')
  ) else null end;
$$;
revoke all on function public.admin_settings() from public, anon;
grant execute on function public.admin_settings() to authenticated;

create or replace function public.admin_set_setting(p_key text, p_value text)
returns void language plpgsql security definer set search_path = private, public as $$
begin
  if not public.is_admin() then raise exception 'admins only' using errcode = '42501'; end if;
  if p_key not in ('receipt_ai_enabled', 'receipt_daily_limit', 'receipt_model', 'receipt_retry_model') then
    raise exception 'unknown setting %', p_key using errcode = '22023';
  end if;
  insert into private.config (key, value) values (p_key, p_value)
  on conflict (key) do update set value = excluded.value;
end $$;
revoke all on function public.admin_set_setting(text, text) from public, anon;
grant execute on function public.admin_set_setting(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Onboarding events
--
-- The old log_event allow-listed eight receipt events and returned early when
-- auth.uid() was null — which dropped every event from a signed-out user, and
-- signed out is exactly where onboarding happens. Anonymous events are now
-- accepted for the onboarding names only, keyed by a client-generated id so a
-- funnel can be followed without knowing who the person is.
-- ---------------------------------------------------------------------------
alter table public.client_events add column if not exists anon_id text;
create index if not exists client_events_anon on public.client_events (anon_id, at) where anon_id is not null;

create or replace function public.log_event(
  p_name text,
  p_props jsonb default '{}'::jsonb,
  p_platform text default null,
  p_app_version text default null,
  p_anon_id text default null
) returns void language plpgsql security definer set search_path = public as $$
declare v_onboarding boolean;
begin
  v_onboarding := p_name in (
    'onboarding_landing_seen', 'onboarding_signup_started', 'onboarding_phone_entered',
    'onboarding_code_sent', 'onboarding_code_verified', 'onboarding_profile_saved',
    'onboarding_payment_added', 'onboarding_finished',
    'login_started', 'login_succeeded'
  );

  if not v_onboarding and p_name not in (
    'receipt_scan_started', 'receipt_read_ready', 'receipt_read_failed', 'receipt_line_edited',
    'tip_selected', 'split_method_chosen', 'split_rest_used', 'receipt_expense_saved',
    'trip_created', 'invite_sent', 'expense_added', 'done_tapped', 'closeout_opened', 'payment_opened'
  ) then
    return;
  end if;

  -- receipt and activity events still need a session; onboarding does not,
  -- because most of it happens before there is one
  if auth.uid() is null and not v_onboarding then return; end if;

  if pg_column_size(p_props) > 2048 then p_props := '{}'::jsonb; end if;
  insert into public.client_events (name, props, platform, app_version, anon_id)
  values (p_name, coalesce(p_props, '{}'::jsonb), left(p_platform, 20), left(p_app_version, 40), left(p_anon_id, 64));
end $$;

grant execute on function public.log_event(text, jsonb, text, text, text) to anon, authenticated;

-- client_events has no read policy, so the portal reads through this instead.
create or replace function public.admin_funnel(p_since timestamptz default now() - interval '30 days')
returns table (step text, step_order int, people bigint) language sql stable security definer set search_path = public as $$
  with steps(step, step_order) as (
    values ('onboarding_landing_seen', 1), ('onboarding_signup_started', 2), ('onboarding_phone_entered', 3),
           ('onboarding_code_sent', 4), ('onboarding_code_verified', 5), ('onboarding_profile_saved', 6),
           ('onboarding_payment_added', 7), ('onboarding_finished', 8)
  )
  select s.step, s.step_order,
         count(distinct coalesce(e.anon_id, e.id::text)) filter (where e.name = s.step) as people
    from steps s left join public.client_events e on e.name = s.step and e.at >= p_since
   where public.is_admin()
   group by s.step, s.step_order
   order by s.step_order;
$$;
revoke all on function public.admin_funnel(timestamptz) from public, anon;
grant execute on function public.admin_funnel(timestamptz) to authenticated;
