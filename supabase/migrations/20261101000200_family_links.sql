-- Lumio · 0002 · Parent ↔ student links and reporting scopes
-- A parent sees a child's data only through an ACTIVE link, and only for the
-- scopes that link grants. Private tutor conversations are NOT shared by
-- default (Children's Code: privacy by default, especially for older students).

create type public.link_status as enum ('pending', 'active', 'revoked');
create type public.link_initiator as enum ('parent', 'student');
create type public.report_scope as enum ('activity', 'results', 'conversations');

create table public.parent_student_links (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references public.profiles (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  status public.link_status not null default 'pending',
  initiated_by public.link_initiator not null,
  -- Only a SHA-256 hash of the one-time invite code is stored.
  invite_code_hash text unique,
  invite_expires_at timestamptz,
  share_activity boolean not null default true,
  share_results boolean not null default true,
  share_conversations boolean not null default false,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint parent_student_links_distinct check (parent_id <> student_id),
  constraint parent_student_links_unique unique (parent_id, student_id),
  constraint parent_student_links_active_has_acceptance
    check (status <> 'active' or accepted_at is not null)
);

create index parent_student_links_student_idx on public.parent_student_links (student_id) where status = 'active';
create index parent_student_links_parent_idx on public.parent_student_links (parent_id) where status = 'active';

create trigger parent_student_links_touch_updated_at
  before update on public.parent_student_links
  for each row execute function private.touch_updated_at();

-- Both ends must hold the right role.
create or replace function private.enforce_link_roles()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select role from public.profiles where id = new.parent_id) is distinct from 'parent' then
    raise exception 'parent_id must reference a parent account';
  end if;
  if (select role from public.profiles where id = new.student_id) is distinct from 'student' then
    raise exception 'student_id must reference a student account';
  end if;
  return new;
end;
$$;

create trigger parent_student_links_enforce_roles
  before insert or update of parent_id, student_id on public.parent_student_links
  for each row execute function private.enforce_link_roles();

-- ---------------------------------------------------------------------------
-- Authorisation helpers used by RLS policies across the schema.
-- SECURITY DEFINER avoids recursive policy evaluation; both read auth.uid()
-- themselves so a caller cannot ask on someone else's behalf.
-- ---------------------------------------------------------------------------
create or replace function public.parent_can_view(target_student uuid, scope public.report_scope)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.parent_student_links l
    where l.parent_id = (select auth.uid())
      and l.student_id = target_student
      and l.status = 'active'
      and case scope
        when 'activity' then l.share_activity
        when 'results' then l.share_results
        when 'conversations' then l.share_conversations
      end
  );
$$;

create or replace function private.is_linked_with(other uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.parent_student_links l
    where l.status = 'active'
      and ((l.parent_id = (select auth.uid()) and l.student_id = other)
        or (l.student_id = (select auth.uid()) and l.parent_id = other))
  );
$$;

revoke all on function public.parent_can_view(uuid, public.report_scope) from public, anon;
grant execute on function public.parent_can_view(uuid, public.report_scope) to authenticated, service_role;
revoke all on function private.is_linked_with(uuid) from public, anon;
grant execute on function private.is_linked_with(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Privileges and policies
-- Creating, accepting and revoking links goes through verified server actions
-- (Phase 2) using the service role, so authenticated users get read access plus
-- a narrowly-scoped student control over sharing preferences.
-- ---------------------------------------------------------------------------
revoke all on public.parent_student_links from anon, authenticated;
grant select (id, parent_id, student_id, status, initiated_by, invite_expires_at,
              share_activity, share_results, share_conversations, accepted_at, revoked_at, created_at, updated_at)
  on public.parent_student_links to authenticated;
grant update (share_activity, share_results, share_conversations) on public.parent_student_links to authenticated;

alter table public.parent_student_links enable row level security;

create policy "links: read own" on public.parent_student_links
  for select to authenticated
  using (parent_id = (select auth.uid()) or student_id = (select auth.uid()));

-- Only the student controls what is shared with a linked parent.
create policy "links: student controls sharing" on public.parent_student_links
  for update to authenticated
  using (student_id = (select auth.uid()))
  with check (student_id = (select auth.uid()));

-- Linked accounts can see each other's basic profile (name, role).
create policy "profiles: read linked" on public.profiles
  for select to authenticated using ((select private.is_linked_with(id)));

create policy "student_profiles: parent reads linked child" on public.student_profiles
  for select to authenticated using ((select public.parent_can_view(profile_id, 'activity')));
