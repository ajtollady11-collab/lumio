-- Lumio · 0012 · Tutor context carries only RELEVANT learning memory
--
-- Replaces get_tutor_context(uuid, integer). Instead of the student's 25
-- most recent memories, it returns a `learning` block scoped to the
-- conversation's subject and topic:
--   subject known  → up to 10 topic-mastery rows in that subject (the current
--                    topic first) and up to 8 insights in that subject
--   topic only     → rows/insights whose topic matches, any subject (≤ 5)
--   neither        → only the 3 most recent weaknesses (to suggest topics)
--   always         → up to 3 learning patterns seen at least twice
-- Dismissed insights are never sent. Corrected ones carry the student's note.

drop function if exists public.get_tutor_context(uuid, integer);

create or replace function public.get_tutor_context(
  p_conversation_id uuid default null,
  p_history integer default 12,
  p_subject_id uuid default null,
  p_topic text default null
)
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
  conv record;
  s uuid;
  tk text;
begin
  if uid is null then
    raise exception 'LUMIO:not_signed_in' using errcode = 'P0001';
  end if;
  select timezone into tz from public.student_profiles where profile_id = uid;
  if tz is null then
    raise exception 'LUMIO:wrong_role' using errcode = 'P0001';
  end if;
  today := (now() at time zone tz)::date;

  select id, title, subject_id, topic, message_count into conv
    from public.tutor_conversations where id = p_conversation_id and student_id = uid;
  s := coalesce(p_subject_id, conv.subject_id);
  tk := nullif(private.topic_key(coalesce(nullif(btrim(p_topic), ''), conv.topic)), '');

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
    'learning', jsonb_build_object(
      'focusSubjectId', s,
      'topics', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'subjectId', m.subject_id, 'topic', m.topic, 'level', m.level, 'evidenceCount', m.evidence_count,
          'correctCount', m.correct_count, 'incorrectCount', m.incorrect_count, 'lastEvidenceAt', m.last_evidence_at,
          'isFocus', tk is not null and m.topic_key = tk
        ) order by (tk is not null and m.topic_key = tk) desc, m.last_seen_at desc), '[]'::jsonb)
        from (
          select * from public.topic_mastery m
           where m.student_id = uid
             and ((s is not null and m.subject_id = s)
                  or (s is null and tk is not null
                      and (m.topic_key = tk or m.topic_key like '%' || tk || '%' or tk like '%' || m.topic_key || '%')))
           order by (tk is not null and m.topic_key = tk) desc, m.last_seen_at desc
           limit case when s is not null then 10 else 5 end
        ) m
      ),
      'insights', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'kind', i.kind, 'subjectId', i.subject_id, 'topic', i.topic, 'detail', i.detail, 'status', i.status,
          'studentNote', i.student_note, 'confidence', i.confidence, 'evidenceSummary', i.evidence_summary
        ) order by i.rank), '[]'::jsonb)
        from (
          select mm.*,
            row_number() over (order by (tk is not null and private.topic_key(mm.topic) = tk) desc,
                               case mm.kind when 'misconception' then 0 when 'weakness' then 1 else 2 end,
                               mm.last_seen_at desc) as rank
            from public.student_memory mm
           where mm.student_id = uid
             and mm.status <> 'dismissed'
             and mm.kind in ('weakness', 'misconception', 'strength')
             and (
               (s is not null and mm.subject_id = s)
               or (s is null and tk is not null and private.topic_key(mm.topic) like '%' || tk || '%')
               or (s is null and tk is null and mm.kind = 'weakness')
             )
           order by rank
           limit case when s is not null then 8 when tk is not null then 5 else 3 end
        ) i
      ),
      'patterns', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'topic', p.topic, 'occurrences', p.occurrences, 'status', p.status, 'studentNote', p.student_note
        ) order by p.occurrences desc), '[]'::jsonb)
        from (
          select * from public.student_memory
           where student_id = uid and kind = 'learning_pattern' and status <> 'dismissed' and occurrences >= 2
           order by occurrences desc limit 3
        ) p
      ),
      'knownTopics', (
        select coalesce(jsonb_agg(m.topic order by m.last_seen_at desc), '[]'::jsonb)
        from (select topic, last_seen_at from public.topic_mastery
               where student_id = uid and s is not null and subject_id = s
               order by last_seen_at desc limit 30) m
      )
    ),
    'conversation', (
      select jsonb_build_object(
        'id', conv.id, 'title', conv.title, 'subjectId', conv.subject_id, 'topic', conv.topic, 'messageCount', conv.message_count
      ) where conv.id is not null
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

revoke all on function public.get_tutor_context(uuid, integer, uuid, text) from public, anon;
grant execute on function public.get_tutor_context(uuid, integer, uuid, text) to authenticated;
