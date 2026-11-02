-- Lumio · Student intelligence tests (migrations 0011–0012)
-- One transaction, rolled back. A clean run returns 'learning intelligence tests: all passed'.
-- "Server" calls run as the owner role, standing in for the service role.

begin;

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
  ('00000000-0000-4000-8000-0000000000a3', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'li.a@test.lumio', '{"account_role":"student","first_name":"Ava"}', now(), now()),
  ('00000000-0000-4000-8000-0000000000b3', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'li.b@test.lumio', '{"account_role":"student","first_name":"Ben"}', now(), now()),
  ('00000000-0000-4000-8000-0000000000d3', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'li.p@test.lumio', '{"account_role":"parent","first_name":"Pat"}', now(), now());
insert into public.parent_student_links (parent_id, student_id, initiated_by, status, accepted_at, share_conversations)
values ('00000000-0000-4000-8000-0000000000d3', '00000000-0000-4000-8000-0000000000a3', 'parent', 'active', now(), true);
insert into public.student_subjects (student_id, subject_id, qualification_id)
select '00000000-0000-4000-8000-0000000000a3', s.id, (select id from public.qualifications where slug = 'a-level')
from public.subjects s where s.slug in ('biology', 'chemistry');

create or replace function pg_temp.act_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
create or replace function pg_temp.rec(topic text, kind public.evidence_kind, subj text default 'biology',
  diff public.evidence_difficulty default 'standard', miscon text default null, approach text default null)
returns text language sql as $$
  select public.service_record_learning('00000000-0000-4000-8000-0000000000a3',
    (select id from public.subjects where slug = subj), topic, kind, diff, null, miscon, approach, null, null,
    'tutor_conversation', null);
$$;
-- Positional parameters: a parameter called "topic" would be shadowed by the column of that name.
create or replace function pg_temp.level(p_topic text, p_subj text default 'biology') returns smallint language sql as $$
  select m.level from public.topic_mastery m where m.student_id = '00000000-0000-4000-8000-0000000000a3'
    and m.subject_id = (select id from public.subjects where slug = $2) and m.topic_key = private.topic_key($1);
$$;
create or replace function pg_temp.has_insight(p_kind public.memory_kind, p_topic text) returns boolean language sql as $$
  select exists (select 1 from public.student_memory m where m.student_id = '00000000-0000-4000-8000-0000000000a3'
    and m.kind = $1 and lower(m.topic) = lower($2));
$$;

-- 1. A new student starts empty.
set local role authenticated;
select pg_temp.act_as('00000000-0000-4000-8000-0000000000a3');
do $$
declare r jsonb := public.get_learning_profile();
begin
  assert jsonb_array_length(r->'mastery') = 0 and jsonb_array_length(r->'insights') = 0
     and jsonb_array_length(r->'changes') = 0 and (r->>'questionsAnswered')::int = 0, 'new profile is empty';
end $$;
reset role;

-- 2. Exposure (asking about a topic) creates "Introduced" and nothing else.
do $$ begin
  assert pg_temp.rec('Photosynthesis', null) = 'exposure', 'exposure recorded';
  assert pg_temp.level('Photosynthesis') = 2, 'introduced';
  assert pg_temp.has_insight('topic_studied', 'Photosynthesis'), 'studied memory';
  assert not pg_temp.has_insight('weakness', 'Photosynthesis'), 'asking alone is not a weakness';
  assert (select count(*) from public.topic_evidence where student_id = '00000000-0000-4000-8000-0000000000a3') = 0,
    'no evidence from exposure';
end $$;

-- 3. One correct answer stays "Introduced" (= Not assessed yet); never mastery.
do $$ begin
  perform pg_temp.rec('Enzymes', 'correct', 'biology', 'challenging');
  assert pg_temp.level('Enzymes') = 2, 'one correct answer is not enough evidence';
  assert not pg_temp.has_insight('strength', 'Enzymes'), 'no strength from one answer';
end $$;

