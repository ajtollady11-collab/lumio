-- Lumio · 0013 · Structured AI lessons and notes
--
-- lessons            one row per lesson: settings, AI plan, progress, final report
-- lesson_sections    the planned stages; content is generated one section at a time
-- lesson_questions   understanding checks. Answer keys live in columns students
--                    can't SELECT; the visible copy (`revealed_answer`) is only
--                    filled once the question is resolved.
-- notes              the student's own notes (optionally linked to a lesson)
--
-- Writes to lessons/sections/questions are SERVER ONLY (secret key, student id
-- pinned from the verified session). Students read their own rows. Notes are
-- written by the student directly (RLS). Parents have no access to any of it.

create type public.lesson_difficulty as enum ('beginner', 'standard', 'advanced', 'exam');
create type public.lesson_objective as enum ('from_scratch', 'improve', 'fill_gaps', 'exam_prep', 'hard_practice', 'master');
create type public.lesson_status as enum ('planning', 'in_progress', 'paused', 'completed');
create type public.lesson_section_kind as enum
  ('intro', 'explain', 'example', 'check', 'practice', 'exam_practice', 'final_check', 'summary');
create type public.lesson_section_status as enum ('pending', 'generating', 'ready');
create type public.lesson_question_kind as enum ('mcq', 'short', 'explain', 'calculation', 'application');
create type public.lesson_question_status as enum ('open', 'correct', 'incorrect', 'revealed');

-- ---------------------------------------------------------------------------
-- Lessons
-- ---------------------------------------------------------------------------
create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.student_profiles (profile_id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete restrict,
  topic text not null check (char_length(topic) between 1 and 80),
  curriculum_topic_id uuid references public.curriculum_topics (id) on delete set null,
  difficulty public.lesson_difficulty not null,
  duration_minutes smallint not null check (duration_minutes in (10, 15, 20, 30, 45, 60)),
  objective public.lesson_objective not null,
  teaching_style public.tutor_teaching_style not null,
  status public.lesson_status not null default 'planning',
  title text check (title is null or char_length(title) between 1 and 120),
  -- {intro, objectives[], prerequisites[]} — validated by the server before saving.
  plan jsonb check (plan is null or jsonb_typeof(plan) = 'object'),
  verified_curriculum boolean not null default false,
  plan_model text,
  current_section smallint not null default 0 check (current_section between 0 and 19),
  active_seconds integer not null default 0 check (active_seconds between 0 and 14400),
  last_active_at timestamptz,
  conversation_id uuid references public.tutor_conversations (id) on delete set null,
  -- Per-lesson AI budget (cost control): generations + markings + regenerations.
  ai_calls smallint not null default 0 check (ai_calls between 0 and 120),
  regenerations smallint not null default 0 check (regenerations between 0 and 6),
  -- Final report, computed from recorded activity when the lesson finishes.
  summary jsonb check (summary is null or jsonb_typeof(summary) = 'object'),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lessons_completed_has_time check ((status = 'completed') = (completed_at is not null))
);
create index lessons_student_recent_idx on public.lessons (student_id, created_at desc);
create index lessons_subject_idx on public.lessons (subject_id);
create index lessons_curriculum_topic_idx on public.lessons (curriculum_topic_id);
create unique index lessons_conversation_once on public.lessons (conversation_id) where conversation_id is not null;

create trigger lessons_touch_updated_at
  before update on public.lessons
  for each row execute function private.touch_updated_at();

-- Free-plan friendly cap.
create or replace function private.limit_lessons()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.lessons where student_id = new.student_id) >= 500 then
    raise exception 'LUMIO:too_many_lessons' using errcode = 'P0001';
  end if;
  -- Only the student's own subjects.
  if not exists (select 1 from public.student_subjects where student_id = new.student_id and subject_id = new.subject_id) then
    raise exception 'LUMIO:not_my_subject' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger lessons_limit
  before insert on public.lessons
  for each row execute function private.limit_lessons();

-- ---------------------------------------------------------------------------
-- Sections
-- ---------------------------------------------------------------------------
create table public.lesson_sections (
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  idx smallint not null check (idx between 0 and 19),
  student_id uuid not null references public.student_profiles (profile_id) on delete cascade,
  kind public.lesson_section_kind not null,
  title text not null check (char_length(title) between 1 and 120),
  goal text check (goal is null or char_length(goal) <= 300),
  minutes smallint not null check (minutes between 1 and 20),
  status public.lesson_section_status not null default 'pending',
  content text check (content is null or char_length(content) <= 16000),
  key_points jsonb not null default '[]'::jsonb check (jsonb_typeof(key_points) = 'array'),
  variant smallint not null default 0 check (variant between 0 and 3),
  model text,
  claimed_at timestamptz,
  generated_at timestamptz,
  completed_at timestamptz,
  primary key (lesson_id, idx)
);
create index lesson_sections_student_idx on public.lesson_sections (student_id);

