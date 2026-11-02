-- Lumio · 0011 · Student intelligence: evidence → topic mastery → insights
--
-- topic_evidence      compact ledger of things the student actually did on a
--                     topic (answered correctly / incorrectly, explained it
--                     unprompted, needed it re-explained, assessment score).
--                     One row per piece of evidence — never per message.
-- topic_mastery       one row per student × subject × topic, recomputed from
--                     the evidence by a transparent rule (see recompute_mastery).
-- topic_mastery_changes  written only when a level changes → "improvements".
-- student_memory      (existing) now also holds inferred insights — strength,
--                     weakness, misconception, learning_pattern — each with
--                     confidence, evidence summary and a student-controlled status.
--
-- Writes come from server code only (service role). Students read, correct,
-- dismiss and delete their own; parents have no access at all.

-- ---------------------------------------------------------------------------
-- Insights: extend student_memory
-- ---------------------------------------------------------------------------
create type public.insight_status as enum ('active', 'confirmed', 'corrected', 'dismissed');
create type public.insight_confidence as enum ('low', 'medium', 'high');

alter table public.student_memory
  add column status public.insight_status not null default 'active',
  add column confidence public.insight_confidence not null default 'low',
  add column evidence_summary text check (evidence_summary is null or char_length(evidence_summary) <= 300),
  add column student_note text check (student_note is null or char_length(student_note) between 1 and 300),
  add constraint student_memory_correction_has_note check (status <> 'corrected' or student_note is not null);