-- 4. Weakness needs repeated evidence. Two wrong answers → Developing, no weakness yet.
do $$ begin
  perform pg_temp.rec('Photosynthesis', 'incorrect', 'biology', 'standard', 'Thinks plants get their mass from the soil');
  perform pg_temp.rec('Photosynthesis', 'incorrect');
  assert pg_temp.level('Photosynthesis') = 3, 'developing after two incorrect';
  assert not pg_temp.has_insight('weakness', 'Photosynthesis'), 'two slips are not yet a weakness';
  assert pg_temp.has_insight('misconception', 'Photosynthesis'), 'misconception recorded';
  perform pg_temp.rec('Photosynthesis', 'needed_reexplanation');
  assert pg_temp.has_insight('weakness', 'Photosynthesis'), 'third piece of evidence confirms the weakness';
  assert (select confidence from public.student_memory where kind = 'weakness' and topic = 'Photosynthesis'
           and student_id = '00000000-0000-4000-8000-0000000000a3') = 'medium', 'medium confidence on 3 pieces';
  assert (select evidence_summary from public.student_memory where kind = 'weakness' and topic = 'Photosynthesis'
           and student_id = '00000000-0000-4000-8000-0000000000a3') like '2 incorrect, 1 needed re-explaining — since %',
    'plain-English reason recorded';
end $$;

-- 5. Improvement over time: consistent correct answers lift the level and clear the weakness.
do $$
declare i int;
begin
  for i in 1..6 loop perform pg_temp.rec('Photosynthesis', 'correct'); end loop;
  assert pg_temp.level('Photosynthesis') >= 4, 'improved';
  assert not pg_temp.has_insight('weakness', 'Photosynthesis'), 'weakness withdrawn once evidence no longer supports it';
  assert exists (select 1 from public.topic_mastery_changes where topic = 'Photosynthesis' and to_level > from_level
                  and student_id = '00000000-0000-4000-8000-0000000000a3'), 'improvement recorded in history';
end $$;

-- 6. Strong vs Mastered: same-day evidence can reach Strong but not Mastered.
do $$
declare i int;
begin
  for i in 1..6 loop perform pg_temp.rec('Ionic bonding', 'correct', 'chemistry', 'challenging', null, 'worked_example'); end loop;
  assert pg_temp.level('Ionic bonding', 'chemistry') = 5, 'strong, not mastered, after one day';
  assert pg_temp.has_insight('strength', 'Ionic bonding'), 'strength recorded at Strong';
  -- Older evidence on another day → mastered.
  insert into public.topic_evidence (student_id, subject_id, topic_key, topic, kind, difficulty, source, created_at)
  values ('00000000-0000-4000-8000-0000000000a3', (select id from public.subjects where slug = 'chemistry'),
          'ionic bonding', 'Ionic bonding', 'correct', 'standard', 'tutor_conversation', now() - interval '3 days');
  perform pg_temp.rec('Ionic bonding', 'independent_explanation', 'chemistry');
  assert pg_temp.level('Ionic bonding', 'chemistry') = 6, 'mastered with consistent evidence over time';
  -- A recent wrong answer drops it below Mastered.
  perform pg_temp.rec('Ionic bonding', 'incorrect', 'chemistry');
  assert pg_temp.level('Ionic bonding', 'chemistry') < 6, 'recent mistake prevents mastery';
  -- Worked examples helped 6+ times → a learning pattern with high confidence.
  assert (select confidence from public.student_memory where student_id = '00000000-0000-4000-8000-0000000000a3'
           and kind = 'learning_pattern' and topic = 'Worked examples') = 'high', 'learning pattern';
end $$;

-- 7. Guards.
do $$ begin
  assert pg_temp.rec('!!!', 'correct') = 'invalid_topic', 'nonsense topic refused';
  assert pg_temp.rec('Waves', 'correct', 'physics') = 'not_my_subject', 'only the student''s own subjects';
end $$;

-- 8. Tutor context only carries relevant memory.
set local role authenticated;
select pg_temp.act_as('00000000-0000-4000-8000-0000000000a3');
do $$
declare
  bio uuid := (select id from public.subjects where slug = 'biology');
  chem uuid := (select id from public.subjects where slug = 'chemistry');
  r jsonb;
begin
  r := public.get_tutor_context(null, 0, bio, 'photosynthesis');
  assert not exists (select 1 from jsonb_array_elements(r->'learning'->'topics') t where t->>'subjectId' <> bio::text),
    'Biology context has no Chemistry topics';
  assert not exists (select 1 from jsonb_array_elements(r->'learning'->'insights') t where t->>'subjectId' <> bio::text),
    'Biology context has no Chemistry insights';
  assert (r->'learning'->'topics'->0->>'topic') = 'Photosynthesis' and (r->'learning'->'topics'->0->>'isFocus')::boolean,
    'current topic first';
  assert jsonb_array_length(r->'learning'->'patterns') = 1, 'pattern seen at least twice is included';

  r := public.get_tutor_context(null, 0, chem, null);
  assert not exists (select 1 from jsonb_array_elements(r->'learning'->'topics') t where t->>'topic' = 'Photosynthesis'),
    'Chemistry context excludes Biology';

  r := public.get_tutor_context(null, 0, null, null);
  assert jsonb_array_length(r->'learning'->'topics') = 0, 'no subject/topic → no topic dump';
  assert not exists (select 1 from jsonb_array_elements(r->'learning'->'insights') t where t->>'kind' <> 'weakness'),
    'no subject/topic → weaknesses only';
