# Lumio — Database Schema

> Source of truth: `supabase/migrations/*.sql`. This document explains intent; when they disagree, the migrations win and this file must be fixed.
> Project: Supabase `lumio` (ref `axyavuiaxcgzzyjxepzp`), Postgres 17, region eu-west-2 (London).
> Last updated: 2026-11-01 (AI tutor).

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
| 0009 | `20261101000900_tutor.sql` | `tutors`, `tutor_conversations`, `tutor_messages`, `student_memory`, `service_remember()`, `get_tutor_quota()` |
| 0009a | `20261101000901_tutor_conversation_client_id.sql` | students may choose a new conversation's UUID |
| 0010 | `20261101001000_tutor_context.sql` | `get_tutor_context()` — one read per tutor turn |
| 0011a | `20261102000050_memory_kind_learning_pattern.sql` | `memory_kind` gains `learning_pattern` |
| 0011 | `20261102000100_learning_intelligence.sql` | insight status/confidence/why on `student_memory`; `topic_evidence`, `topic_mastery`, `topic_mastery_changes`; `private.recompute_mastery`; `service_record_learning()`; `reset_learning_topic()`, `clear_learning_memory()`, `get_learning_profile()` |
| 0011b | `20261102000150_mastery_recent_tiebreak.sql` | deterministic "last 3 answers" ordering |
| 0012 | `20261102000200_tutor_relevant_learning.sql` | `get_tutor_context(conversation, history, subject, topic)` returns only relevant learning memory |
| 0008 | `20261101000800_learning_activity.sql` | `study_activity_events` ledger, `student_streaks`, `student_learning_goals` (replaces `student_profiles.weekly_study_minutes_goal`), timezone validation, `get_dashboard_activity()` |

## 3. Entity map (current)

