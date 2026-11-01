-- Lumio · 0001 · Identity foundation
-- Profiles for every auth user, role-specific profiles, staff roles and shared helpers.
-- Principle: deny by default. Every table enables RLS, privileges are granted
-- explicitly per column where users may write.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type public.account_role as enum ('student', 'parent');

-- Age bands rather than dates of birth (data minimisation, UK GDPR art. 5).
-- 'under_13' triggers the parental-consent flow (UK age of digital consent is 13).
create type public.age_band as enum ('under_13', '13_15', '16_17', '18_plus');

create type public.consent_status as enum ('not_required', 'pending', 'granted', 'withdrawn');

create type public.staff_role as enum ('admin', 'support');

-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------
create or replace function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Staff (internal admin) — lives in the private schema, never exposed via the API.
-- Rows are only ever inserted manually or by service-role tooling.
-- ---------------------------------------------------------------------------
create table private.staff_members (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role public.staff_role not null,
  granted_by uuid references auth.users (id) on delete set null,
  granted_at timestamptz not null default now()
);

create or replace function public.is_staff(required public.staff_role default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from private.staff_members s
    where s.user_id = (select auth.uid())
      and (required is null or s.role = required or s.role = 'admin')
  );
$$;

revoke all on function public.is_staff(public.staff_role) from public, anon;
grant execute on function public.is_staff(public.staff_role) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.account_role not null,
  display_name text check (display_name is null or char_length(display_name) between 1 and 60),
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function private.touch_updated_at();

create table public.student_profiles (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  first_name text check (first_name is null or char_length(first_name) between 1 and 40),
  age_band public.age_band,
  school_year smallint check (school_year is null or school_year between 7 and 14),
  learning_preferences text[] not null default '{}'
    check (learning_preferences <@ array['visual', 'conversational', 'detailed', 'simplified', 'question_led', 'example_based']::text[]),
  weekly_study_minutes_goal smallint check (weekly_study_minutes_goal is null or weekly_study_minutes_goal between 0 and 6000),
  timezone text not null default 'Europe/London',
  parental_consent public.consent_status not null default 'not_required',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger student_profiles_touch_updated_at
  before update on public.student_profiles
  for each row execute function private.touch_updated_at();

create table public.parent_profiles (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  first_name text check (first_name is null or char_length(first_name) between 1 and 40),
  weekly_report_opt_in boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger parent_profiles_touch_updated_at
  before update on public.parent_profiles
  for each row execute function private.touch_updated_at();

-- ---------------------------------------------------------------------------
-- New-user bootstrap. The role comes from sign-up metadata but is validated:
-- only 'student' or 'parent' are accepted, never staff. Staff access is granted
-- separately in private.staff_members.
-- ---------------------------------------------------------------------------
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_role text := new.raw_user_meta_data ->> 'account_role';
  resolved_role public.account_role;
  first_name text := nullif(btrim(left(new.raw_user_meta_data ->> 'first_name', 40)), '');
begin
  resolved_role := case when requested_role = 'parent' then 'parent' else 'student' end;

  insert into public.profiles (id, role, display_name)
  values (new.id, resolved_role, first_name);

  if resolved_role = 'student' then
    insert into public.student_profiles (profile_id, first_name) values (new.id, first_name);
  else
    insert into public.parent_profiles (profile_id, first_name) values (new.id, first_name);
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- ---------------------------------------------------------------------------
-- Privileges: start from nothing, grant only what is needed.
-- ---------------------------------------------------------------------------
revoke all on public.profiles, public.student_profiles, public.parent_profiles from anon, authenticated;

grant select on public.profiles to authenticated;
grant update (display_name, onboarding_completed_at) on public.profiles to authenticated;

grant select on public.student_profiles to authenticated;
grant update (first_name, age_band, school_year, learning_preferences, weekly_study_minutes_goal, timezone)
  on public.student_profiles to authenticated;

grant select on public.parent_profiles to authenticated;
grant update (first_name, weekly_report_opt_in) on public.parent_profiles to authenticated;

-- `role` and `parental_consent` are deliberately not updatable by users.

alter table public.profiles enable row level security;
alter table public.student_profiles enable row level security;
alter table public.parent_profiles enable row level security;

create policy "profiles: read own" on public.profiles
  for select to authenticated using (id = (select auth.uid()));

create policy "profiles: update own" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "profiles: staff read" on public.profiles
  for select to authenticated using ((select public.is_staff()));

create policy "student_profiles: read own" on public.student_profiles
  for select to authenticated using (profile_id = (select auth.uid()));

create policy "student_profiles: update own" on public.student_profiles
  for update to authenticated
  using (profile_id = (select auth.uid())) with check (profile_id = (select auth.uid()));

create policy "parent_profiles: read own" on public.parent_profiles
  for select to authenticated using (profile_id = (select auth.uid()));

create policy "parent_profiles: update own" on public.parent_profiles
  for update to authenticated
  using (profile_id = (select auth.uid())) with check (profile_id = (select auth.uid()));
