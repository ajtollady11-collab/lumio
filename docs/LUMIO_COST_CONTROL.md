# Lumio — Cost Control

> Commercial guard-rails for AI spend. Engineering target: **£3–4 variable cost per Premium subscriber per month** (to validate, not guaranteed).
> Last updated: 2026-11-01 (AI tutor).

## 1. Built so far ✅

* `subscription_plans.allowances` — per-plan, per-student monthly allowances as data (admin-editable in Phase 7).
* `usage_events` — append-only ledger: user, plan, feature, allowance, units, provider, model, input/output/cached tokens, audio seconds, estimated cost (USD micros), `parent_operation_id`, status.
* `usage_current_month` — current Europe/London month totals per allowance.
* Users can read only their own usage; **only server code with the secret key can write** (verified by the RLS suite).

## 2. Allowances (provisional)

| Allowance key | Free | Premium | Family (per student) |
|---|---|---|---|
| `tutor_messages` | 50 | 1,000 | 1,000 |
| `lessons` | 2 | 60 | 60 |
| `voice_minutes` | 0 | 120 | 120 |
| `flashcards_generated` | 50 | 500 | 500 |
| `quizzes` | 10 | 150 | 150 |
| `exam_questions_marked` | 5 | 100 | 100 |
| `notes_generated` | 5 | 100 | 100 |
| `diagrams_generated` | 5 | 100 | 100 |

Free-plan numbers are a proposal for review. Nothing is ever marketed as unlimited (enforced by a unit test on plan copy).

**Lessons count once.** Every model call inside a lesson shares the lesson's `parent_operation_id` and records `allowance = null`; only the lesson start consumes one `lessons` unit. Questions asked during a lesson do not consume `tutor_messages`. Voice minutes inside a lesson do consume `voice_minutes` (real marginal cost).

## 3a. Tutor chat — implemented (2026-11-01)

Every tutor turn, server-side, before any AI call (`src/server/tutor/turn.ts`):

1. **One read** (`get_tutor_context`) returns the plan, this month's `tutor_messages` use, escalations used, and the student's message count in the last minute / hour.
2. **Rate limits**: 6 messages/minute, 60/hour per student (abuse guard, independent of plan).
3. **Allowance**: refused once `usedThisMonth ≥ plan allowance` (Free 50, Premium 1,000). Never unlimited. Resets with the calendar month (Europe/London), no cron.
4. **Model routing** (`src/lib/ai/router.ts`): Claude Haiku 5.5 by default. Escalate to Claude Sonnet 5.5 only when the student signals they're stuck (e.g. "I still don't get it") or writes a long question (>700 chars) **and** the plan's monthly escalation budget isn't spent (Free 5, Premium 100 ≈ 10% of messages). Escalations are logged as feature `tutor.chat.complex`.
5. **Prompt caching**: the teaching foundation (identical for every student) is sent as a cached system block; per-student context follows it.
6. **Output caps** by explanation depth: 700 / 1,200 / 2,000 tokens. **History** limited to the last 12 messages and ~16k characters — structured student context replaces long transcripts.
7. **Ledger**: one `usage_events` row per reply — provider, model, input / output / cache-read tokens, estimated cost (USD micros), provider request id. Failed replies consume nothing (the unanswered message is removed). If a student stops a reply, it's recorded with tokens estimated at ~4 characters per token (marked by a null request id).

### Prices used (USD per million tokens, prompts < 100K)

| Model | Input | Output | Cache write | Cache read |
|---|---|---|---|---|
| `claude-haiku-5-5` | 0.10 | 0.50 | 0.125 | 0.01 |
| `claude-sonnet-5-5` | 2.00 | 10.00 | 2.50 | 0.10 |

Source: published price tables as of 2026-11-01 (e.g. braindetox.kr "Reading the Claude Haiku 5.5 Price Table"). ⚠️ **Confirm against Anthropic's own pricing page** before relying on these for margins; update `src/lib/ai/models.ts` if they differ. The provider invoice is the source of truth.

### Expected cost per Premium student (worked example, to validate)

A typical turn ≈ 3,000 fresh input tokens + 2,000 cached + 400 output.
* Haiku: 3,000×0.10 + 2,000×0.01 + 400×0.50 = **$0.00052** per message.
* Sonnet: 3,000×2 + 2,000×0.10 + 400×10 = **$0.0102** per message.
* 1,000 messages with 10% escalated: 900×0.00052 + 100×0.0102 ≈ **$1.49 (~£1.15)/month** at full allowance.

Well inside the £3–4 target, leaving room for lessons, voice and marking. Real figures will come from the ledger.

**Also set a hard monthly spend limit in the Anthropic console** (Billing → Limits) as a backstop.

## 3. Usage service — remaining work (`src/server/usage/`)

```
reserve(userId, allowance, units)   → checks plan + month-to-date (row lock / advisory lock per user)
                                       → rejects with a friendly "allowance reached" state
                                       → rate limit (per-user token bucket) and global kill switch
commit(reservation, actuals)        → writes usage_events with tokens and estimated cost
release(reservation)                → on provider failure: status='failed', no allowance consumed
```

All enforcement is server-side; the client only displays remaining allowance read from the view.

## 4. Model routing policy

| Task | Tier | Escalate when |
|---|---|---|
| Flashcards, quizzes, simple Q&A, memory extraction, revision wording | **Low** (e.g. Claude Haiku-class) | schema validation fails twice |
| Lesson planning, standard teaching turns, parent reports | **Mid** (Sonnet-class) | student fails two strategies on one objective |
| Exam marking (extended response), hard escalations | **High** (Opus-class / reasoning) | — |
| Voice | Dedicated realtime provider | — |

Model IDs and per-token prices live in one config module (`src/lib/ai/models.ts`, done) populated from the providers' official pricing pages at the time of integration, with the date recorded. Costs in the ledger use those rates.

Levers, in order: prompt caching of stable prefixes → small models by default → batch APIs for non-interactive work (weekly reports, memory extraction) → short context windows built from structured memory → output length caps per task.

## 5. Budget model (to validate with real traffic)

Per Premium subscriber per month, assuming *typical* (not maximum) usage — to be replaced with measured data in Phase 7:

| Line | Assumption | Notes |
|---|---|---|
| Text tutoring + lessons | ~25 lessons + ~300 messages, mostly mid/low tier with caching | Largest controllable line |
| Generation (cards, quizzes, notes) | low tier | Small |
| Marking | ~30 marked answers, high tier | Watch closely |
| Voice | ~45 min actual use | Provider choice dominates — see AI architecture §6 |
| Infra | Supabase + Vercel amortised | Fixed-ish |

Risk flagged: at a $0.05/min voice provider, a student using all 120 voice minutes costs ~$6 in voice alone. Mitigations: provider choice, allowance tuning, and silence suppression (server VAD) so silence isn't billed.

## 6. Monitoring & alerts (Phase 7)

* Daily cost rollup per user, plan, feature and model.
* Alerts: user over 2× plan's expected daily cost; platform spend over daily budget; provider error rate > 2%; any user hitting rate limits repeatedly (abuse).
* Admin dashboard: AI spend, cost per subscriber, ARPU, margin by plan, usage by feature, model latency/error rates.
* Monthly reset is implicit (calendar-month view); no cron needed for resets.
