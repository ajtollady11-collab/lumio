-- Lumio · Onboarding, examination and parent-linking tests
-- Runs in one transaction and rolls back. Every assertion raises on failure.
-- Final row: 'Onboarding and linking tests: all passed'.

begin;

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
  ('10000000-0000-4000-8000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@test.lumio', '{"account_role":"student","first_name":"Ava"}', now(), now()),
  ('10000000-0000-4000-8000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@test.lumio', '{"account_role":"student","first_name":"Ben"}', now(), now()),
  ('10000000-0000-4000-8000-00000000000c', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c@test.lumio', '{"account_role":"student","first_name":"Cal"}', now(), now()),
  ('10000000-0000-4000-8000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'p@test.lumio', '{"account_role":"parent","first_name":"Pat"}', now(), now()),
  ('10000000-0000-4000-8000-0000000000a2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'q@test.lumio', '{"account_role":"parent","first_name":"Quinn"}', now(), now());

create or replace function pg_temp.act_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
create or replace function pg_temp.q(slug text) returns uuid language sql as $$ select id from public.qualifications where qualifications.slug = $1 $$;
create or replace function pg_temp.b(slug text) returns uuid language sql as $$ select id from public.exam_boards where exam_boards.slug = $1 $$;
create or replace function pg_temp.s(slug text) returns uuid language sql as $$ select id from public.subjects where subjects.slug = $1 $$;
grant execute on all functions in schema pg_temp to authenticated;

-- ===========================================================================
-- Student A completes onboarding
-- ===========================================================================
set local role authenticated;
select pg_temp.act_as('10000000-0000-4000-8000-00000000000a');

update public.student_profiles
   set first_name = 'Ava-Rose', age_band = '16_17', school_year = 12, education_level = 'a_level',
       primary_qualification_id = pg_temp.q('a-level'), onboarding_step = 3
 where profile_id = '10000000-0000-4000-8000-00000000000a';

do $$ begin
  assert (select display_name from public.profiles where id = '10000000-0000-4000-8000-00000000000a') = 'Ava-Rose',
    'display name follows first name';
  assert (select parental_consent from public.student_profiles where profile_id = '10000000-0000-4000-8000-00000000000a') = 'not_required',
    '16-17 needs no parental consent';
end $$;

-- Completion cannot be self-set.
do $$ begin
  begin
    update public.profiles set onboarding_completed_at = now() where id = '10000000-0000-4000-8000-00000000000a';
    raise exception 'self-completion must be denied';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Completion is refused while required data is missing.
do $$ begin
  begin
    perform public.complete_student_onboarding();
    raise exception 'completion without subjects must fail';
  exception when raise_exception then
    if sqlerrm <> 'LUMIO:incomplete:subjects' then raise; end if;
  end;
end $$;

insert into public.student_subjects (student_id, subject_id, qualification_id, exam_board_id, current_grade, target_grade, confidence)
values ('10000000-0000-4000-8000-00000000000a', pg_temp.s('biology'), pg_temp.q('a-level'), pg_temp.b('aqa'), 'B', 'A*', 'difficult'),
       ('10000000-0000-4000-8000-00000000000a', pg_temp.s('economics'), pg_temp.q('a-level'), pg_temp.b('pearson-edexcel'), null, 'A', 'confident'),
       ('10000000-0000-4000-8000-00000000000a', pg_temp.s('psychology'), pg_temp.q('a-level'), null, null, null, null);

do $$ begin
  -- Same subject twice
  begin
    insert into public.student_subjects (student_id, subject_id, qualification_id)
    values ('10000000-0000-4000-8000-00000000000a', pg_temp.s('biology'), pg_temp.q('a-level'));
    raise exception 'duplicate subject must be rejected';
  exception when unique_violation then null;
  end;
  -- GCSE grade on an A-level
  begin
    insert into public.student_subjects (student_id, subject_id, qualification_id, target_grade)
    values ('10000000-0000-4000-8000-00000000000a', pg_temp.s('physics'), pg_temp.q('a-level'), '9');
    raise exception 'GCSE grade on A-level must be rejected';
  exception when raise_exception then
    if sqlerrm <> 'LUMIO:invalid_grade' then raise; end if;
  end;
  -- A* doesn't exist at AS level
  begin
    insert into public.student_subjects (student_id, subject_id, qualification_id, target_grade)
    values ('10000000-0000-4000-8000-00000000000a', pg_temp.s('physics'), pg_temp.q('as-level'), 'A*');
    raise exception 'A* at AS must be rejected';
  exception when raise_exception then
    if sqlerrm <> 'LUMIO:invalid_grade' then raise; end if;
  end;
  -- AQA does not offer International GCSE here
  begin
    insert into public.student_subjects (student_id, subject_id, qualification_id, exam_board_id)
    values ('10000000-0000-4000-8000-00000000000a', pg_temp.s('physics'), pg_temp.q('international-gcse'), pg_temp.b('aqa'));
    raise exception 'board not offering qualification must be rejected';
  exception when foreign_key_violation then null;
  end;
  -- Writing a subject for someone else
  begin
    insert into public.student_subjects (student_id, subject_id, qualification_id)
    values ('10000000-0000-4000-8000-00000000000b', pg_temp.s('physics'), pg_temp.q('a-level'));
    raise exception 'writing another student''s subjects must be rejected';
  exception when insufficient_privilege then null;
  end;
end $$;

insert into public.examination_dates (student_id, subject_id, qualification_id, exam_board_id, exam_date, notes)
values ('10000000-0000-4000-8000-00000000000a', pg_temp.s('biology'), pg_temp.q('a-level'), pg_temp.b('aqa'), date '2027-06-08', 'Paper 1');

do $$ begin
  begin
    insert into public.examination_dates (student_id, subject_id, qualification_id, exam_date, notes)
    values ('10000000-0000-4000-8000-00000000000a', pg_temp.s('biology'), pg_temp.q('a-level'), date '2027-06-08', 'Paper 1');
    raise exception 'duplicate exam must be rejected';
  exception when unique_violation then null;
  end;
  begin
    insert into public.examination_dates (student_id, subject_id, qualification_id, exam_date)
    values ('10000000-0000-4000-8000-00000000000a', pg_temp.s('biology'), pg_temp.q('a-level'), date '1999-01-01');
    raise exception 'implausible exam date must be rejected';
  exception when check_violation then null;
  end;
end $$;

update public.student_profiles set learning_preferences = array['visual', 'question_led'], academic_goals = 'Medicine offer'
 where profile_id = '10000000-0000-4000-8000-00000000000a';

select public.complete_student_onboarding();

do $$ begin
  assert (select onboarding_completed_at is not null from public.profiles where id = '10000000-0000-4000-8000-00000000000a'),
    'completion recorded';
  assert (select onboarding_step from public.student_profiles where profile_id = '10000000-0000-4000-8000-00000000000a') = 8,
    'step recorded as complete';
end $$;

-- Updating later does not duplicate
update public.student_subjects set target_grade = 'A' where student_id = '10000000-0000-4000-8000-00000000000a'
  and subject_id = pg_temp.s('biology');
do $$ begin
  assert (select count(*) from public.student_subjects where student_id = '10000000-0000-4000-8000-00000000000a') = 3,
    'edits update in place';
end $$;

-- ===========================================================================
-- Student B cannot see or change A
-- ===========================================================================
select pg_temp.act_as('10000000-0000-4000-8000-00000000000b');
update public.student_subjects set target_grade = 'E' where student_id = '10000000-0000-4000-8000-00000000000a';
delete from public.examination_dates where student_id = '10000000-0000-4000-8000-00000000000a';
do $$ begin
  assert (select count(*) from public.student_subjects) = 0, 'B sees no subjects of A';
  assert (select count(*) from public.examination_dates) = 0, 'B sees no exams of A';
  begin
    perform public.create_parent_invitation();
    raise exception 'students cannot create parent invitations';
  exception when raise_exception then
    if sqlerrm <> 'LUMIO:wrong_role' then raise; end if;
  end;
end $$;
reset role;
do $$ begin
  assert (select target_grade from public.student_subjects where student_id = '10000000-0000-4000-8000-00000000000a'
          and subject_id = pg_temp.s('biology')) = 'A', 'B''s update had no effect';
  assert (select count(*) from public.examination_dates where student_id = '10000000-0000-4000-8000-00000000000a') = 1,
    'B''s delete had no effect';
end $$;

-- ===========================================================================
-- Parent P invites; A previews and accepts
-- ===========================================================================
set local role authenticated;
select pg_temp.act_as('10000000-0000-4000-8000-0000000000a1');
select set_config('test.code1', (select code from public.create_parent_invitation()), true);

do $$ begin
  assert current_setting('test.code1') ~ '^[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$',
    'code format XXXX-XXXX-XXXX in Crockford base32';
  assert (select count(*) from public.parent_invitations) = 1, 'parent sees own invitation';
  assert (select count(*) from public.student_subjects) = 0, 'parent sees nothing before linking';
  begin
    perform code_hash from public.parent_invitations;
    raise exception 'code hashes must be unreadable';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.preview_parent_invitation(current_setting('test.code1'));
    raise exception 'parents cannot accept invitations';
  exception when raise_exception then
    if sqlerrm <> 'LUMIO:wrong_role' then raise; end if;
  end;
  perform public.complete_parent_onboarding();
end $$;

select pg_temp.act_as('10000000-0000-4000-8000-00000000000a');
do $$
declare r record;
begin
  select * into r from public.preview_parent_invitation('zzzz-zzzz-zzzz');
  assert r.status = 'invalid_code', 'wrong code is invalid';

  -- lower case, no dashes, O for 0 etc. are all accepted
  select * into r from public.preview_parent_invitation(lower(replace(current_setting('test.code1'), '-', ' ')));
  assert r.status = 'ok' and r.parent_first_name = 'Pat', 'preview shows the parent''s first name only';

  select * into r from public.accept_parent_invitation(current_setting('test.code1'));
  assert r.status = 'ok' and r.link_id is not null, 'accept links the accounts';

  select * into r from public.accept_parent_invitation(current_setting('test.code1'));
  assert r.status = 'code_used', 'codes are single use';
end $$;

reset role;
do $$ begin
  assert (select count(*) from public.audit_logs where action = 'invitation.failed_attempt'
          and actor_id = '10000000-0000-4000-8000-00000000000a') = 1,
    'failed attempt is recorded (not rolled back)';
  assert (select count(*) from public.audit_logs where action = 'link.accepted') = 1, 'link acceptance audited';
end $$;

set local role authenticated;
select pg_temp.act_as('10000000-0000-4000-8000-0000000000a1');
do $$ begin
  assert (select count(*) from public.student_profiles) = 1, 'parent sees the linked child';
  assert (select count(*) from public.student_subjects) = 3, 'parent sees linked child''s subjects';
  assert (select count(*) from public.examination_dates) = 1, 'parent sees linked child''s exams';
  assert (select private.parent_can_view('10000000-0000-4000-8000-00000000000a', 'conversations')) = false,
    'conversations stay private after linking';
end $$;

-- Another parent sees nothing
select pg_temp.act_as('10000000-0000-4000-8000-0000000000a2');
do $$ begin
  assert (select count(*) from public.student_profiles) = 0, 'unlinked parent sees no students';
  assert (select count(*) from public.parent_invitations) = 0, 'parents cannot see others'' invitations';
end $$;

-- ===========================================================================
-- Expiry, revocation, multiple children, limits
-- ===========================================================================
select pg_temp.act_as('10000000-0000-4000-8000-0000000000a1');
select set_config('test.code2', (select code from public.create_parent_invitation()), true);
select set_config('test.code3', (select code from public.create_parent_invitation()), true);
select set_config('test.code4', (select code from public.create_parent_invitation()), true);
reset role;

-- Expire code 2
update public.parent_invitations set expires_at = now() - interval '1 minute'
 where code_hash = encode(extensions.digest(replace(current_setting('test.code2'), '-', ''), 'sha256'), 'hex');

select set_config('test.inv3', (select id::text from public.parent_invitations
  where code_hash = encode(extensions.digest(replace(current_setting('test.code3'), '-', ''), 'sha256'), 'hex')), true);
set local role authenticated;
select pg_temp.act_as('10000000-0000-4000-8000-0000000000a2');
do $$ begin
  begin
    perform public.revoke_parent_invitation(current_setting('test.inv3')::uuid);
    raise exception 'another parent must not revoke this invitation';
  exception when raise_exception then
    if sqlerrm <> 'LUMIO:not_found' then raise; end if;
  end;
end $$;
select pg_temp.act_as('10000000-0000-4000-8000-0000000000a1');
select public.revoke_parent_invitation(current_setting('test.inv3')::uuid);

-- Student B: expired and revoked codes, then a valid one (second child)
select pg_temp.act_as('10000000-0000-4000-8000-00000000000b');
do $$
declare r record;
begin
  select * into r from public.accept_parent_invitation(current_setting('test.code2'));
  assert r.status = 'code_expired', 'expired codes are refused';
  select * into r from public.accept_parent_invitation(current_setting('test.code3'));
  assert r.status = 'invalid_code', 'revoked codes are refused';
  select * into r from public.accept_parent_invitation(current_setting('test.code4'));
  assert r.status = 'ok', 'second child links';
end $$;

select pg_temp.act_as('10000000-0000-4000-8000-0000000000a1');
do $$ begin
  assert (select count(*) from public.student_profiles) = 2, 'parent sees both linked children';
end $$;

-- Under-13 consent: Cal sets age band, links, consent becomes granted
select pg_temp.act_as('10000000-0000-4000-8000-00000000000c');
update public.student_profiles set age_band = 'under_13' where profile_id = '10000000-0000-4000-8000-00000000000c';
do $$ begin
  assert (select parental_consent from public.student_profiles where profile_id = '10000000-0000-4000-8000-00000000000c') = 'pending',
    'under-13 requires consent';
end $$;
select pg_temp.act_as('10000000-0000-4000-8000-0000000000a1');
select set_config('test.code5', (select code from public.create_parent_invitation()), true);
select pg_temp.act_as('10000000-0000-4000-8000-00000000000c');
do $$
declare r record;
begin
  select * into r from public.accept_parent_invitation(current_setting('test.code5'));
  assert r.status = 'ok', 'under-13 links';
  assert (select parental_consent from public.student_profiles where profile_id = '10000000-0000-4000-8000-00000000000c') = 'granted',
    'linking records parental consent';
end $$;

-- Rate limit: 10 wrong guesses, then blocked even for a valid-looking code
do $$
declare r record; i int;
begin
  for i in 1..10 loop
    select * into r from public.preview_parent_invitation('0000-0000-000' || i % 10);
  end loop;
  select * into r from public.preview_parent_invitation('0000-0000-0000');
  assert r.status = 'rate_limited', 'guessing is rate limited';
end $$;

-- Pending-invitation cap (5)
select pg_temp.act_as('10000000-0000-4000-8000-0000000000a2');
do $$ begin
  perform public.create_parent_invitation(); perform public.create_parent_invitation();
  perform public.create_parent_invitation(); perform public.create_parent_invitation();
  perform public.create_parent_invitation();
  begin
    perform public.create_parent_invitation();
    raise exception 'sixth pending invitation must be refused';
  exception when raise_exception then
    if sqlerrm <> 'LUMIO:too_many_invitations' then raise; end if;
  end;
end $$;

-- Unlinking: student A ends the link; parent loses access immediately
select pg_temp.act_as('10000000-0000-4000-8000-00000000000a');
select public.unlink_parent_student(id) from public.parent_student_links
 where student_id = '10000000-0000-4000-8000-00000000000a' and status = 'active';
select pg_temp.act_as('10000000-0000-4000-8000-0000000000a1');
do $$ begin
  assert not exists (select 1 from public.student_profiles where profile_id = '10000000-0000-4000-8000-00000000000a'),
    'unlinked child is no longer visible';
  assert (select count(*) from public.student_profiles) = 2, 'other children remain visible';
end $$;

-- Anonymous callers cannot use any of the functions
reset role;
set local role anon;
do $$ begin
  begin
    perform public.create_parent_invitation();
    raise exception 'anon must not call RPCs';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

select 'Onboarding and linking tests: all passed' as result;
rollback;
