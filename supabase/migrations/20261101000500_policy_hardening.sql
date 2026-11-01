-- Lumio · 0005 · Hardening after Supabase advisor review
-- 1. Authorisation helpers move to the private schema so they are not
--    callable as /rest/v1/rpc endpoints. Policies reference functions by OID,
--    so existing policies keep working.
-- 2. One permissive SELECT policy per table/role (combined with OR), and
--    staff write policies split per command, to avoid evaluating several
--    policies on every read.
-- 3. Covering indexes for foreign keys.

alter function public.is_staff(public.staff_role) set schema private;
alter function public.parent_can_view(uuid, public.report_scope) set schema private;

-- SQL function bodies resolve names at call time, so this one must point at
-- the helper's new location.
create or replace function private.specification_is_visible(spec uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.specifications s
    where s.id = spec and (s.status = 'published' or private.is_staff())
  );
$$;

-- ---------------------------------------------------------------------------
-- Consolidated read policies
-- ---------------------------------------------------------------------------
drop policy "profiles: read own" on public.profiles;
drop policy "profiles: staff read" on public.profiles;
drop policy "profiles: read linked" on public.profiles;
create policy "profiles: read own, linked or staff" on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select private.is_linked_with(id)) or (select private.is_staff()));

drop policy "student_profiles: read own" on public.student_profiles;
drop policy "student_profiles: parent reads linked child" on public.student_profiles;
create policy "student_profiles: read own or linked parent" on public.student_profiles for select to authenticated
  using (profile_id = (select auth.uid()) or (select private.parent_can_view(profile_id, 'activity')));

drop policy "student_subjects: own" on public.student_subjects;
drop policy "student_subjects: parent reads linked" on public.student_subjects;
create policy "student_subjects: read own or linked parent" on public.student_subjects for select to authenticated
  using (student_id = (select auth.uid()) or (select private.parent_can_view(student_id, 'activity')));
create policy "student_subjects: insert own" on public.student_subjects for insert to authenticated
  with check (student_id = (select auth.uid()));
create policy "student_subjects: update own" on public.student_subjects for update to authenticated
  using (student_id = (select auth.uid())) with check (student_id = (select auth.uid()));
create policy "student_subjects: delete own" on public.student_subjects for delete to authenticated
  using (student_id = (select auth.uid()));

drop policy "subscriptions: owner read" on public.subscriptions;
drop policy "subscriptions: staff read" on public.subscriptions;
create policy "subscriptions: owner or staff read" on public.subscriptions for select to authenticated
  using (owner_id = (select auth.uid()) or (select private.is_staff()));

drop policy "usage: owner read" on public.usage_events;
drop policy "usage: staff read" on public.usage_events;
create policy "usage: owner or staff read" on public.usage_events for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_staff()));

-- ---------------------------------------------------------------------------
-- Curriculum: staff write policies per command (no SELECT overlap)
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
  short text;
begin
  foreach t in array array['qualifications', 'exam_boards', 'subjects', 'specifications',
                           'curriculum_modules', 'curriculum_topics', 'learning_objectives', 'assessment_criteria']
  loop
    short := case t
      when 'curriculum_modules' then 'modules'
      when 'curriculum_topics' then 'topics'
      when 'learning_objectives' then 'objectives'
      when 'assessment_criteria' then 'criteria'
      else t end;
    execute format('drop policy %I on public.%I', short || ': staff write', t);
    execute format('create policy %I on public.%I for insert to authenticated with check ((select private.is_staff(''admin'')))',
                   short || ': staff insert', t);
    execute format('create policy %I on public.%I for update to authenticated using ((select private.is_staff(''admin''))) with check ((select private.is_staff(''admin'')))',
                   short || ': staff update', t);
    execute format('create policy %I on public.%I for delete to authenticated using ((select private.is_staff(''admin'')))',
                   short || ': staff delete', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Foreign-key indexes
-- ---------------------------------------------------------------------------
create index staff_members_granted_by_idx on private.staff_members (granted_by);
create index specifications_subject_idx on public.specifications (subject_id);
create index subscriptions_plan_idx on public.subscriptions (plan_id);
create index usage_events_plan_idx on public.usage_events (plan_id);
