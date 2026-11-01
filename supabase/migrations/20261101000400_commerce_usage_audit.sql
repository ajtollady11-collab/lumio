-- Lumio · 0004 · Plans, subscriptions, usage ledger, audit log
-- Writes to subscriptions, usage and audit are SERVICE-ROLE ONLY (Stripe
-- webhooks, the usage accounting service, server actions). Users may read
-- their own subscription and usage; nothing more.

-- ---------------------------------------------------------------------------
-- Plans — prices and allowances are data, editable from the admin dashboard.
-- ---------------------------------------------------------------------------
create table public.subscription_plans (
  id text primary key check (id ~ '^[a-z0-9_]+$'),
  name text not null,
  currency text not null default 'gbp' check (currency = lower(currency) and char_length(currency) = 3),
  monthly_price_pence integer not null check (monthly_price_pence >= 0),
  annual_price_pence integer check (annual_price_pence is null or annual_price_pence >= 0),
  max_students smallint not null default 1 check (max_students between 1 and 10),
  -- Monthly allowances per student, keyed by allowance (see LUMIO_COST_CONTROL.md).
  allowances jsonb not null default '{}'::jsonb check (jsonb_typeof(allowances) = 'object'),
  stripe_monthly_price_id text,
  stripe_annual_price_id text,
  is_public boolean not null default true,
  is_active boolean not null default true,
  sort_order smallint not null default 0,
  updated_at timestamptz not null default now()
);

create trigger subscription_plans_touch_updated_at
  before update on public.subscription_plans
  for each row execute function private.touch_updated_at();

-- Provisional allowances from the master specification. To be validated
-- against measured provider costs before launch.
insert into public.subscription_plans (id, name, monthly_price_pence, annual_price_pence, max_students, allowances, is_active, sort_order) values
  ('free', 'Lumio Free', 0, null, 1, '{
    "tutor_messages": 50, "lessons": 2, "voice_minutes": 0, "flashcards_generated": 50,
    "quizzes": 10, "exam_questions_marked": 5, "notes_generated": 5, "diagrams_generated": 5
  }', true, 10),
  ('premium', 'Lumio Premium', 2999, null, 1, '{
    "tutor_messages": 1000, "lessons": 60, "voice_minutes": 120, "flashcards_generated": 500,
    "quizzes": 150, "exam_questions_marked": 100, "notes_generated": 100, "diagrams_generated": 100
  }', true, 20),
  ('family', 'Lumio Family', 4499, null, 3, '{
    "tutor_messages": 1000, "lessons": 60, "voice_minutes": 120, "flashcards_generated": 500,
    "quizzes": 150, "exam_questions_marked": 100, "notes_generated": 100, "diagrams_generated": 100
  }', false, 30);  -- planned: inactive until the family system ships

-- ---------------------------------------------------------------------------
-- Subscriptions — mirror of Stripe state, written only by verified webhooks.
-- ---------------------------------------------------------------------------
create type public.subscription_status as enum (
  'trialing', 'active', 'past_due', 'canceled', 'incomplete', 'incomplete_expired', 'unpaid', 'paused'
);
create type public.billing_interval as enum ('month', 'year');

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  plan_id text not null references public.subscription_plans (id) on delete restrict,
  status public.subscription_status not null,
  billing_interval public.billing_interval not null default 'month',
  stripe_customer_id text,
  stripe_subscription_id text unique,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index subscriptions_owner_idx on public.subscriptions (owner_id, status);
create unique index subscriptions_stripe_customer_idx on public.subscriptions (stripe_customer_id)
  where stripe_customer_id is not null and status in ('trialing', 'active', 'past_due');

create trigger subscriptions_touch_updated_at
  before update on public.subscriptions
  for each row execute function private.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Usage ledger — one append-only row per billable AI operation.
