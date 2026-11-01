# Lumio — Database Schema

> Source of truth: `supabase/migrations/*.sql`. This document explains intent; when they disagree, the migrations win and this file must be fixed.
> Project: Supabase `lumio` (ref `axyavuiaxcgzzyjxepzp`), Postgres 17, region eu-west-2 (London).
> Last updated: 2026-11-01 (Phase 2 onboarding).

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
| 0006 | `20261101000600_onboarding.sql` | onboarding columns on `student_profiles`, `qualification_exam_boards`, rebuilt `student_subjects`, `examination_dates`, `parent_invitations`; consent and display-name triggers |
| 0007 | `20261101000700_onboarding_functions.sql` | invitation create/preview/accept/revoke, unlink, onboarding completion functions; invite rate limiting |

## 3. Entity map (current)

```
auth.users ─1:1─ profiles (role: student|parent)
                  ├─1:1─ student_profiles ─1:N─ student_subjects (subject, qualification, board?, grades, confidence)
                  │                       └─1:N─ examination_dates
                  ├─1:1─ parent_profiles ─1:N─ parent_invitations (hashed code, 7-day expiry, single use)
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
| `profiles` | One per auth user. `role`, `display_name`, `onboarding_completed_at` | `display_name` only (own row). `onboarding_completed_at` is set **only** by `complete_student_onboarding()` / `complete_parent_onboarding()`, which check the answers are complete |
| `student_profiles` | First name, `age_band`, `school_year` (7–14), `education_level`, `primary_qualification_id`, learning preferences, `academic_goals` (≤600 chars), `onboarding_step` (1–8, for cross-device resume), weekly goal, timezone, `parental_consent` | All except `parental_consent` (own row). Choosing the under-13 band sets consent to `pending` by trigger |
| `parent_profiles` | First name, weekly report opt-in | own row |
| `private.staff_members` | Admin/support staff. Service role / SQL only | never |

### Studies (Phase 2)
| Table | Purpose |
|---|---|
| `qualification_exam_boards` | Which boards offer which qualification (GCSE/AS/A-level × AQA, Edexcel, OCR, WJEC; International GCSE × Pearson Edexcel only). Read-only reference |
| `student_subjects` | One row per student per subject (unique). Qualification required; exam board **optional** ("not sure yet"); composite FK guarantees the board offers that qualification. `current_grade` / `target_grade` validated against the qualification's scale by trigger (`private.grade_is_valid`). Max 15 per student |
| `examination_dates` | Student's exam papers: subject, qualification, board, date (2024–2040), notes (≤200). Unique per student/subject/date/notes; max 60. Parents read via `parent_can_view(…, 'activity')` |

### Family
`parent_student_links` — `pending → active → revoked`. Created only by `accept_parent_invitation()`.

`parent_invitations` — one row per code a parent generates. Code: 12 Crockford base-32 characters (60 bits), shown once, stored only as a SHA-256 hash (`code_hash` has no user grant). Status `pending → accepted | revoked | expired`; expires after 7 days; single use. Parents read their own rows (minus the hash).

Functions (all `security definer`, execute granted to `authenticated` only, each checks the caller's role):
| Function | Who | Does |
|---|---|---|
| `create_parent_invitation()` | parent | Issues a code; max 5 open at once |
| `preview_parent_invitation(code)` | student | Returns status + parent's first name so the student can confirm before linking |
| `accept_parent_invitation(code)` | student | Creates the active link, marks the code used, grants consent for under-13s, writes an audit row |
| `revoke_parent_invitation(id)` | parent | Cancels an unused code |
| `unlink_parent_student(link_id)` | either side | Ends a link (audited) |

Wrong codes are recorded in `audit_logs`; after **10 failed attempts in an hour** further attempts return `rate_limited`. Functions return a status instead of raising so the failed-attempt record is not rolled back. Scopes: `share_activity` (default on), `share_results` (default on), `share_conversations` (**default off**). Only the **student** may change scopes. Roles of both ends enforced by trigger.

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
| 2 | ✅ done (0006–0007). Still to do: a separate consent-record table if legal review requires more than the link + audit trail |
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

`supabase/tests/onboarding_and_linking.sql` (Phase 2, same style) asserts: onboarding cannot be marked complete directly or before the required answers exist; grade scales and board/qualification pairs are enforced; subject and exam caps; under-13 consent becomes `pending`; invitation codes are single-use, expire, can be revoked, can only be accepted by students, are hashed and unreadable; the 11th wrong code in an hour is refused; parents see exam dates only through an active link with activity sharing; unlinking removes access.

Last run of both suites: **2026-11-01 — all passed**, with no test data left behind (with a negative control confirming failed assertions abort the run). Rerun after every migration that touches policies.

## 7. Regenerating types

```bash
npx supabase gen types typescript --project-id axyavuiaxcgzzyjxepzp --schema public > src/types/database.ts
```