```
auth.users ─1:1─ profiles (role: student|parent)
                  ├─1:1─ student_profiles ─1:N─ student_subjects (subject, qualification, board?, grades, confidence)
                  │                       ├─1:N─ examination_dates
                  │                       ├─1:N─ study_activity_events (read-only to students)
                  │                       ├─1:1─ student_streaks (trigger-maintained)
                  │                       └─1:1─ student_learning_goals
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

### Learning activity (dashboard, migration 0008)
| Table | Purpose | Who writes |
|---|---|---|
| `study_activity_events` | One ledger for every learning feature: type (`lesson`, `tutor_session`, `quiz`, `flashcards`, `exam_practice`, `revision`, `notes`), subject, title, start/end, `active_seconds` (≤4 h), `completed`, `score_percent`, `source_table`+`source_id` (unique → each feature row reports once), `local_date` (study day in the student's timezone, set by trigger). Future timestamps refused | **Server code / feature triggers only** via `private.record_study_activity(...)`. Students: read own rows. No direct user insert/update/delete |
| `student_streaks` | `current_streak` (run ending on `last_active_date`), `best_streak`. Recomputed from distinct qualifying study days (gaps-and-islands) after every insert/update/delete, and when the timezone changes — so back-dated or removed events can't leave it wrong | Trigger only. Students: read own |
| `student_learning_goals` | Optional weekly targets: minutes (15–3000), lessons (1–50), subjects (1–15), revision sessions (1–50); at least one must be set | Student, own row (update-then-insert; `student_id` not updatable) |

**What counts** — a generated column `qualifies` defines it once for every feature: completed lessons, quizzes and exam practice; flashcards or revision with ≥ 5 minutes of active time. Tutor chat and notes are recorded (they appear in activity and study time) but do **not** count towards streaks. Simply having the app open is never an event.

**`get_dashboard_activity()`** — `security invoker` (RLS applies), returns everything the dashboard needs in one round trip: totals, this week (Mon–Sun in the student's timezone), the 7-day calendar, streak (current is shown as 0 if the last study day was before yesterday), per-subject last-studied date and assessment average, the 8 most recent events and goals. Raises `LUMIO:wrong_role` for non-students.

**Parents** have no direct read access to these tables. Phase 6 adds scoped reporting functions that respect `share_activity` / `share_results` separately.

`student_profiles.timezone` is now validated against `pg_timezone_names`.

### Personal tutor (0009–0010)
| Table | Purpose | Who writes |
|---|---|---|
| `tutors` | One per student: `name` (1–24 chars, letters/numbers/space/'.-), `personality`, `teaching_style`, `pace`, `depth` (enums). Absent until the student saves; defaults come from their learning preferences | Student, own row |
| `tutor_conversations` | `title` (≤80), optional `subject_id` and `topic` (≤80), `message_count`, `last_message_at` (both trigger-maintained). Max 300 per student | Student: create (may choose UUID), rename, change subject/topic, delete (messages cascade) |
| `tutor_messages` | `role` user/assistant, `content` (user ≤2,000 chars, any ≤12,000), `status` complete/interrupted, `model`. Max 400 per conversation; a trigger checks the conversation belongs to the message's student | Students insert **only role = user** in their own conversations; assistant replies **server only**. Immutable |
| `student_memory` | Structured facts: `kind`, `subject_id`, `topic`, `detail` (≤300), `source`, `occurrences`, first/last seen. Unique per student/kind/subject/topic (case-insensitive); max 500 | **Server only** via `service_remember()` (service role). Students read and delete their own |

### Student intelligence (0011–0012)
| Table | Purpose | Who writes |
|---|---|---|
| `student_memory` (extended) | + `status` (active / confirmed / corrected / dismissed), `confidence` (low/medium/high), `evidence_summary` (≤300, the "why"), `student_note` (≤300; required when corrected) | Server via `service_record_learning`. Students may update **only** `status` and `student_note` (column grant + RLS) and delete their own rows |
| `topic_evidence` | One row per genuine answer: subject (required), `topic_key` (normalised), `topic`, `kind`, `difficulty`, `score_percent` (assessments only), misconception, approach, confidence, next step, conversation. Capped at 3,000 per student (oldest trimmed by trigger) | **Server only**. Students read and delete own (deleting recomputes mastery) |
| `topic_mastery` | PK (student, subject, topic_key): `level` 1–6, `score` 0–1, evidence/correct/incorrect counts, first/last seen, last evidence, level changed at | Server only (recomputed). Students read/delete own |
| `topic_mastery_changes` | from/to level + timestamp, for "how it's changed" | Server only. Students read/delete own |

Writes per tutor turn: at most one evidence row + one mastery upsert + 0–3 small memory upserts, and only when the answer was genuine evidence — never a row per message. All four tables: **no parent policy at all**; `get_learning_profile()` raises `wrong_role` for non-students.

`get_tutor_quota()` / `get_tutor_context()` are `security invoker` (RLS applies). **Parents have no access to any of these tables**, even with every sharing switch on.

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
| 6 | ~~`topic_mastery`~~ (✅ 0011), `student_xp`, `achievements`, `weekly_reports`, `notifications`, parent reporting functions. (`study_activity_events`, streaks and goals were brought forward to 0008; a separate `study_sessions` table proved unnecessary — the ledger covers it) |
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

`supabase/tests/learning_activity.sql` (0008) asserts: invalid timezones refused; idempotent recording; future events refused; streak current/best computed correctly and recomputed after deletion; non-qualifying events (abandoned quiz, 3-minute flashcards, tutor chat, notes) don't count; study days follow the student's timezone and are re-derived when it changes; dashboard totals/averages/calendar are correct; students cannot write events or streaks or call the private recorder; goal ranges and "at least one" enforced; a second and third student see only their own data and can't alter another's goals; parents have no direct access and can't call the student dashboard; anonymous users are refused.

`supabase/tests/tutor.sql` (0009–0010) asserts: students can't forge tutor replies, edit messages, reset counters or write memory; over-long messages and invalid tutor names are refused; messages can't be attached to another student's conversation (even by the server); a second student can't read, rename, delete or write into the first student's conversations, tutor or memory, and `get_tutor_context` with someone else's conversation id returns nothing; a parent with every sharing switch on sees nothing; anonymous users are refused; deleting a conversation deletes its messages; students can delete memory; quota reflects plan data and recent messages.

`supabase/tests/learning_intelligence.sql` (0011–0012) asserts: a new student starts empty; exposure creates "Introduced" and nothing else; one correct answer stays "Introduced" (not assessed); two wrong answers → Developing with no weakness yet, repeated wrong answers → a weakness; consistent correct answers lift the level, withdraw the weakness and log the change; same-day evidence reaches Strong (and a strength) but not Mastered, evidence across days with an independent explanation reaches Mastered, a recent mistake drops it; learning patterns are counted; nonsense topics and subjects the student doesn't take are refused; tutor context carries only the relevant subject/topic and never dismissed items; students can confirm, correct (only with a note) and dismiss but can't change confidence; a second student sees and changes nothing; a linked parent with every switch on sees nothing and can't call the profile; a student can reset a topic and clear everything.

Last run of all suites: **2026-11-02 — all passed** (tutor.sql re-run after 0012), with no test data left behind (with a negative control confirming failed assertions abort the run). Rerun after every migration that touches policies.

## 7. Regenerating types

```bash
npx supabase gen types typescript --project-id axyavuiaxcgzzyjxepzp --schema public > src/types/database.ts
```
