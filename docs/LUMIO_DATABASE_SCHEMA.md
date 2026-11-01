# Lumio — Database Schema

> Source of truth: `supabase/migrations/*.sql`. This document explains intent; when they disagree, the migrations win and this file must be fixed.
> Project: Supabase `lumio` (ref `axyavuiaxcgzzyjxepzp`), Postgres 17, region eu-west-2 (London).
> Last updated: 2026-11-01.

## 1. Conventions

* `uuid` primary keys (`gen_random_uuid()`); append-only ledgers use `bigint identity`.
* `created_at` / `updated_at timestamptz`; `updated_at` maintained by `private.touch_updated_at()`.
* Every table has RLS enabled. Privileges are **revoked from `anon`/`authenticated` then granted explicitly**, column-by-column for writable tables — RLS decides *which rows*, grants decide *which columns*.
* Security-definer helpers live in the `private` schema (not exposed through the Data API) and set `search_path = ''`.
* One permissive policy per table/role/command (Supabase advisor clean).
* Money in integer pence; provider cost in integer US-dollar micros.
* Age is stored as an **age band**, not a date of birth (data minimisation).

## 2. Applied migrations

| # | File | Contents |
|---|---|---|
| 0001 | `20261101000100_foundation.sql` | enums, `private.staff_members`, `profiles`, `student_profiles`, `parent_profiles`, sign-up trigger |
| 0002 | `20261101000200_family_links.sql` | `parent_student_links`, reporting scopes, `parent_can_view`, `is_linked_with` |
| 0003 | `20261101000300_curriculum.sql` | qualifications → boards → subjects → specifications → modules → topics → objectives, assessment criteria, `student_subjects`, reference seed |
| 0004 | `20261101000400_commerce_usage_audit.sql` | `subscription_plans` (seeded), `subscriptions`, `usage_events`, `usage_current_month` view, `audit_logs` |
| 0005 | `20261101000500_policy_hardening.sql` | helpers moved to `private`, consolidated policies, FK indexes |

## 3. Entity map (current)

```
auth.users ─1:1─ profiles (role: student|parent)
                  ├─1:1─ student_profiles ─1:N─ student_subjects ─N:1─ specifications
                  ├─1:1─ parent_profiles
                  ├─N:M─ parent_student_links (status, share_* scopes)
                  ├─1:N─ subscriptions ─N:1─ subscription_plans
                  └─1:N─ usage_events
qualifications ┐
exam_boards    ├─ specifications ─1:N─ curriculum_modules ─1:N─ curriculum_topics (self-nesting: subtopics)
subjects       ┘        │                                         └─1:N─ learning_objectives
                        └─1:N─ assessment_criteria
private.staff_members (admin/support) · audit_logs (append-only)
```

## 4. Tables

### Identity
| Table | Purpose | User can write |
|---|---|---|
| `profiles` | One per auth user. `role`, `display_name`, `onboarding_completed_at` | `display_name`, `onboarding_completed_at` (own row) |
| `student_profiles` | First name, `age_band`, `school_year` (7–14), learning preferences, weekly goal, timezone, `parental_consent` | All except `parental_consent` (own row) |
| `parent_profiles` | First name, weekly report opt-in | own row |
| `private.staff_members` | Admin/support staff. Service role / SQL only | never |

### Family
`parent_student_links` — `pending → active → revoked`. Invite codes stored only as SHA-256 hashes (`invite_code_hash`, not readable by users). Scopes: `share_activity` (default on), `share_results` (default on), `share_conversations` (**default off**). Only the **student** may change scopes. Roles of both ends enforced by trigger.

Helpers: `private.parent_can_view(student, scope)`, `private.is_linked_with(other)`. All future student-data tables add a parent read policy using `parent_can_view(student_id, '<scope>')`.

### Curriculum
Reference vocabulary is seeded (4 qualifications, 4 boards, 13 subjects). **No specification content is seeded** — that is loaded in Phase 5 after licensing review, with `source_url` and `licence_note` recorded per specification. Only `published` specifications are visible to users; staff see drafts.

### Commerce, usage, audit
* `subscription_plans` — prices and per-student monthly `allowances` (JSON) are data, editable by admins. Seeded: Free, Premium (£29.99), Family (£44.99, `is_active=false` until shipped).
* `subscriptions` — Stripe mirror, written only by verified webhooks.
* `usage_events` — append-only ledger of every billable AI operation: feature, allowance key, units, provider, model, tokens, audio seconds, estimated cost, `parent_operation_id` (groups a lesson's calls so it counts once).
* `usage_current_month` — `security_invoker` view summing the current Europe/London calendar month.
* `audit_logs` — append-only (trigger blocks update/delete); admin-readable only.

## 5. Planned tables by phase

| Phase | Tables |
|---|---|
| 2 | `examination_dates`, link invite/accept functions, consent records for under-13s |
| 3 | `tutors`, `tutor_memory` (structured facts: strengths, misconceptions, preferences), `conversations`, `messages` |
| 4 | `lessons`, `lesson_plans`, `lesson_activities`, `lesson_resources` (slides/diagram specs) |
| 5 | `flashcard_decks`, `flashcards` + review state (SM-2/FSRS), `quizzes`, `quiz_questions`, `quiz_attempts`, `assessments`, `assessment_results`, `notes`, `revision_plans`, `revision_tasks`, curriculum embeddings (pgvector) |
| 6 | `study_sessions`, `study_activity_events`, `topic_mastery`, `student_xp`, `achievements`, `weekly_reports`, `notifications` |
| 7 | `subscription_members` (family seats), Stripe event idempotency table, `ai_cost_rollups` |

The spec's `users` table is Supabase `auth.users`; `ai_usage` and `ai_cost_events` are unified as `usage_events` (one ledger avoids double counting).

## 6. Testing permissions

`supabase/tests/rls_permissions.sql` runs in one transaction and rolls back. It creates two students, a parent, a forged-admin sign-up and a staff member, then asserts:

* students see only their own rows; cross-student updates have no effect;
* `role` and `parental_consent` cannot be changed by users; usage/subscription/audit inserts are denied;
* `private.staff_members` is unreadable; non-staff cannot write curriculum;
* a parent sees nothing until a link is **active**; then only the linked child;
* parents cannot enable conversation sharing; invite hashes are unreadable;
* a student withdrawing activity sharing immediately hides their profile from the parent;
* anon can read only public vocabulary and plans;
* `account_role: "admin"` in sign-up metadata resolves to `student`.

Last run: **2026-11-01 — all passed** (with a negative control confirming failed assertions abort the run). Rerun after every migration that touches policies.

## 7. Regenerating types

```bash
npx supabase gen types typescript --project-id axyavuiaxcgzzyjxepzp --schema public > src/types/database.ts
```