-- Allowance checks and cost reporting both read from here.
-- ---------------------------------------------------------------------------
create type public.allowance_key as enum (
  'tutor_messages', 'lessons', 'voice_minutes', 'flashcards_generated',
  'quizzes', 'exam_questions_marked', 'notes_generated', 'diagrams_generated'
);

create table public.usage_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  plan_id text references public.subscription_plans (id) on delete set null,
  feature text not null check (feature ~ '^[a-z0-9_.]+$'),       -- e.g. tutor.chat, lesson.plan
  allowance public.allowance_key,                                   -- null = not counted against an allowance
  units numeric(10, 2) not null default 0 check (units >= 0),       -- messages, minutes, cards…
  provider text,
  model text,
  input_tokens integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  cached_input_tokens integer not null default 0 check (cached_input_tokens >= 0),
  audio_seconds numeric(10, 2) not null default 0 check (audio_seconds >= 0),
  estimated_cost_usd_micros bigint not null default 0 check (estimated_cost_usd_micros >= 0),
  -- Groups the many model calls inside one lesson so it counts once against `lessons`.
  parent_operation_id uuid,
  request_id text,
  status text not null default 'succeeded' check (status in ('succeeded', 'failed', 'refunded')),
  created_at timestamptz not null default now()
);
create index usage_events_user_month_idx on public.usage_events (user_id, created_at desc);
create index usage_events_allowance_idx on public.usage_events (user_id, allowance, created_at) where allowance is not null;
create index usage_events_created_idx on public.usage_events using brin (created_at);

-- Current calendar-month usage per allowance (Europe/London months).
create view public.usage_current_month
with (security_invoker = true) as
select
  user_id,
  allowance,
  sum(units) as units_used,
  sum(estimated_cost_usd_micros) as cost_usd_micros
from public.usage_events
where allowance is not null
  and status = 'succeeded'
  and created_at >= (date_trunc('month', now() at time zone 'Europe/London') at time zone 'Europe/London')
group by user_id, allowance;

-- ---------------------------------------------------------------------------
-- Audit log — append-only record of sensitive actions.
-- ---------------------------------------------------------------------------
create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users (id) on delete set null,
  action text not null check (action ~ '^[a-z0-9_.]+$'),          -- e.g. link.accepted, plan.updated
  target_table text,
  target_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_actor_idx on public.audit_logs (actor_id, created_at desc);
create index audit_logs_target_idx on public.audit_logs (target_table, target_id);

create or replace function private.prevent_audit_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'audit_logs is append-only';
end;
$$;

create trigger audit_logs_append_only
  before update or delete on public.audit_logs
  for each row execute function private.prevent_audit_mutation();

-- ---------------------------------------------------------------------------
-- Privileges and policies
-- ---------------------------------------------------------------------------
revoke all on public.subscription_plans, public.subscriptions, public.usage_events, public.audit_logs
  from anon, authenticated;
revoke all on public.usage_current_month from anon, authenticated;

grant select (id, name, currency, monthly_price_pence, annual_price_pence, max_students, allowances,
              is_public, is_active, sort_order)
  on public.subscription_plans to anon, authenticated;
grant select on public.subscriptions to authenticated;
grant select on public.usage_events to authenticated;
grant select on public.usage_current_month to authenticated;
grant select on public.audit_logs to authenticated;

alter table public.subscription_plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.usage_events enable row level security;
alter table public.audit_logs enable row level security;

create policy "plans: public read" on public.subscription_plans for select to anon, authenticated
  using (is_public);

create policy "subscriptions: owner read" on public.subscriptions for select to authenticated
  using (owner_id = (select auth.uid()));
create policy "subscriptions: staff read" on public.subscriptions for select to authenticated
  using ((select public.is_staff()));

create policy "usage: owner read" on public.usage_events for select to authenticated
  using (user_id = (select auth.uid()));
create policy "usage: staff read" on public.usage_events for select to authenticated
  using ((select public.is_staff()));

create policy "audit: staff read" on public.audit_logs for select to authenticated
  using ((select public.is_staff('admin')));
