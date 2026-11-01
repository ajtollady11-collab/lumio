-- Lumio · 0009 · Personal AI tutor: settings, conversations, messages, memory
--
-- Trust model
--   • Students write: their tutor settings, conversation titles/subject/topic,
--     and their OWN messages (role = 'user').
--   • Only server code (secret key) writes: tutor replies (role = 'assistant'),
--     usage events and memory items — so a student can't forge tutor replies,
--     usage or "memories".
--   • Parents have NO access to tutor conversations or memory.
--   • Students can delete their conversations (messages cascade) and any
--     memory item.

-- ---------------------------------------------------------------------------
-- Tutor settings (one per student)
-- ---------------------------------------------------------------------------
create type public.tutor_personality as enum (
  'friendly', 'patient', 'motivational', 'professional', 'strict_supportive', 'encouraging'
);
create type public.tutor_teaching_style as enum (
  'visual', 'conversational', 'detailed', 'simplified', 'question_led', 'example_based'
);
create type public.tutor_pace as enum ('slow', 'balanced', 'fast');
create type public.tutor_depth as enum ('simple', 'standard', 'detailed');

create table public.tutors (
  student_id uuid primary key references public.student_profiles (profile_id) on delete cascade,
  name text not null default 'Nova' check (name ~ '^[[:alnum:]][[:alnum:] ''.-]{0,23}$'),
  personality public.tutor_personality not null default 'friendly',
  teaching_style public.tutor_teaching_style not null default 'conversational',
  pace public.tutor_pace not null default 'balanced',
  depth public.tutor_depth not null default 'standard',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger tutors_touch_updated_at
  before update on public.tutors
  for each row execute function private.touch_updated_at();

revoke all on public.tutors from anon, authenticated;
grant select, delete on public.tutors to authenticated;
grant insert (student_id, name, personality, teaching_style, pace, depth) on public.tutors to authenticated;
grant update (name, personality, teaching_style, pace, depth) on public.tutors to authenticated;
alter table public.tutors enable row level security;
create policy "tutors: read own" on public.tutors for select to authenticated
  using (student_id = (select auth.uid()));
create policy "tutors: insert own" on public.tutors for insert to authenticated
  with check (student_id = (select auth.uid()));
create policy "tutors: update own" on public.tutors for update to authenticated
  using (student_id = (select auth.uid())) with check (student_id = (select auth.uid()));
create policy "tutors: delete own" on public.tutors for delete to authenticated
  using (student_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Conversations
-- ---------------------------------------------------------------------------
create table public.tutor_conversations (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.student_profiles (profile_id) on delete cascade,
  title text not null default 'New conversation' check (char_length(title) between 1 and 80),
  subject_id uuid references public.subjects (id) on delete set null,
  topic text check (topic is null or char_length(topic) between 1 and 80),
  message_count integer not null default 0 check (message_count >= 0),
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index tutor_conversations_student_recent_idx on public.tutor_conversations (student_id, last_message_at desc);
create index tutor_conversations_subject_idx on public.tutor_conversations (subject_id);

create trigger tutor_conversations_touch_updated_at
  before update on public.tutor_conversations
  for each row execute function private.touch_updated_at();

-- Free-plan friendly storage cap: oldest conversations must be deleted first.
create or replace function private.limit_tutor_conversations()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.tutor_conversations where student_id = new.student_id) >= 300 then
    raise exception 'LUMIO:too_many_conversations' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger tutor_conversations_limit
  before insert on public.tutor_conversations
  for each row execute function private.limit_tutor_conversations();

revoke all on public.tutor_conversations from anon, authenticated;
grant select, delete on public.tutor_conversations to authenticated;
grant insert (student_id, title, subject_id, topic) on public.tutor_conversations to authenticated;
grant update (title, subject_id, topic) on public.tutor_conversations to authenticated;
alter table public.tutor_conversations enable row level security;
create policy "tutor_conversations: read own" on public.tutor_conversations for select to authenticated
  using (student_id = (select auth.uid()));
create policy "tutor_conversations: insert own" on public.tutor_conversations for insert to authenticated
  with check (student_id = (select auth.uid()));
create policy "tutor_conversations: update own" on public.tutor_conversations for update to authenticated
  using (student_id = (select auth.uid())) with check (student_id = (select auth.uid()));
create policy "tutor_conversations: delete own" on public.tutor_conversations for delete to authenticated
  using (student_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Messages
-- ---------------------------------------------------------------------------
create type public.tutor_message_role as enum ('user', 'assistant');
create type public.tutor_message_status as enum ('complete', 'interrupted');

create table public.tutor_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.tutor_conversations (id) on delete cascade,
  student_id uuid not null references public.student_profiles (profile_id) on delete cascade,
  role public.tutor_message_role not null,
  content text not null check (char_length(content) between 1 and 12000),
  status public.tutor_message_status not null default 'complete',
  model text check (model is null or char_length(model) <= 64),
  created_at timestamptz not null default now(),
  constraint tutor_messages_user_length check (role <> 'user' or char_length(content) <= 2000)
);
create index tutor_messages_conversation_idx on public.tutor_messages (conversation_id, created_at);
create index tutor_messages_student_recent_idx on public.tutor_messages (student_id, created_at desc)
  where role = 'user';

-- A message belongs to the conversation's owner; conversations hold at most
-- 400 messages (start a new one after that).
create or replace function private.check_tutor_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner uuid;
  n integer;
begin
  select student_id, message_count into owner, n from public.tutor_conversations where id = new.conversation_id;
  if owner is null or owner <> new.student_id then
    raise exception 'LUMIO:not_found' using errcode = 'P0001';
  end if;
  if n >= 400 then
    raise exception 'LUMIO:conversation_full' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger tutor_messages_check
  before insert on public.tutor_messages
  for each row execute function private.check_tutor_message();

create or replace function private.tutor_message_added()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.tutor_conversations
     set message_count = message_count + 1,
         last_message_at = new.created_at
   where id = new.conversation_id;
  return null;
end;
$$;
create trigger tutor_messages_added
  after insert on public.tutor_messages
  for each row execute function private.tutor_message_added();

-- Messages are immutable for users; they disappear with their conversation.
revoke all on public.tutor_messages from anon, authenticated;
grant select on public.tutor_messages to authenticated;
grant insert (conversation_id, student_id, role, content) on public.tutor_messages to authenticated;
alter table public.tutor_messages enable row level security;
create policy "tutor_messages: read own" on public.tutor_messages for select to authenticated
  using (student_id = (select auth.uid()));
create policy "tutor_messages: students insert their own words only" on public.tutor_messages
  for insert to authenticated
  with check (student_id = (select auth.uid()) and role = 'user');

-- ---------------------------------------------------------------------------
-- Student memory — structured facts the tutor may use. Never free-form chat
-- logs. Written only by server code from genuinely recorded events; students
-- can see and delete every item.
-- ---------------------------------------------------------------------------
create type public.memory_kind as enum ('topic_studied', 'strength', 'weakness', 'misconception', 'note');
create type public.memory_source as enum ('tutor_conversation', 'assessment', 'lesson', 'student');

create table public.student_memory (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.student_profiles (profile_id) on delete cascade,
  kind public.memory_kind not null,
  subject_id uuid references public.subjects (id) on delete cascade,
  topic text not null check (char_length(topic) between 1 and 100),
  detail text check (detail is null or char_length(detail) <= 300),
  source public.memory_source not null,
  occurrences integer not null default 1 check (occurrences >= 1),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create unique index student_memory_unique_fact
  on public.student_memory (student_id, kind, coalesce(subject_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(topic));
create index student_memory_student_recent_idx on public.student_memory (student_id, last_seen_at desc);
create index student_memory_subject_idx on public.student_memory (subject_id);

create or replace function private.limit_student_memory()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.student_memory where student_id = new.student_id) >= 500 then
    raise exception 'LUMIO:memory_full' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger student_memory_limit
  before insert on public.student_memory
  for each row execute function private.limit_student_memory();

revoke all on public.student_memory from anon, authenticated;
grant select, delete on public.student_memory to authenticated;
alter table public.student_memory enable row level security;
create policy "student_memory: read own" on public.student_memory for select to authenticated
  using (student_id = (select auth.uid()));
create policy "student_memory: delete own" on public.student_memory for delete to authenticated
  using (student_id = (select auth.uid()));

-- Upsert used by the memory service (service role). Increments occurrences.
create or replace function private.remember(
  p_student uuid, p_kind public.memory_kind, p_subject uuid, p_topic text, p_detail text, p_source public.memory_source
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.student_memory (student_id, kind, subject_id, topic, detail, source)
  values (p_student, p_kind, p_subject, left(btrim(p_topic), 100), left(p_detail, 300), p_source)
  on conflict (student_id, kind, coalesce(subject_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(topic))
  do update set occurrences = public.student_memory.occurrences + 1,
                last_seen_at = now(),
                detail = coalesce(excluded.detail, public.student_memory.detail);
$$;
revoke all on function private.remember(uuid, public.memory_kind, uuid, text, text, public.memory_source) from public;

-- Exposed to the service role only (PostgREST can't reach the private schema).
create or replace function public.service_remember(
  p_student uuid, p_kind public.memory_kind, p_subject uuid, p_topic text, p_detail text, p_source public.memory_source
)
returns void
language sql
security definer
set search_path = ''
as $$
  select private.remember(p_student, p_kind, p_subject, p_topic, p_detail, p_source);
$$;
revoke all on function public.service_remember(uuid, public.memory_kind, uuid, text, text, public.memory_source)
  from public, anon, authenticated;
grant execute on function public.service_remember(uuid, public.memory_kind, uuid, text, text, public.memory_source)
  to service_role;

-- ---------------------------------------------------------------------------
-- Quota check: plan allowance, this month's use and recent message rate in one
-- round trip. SECURITY INVOKER — only the caller's own rows are visible.
-- ---------------------------------------------------------------------------
create or replace function public.get_tutor_quota()
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
  select s.plan_id into plan
    from public.subscriptions s
   where s.owner_id = uid and s.status in ('active', 'trialing')
   order by s.created_at desc limit 1;
  plan := coalesce(plan, 'free');

  return jsonb_build_object(
    'planId', plan,
    'allowance', coalesce((select (p.allowances ->> 'tutor_messages')::int from public.subscription_plans p where p.id = plan), 0),
    'usedThisMonth', coalesce((
      select sum(units) from public.usage_events
       where user_id = uid and allowance = 'tutor_messages' and status = 'succeeded' and created_at >= month_start
    ), 0),
    'complexUsedThisMonth', (
      select count(*) from public.usage_events
       where user_id = uid and feature = 'tutor.chat.complex' and status = 'succeeded' and created_at >= month_start
    ),
    'lastMinute', (
      select count(*) from public.tutor_messages
       where student_id = uid and role = 'user' and created_at > now() - interval '1 minute'
    ),
    'lastHour', (
      select count(*) from public.tutor_messages
       where student_id = uid and role = 'user' and created_at > now() - interval '1 hour'
    )
  );
end;
$$;
revoke all on function public.get_tutor_quota() from public, anon;
grant execute on function public.get_tutor_quota() to authenticated;
