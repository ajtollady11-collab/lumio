-- Lumio · 0008 · Learning activity, weekly goals and study streaks
--
-- study_activity_events is the single ledger every learning feature reports
-- to (lessons, quizzes, flashcards, exam practice, tutor sessions, notes).
-- Students can READ their own events but never write them: events come from
-- server code or from triggers on feature tables, so streaks and goal progress
-- can't be faked from the browser. Opening the app is not an event.
--
-- Study days use the student's own timezone (student_profiles.timezone).

-- ---------------------------------------------------------------------------
-- Timezone must be a real IANA zone (it feeds `at time zone`).
-- ---------------------------------------------------------------------------
create or replace function private.validate_timezone()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = new.timezone) then
    raise exception 'LUMIO:invalid_timezone' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger student_profiles_validate_timezone
  before insert or update of timezone on public.student_profiles
  for each row execute function private.validate_timezone();

-- ---------------------------------------------------------------------------
-- Activity ledger
-- ---------------------------------------------------------------------------
create type public.study_activity_type as enum (
  'lesson', 'tutor_session', 'quiz', 'flashcards', 'exam_practice', 'revision', 'notes'
);

create table public.study_activity_events (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.student_profiles (profile_id) on delete cascade,
  activity_type public.study_activity_type not null,
  subject_id uuid references public.subjects (id) on delete set null,
  title text check (title is null or char_length(title) between 1 and 120),
  started_at timestamptz,
  occurred_at timestamptz not null default now(),          -- when the activity finished
  active_seconds integer not null default 0 check (active_seconds between 0 and 14400),
  completed boolean not null default false,
  score_percent numeric(5, 2) check (score_percent is null or score_percent between 0 and 100),
  source_table text check (source_table is null or source_table ~ '^[a-z_]{1,63}$'),
  source_id uuid,
  local_date date not null,                                  -- study day in the student's timezone (set by trigger)
  -- What counts towards streaks and goals. Defined here, once, so every
  -- feature is judged by the same rule.
  qualifies boolean generated always as (
    case
      when activity_type in ('lesson', 'quiz', 'exam_practice') then completed
      when activity_type in ('flashcards', 'revision') then active_seconds >= 300
      else false
    end
  ) stored,
  created_at timestamptz not null default now(),
  constraint study_activity_events_started_before_end check (started_at is null or started_at <= occurred_at),
  constraint study_activity_events_source_pair check ((source_table is null) = (source_id is null))
);

-- Idempotency: a feature row reports at most once.
create unique index study_activity_events_source_once
  on public.study_activity_events (source_table, source_id) where source_id is not null;
create index study_activity_events_student_time_idx on public.study_activity_events (student_id, occurred_at desc);
create index study_activity_events_student_day_idx
  on public.study_activity_events (student_id, local_date) where qualifies;
create index study_activity_events_subject_idx on public.study_activity_events (subject_id);

create or replace function private.set_activity_local_date()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  tz text;
begin
  if new.occurred_at > now() + interval '5 minutes' then
    raise exception 'LUMIO:future_activity' using errcode = 'P0001';
  end if;
  select timezone into tz from public.student_profiles where profile_id = new.student_id;
  new.local_date := (new.occurred_at at time zone coalesce(tz, 'Europe/London'))::date;
  return new;
end;
$$;

create trigger study_activity_events_local_date
  before insert or update of occurred_at, student_id on public.study_activity_events
  for each row execute function private.set_activity_local_date();