end $$;

-- 9. Student controls: confirm, correct (needs a note), dismiss; can't edit anything else.
do $$
declare mid uuid := (select id from public.student_memory where kind = 'misconception' and topic = 'Photosynthesis');
begin
  update public.student_memory set status = 'confirmed' where id = mid;
  begin
    update public.student_memory set status = 'corrected', student_note = null where id = mid;
    raise exception 'correction without a note accepted';
  exception when check_violation then null;
  end;
  update public.student_memory set status = 'corrected', student_note = 'I now know mass comes from CO2' where id = mid;
  begin
    update public.student_memory set confidence = 'high' where id = mid;
    raise exception 'student changed confidence';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.service_record_learning('00000000-0000-4000-8000-0000000000a3', null, 'X', 'correct', null, null, null, null, null, null, 'student', null);
    raise exception 'student called the server recorder';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.topic_mastery set level = 6;
    raise exception 'student set their own mastery';
  exception when insufficient_privilege then null;
  end;
  update public.student_memory set status = 'dismissed'
   where kind = 'learning_pattern' and topic = 'Worked examples';
  assert jsonb_array_length(public.get_tutor_context(null, 0, null, null)->'learning'->'patterns') = 0,
    'dismissed insights are never sent to the tutor';
  assert (select r->'learning'->'insights' @> '[{"studentNote":"I now know mass comes from CO2"}]'
            from (select public.get_tutor_context(null, 0, (select id from public.subjects where slug = 'biology'), null) r) x),
    'corrections reach the tutor';
end $$;

-- 10. Another student sees and changes nothing.
select pg_temp.act_as('00000000-0000-4000-8000-0000000000b3');
do $$
declare r jsonb := public.get_learning_profile();
begin
  assert jsonb_array_length(r->'mastery') = 0 and jsonb_array_length(r->'insights') = 0, 'B sees none of A''s profile';
  assert (select count(*) from public.topic_evidence) = 0, 'B sees no evidence';
  perform public.clear_learning_memory();
  perform public.reset_learning_topic((select id from public.subjects where slug = 'biology'), 'photosynthesis');
  update public.student_memory set status = 'dismissed';
  delete from public.topic_mastery;
end $$;

-- 11. A linked parent (every switch on) sees nothing.
select pg_temp.act_as('00000000-0000-4000-8000-0000000000d3');
do $$ begin
  assert (select count(*) from public.topic_evidence) = 0, 'parent: no evidence';
  assert (select count(*) from public.topic_mastery) = 0, 'parent: no mastery';
  assert (select count(*) from public.topic_mastery_changes) = 0, 'parent: no history';
  assert (select count(*) from public.student_memory) = 0, 'parent: no insights';
  begin
    perform public.get_learning_profile();
    raise exception 'parent read a learning profile';
  exception when raise_exception then
    if sqlerrm <> 'LUMIO:wrong_role' then raise; end if;
  end;
end $$;

-- 12. A's data survived; A can reset a topic and clear everything.
select pg_temp.act_as('00000000-0000-4000-8000-0000000000a3');
do $$
declare r jsonb := public.get_learning_profile();
begin
  assert jsonb_array_length(r->'mastery') = 3, 'A still has 3 topics';
  assert (r->>'questionsAnswered')::int > 10, 'questions answered counted';
  perform public.reset_learning_topic((select id from public.subjects where slug = 'biology'), 'photosynthesis');
  assert not exists (select 1 from public.topic_mastery where topic_key = 'photosynthesis'), 'topic reset';
  assert not exists (select 1 from public.student_memory where lower(topic) = 'photosynthesis'), 'topic insights removed';
  assert exists (select 1 from public.topic_mastery where topic_key = 'ionic bonding'), 'other topics kept';
  perform public.clear_learning_memory();
  r := public.get_learning_profile();
  assert jsonb_array_length(r->'mastery') = 0 and jsonb_array_length(r->'insights') = 0
     and (r->>'questionsAnswered')::int = 0, 'learning memory cleared';
end $$;
reset role;

select 'learning intelligence tests: all passed' as result;
rollback;
