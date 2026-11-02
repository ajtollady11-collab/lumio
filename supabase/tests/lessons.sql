-- Lumio · Lesson engine permission tests (migration 0013)
-- One transaction, rolled back. A clean run returns 'lesson tests: all passed'.
-- Students A and B, parent P linked to A with EVERY sharing switch on.

begin;

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
  ('00000000-0000-4000-8000-0000000000a4', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ls.a@test.lumio', '{"account_role":"student","first_name":"Ava"}', now(), now()),
  ('00000000-0000-4000-8000-0000000000b4', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ls.b@test.lumio', '{"account_role":"student","first_name":"Ben"}', now(), now()),
  ('00000000-0000-4000-8000-0000000000d4', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ls.p@test.lumio', '{"account_role":"parent","first_name":"Pat"}', now(), now());
insert into public.parent_student_links (parent_id, student_id, initiated_by, status, accepted_at, share_conversations)
values ('00000000-0000-4000-8000-0000000000d4', '00000000-0000-4000-8000-0000000000a4', 'parent', 'active', now(), true);
insert into public.student_subjects (student_id, subject_id, qualification_id)
select '00000000-0000-4000-8000-0000000000a4', s.id, (select id from public.qualifications order by name limit 1)
  from public.subjects s where s.slug = 'biology';

create or replace function pg_temp.act_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

-- ---------------------------------------------------------------------------
-- Server (owner here; service role in production) creates A's lesson
-- ---------------------------------------------------------------------------
insert into public.lessons (id, student_id, subject_id, topic, difficulty, duration_minutes, objective, teaching_style, status, title)
values ('00000000-0000-4000-8000-00000000e001', '00000000-0000-4000-8000-0000000000a4',
        (select id from public.subjects where slug = 'biology'), 'Osmosis', 'standard', 20, 'improve', 'visual',
        'in_progress', 'Osmosis in plant cells');
insert into public.lesson_sections (lesson_id, idx, student_id, kind, title, minutes, status, content)
values ('00000000-0000-4000-8000-00000000e001', 0, '00000000-0000-4000-8000-0000000000a4', 'intro', 'Introduction', 2, 'ready', 'Hello'),
       ('00000000-0000-4000-8000-00000000e001', 1, '00000000-0000-4000-8000-0000000000a4', 'check', 'Check', 3, 'pending', null);
insert into public.lesson_questions (id, lesson_id, student_id, section_idx, position, kind, prompt, options, correct_option, model_answer, marking_guide, hint)
values ('00000000-0000-4000-8000-00000000f001', '00000000-0000-4000-8000-00000000e001', '00000000-0000-4000-8000-0000000000a4',
        1, 0, 'mcq', 'Which way does water move?', '["In","Out"]', 0, 'Into the cell (higher water potential outside)', null, 'Think about concentration');

do $$ begin
  -- Guards on server writes too.
  begin
    insert into public.lessons (student_id, subject_id, topic, difficulty, duration_minutes, objective, teaching_style)
    values ('00000000-0000-4000-8000-0000000000a4', (select id from public.subjects where slug = 'physics'),
            'Waves', 'standard', 20, 'improve', 'visual');
    raise exception 'lesson in a subject the student does not take';
  exception when raise_exception then
    if sqlerrm <> 'LUMIO:not_my_subject' then raise; end if;
  end;
  begin
    insert into public.lessons (student_id, subject_id, topic, difficulty, duration_minutes, objective, teaching_style)
    values ('00000000-0000-4000-8000-0000000000a4', (select id from public.subjects where slug = 'biology'),
            'Osmosis', 'standard', 25, 'improve', 'visual');
    raise exception 'invalid duration accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.lesson_sections (lesson_id, idx, student_id, kind, title, minutes)
    values ('00000000-0000-4000-8000-00000000e001', 5, '00000000-0000-4000-8000-0000000000b4', 'intro', 'X', 2);
    raise exception 'section attached to another student';
  exception when raise_exception then
    if sqlerrm <> 'LUMIO:not_found' then raise; end if;
  end;
  begin
    insert into public.lesson_questions (lesson_id, student_id, section_idx, position, kind, prompt)
    values ('00000000-0000-4000-8000-00000000e001', '00000000-0000-4000-8000-0000000000a4', 1, 1, 'mcq', 'No options');
    raise exception 'mcq without options accepted';
  exception when check_violation then null;
  end;
end $$;

-- ---------------------------------------------------------------------------
-- Student A: reads own lesson, never the answer key, can't write lesson data
-- ---------------------------------------------------------------------------
set local role authenticated;
select pg_temp.act_as('00000000-0000-4000-8000-0000000000a4');
do $$ begin
  assert (select count(*) from public.lessons) = 1, 'A sees own lesson';
  assert (select count(*) from public.lesson_sections) = 2, 'A sees own sections';
  assert (select prompt from public.lesson_questions where id = '00000000-0000-4000-8000-00000000f001') = 'Which way does water move?',
    'A sees own question';
  assert (select revealed_answer from public.lesson_questions where id = '00000000-0000-4000-8000-00000000f001') is null,
    'answer not revealed before resolution';
  begin
    perform correct_option from public.lesson_questions;
    raise exception 'student read the correct option';
  exception when insufficient_privilege then null;
  end;
  begin
    perform model_answer from public.lesson_questions;
    raise exception 'student read the model answer';
  exception when insufficient_privilege then null;
  end;
  begin
    perform marking_guide, hint from public.lesson_questions;
    raise exception 'student read the marking guide';
  exception when insufficient_privilege then null;
  end;
  begin
    perform * from public.lesson_questions;
    raise exception 'select * exposed hidden columns';
  exception when insufficient_privilege then null;
  end;
  -- No direct writes: progress, results and content are server-written.
  begin
    update public.lessons set status = 'completed', completed_at = now();
    raise exception 'student completed a lesson directly';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.lesson_questions set status = 'correct', resolved_at = now();
    raise exception 'student marked their own answer';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.lesson_sections set content = 'forged';
    raise exception 'student edited lesson content';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.lessons (student_id, subject_id, topic, difficulty, duration_minutes, objective, teaching_style)
    values ('00000000-0000-4000-8000-0000000000a4', (select id from public.subjects where slug = 'biology'),
            'Free lesson', 'standard', 10, 'improve', 'visual');
    raise exception 'student created a lesson without the server (bypassing the allowance)';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.service_record_lesson_activity('00000000-0000-4000-8000-0000000000a4', '00000000-0000-4000-8000-00000000e001', true);
    raise exception 'student recorded lesson activity';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.tutor_conversations set lesson_id = '00000000-0000-4000-8000-00000000e001';
    raise exception 'student linked a conversation to a lesson';
  exception when insufficient_privilege then null;
  end;
  -- Quota reflects plan data and the lesson row.
  assert (public.get_lesson_quota() ->> 'allowance')::int = 2, 'free plan: 2 lessons';
  assert (public.get_lesson_quota() ->> 'startedThisMonth')::int = 1, 'lesson counted';
end $$;

-- Notes: A creates, edits and links to own lesson.
insert into public.notes (id, student_id, subject_id, topic, lesson_id, title, body, source)
values ('00000000-0000-4000-8000-00000000a0a1', '00000000-0000-4000-8000-0000000000a4',
        (select id from public.subjects where slug = 'biology'), 'Osmosis', '00000000-0000-4000-8000-00000000e001',
        'Water potential', 'Water moves from high to low water potential.', 'lesson');
update public.notes set body = 'Edited' where id = '00000000-0000-4000-8000-00000000a0a1';
do $$ begin
  assert (select body from public.notes where id = '00000000-0000-4000-8000-00000000a0a1') = 'Edited', 'A edits own note';
  begin
    update public.notes set lesson_id = null where id = '00000000-0000-4000-8000-00000000a0a1';
    raise exception 'student re-pointed a note';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.notes (student_id, title, body) values ('00000000-0000-4000-8000-0000000000b4', 'Forged', 'x');
    raise exception 'A wrote a note as B';
  exception when insufficient_privilege then null;
  end;
end $$;

-- ---------------------------------------------------------------------------
-- Student B sees and changes nothing of A's
-- ---------------------------------------------------------------------------
select pg_temp.act_as('00000000-0000-4000-8000-0000000000b4');
do $$ begin
  assert (select count(*) from public.lessons) = 0, 'B sees no lessons of A';
  assert (select count(*) from public.lesson_sections) = 0, 'B sees no sections of A';
  assert (select count(*) from public.lesson_questions) = 0, 'B sees no questions of A';
  assert (select count(*) from public.notes) = 0, 'B sees no notes of A';
  assert (public.get_lesson_quota() ->> 'startedThisMonth')::int = 0, 'B quota is own';
  begin
    insert into public.notes (student_id, title, body, lesson_id)
    values ('00000000-0000-4000-8000-0000000000b4', 'Mine', 'x', '00000000-0000-4000-8000-00000000e001');
    raise exception 'B linked a note to A''s lesson';
  exception when raise_exception then
    if sqlerrm <> 'LUMIO:not_found' then raise; end if;
  end;
  update public.notes set body = 'Hacked';
  delete from public.notes;
  delete from public.lessons;
end $$;

-- ---------------------------------------------------------------------------
-- Parent P (linked, every switch on) sees nothing
-- ---------------------------------------------------------------------------
select pg_temp.act_as('00000000-0000-4000-8000-0000000000d4');
do $$ begin
  assert (select count(*) from public.lessons) = 0, 'parent sees no lessons';
  assert (select count(*) from public.lesson_sections) = 0, 'parent sees no lesson content';
  assert (select count(*) from public.lesson_questions) = 0, 'parent sees no answers';
  assert (select count(*) from public.notes) = 0, 'parent sees no notes';
  begin
    perform public.get_lesson_quota();
    raise exception 'parent got a lesson quota';
  exception when raise_exception then
    if sqlerrm <> 'LUMIO:wrong_role' then raise; end if;
  end;
end $$;

-- Anonymous: nothing.
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
do $$ begin
  begin
    perform 1 from public.lessons;
    raise exception 'anon read lessons';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.notes;
    raise exception 'anon read notes';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.get_lesson_quota();
    raise exception 'anon called lesson quota';
  exception when insufficient_privilege then null;
  end;
end $$;

-- ---------------------------------------------------------------------------
-- A's data survived; completion is recorded once; A can delete
-- ---------------------------------------------------------------------------
reset role;
update public.lessons set status = 'completed', completed_at = now(), active_seconds = 900
 where id = '00000000-0000-4000-8000-00000000e001';
select public.service_record_lesson_activity('00000000-0000-4000-8000-0000000000a4', '00000000-0000-4000-8000-00000000e001', true);
select public.service_record_lesson_activity('00000000-0000-4000-8000-0000000000a4', '00000000-0000-4000-8000-00000000e001', true);
do $$ begin
  assert (select count(*) from public.study_activity_events
           where source_table = 'lessons' and source_id = '00000000-0000-4000-8000-00000000e001'
             and activity_type = 'lesson' and completed and qualifies and active_seconds = 900) = 1,
    'one qualifying lesson entry, recorded once';
  begin
    perform public.service_record_lesson_activity('00000000-0000-4000-8000-0000000000b4', '00000000-0000-4000-8000-00000000e001', true);
    raise exception 'activity recorded for the wrong student';
  exception when raise_exception then
    if sqlerrm <> 'LUMIO:not_found' then raise; end if;
  end;
end $$;

set local role authenticated;
select pg_temp.act_as('00000000-0000-4000-8000-0000000000a4');
do $$ begin
  assert (select count(*) from public.lessons) = 1, 'B could not delete A''s lesson';
  assert (select body from public.notes) = 'Edited', 'B could not edit A''s note';
end $$;
delete from public.lessons where id = '00000000-0000-4000-8000-00000000e001';
reset role;
do $$ begin
  assert (select count(*) from public.lesson_sections where lesson_id = '00000000-0000-4000-8000-00000000e001') = 0,
    'deleting a lesson deletes its sections';
  assert (select count(*) from public.lesson_questions where lesson_id = '00000000-0000-4000-8000-00000000e001') = 0,
    'and its questions';
  assert (select lesson_id from public.notes where id = '00000000-0000-4000-8000-00000000a0a1') is null,
    'notes are kept, unlinked';
end $$;

select 'lesson tests: all passed' as result;
rollback;
