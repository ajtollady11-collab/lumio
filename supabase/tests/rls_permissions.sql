-- Lumio · Row Level Security permission tests
--
-- Runs entirely inside one transaction and rolls back, so it is safe to run
-- against any environment. Every assertion raises on failure; a clean run ends
-- with the NOTICE "RLS permission tests: all passed".
--
-- Run: paste into the Supabase SQL editor, or `psql "$DATABASE_URL" -f supabase/tests/rls_permissions.sql`

begin;

-- ---------------------------------------------------------------------------
-- Fixtures (created as the migration owner; the auth trigger builds profiles)
-- ---------------------------------------------------------------------------
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
  ('00000000-0000-4000-8000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'student.a@test.lumio', '{"account_role":"student","first_name":"Ava"}', now(), now()),
  ('00000000-0000-4000-8000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'student.b@test.lumio', '{"account_role":"student","first_name":"Ben"}', now(), now()),
  ('00000000-0000-4000-8000-00000000000c', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'parent.p@test.lumio', '{"account_role":"parent","first_name":"Pat"}', now(), now()),
  ('00000000-0000-4000-8000-00000000000d', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'sneaky@test.lumio', '{"account_role":"admin","first_name":"Eve"}', now(), now()),
  ('00000000-0000-4000-8000-00000000000e', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'staff@test.lumio', '{"account_role":"student","first_name":"Sam"}', now(), now());

insert into private.staff_members (user_id, role) values ('00000000-0000-4000-8000-00000000000e', 'admin');

-- Sign-up metadata cannot grant elevated roles.
do $$ begin
  assert (select role from public.profiles where id = '00000000-0000-4000-8000-00000000000d') = 'student',
    'account_role=admin in metadata must resolve to student';
  assert (select count(*) from public.parent_profiles where profile_id = '00000000-0000-4000-8000-00000000000c') = 1,
    'parent sign-up must create a parent_profiles row';
end $$;

-- Link rows must join a parent to a student.
do $$ begin
  begin
    insert into public.parent_student_links (parent_id, student_id, initiated_by)
    values ('00000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-00000000000b', 'parent');
    raise exception 'student-to-student link must be rejected';
  exception when raise_exception then
    if sqlerrm like 'student-to-student%' then raise; end if;
  end;
end $$;

create or replace function pg_temp.act_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

-- ---------------------------------------------------------------------------
-- Student A: sees only their own data
-- ---------------------------------------------------------------------------
set local role authenticated;
select pg_temp.act_as('00000000-0000-4000-8000-00000000000a');

do $$ begin
  assert (select count(*) from public.profiles) = 1, 'student A must see exactly one profile (their own)';
  assert (select count(*) from public.student_profiles) = 1, 'student A must see only their own student profile';
  assert not exists (select 1 from public.student_profiles where profile_id = '00000000-0000-4000-8000-00000000000b'),
    'student A must not see student B';
  assert (select count(*) from public.parent_student_links) = 0, 'student A has no links yet';
  assert (select count(*) from public.subjects) >= 13, 'curriculum vocabulary is readable';
  assert (select count(*) from public.audit_logs) = 0, 'students cannot read audit logs';
end $$;

-- Updating another student changes nothing.
update public.student_profiles set first_name = 'Hacked' where profile_id = '00000000-0000-4000-8000-00000000000b';

-- Role is not a writable column.
do $$ begin
  begin
    update public.profiles set role = 'parent' where id = '00000000-0000-4000-8000-00000000000a';
    raise exception 'role escalation must be denied';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Parental consent status is not self-service.
do $$ begin
  begin
    update public.student_profiles set parental_consent = 'granted' where profile_id = '00000000-0000-4000-8000-00000000000a';
    raise exception 'consent self-grant must be denied';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Usage, subscriptions and audit are service-role writes only.
do $$ begin
  begin
    insert into public.usage_events (user_id, feature) values ('00000000-0000-4000-8000-00000000000a', 'tutor.chat');
    raise exception 'usage insert must be denied';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.subscriptions (owner_id, plan_id, status) values ('00000000-0000-4000-8000-00000000000a', 'premium', 'active');
    raise exception 'self-granted subscription must be denied';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.audit_logs (action) values ('forged.entry');
    raise exception 'audit insert must be denied';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Staff table is invisible to users.
do $$ begin
  begin
    perform 1 from private.staff_members;
    raise exception 'staff_members must not be readable';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Non-staff cannot write curriculum.
do $$ begin
  begin
    insert into public.subjects (slug, name) values ('forged', 'Forged');
    raise exception 'non-staff curriculum write must be denied';
  exception when insufficient_privilege then null;  -- RLS violation (42501)
  end;
end $$;

reset role;
do $$ begin
  assert (select first_name from public.student_profiles where profile_id = '00000000-0000-4000-8000-00000000000b') = 'Ben',
    'cross-student update must have had no effect';
end $$;

-- ---------------------------------------------------------------------------
-- Parent: nothing without an ACTIVE link
-- ---------------------------------------------------------------------------
set local role authenticated;
select pg_temp.act_as('00000000-0000-4000-8000-00000000000c');
do $$ begin
  assert (select count(*) from public.student_profiles) = 0, 'unlinked parent must see no students';
  assert (select count(*) from public.profiles) = 1, 'unlinked parent sees only themselves';
end $$;
reset role;

insert into public.parent_student_links (id, parent_id, student_id, initiated_by, status)
values ('00000000-0000-4000-8000-0000000000f1', '00000000-0000-4000-8000-00000000000c',
        '00000000-0000-4000-8000-00000000000a', 'parent', 'pending');

set local role authenticated;
select pg_temp.act_as('00000000-0000-4000-8000-00000000000c');
do $$ begin
  assert (select count(*) from public.student_profiles) = 0, 'pending link must not grant access';
end $$;
reset role;

update public.parent_student_links set status = 'active', accepted_at = now()
where id = '00000000-0000-4000-8000-0000000000f1';

set local role authenticated;
select pg_temp.act_as('00000000-0000-4000-8000-00000000000c');
do $$ begin
  assert (select count(*) from public.student_profiles) = 1, 'active link grants access to the linked child';
  assert not exists (select 1 from public.student_profiles where profile_id = '00000000-0000-4000-8000-00000000000b'),
    'parent must not see an unlinked student';
  assert (select count(*) from public.profiles) = 2, 'parent sees self and linked child';
  assert (select private.parent_can_view('00000000-0000-4000-8000-00000000000a', 'conversations')) = false,
    'conversations are private by default';
end $$;

-- Parents cannot widen their own access.
update public.parent_student_links set share_conversations = true where id = '00000000-0000-4000-8000-0000000000f1';
reset role;
do $$ begin
  assert (select share_conversations from public.parent_student_links where id = '00000000-0000-4000-8000-0000000000f1') = false,
    'parent must not be able to enable conversation sharing';
end $$;

-- Invite code hashes now live in parent_invitations and are never readable by
-- users (column grant excludes code_hash). Covered in detail by
-- onboarding_and_linking.sql; re-asserted here so this suite stands alone.
set local role authenticated;
select pg_temp.act_as('00000000-0000-4000-8000-00000000000c');
do $$ begin
  begin
    perform code_hash from public.parent_invitations;
    raise exception 'code_hash must not be readable';
  exception when insufficient_privilege then null;
  end;
end $$;

-- ---------------------------------------------------------------------------
-- Student controls sharing; revoking activity sharing hides the profile.
-- ---------------------------------------------------------------------------
select pg_temp.act_as('00000000-0000-4000-8000-00000000000a');
update public.parent_student_links set share_activity = false where id = '00000000-0000-4000-8000-0000000000f1';

select pg_temp.act_as('00000000-0000-4000-8000-00000000000c');
do $$ begin
  assert (select count(*) from public.student_profiles) = 0, 'student can withdraw activity sharing';
end $$;
reset role;

-- ---------------------------------------------------------------------------
-- Anonymous visitors
-- ---------------------------------------------------------------------------
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
do $$ begin
  assert (select count(*) from public.subjects) >= 13, 'anon can read subjects';
  assert (select count(*) from public.subscription_plans) = 3, 'anon can read public plans';
  begin
    perform 1 from public.profiles;
    raise exception 'anon must not read profiles';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.specifications;
    raise exception 'anon must not read specifications';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- ---------------------------------------------------------------------------
-- Staff
-- ---------------------------------------------------------------------------
set local role authenticated;
select pg_temp.act_as('00000000-0000-4000-8000-00000000000e');
insert into public.subjects (slug, name) values ('staff-test-subject', 'Staff test subject');
do $$ begin
  assert (select count(*) from public.profiles) >= 5, 'staff can read profiles for support';
  assert exists (select 1 from public.subjects where slug = 'staff-test-subject'), 'staff can write curriculum';
end $$;
reset role;

do $$ begin raise notice 'RLS permission tests: all passed'; end $$;

rollback;
