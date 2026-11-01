-- Lumio · Learning activity, goals and streak tests (migration 0008)
--
-- One transaction, rolled back. Raises on the first failed assertion; a clean
-- run returns 'learning activity tests: all passed'.
-- Students: A (London), B (New York — tests timezone), C (no activity).
-- Parent P actively linked to A with full sharing.

begin;

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
  ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'la.a@test.lumio', '{"account_role":"student","first_name":"Ava"}', now(), now()),
  ('00000000-0000-4000-8000-0000000000b1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'la.b@test.lumio', '{"account_role":"student","first_name":"Ben"}', now(), now()),
  ('00000000-0000-4000-8000-0000000000c1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'la.c@test.lumio', '{"account_role":"student","first_name":"Cal"}', now(), now()),
  ('00000000-0000-4000-8000-0000000000d1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'la.p@test.lumio', '{"account_role":"parent","first_name":"Pat"}', now(), now());

insert into public.parent_student_links (parent_id, student_id, initiated_by, status, accepted_at)
values ('00000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-0000000000a1', 'parent', 'active', now());

create or replace function pg_temp.act_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

-- Timezone must be real.
do $$ begin
  begin
    update public.student_profiles set timezone = 'Mars/Olympus' where profile_id = '00000000-0000-4000-8000-0000000000b1';
    raise exception 'invalid timezone accepted';
  exception when raise_exception then
    if sqlerrm <> 'LUMIO:invalid_timezone' then raise; end if;
  end;
end $$;
update public.student_profiles set timezone = 'America/New_York' where profile_id = '00000000-0000-4000-8000-0000000000b1';

-- ---------------------------------------------------------------------------
-- Seed A's activity as a feature would (definer function). Study days in
-- London: today, yesterday, 2 days ago (run of 3); 5,6,7,8 days ago (run of 4).
-- Plus non-qualifying events that must not count.
-- ---------------------------------------------------------------------------
do $$
declare
  a uuid := '00000000-0000-4000-8000-0000000000a1';
  bio uuid := (select id from public.subjects where slug = 'biology');
  chem uuid := (select id from public.subjects where slug = 'chemistry');
  d int;
begin
  foreach d in array array[0, 1, 2, 5, 6, 7, 8] loop
    perform private.record_study_activity(a, 'lesson', bio, 'Cell structure', null,
      now() - make_interval(days => d), 1200, true, null, 'test_lessons', gen_random_uuid());
  end loop;
  -- Completed quiz with a score (today): qualifies.
  perform private.record_study_activity(a, 'quiz', chem, 'Bonding quiz', null, now(), 600, true, 80, 'test_quizzes', gen_random_uuid());
  perform private.record_study_activity(a, 'quiz', chem, 'Moles quiz', null, now() - interval '1 day', 500, true, 60, 'test_quizzes', gen_random_uuid());
  -- Abandoned quiz, short flashcards, tutor chat, notes: do not qualify.
  perform private.record_study_activity(a, 'quiz', chem, null, null, now() - interval '3 days', 120, false, null, null, null);
  perform private.record_study_activity(a, 'flashcards', bio, null, null, now() - interval '3 days', 200, false, null, null, null);
  perform private.record_study_activity(a, 'tutor_session', bio, null, null, now() - interval '3 days', 1800, false, null, null, null);
  perform private.record_study_activity(a, 'notes', bio, null, null, now() - interval '3 days', 900, false, null, null, null);
end $$;

-- Idempotency: the same source row can't report twice.
do $$
declare
  src uuid := gen_random_uuid();
  first_id uuid;
  second_id uuid;
begin
  first_id := private.record_study_activity('00000000-0000-4000-8000-0000000000c1', 'notes', null, null, null, now(), 60, false, null, 'test_notes', src);
  second_id := private.record_study_activity('00000000-0000-4000-8000-0000000000c1', 'notes', null, null, null, now(), 60, false, null, 'test_notes', src);
  assert first_id is not null and second_id is null, 'duplicate source must be ignored';
  delete from public.study_activity_events where id = first_id;
end $$;

-- Future-dated activity is refused.
do $$ begin
  begin
    perform private.record_study_activity('00000000-0000-4000-8000-0000000000a1', 'lesson', null, null, null, now() + interval '1 day', 60, true, null, null, null);
    raise exception 'future activity accepted';
  exception when raise_exception then
    if sqlerrm <> 'LUMIO:future_activity' then raise; end if;
  end;
end $$;

-- Streak maths (as owner).
do $$
declare s record;
begin
  select * into s from public.student_streaks where student_id = '00000000-0000-4000-8000-0000000000a1';
  assert s.current_streak = 3, format('current streak should be 3, got %s', s.current_streak);
  assert s.best_streak = 4, format('best streak should be 4, got %s', s.best_streak);
  assert s.last_active_date = (now() at time zone 'Europe/London')::date, 'last active date is today in London';
  assert (select count(*) from public.study_activity_events where student_id = '00000000-0000-4000-8000-0000000000a1' and not qualifies) = 4,
    'abandoned quiz, short flashcards, tutor chat and notes must not qualify';
end $$;

-- Deleting today's qualifying events shortens the current run (recomputed, not incremented).
delete from public.study_activity_events
 where student_id = '00000000-0000-4000-8000-0000000000a1'
   and local_date = (now() at time zone 'Europe/London')::date and qualifies;
do $$ begin
  assert (select current_streak from public.student_streaks where student_id = '00000000-0000-4000-8000-0000000000a1') = 2,
    'streak must be recomputed after deletion';
end $$;
-- Restore today.
select private.record_study_activity('00000000-0000-4000-8000-0000000000a1', 'quiz',
  (select id from public.subjects where slug = 'chemistry'), 'Bonding quiz', null, now(), 600, true, 80, 'test_quizzes', gen_random_uuid());

-- Timezone: an event at 02:00 UTC is the previous day in New York.
do $$
declare
  ev uuid;
  utc_two date := (date_trunc('day', now() at time zone 'UTC') - interval '1 day')::date;
begin
  ev := private.record_study_activity('00000000-0000-4000-8000-0000000000b1', 'lesson', null, null, null,
    (utc_two::timestamp + time '02:00') at time zone 'UTC', 900, true, null, null, null);
  assert (select local_date from public.study_activity_events where id = ev) = utc_two - 1,
    'study day must use the student''s timezone';
  -- Moving B to London re-derives study days.
  update public.student_profiles set timezone = 'Europe/London' where profile_id = '00000000-0000-4000-8000-0000000000b1';
  assert (select local_date from public.study_activity_events where id = ev) = utc_two,
    'changing timezone must re-derive study days';
end $$;

-- ---------------------------------------------------------------------------
-- Student A through the API
-- ---------------------------------------------------------------------------
set local role authenticated;
select pg_temp.act_as('00000000-0000-4000-8000-0000000000a1');

do $$
declare
  r jsonb := public.get_dashboard_activity();
begin
  assert (r->'streak'->>'current')::int = 3, 'dashboard current streak';
  assert (r->'streak'->>'best')::int = 4, 'dashboard best streak';
  assert (r->'totals'->>'lessonsCompleted')::int = 6, 'lessons completed (today''s was deleted above)';
  assert (r->'totals'->>'quizzesCompleted')::int = 2, 'completed quizzes only';
  assert (r->'totals'->>'quizAveragePercent')::numeric = 70.0, 'quiz average from completed, scored quizzes';
  assert jsonb_array_length(r->'days') = 7, 'seven calendar days';
  assert jsonb_array_length(r->'recent') = 8, 'recent capped at 8';
  assert r->'goals' = 'null'::jsonb, 'no goals yet';
  assert exists (select 1 from jsonb_array_elements(r->'subjects') x
                 where x->>'subjectId' = (select id::text from public.subjects where slug = 'chemistry')
                   and (x->>'assessedCount')::int = 2 and (x->>'averagePercent')::numeric = 70.0),
    'per-subject assessment average';
  assert not exists (select 1 from jsonb_array_elements(r->'recent') x
                     where x->>'subjectId' is not null and x->>'id' in (
                       select id::text from public.study_activity_events where student_id <> '00000000-0000-4000-8000-0000000000a1')),
    'recent contains only own events';
end $$;

-- Students cannot write the ledger or streaks.
do $$ begin
  begin
    insert into public.study_activity_events (student_id, activity_type, completed, local_date)
    values ('00000000-0000-4000-8000-0000000000a1', 'lesson', true, current_date);
    raise exception 'student inserted activity';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.student_streaks set best_streak = 999;
    raise exception 'student updated streak';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.study_activity_events;
    raise exception 'student deleted activity';
  exception when insufficient_privilege then null;
  end;
  begin
    perform private.record_study_activity('00000000-0000-4000-8000-0000000000a1', 'lesson', null, null, null, now(), 60, true, null, null, null);
    raise exception 'student called private recorder';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Goals: create, validate, update, clear.
insert into public.student_learning_goals (student_id, weekly_minutes, weekly_lessons)
values ('00000000-0000-4000-8000-0000000000a1', 300, 3);
do $$ begin
  begin
    update public.student_learning_goals set weekly_minutes = 5 where student_id = '00000000-0000-4000-8000-0000000000a1';
    raise exception 'out-of-range goal accepted';
  exception when check_violation then null;
  end;
  begin
    update public.student_learning_goals set weekly_minutes = null, weekly_lessons = null
     where student_id = '00000000-0000-4000-8000-0000000000a1';
    raise exception 'empty goals row accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.student_learning_goals (student_id, weekly_minutes) values ('00000000-0000-4000-8000-0000000000b1', 60);
    raise exception 'goal written for another student';
  exception when insufficient_privilege then null;
  end;
  assert (public.get_dashboard_activity()->'goals'->>'weeklyMinutes')::int = 300, 'goals returned';
end $$;

-- ---------------------------------------------------------------------------
-- Student C (no activity) and B see nothing of A
-- ---------------------------------------------------------------------------
select pg_temp.act_as('00000000-0000-4000-8000-0000000000c1');
do $$
declare r jsonb := public.get_dashboard_activity();
begin
  assert (select count(*) from public.study_activity_events) = 0, 'C sees no events';
  assert (select count(*) from public.student_learning_goals) = 0, 'C sees no goals';
  -- C's own zero row exists (the idempotency check above added then removed an event).
  assert not exists (select 1 from public.student_streaks where student_id <> '00000000-0000-4000-8000-0000000000c1'), 'C sees no other streaks';
  assert (r->'totals'->>'events')::int = 0, 'C has no totals';
  assert coalesce((r->'streak'->>'current')::int, 0) = 0 and coalesce((r->'streak'->>'best')::int, 0) = 0, 'C streak is zero';
  assert jsonb_array_length(r->'recent') = 0 and jsonb_array_length(r->'subjects') = 0, 'C empty lists';
  -- C cannot change A's goals.
  update public.student_learning_goals set weekly_minutes = 3000 where student_id = '00000000-0000-4000-8000-0000000000a1';
  delete from public.student_learning_goals where student_id = '00000000-0000-4000-8000-0000000000a1';
end $$;

select pg_temp.act_as('00000000-0000-4000-8000-0000000000b1');
do $$ begin
  assert (select count(*) from public.study_activity_events) = 1, 'B sees only own event';
  assert (public.get_dashboard_activity()->'totals'->>'lessonsCompleted')::int = 1, 'B totals are own';
end $$;

-- Parent: no direct access to the ledger or goals (Phase 6 adds scoped reporting).
select pg_temp.act_as('00000000-0000-4000-8000-0000000000d1');
do $$ begin
  assert (select count(*) from public.study_activity_events) = 0, 'parent has no direct ledger access';
  assert (select count(*) from public.student_learning_goals) = 0, 'parent cannot read goals';
  begin
    perform public.get_dashboard_activity();
    raise exception 'parent got a student dashboard';
  exception when raise_exception then
    if sqlerrm <> 'LUMIO:wrong_role' then raise; end if;
  end;
end $$;

-- Anonymous: nothing.
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
do $$ begin
  begin
    perform public.get_dashboard_activity();
    raise exception 'anon called dashboard';
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;
do $$ begin
  assert (select weekly_minutes from public.student_learning_goals where student_id = '00000000-0000-4000-8000-0000000000a1') = 300,
    'other students could not alter A''s goals';
end $$;

select 'learning activity tests: all passed' as result;
rollback;