-- Students read their own events. No user insert/update/delete. Parents get
-- activity through scoped reporting functions in Phase 6 (so results can be
-- hidden when the student turns results sharing off), not direct reads.
revoke all on public.study_activity_events from anon, authenticated;
grant select on public.study_activity_events to authenticated;
alter table public.study_activity_events enable row level security;
create policy "study_activity_events: read own" on public.study_activity_events for select to authenticated
  using (student_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Streaks — maintained by trigger from qualifying study days
-- ---------------------------------------------------------------------------
create table public.student_streaks (
  student_id uuid primary key references public.student_profiles (profile_id) on delete cascade,
  current_streak integer not null default 0 check (current_streak >= 0),  -- run ending on last_active_date
  best_streak integer not null default 0 check (best_streak >= current_streak),
  last_active_date date,
  updated_at timestamptz not null default now()
);

revoke all on public.student_streaks from anon, authenticated;
grant select on public.student_streaks to authenticated;
alter table public.student_streaks enable row level security;
create policy "student_streaks: read own" on public.student_streaks for select to authenticated
  using (student_id = (select auth.uid()));

-- Recomputes from scratch (gaps-and-islands over distinct study days), so
-- back-dated or deleted events can never leave the streak wrong.
create or replace function private.recompute_streak(p_student uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_best integer;
  v_current integer;
  v_last date;
begin
  with days as (
    select distinct local_date as d
    from public.study_activity_events
    where student_id = p_student and qualifies
  ), runs as (
    select d - (row_number() over (order by d))::integer as grp, d from days
  ), islands as (
    select count(*)::integer as len, max(d) as last_day from runs group by grp
  )
  select max(len), max(last_day), (select len from islands order by last_day desc limit 1)
    into v_best, v_last, v_current
  from islands;

  insert into public.student_streaks (student_id, current_streak, best_streak, last_active_date, updated_at)
  values (p_student, coalesce(v_current, 0), coalesce(v_best, 0), v_last, now())
  on conflict (student_id) do update
    set current_streak = excluded.current_streak,
        best_streak = excluded.best_streak,
        last_active_date = excluded.last_active_date,
        updated_at = now();
end;
$$;
revoke all on function private.recompute_streak(uuid) from public;

create or replace function private.activity_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op in ('INSERT', 'UPDATE') then
    perform private.recompute_streak(new.student_id);
  end if;
  if tg_op in ('DELETE', 'UPDATE') and (tg_op = 'DELETE' or old.student_id <> new.student_id) then
    perform private.recompute_streak(old.student_id);
  end if;
  return null;
end;
$$;

create trigger study_activity_events_streak
  after insert or update or delete on public.study_activity_events
  for each row execute function private.activity_changed();

-- Changing timezone moves study days; re-derive them.
create or replace function private.timezone_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.study_activity_events
     set local_date = (occurred_at at time zone new.timezone)::date
   where student_id = new.profile_id;
  perform private.recompute_streak(new.profile_id);
  return null;
end;
$$;

create trigger student_profiles_timezone_changed
  after update of timezone on public.student_profiles
  for each row when (old.timezone is distinct from new.timezone)
  execute function private.timezone_changed();

-- For feature code and triggers (Phase 3+). Not exposed through the Data API.
create or replace function private.record_study_activity(
  p_student uuid,
  p_type public.study_activity_type,
  p_subject uuid,
  p_title text,
  p_started_at timestamptz,
  p_occurred_at timestamptz,
  p_active_seconds integer,
  p_completed boolean,
  p_score_percent numeric,
  p_source_table text,
  p_source_id uuid
)
returns uuid
language sql
security definer
set search_path = ''
as $$
  insert into public.study_activity_events
    (student_id, activity_type, subject_id, title, started_at, occurred_at, active_seconds, completed,
     score_percent, source_table, source_id, local_date)
  values
    (p_student, p_type, p_subject, p_title, p_started_at, coalesce(p_occurred_at, now()),
     coalesce(p_active_seconds, 0), coalesce(p_completed, false), p_score_percent, p_source_table, p_source_id,
     current_date) -- placeholder; replaced by the local-date trigger
  on conflict (source_table, source_id) where source_id is not null do nothing
  returning id;
$$;
revoke all on function private.record_study_activity(uuid, public.study_activity_type, uuid, text, timestamptz,
  timestamptz, integer, boolean, numeric, text, uuid) from public;

-- ---------------------------------------------------------------------------
-- Weekly goals (replaces the unused student_profiles.weekly_study_minutes_goal)
-- ---------------------------------------------------------------------------
create table public.student_learning_goals (
  student_id uuid primary key references public.student_profiles (profile_id) on delete cascade,
  weekly_minutes smallint check (weekly_minutes is null or weekly_minutes between 15 and 3000),
  weekly_lessons smallint check (weekly_lessons is null or weekly_lessons between 1 and 50),
  weekly_subjects smallint check (weekly_subjects is null or weekly_subjects between 1 and 15),
  weekly_revision_sessions smallint check (weekly_revision_sessions is null or weekly_revision_sessions between 1 and 50),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint student_learning_goals_at_least_one check (
    num_nonnulls(weekly_minutes, weekly_lessons, weekly_subjects, weekly_revision_sessions) > 0
  )
);

create trigger student_learning_goals_touch_updated_at
  before update on public.student_learning_goals
  for each row execute function private.touch_updated_at();

insert into public.student_learning_goals (student_id, weekly_minutes)
select profile_id, greatest(15, least(3000, weekly_study_minutes_goal))
from public.student_profiles
where weekly_study_minutes_goal is not null and weekly_study_minutes_goal > 0;

revoke update (weekly_study_minutes_goal) on public.student_profiles from authenticated;
alter table public.student_profiles drop column weekly_study_minutes_goal;

revoke all on public.student_learning_goals from anon, authenticated;
grant select, delete on public.student_learning_goals to authenticated;
grant insert (student_id, weekly_minutes, weekly_lessons, weekly_subjects, weekly_revision_sessions)
  on public.student_learning_goals to authenticated;
grant update (weekly_minutes, weekly_lessons, weekly_subjects, weekly_revision_sessions)
  on public.student_learning_goals to authenticated;

alter table public.student_learning_goals enable row level security;
create policy "student_learning_goals: read own" on public.student_learning_goals for select to authenticated
  using (student_id = (select auth.uid()));
create policy "student_learning_goals: insert own" on public.student_learning_goals for insert to authenticated
  with check (student_id = (select auth.uid()));
create policy "student_learning_goals: update own" on public.student_learning_goals for update to authenticated
  using (student_id = (select auth.uid())) with check (student_id = (select auth.uid()));
create policy "student_learning_goals: delete own" on public.student_learning_goals for delete to authenticated
  using (student_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Dashboard read model: one round trip for all activity-derived figures.
-- SECURITY INVOKER — RLS applies, so it only ever sees the caller's rows.
-- ---------------------------------------------------------------------------
create or replace function public.get_dashboard_activity()
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
  week_start date;
  result jsonb;
begin
  if uid is null then
    raise exception 'LUMIO:not_signed_in' using errcode = 'P0001';
  end if;

  select timezone into tz from public.student_profiles where profile_id = uid;
  if tz is null then
    raise exception 'LUMIO:wrong_role' using errcode = 'P0001';
  end if;
  today := (now() at time zone tz)::date;
  week_start := date_trunc('week', today)::date;  -- Monday

  with ev as (
    select * from public.study_activity_events where student_id = uid
  ), wk as (
    select * from ev where local_date between week_start and week_start + 6
  )
  select jsonb_build_object(
    'timezone', tz,
    'today', today,
    'weekStart', week_start,
    'totals', (
      select jsonb_build_object(
        'events', count(*),
        'lessonsCompleted', count(*) filter (where activity_type = 'lesson' and completed),
        'activeSeconds', coalesce(sum(active_seconds), 0),
        'quizzesCompleted', count(*) filter (where activity_type = 'quiz' and completed),
        'quizAveragePercent', round(avg(score_percent) filter (where activity_type = 'quiz' and completed and score_percent is not null), 1),
        'lastActiveDate', max(local_date) filter (where qualifies),
        'lastActivityAt', max(occurred_at)
      ) from ev
    ),
    'week', (
      select jsonb_build_object(
        'activeSeconds', coalesce(sum(active_seconds), 0),
        'lessons', count(*) filter (where activity_type = 'lesson' and completed),
        'subjects', count(distinct subject_id) filter (where qualifies and subject_id is not null),
        'revisionSessions', count(*) filter (where qualifies and activity_type in ('flashcards', 'revision', 'quiz', 'exam_practice'))
      ) from wk
    ),
    'days', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'date', d::date,
        'qualified', exists (select 1 from wk where wk.local_date = d::date and wk.qualifies),
        'activeSeconds', coalesce((select sum(active_seconds) from wk where wk.local_date = d::date), 0)
      ) order by d), '[]'::jsonb)
      from generate_series(week_start, week_start + 6, interval '1 day') as d
    ),
    'streak', (
      select jsonb_build_object(
        'current', case when s.last_active_date >= today - 1 then s.current_streak else 0 end,
        'best', s.best_streak,
        'lastActiveDate', s.last_active_date
      ) from public.student_streaks s where s.student_id = uid
    ),
    'subjects', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'subjectId', subject_id,
        'lastStudiedDate', last_date,
        'studiedThisWeek', coalesce(last_date >= week_start, false),
        'sessions', sessions,
        'assessedCount', assessed,
        'averagePercent', avg_score
      )), '[]'::jsonb)
      from (
        select subject_id,
               max(local_date) filter (where qualifies) as last_date,
               count(*) filter (where qualifies) as sessions,
               count(*) filter (where activity_type in ('quiz', 'exam_practice') and completed and score_percent is not null) as assessed,
               round(avg(score_percent) filter (where activity_type in ('quiz', 'exam_practice') and completed and score_percent is not null), 1) as avg_score
        from ev where subject_id is not null group by subject_id
      ) per_subject
    ),
    'recent', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', id, 'type', activity_type, 'subjectId', subject_id, 'title', title,
        'occurredAt', occurred_at, 'activeSeconds', active_seconds, 'completed', completed,
        'scorePercent', score_percent
      ) order by occurred_at desc), '[]'::jsonb)
      from (select * from ev order by occurred_at desc limit 8) r
    ),
    'goals', (
      select jsonb_build_object(
        'weeklyMinutes', g.weekly_minutes,
        'weeklyLessons', g.weekly_lessons,
        'weeklySubjects', g.weekly_subjects,
        'weeklyRevisionSessions', g.weekly_revision_sessions
      ) from public.student_learning_goals g where g.student_id = uid
    )
  ) into result;

  return result;
end;
$$;

revoke all on function public.get_dashboard_activity() from public, anon;
grant execute on function public.get_dashboard_activity() to authenticated;