-- Section rows always belong to the lesson's student.
create or replace function private.lesson_child_owner()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (select 1 from public.lessons where id = new.lesson_id and student_id = new.student_id) then
    raise exception 'LUMIO:not_found' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger lesson_sections_owner
  before insert or update of lesson_id, student_id on public.lesson_sections
  for each row execute function private.lesson_child_owner();

-- ---------------------------------------------------------------------------
-- Questions
-- ---------------------------------------------------------------------------
create table public.lesson_questions (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  student_id uuid not null references public.student_profiles (profile_id) on delete cascade,
  section_idx smallint not null check (section_idx between 0 and 19),
  position smallint not null check (position between 0 and 5),
  kind public.lesson_question_kind not null,
  prompt text not null check (char_length(prompt) between 1 and 1500),
  options jsonb check (options is null or jsonb_typeof(options) = 'array'),
  -- Hidden from students (no column grant):
  correct_option smallint check (correct_option is null or correct_option between 0 and 5),
  model_answer text check (model_answer is null or char_length(model_answer) <= 3000),
  marking_guide text check (marking_guide is null or char_length(marking_guide) <= 2000),
  hint text check (hint is null or char_length(hint) <= 500),
  -- Visible state:
  status public.lesson_question_status not null default 'open',
  attempts smallint not null default 0 check (attempts between 0 and 3),
  first_attempt_correct boolean,
  last_answer text check (last_answer is null or char_length(last_answer) <= 2000),
  feedback text check (feedback is null or char_length(feedback) <= 1500),
  shown_hint text check (shown_hint is null or char_length(shown_hint) <= 500),
  revealed_answer text check (revealed_answer is null or char_length(revealed_answer) <= 3000),
  misconception text check (misconception is null or char_length(misconception) <= 200),
  retired boolean not null default false,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint lesson_questions_mcq_shape check (
    (kind = 'mcq') = (options is not null and correct_option is not null)
  ),
  constraint lesson_questions_resolved check ((status = 'open') = (resolved_at is null))
);
create index lesson_questions_lesson_idx on public.lesson_questions (lesson_id, section_idx, position);
create index lesson_questions_student_idx on public.lesson_questions (student_id);
create trigger lesson_questions_owner
  before insert or update of lesson_id, student_id on public.lesson_questions
  for each row execute function private.lesson_child_owner();

