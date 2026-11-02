-- Lumio · 0011b · "Last three answers" must be exact even when timestamps tie
-- (several answers in one transaction share now()). Tie-break on insertion order.

create or replace function private.recompute_mastery(p_student uuid, p_subject uuid, p_key text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  st record;
  recent_incorrect boolean;
  new_level smallint;
  old_level smallint;
  topic_name text;
  summary text;
begin
  select
    count(*)::int as n,
    sum(w * s) / nullif(sum(w), 0) as a,
    count(*) filter (where kind in ('correct', 'independent_explanation'))::int as ok,
    count(*) filter (where kind = 'incorrect')::int as bad,
    count(*) filter (where kind = 'partial')::int as part,
    count(*) filter (where kind = 'needed_reexplanation')::int as reexp,
    count(*) filter (where kind = 'assessment')::int as assessed,
    count(distinct (created_at at time zone 'Europe/London')::date)::int as days,
    bool_or(kind = 'independent_explanation' or (kind = 'correct' and difficulty = 'challenging')
            or (kind = 'assessment' and score_percent >= 80)) as deep,
    max(created_at) as last_at,
    min(created_at) as first_at
  into st
  from (
    select kind, difficulty, score_percent, created_at,
      case kind
        when 'correct' then 1.0 when 'independent_explanation' then 1.0 when 'partial' then 0.5
        when 'needed_reexplanation' then 0.25 when 'incorrect' then 0.0
        else score_percent / 100.0 end as s,
      (case kind when 'assessment' then 2.0 when 'independent_explanation' then 1.25
                 when 'needed_reexplanation' then 0.5 else 1.0 end)
      * (case difficulty when 'foundation' then 0.75 when 'challenging' then 1.25 else 1.0 end)
      * power(0.5, extract(epoch from (now() - created_at)) / 86400.0 / 45.0) as w
    from public.topic_evidence
    where student_id = p_student and subject_id = p_subject and topic_key = p_key
  ) e;

  select bool_or(kind = 'incorrect') into recent_incorrect from (
    select kind from public.topic_evidence
     where student_id = p_student and subject_id = p_subject and topic_key = p_key
     order by created_at desc, id desc limit 3
  ) r;

  new_level := case
    when st.n < 2 then 2
    when st.a < 0.50 then 3
    when st.a < 0.75 or st.n < 4 then 4
    when st.a >= 0.85 and st.n >= 6 and st.days >= 2 and coalesce(st.deep, false) and not coalesce(recent_incorrect, false) then 6
    else 5 end;

  select level, topic into old_level, topic_name from public.topic_mastery
   where student_id = p_student and subject_id = p_subject and topic_key = p_key;
  if topic_name is null then
    return; -- the caller creates the row first
  end if;

  update public.topic_mastery set
    level = new_level,
    score = case when st.n >= 2 then round(st.a, 3) end,
    evidence_count = st.n,
    correct_count = st.ok,
    incorrect_count = st.bad,
    last_evidence_at = st.last_at,
    level_changed_at = case when new_level <> old_level then now() else level_changed_at end,
    updated_at = now()
  where student_id = p_student and subject_id = p_subject and topic_key = p_key;

  if new_level <> old_level then
    insert into public.topic_mastery_changes (student_id, subject_id, topic_key, topic, from_level, to_level)
    values (p_student, p_subject, p_key, topic_name, old_level, new_level);
  end if;

  -- Plain-English reason, shown to the student and the tutor.
  summary := concat_ws(', ',
    nullif(format('%s correct', st.ok), '0 correct'),
    nullif(format('%s incorrect', st.bad), '0 incorrect'),
    nullif(format('%s partly correct', st.part), '0 partly correct'),
    nullif(format('%s needed re-explaining', st.reexp), '0 needed re-explaining'),
    nullif(format('%s assessed', st.assessed), '0 assessed'))
    || case when st.first_at is not null
         then format(' — since %s', to_char(st.first_at at time zone 'Europe/London', 'FMDD Mon')) else '' end;

  -- Weakness: needs repeated evidence, not one slip.
  if st.n >= 3 and st.a < 0.5 and st.bad >= 2 then
    insert into public.student_memory (student_id, kind, subject_id, topic, source, confidence, evidence_summary, occurrences)
    values (p_student, 'weakness', p_subject, topic_name, 'tutor_conversation',
            (case when st.n >= 5 then 'high' else 'medium' end)::public.insight_confidence, summary, st.bad)
    on conflict (student_id, kind, coalesce(subject_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(topic))
    do update set confidence = excluded.confidence, evidence_summary = excluded.evidence_summary,
                  occurrences = excluded.occurrences, last_seen_at = now();
  else
    delete from public.student_memory
     where student_id = p_student and kind = 'weakness' and subject_id = p_subject and lower(topic) = lower(topic_name);
  end if;

  -- Strength: only at Strong or Mastered.
  if new_level >= 5 then
    insert into public.student_memory (student_id, kind, subject_id, topic, source, confidence, evidence_summary, occurrences)
    values (p_student, 'strength', p_subject, topic_name, 'tutor_conversation',
            (case when new_level = 6 then 'high' else 'medium' end)::public.insight_confidence, summary, st.ok)
    on conflict (student_id, kind, coalesce(subject_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(topic))
    do update set confidence = excluded.confidence, evidence_summary = excluded.evidence_summary,
                  occurrences = excluded.occurrences, last_seen_at = now();
  else
    delete from public.student_memory
     where student_id = p_student and kind = 'strength' and subject_id = p_subject and lower(topic) = lower(topic_name);
  end if;
end;
$$;
