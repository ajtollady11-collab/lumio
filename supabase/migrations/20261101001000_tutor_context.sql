-- Lumio · 0010 · Everything one tutor turn needs, in one round trip.
--
-- SECURITY INVOKER: runs as the signed-in student, so RLS limits every read
-- to their own rows. If p_conversation_id belongs to someone else it simply
-- comes back as null (indistinguishable from "doesn't exist").

create or replace function public.get_tutor_context(p_conversation_id uuid default null, p_history integer default 12)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  tz text;
  today date;
begin
  if uid is null then
    raise exception 'LUMIO:not_signed_in' using errcode = 'P0001';
  end if;
  select timezone into tz from public.student_profiles where profile_id = uid;
  if tz is null then
    raise exception 'LUMIO:wrong_role' using errcode = 'P0001';
  end if;
  today := (now() at time zone tz)::date;

  return jsonb_build_object(
    'today', today,
    'quota', public.get_tutor_quota(),
    'profile', (
      select jsonb_build_object(
        'firstName', p.first_name, 'ageBand', p.age_band, 'schoolYear', p.school_year,
        'educationLevel', p.education_level, 'learningPreferences', to_jsonb(p.learning_preferences),
        'academicGoals', p.academic_goals, 'parentalConsent', p.parental_consent
      ) from public.student_profiles p where p.profile_id = uid
    ),
    'tutor', (
      select jsonb_build_object(
        'name', t.name, 'personality', t.personality, 'teachingStyle', t.teaching_style,
        'pace', t.pace, 'depth', t.depth
      ) from public.tutors t where t.student_id = uid
    ),
    'subjects', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'subjectId', ss.subject_id, 'qualificationId', ss.qualification_id, 'examBoardId', ss.exam_board_id,
        'currentGrade', ss.current_grade, 'targetGrade', ss.target_grade, 'confidence', ss.confidence,
        'nextExam', (
          select min(e.exam_date) from public.examination_dates e
           where e.student_id = uid and e.subject_id = ss.subject_id and e.exam_date >= today
        ),
        'assessedCount', (
          select count(*) from public.study_activity_events a
           where a.student_id = uid and a.subject_id = ss.subject_id
             and a.activity_type in ('quiz', 'exam_practice') and a.completed and a.score_percent is not null
        ),
        'averagePercent', (
          select round(avg(a.score_percent), 1) from public.study_activity_events a
           where a.student_id = uid and a.subject_id = ss.subject_id
             and a.activity_type in ('quiz', 'exam_practice') and a.completed and a.score_percent is not null
        ),
        'lastStudiedDate', (
          select max(a.local_date) from public.study_activity_events a
           where a.student_id = uid and a.subject_id = ss.subject_id and a.qualifies
        )
      ) order by ss.created_at), '[]'::jsonb)
      from public.student_subjects ss where ss.student_id = uid
    ),
    'memory', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'kind', m.kind, 'subjectId', m.subject_id, 'topic', m.topic, 'detail', m.detail, 'occurrences', m.occurrences
      ) order by m.last_seen_at desc), '[]'::jsonb)
      from (select * from public.student_memory where student_id = uid order by last_seen_at desc limit 25) m
    ),
    'conversation', (
      select jsonb_build_object(
        'id', c.id, 'title', c.title, 'subjectId', c.subject_id, 'topic', c.topic, 'messageCount', c.message_count
      ) from public.tutor_conversations c where c.id = p_conversation_id and c.student_id = uid
    ),
    'history', (
      select coalesce(jsonb_agg(jsonb_build_object('role', h.role, 'content', h.content) order by h.created_at), '[]'::jsonb)
      from (
        select role, content, created_at from public.tutor_messages
         where conversation_id = p_conversation_id and student_id = uid
         order by created_at desc limit least(greatest(p_history, 0), 40)
      ) h
    )
  );
end;
$$;

revoke all on function public.get_tutor_context(uuid, integer) from public, anon;
grant execute on function public.get_tutor_context(uuid, integer) to authenticated;