grant update (status, student_note) on public.student_memory to authenticated;
create policy "student_memory: update own" on public.student_memory for update to authenticated
  using (student_id = (select auth.uid())) with check (student_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Evidence ledger
-- ---------------------------------------------------------------------------
create type public.evidence_kind as enum (
  'correct', 'incorrect', 'partial', 'independent_explanation', 'needed_reexplanation', 'assessment'
);
create type public.evidence_difficulty as enum ('foundation', 'standard', 'challenging');

create or replace function private.topic_key(p_topic text)
returns text
language sql
immutable
set search_path = ''
as $$
  select left(btrim(regexp_replace(regexp_replace(lower(p_topic), '[^a-z0-9 ]+', ' ', 'g'), '\s+', ' ', 'g')), 60);
$$;

create table public.topic_evidence (
  id bigint generated always as identity primary key,
  student_id uuid not null references public.student_profiles (profile_id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  topic_key text not null check (topic_key ~ '^[a-z0-9][a-z0-9 ]{0,59}$'),
  topic text not null check (char_length(topic) between 1 and 60),
  kind public.evidence_kind not null,
  difficulty public.evidence_difficulty not null default 'standard',
  score_percent numeric(5, 2) check (score_percent is null or score_percent between 0 and 100),
  misconception text check (misconception is null or char_length(misconception) between 1 and 200),
  effective_approach text check (effective_approach in
    ('visual', 'worked_example', 'step_by_step', 'questioning', 'analogy', 'detailed', 'simplified')),
  student_confidence text check (student_confidence in ('confident', 'unsure')),
  next_step text check (next_step in ('practise_more', 'revisit_basics', 'try_harder_questions', 'try_exam_question', 'move_on')),
  source public.memory_source not null,
  conversation_id uuid references public.tutor_conversations (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint topic_evidence_assessment_score check ((kind = 'assessment') = (score_percent is not null))
);
create index topic_evidence_topic_idx on public.topic_evidence (student_id, subject_id, topic_key, created_at desc);
create index topic_evidence_subject_idx on public.topic_evidence (subject_id);
create index topic_evidence_conversation_idx on public.topic_evidence (conversation_id);

revoke all on public.topic_evidence from anon, authenticated;
grant select, delete on public.topic_evidence to authenticated;
alter table public.topic_evidence enable row level security;
create policy "topic_evidence: read own" on public.topic_evidence for select to authenticated
  using (student_id = (select auth.uid()));
create policy "topic_evidence: delete own" on public.topic_evidence for delete to authenticated
  using (student_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Mastery
-- ---------------------------------------------------------------------------
create table public.topic_mastery (
  student_id uuid not null references public.student_profiles (profile_id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  topic_key text not null,
  topic text not null check (char_length(topic) between 1 and 60),
  -- 1 Not started · 2 Introduced · 3 Developing · 4 Good · 5 Strong · 6 Mastered
  level smallint not null default 2 check (level between 1 and 6),
  score numeric(4, 3) check (score is null or score between 0 and 1),   -- recency-weighted accuracy
  evidence_count integer not null default 0,
  correct_count integer not null default 0,
  incorrect_count integer not null default 0,
  first_seen_at timestamptz not null default now(),
  last_evidence_at timestamptz,
  last_seen_at timestamptz not null default now(),
  level_changed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (student_id, subject_id, topic_key)
);
create index topic_mastery_recent_idx on public.topic_mastery (student_id, last_seen_at desc);
create index topic_mastery_subject_idx on public.topic_mastery (subject_id);

create table public.topic_mastery_changes (
  id bigint generated always as identity primary key,
  student_id uuid not null references public.student_profiles (profile_id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  topic_key text not null,
  topic text not null,
  from_level smallint not null check (from_level between 1 and 6),
  to_level smallint not null check (to_level between 1 and 6),
  changed_at timestamptz not null default now()
);
create index topic_mastery_changes_student_idx on public.topic_mastery_changes (student_id, changed_at desc);
create index topic_mastery_changes_subject_idx on public.topic_mastery_changes (subject_id);

revoke all on public.topic_mastery, public.topic_mastery_changes from anon, authenticated;
grant select, delete on public.topic_mastery, public.topic_mastery_changes to authenticated;
alter table public.topic_mastery enable row level security;
alter table public.topic_mastery_changes enable row level security;
create policy "topic_mastery: read own" on public.topic_mastery for select to authenticated
  using (student_id = (select auth.uid()));
create policy "topic_mastery: delete own" on public.topic_mastery for delete to authenticated
  using (student_id = (select auth.uid()));
create policy "topic_mastery_changes: read own" on public.topic_mastery_changes for select to authenticated
  using (student_id = (select auth.uid()));
create policy "topic_mastery_changes: delete own" on public.topic_mastery_changes for delete to authenticated
  using (student_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- The mastery rule (documented in LUMIO_AI_ARCHITECTURE.md §0b).
--
-- Each piece of evidence has a value s and a weight w:
--   correct 1 · independent explanation 1 (w×1.25) · partial 0.5 ·
--   needed re-explanation 0.25 (w×0.5) · incorrect 0 · assessment score/100 (w×2)
--   difficulty: foundation w×0.75 · standard ×1 · challenging ×1.25
--   recency: w × 0.5^(age in days / 45)   — recent work counts most
-- score a = Σ w·s / Σ w ;  n = number of pieces of evidence
--
--   n < 2                          → 2 Introduced  (shown as "Not assessed yet")
--   a < 0.50                       → 3 Developing
--   a < 0.75  or  n < 4            → 4 Good
--   a ≥ 0.85, n ≥ 6, ≥ 2 different days, at least one "deep" signal
--   (challenging correct, independent explanation or assessment ≥ 80%),
--   and no incorrect answer among the last 3   → 6 Mastered
--   otherwise                      → 5 Strong
-- Time spent is never an input. One correct answer can never exceed Introduced.
-- ---------------------------------------------------------------------------
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
     order by created_at desc limit 3
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
revoke all on function private.recompute_mastery(uuid, uuid, text) from public;

-- Deleting evidence (topic reset / clear memory) keeps mastery consistent.
create or replace function private.evidence_deleted()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.recompute_mastery(old.student_id, old.subject_id, old.topic_key);
  return null;
end;
$$;
create trigger topic_evidence_deleted
  after delete on public.topic_evidence
  for each row execute function private.evidence_deleted();

-- Ledger cap: keep the most recent 3,000 pieces of evidence per student.
create or replace function private.cap_topic_evidence()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.topic_evidence where student_id = new.student_id) > 3000 then
    delete from public.topic_evidence where id in (
      select id from public.topic_evidence where student_id = new.student_id order by created_at asc limit 100);
  end if;
  return null;
end;
$$;
create trigger topic_evidence_cap
  after insert on public.topic_evidence
  for each row execute function private.cap_topic_evidence();

-- ---------------------------------------------------------------------------
-- The single write path for learning signals (server / service role only).
-- p_kind null = exposure only (the topic was studied; no judgement).
-- ---------------------------------------------------------------------------
create or replace function public.service_record_learning(
  p_student uuid,
  p_subject uuid,
  p_topic text,
  p_kind public.evidence_kind,
  p_difficulty public.evidence_difficulty,
  p_score numeric,
  p_misconception text,
  p_approach text,
  p_student_confidence text,
  p_next_step text,
  p_source public.memory_source,
  p_conversation uuid
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  k text := private.topic_key(p_topic);
  name text := left(btrim(regexp_replace(p_topic, '\s+', ' ', 'g')), 60);
  approach_label text;
begin
  if k is null or k = '' or k !~ '^[a-z0-9]' then
    return 'invalid_topic';
  end if;
  -- Only the student's own subjects.
  if not exists (select 1 from public.student_subjects where student_id = p_student and subject_id = p_subject) then
    return 'not_my_subject';
  end if;

  insert into public.topic_mastery (student_id, subject_id, topic_key, topic)
  values (p_student, p_subject, k, name)
  on conflict (student_id, subject_id, topic_key) do update set last_seen_at = now();

  if p_kind is null then
    -- Exposure: remembered (and counted) as "studied with you".
    perform private.remember(p_student, 'topic_studied', p_subject, name, null, p_source);
    return 'exposure';
  end if;

  -- Evidence implies the topic was studied, without inflating the count.
  insert into public.student_memory (student_id, kind, subject_id, topic, source)
  values (p_student, 'topic_studied', p_subject, name, p_source)
  on conflict (student_id, kind, coalesce(subject_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(topic))
  do update set last_seen_at = now();

  insert into public.topic_evidence (student_id, subject_id, topic_key, topic, kind, difficulty, score_percent,
                                     misconception, effective_approach, student_confidence, next_step, source, conversation_id)
  values (p_student, p_subject, k, name, p_kind, coalesce(p_difficulty, 'standard'), p_score,
          nullif(left(btrim(p_misconception), 200), ''), p_approach, p_student_confidence, p_next_step, p_source, p_conversation);

  perform private.recompute_mastery(p_student, p_subject, k);

  if nullif(btrim(p_misconception), '') is not null and p_kind in ('incorrect', 'partial') then
    insert into public.student_memory (student_id, kind, subject_id, topic, detail, source, confidence, evidence_summary)
    values (p_student, 'misconception', p_subject, name, left(btrim(p_misconception), 300), p_source, 'low',
            format('Noticed in an answer on %s', to_char(now() at time zone 'Europe/London', 'FMDD Mon')))
    on conflict (student_id, kind, coalesce(subject_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(topic))
    do update set detail = excluded.detail,
                  occurrences = public.student_memory.occurrences + 1,
                  confidence = (case when public.student_memory.occurrences + 1 >= 3 then 'high' else 'medium' end)::public.insight_confidence,
                  evidence_summary = format('Seen in %s answers, most recently %s', public.student_memory.occurrences + 1,
                                            to_char(now() at time zone 'Europe/London', 'FMDD Mon')),
                  last_seen_at = now();
  end if;

  if p_approach is not null and p_kind in ('correct', 'independent_explanation') then
    approach_label := case p_approach
      when 'visual' then 'Visual explanations' when 'worked_example' then 'Worked examples'
      when 'step_by_step' then 'Step-by-step breakdowns' when 'questioning' then 'Guiding questions'
      when 'analogy' then 'Analogies' when 'detailed' then 'Detailed explanations'
      when 'simplified' then 'Simplified explanations' end;
    insert into public.student_memory (student_id, kind, subject_id, topic, detail, source, confidence, evidence_summary)
    values (p_student, 'learning_pattern', null, approach_label, null, p_source, 'low',
            format('Helped with %s', name))
    on conflict (student_id, kind, coalesce(subject_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(topic))
    do update set occurrences = public.student_memory.occurrences + 1,
                  confidence = (case when public.student_memory.occurrences + 1 >= 4 then 'high'
                                     when public.student_memory.occurrences + 1 >= 2 then 'medium' else 'low' end)::public.insight_confidence,
                  evidence_summary = format('Helped %s times, most recently with %s', public.student_memory.occurrences + 1, name),
                  last_seen_at = now();
  end if;

  return 'recorded';
end;
$$;
revoke all on function public.service_record_learning(uuid, uuid, text, public.evidence_kind, public.evidence_difficulty,
  numeric, text, text, text, text, public.memory_source, uuid) from public, anon, authenticated;
grant execute on function public.service_record_learning(uuid, uuid, text, public.evidence_kind, public.evidence_difficulty,
  numeric, text, text, text, text, public.memory_source, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Student controls (run as the student; RLS applies)
-- ---------------------------------------------------------------------------
create or replace function public.reset_learning_topic(p_subject uuid, p_topic_key text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  name text;
begin
  select topic into name from public.topic_mastery where student_id = uid and subject_id = p_subject and topic_key = p_topic_key;
  delete from public.topic_evidence where student_id = uid and subject_id = p_subject and topic_key = p_topic_key;
  delete from public.topic_mastery_changes where student_id = uid and subject_id = p_subject and topic_key = p_topic_key;
  delete from public.topic_mastery where student_id = uid and subject_id = p_subject and topic_key = p_topic_key;
  if name is not null then
    delete from public.student_memory where student_id = uid and subject_id = p_subject and lower(topic) = lower(name);
  end if;
end;
$$;

create or replace function public.clear_learning_memory()
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare uid uuid := auth.uid();
begin
  delete from public.topic_evidence where student_id = uid;
  delete from public.topic_mastery_changes where student_id = uid;
  delete from public.topic_mastery where student_id = uid;
  delete from public.student_memory where student_id = uid;
end;
$$;

revoke all on function public.reset_learning_topic(uuid, text) from public, anon;
revoke all on function public.clear_learning_memory() from public, anon;
grant execute on function public.reset_learning_topic(uuid, text) to authenticated;
grant execute on function public.clear_learning_memory() to authenticated;

-- ---------------------------------------------------------------------------
-- Learning profile read model (one round trip, own rows only)
-- ---------------------------------------------------------------------------
create or replace function public.get_learning_profile()
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'LUMIO:not_signed_in' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.student_profiles where profile_id = uid) then
    raise exception 'LUMIO:wrong_role' using errcode = 'P0001';
  end if;
  return jsonb_build_object(
    'mastery', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'subjectId', m.subject_id, 'topicKey', m.topic_key, 'topic', m.topic, 'level', m.level, 'score', m.score,
        'evidenceCount', m.evidence_count, 'correctCount', m.correct_count, 'incorrectCount', m.incorrect_count,
        'firstSeenAt', m.first_seen_at, 'lastEvidenceAt', m.last_evidence_at, 'lastSeenAt', m.last_seen_at,
        'levelChangedAt', m.level_changed_at
      ) order by m.last_seen_at desc), '[]'::jsonb)
      from (select * from public.topic_mastery where student_id = uid order by last_seen_at desc limit 300) m
    ),
    'changes', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'subjectId', c.subject_id, 'topicKey', c.topic_key, 'topic', c.topic,
        'fromLevel', c.from_level, 'toLevel', c.to_level, 'changedAt', c.changed_at
      ) order by c.changed_at desc), '[]'::jsonb)
      from (select * from public.topic_mastery_changes where student_id = uid order by changed_at desc limit 200) c
    ),
    'insights', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', i.id, 'kind', i.kind, 'subjectId', i.subject_id, 'topic', i.topic, 'detail', i.detail,
        'source', i.source, 'occurrences', i.occurrences, 'status', i.status, 'confidence', i.confidence,
        'evidenceSummary', i.evidence_summary, 'studentNote', i.student_note,
        'firstSeenAt', i.first_seen_at, 'lastSeenAt', i.last_seen_at
      ) order by i.last_seen_at desc), '[]'::jsonb)
      from (select * from public.student_memory where student_id = uid order by last_seen_at desc limit 300) i
    ),
    'questionsAnswered', (
      select count(*) from public.topic_evidence
       where student_id = uid and kind in ('correct', 'incorrect', 'partial', 'independent_explanation')
    )
  );
end;
$$;
revoke all on function public.get_learning_profile() from public, anon;
grant execute on function public.get_learning_profile() to authenticated;