-- ---------------------------------------------------------------------------
-- Notes (student-written)
-- ---------------------------------------------------------------------------
create table public.notes (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.student_profiles (profile_id) on delete cascade,
  subject_id uuid references public.subjects (id) on delete set null,
  topic text check (topic is null or char_length(topic) between 1 and 80),
  lesson_id uuid references public.lessons (id) on delete set null,
  title text not null check (char_length(title) between 1 and 120),
  body text not null default '' check (char_length(body) <= 20000),
  source text not null default 'student' check (source in ('student', 'lesson')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index notes_student_recent_idx on public.notes (student_id, updated_at desc);
create index notes_lesson_idx on public.notes (lesson_id) where lesson_id is not null;
create index notes_subject_idx on public.notes (subject_id);
create trigger notes_touch_updated_at
  before update on public.notes
  for each row execute function private.touch_updated_at();

create or replace function private.check_note()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' and (select count(*) from public.notes where student_id = new.student_id) >= 1000 then
    raise exception 'LUMIO:too_many_notes' using errcode = 'P0001';
  end if;
  -- A note can only point at the student's own lesson.
  if new.lesson_id is not null
     and not exists (select 1 from public.lessons where id = new.lesson_id and student_id = new.student_id) then
    raise exception 'LUMIO:not_found' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger notes_check
  before insert or update of lesson_id, student_id on public.notes
  for each row execute function private.check_note();

-- ---------------------------------------------------------------------------
-- Lesson Q&A uses the tutor's conversations, linked to the lesson.
-- Only the server can set lesson_id (no column grant), so a student can't
-- attach a conversation to someone else's lesson.
-- ---------------------------------------------------------------------------
alter table public.tutor_conversations
  add column lesson_id uuid references public.lessons (id) on delete cascade;
create unique index tutor_conversations_lesson_once on public.tutor_conversations (lesson_id) where lesson_id is not null;

-- ---------------------------------------------------------------------------
-- Permissions
-- ---------------------------------------------------------------------------
revoke all on public.lessons, public.lesson_sections, public.lesson_questions, public.notes from anon, authenticated;

grant select on public.lessons to authenticated;
grant delete on public.lessons to authenticated;
grant select on public.lesson_sections to authenticated;
grant select (id, lesson_id, student_id, section_idx, position, kind, prompt, options, status, attempts,
              first_attempt_correct, last_answer, feedback, shown_hint, revealed_answer, misconception,
              retired, created_at, resolved_at)
  on public.lesson_questions to authenticated;
grant select, delete on public.notes to authenticated;
grant insert (student_id, subject_id, topic, lesson_id, title, body, source) on public.notes to authenticated;
grant update (subject_id, topic, title, body) on public.notes to authenticated;

alter table public.lessons enable row level security;
alter table public.lesson_sections enable row level security;
alter table public.lesson_questions enable row level security;
alter table public.notes enable row level security;

create policy "lessons: read own" on public.lessons for select to authenticated
  using (student_id = (select auth.uid()));
create policy "lessons: delete own" on public.lessons for delete to authenticated
  using (student_id = (select auth.uid()));
create policy "lesson_sections: read own" on public.lesson_sections for select to authenticated
  using (student_id = (select auth.uid()));
create policy "lesson_questions: read own" on public.lesson_questions for select to authenticated
  using (student_id = (select auth.uid()));
create policy "notes: read own" on public.notes for select to authenticated
  using (student_id = (select auth.uid()));
create policy "notes: insert own" on public.notes for insert to authenticated
  with check (student_id = (select auth.uid()));
create policy "notes: update own" on public.notes for update to authenticated
  using (student_id = (select auth.uid())) with check (student_id = (select auth.uid()));
create policy "notes: delete own" on public.notes for delete to authenticated
  using (student_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Lesson quota (one read before any lesson AI call). SECURITY INVOKER.
-- `startedThisMonth` counts lesson rows, so two simultaneous starts can't
-- both slip under the allowance after the row exists.
-- ---------------------------------------------------------------------------
create or replace function public.get_lesson_quota()
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  plan text;
  month_start timestamptz := date_trunc('month', now() at time zone 'Europe/London') at time zone 'Europe/London';
begin
  if uid is null then
    raise exception 'LUMIO:not_signed_in' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.student_profiles where profile_id = uid) then
    raise exception 'LUMIO:wrong_role' using errcode = 'P0001';
  end if;
  select s.plan_id into plan
    from public.subscriptions s
   where s.owner_id = uid and s.status in ('active', 'trialing')
   order by s.created_at desc limit 1;
  plan := coalesce(plan, 'free');
  return jsonb_build_object(
    'planId', plan,
    'allowance', coalesce((select (p.allowances ->> 'lessons')::int from public.subscription_plans p where p.id = plan), 0),
    'startedThisMonth', (select count(*) from public.lessons where student_id = uid and created_at >= month_start),
    'aiCallsLastMinute', (
      select count(*) from public.usage_events
       where user_id = uid and feature like 'lesson.%' and created_at > now() - interval '1 minute'
    ),
    'aiCallsLastHour', (
      select count(*) from public.usage_events
       where user_id = uid and feature like 'lesson.%' and created_at > now() - interval '1 hour'
    )
  );
end;
$$;
revoke all on function public.get_lesson_quota() from public, anon;
grant execute on function public.get_lesson_quota() to authenticated;

-- ---------------------------------------------------------------------------
-- Activity ledger entry for a finished lesson (server only). `p_counts` is
-- decided by the server from what the student actually did (most sections
-- completed); only then does the lesson count towards streaks and goals
-- (rule defined in 0008). Ending a lesson after a minute doesn't.
-- ---------------------------------------------------------------------------
create or replace function public.service_record_lesson_activity(p_student uuid, p_lesson uuid, p_counts boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare l record;
begin
  select * into l from public.lessons where id = p_lesson and student_id = p_student and status = 'completed';
  if l.id is null then
    raise exception 'LUMIO:not_found' using errcode = 'P0001';
  end if;
  perform private.record_study_activity(p_student, 'lesson', l.subject_id, left(coalesce(l.title, l.topic), 120),
    l.started_at, l.completed_at, l.active_seconds, coalesce(p_counts, false), null, 'lessons', l.id);
end;
$$;
revoke all on function public.service_record_lesson_activity(uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.service_record_lesson_activity(uuid, uuid, boolean) to service_role;
