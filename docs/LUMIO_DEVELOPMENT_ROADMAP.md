# Lumio — Development Roadmap

> Record of completed work and what's next. Rule: a phase starts only after the previous one is verified.
> Last updated: 2026-11-02 (long-term student intelligence).

## Status at a glance

| Phase | Scope | Status |
|---|---|---|
| 1 | Foundation | **Built, verified and deployed** — Supabase auth URL settings and a live sign-up test outstanding |
| 2 | User experience: onboarding, profiles, linking, dashboards | **Complete — built, tested and verified live** (2026-11-01) |
| 2b | Intelligent student dashboard (owner's "Prompt 3") | **Built and tested** (2026-11-01) — live check by the owner outstanding |
| 3 | AI tutor: customisation, routing, context, memory, chat (owner's "Phase 4" prompt) | **Built and tested** (2026-11-01) — needs two keys added in Vercel, then a live check |
| 3b | Long-term student intelligence & adaptive memory (owner's "Phase 5" prompt) | **Built and tested** (2026-11-02) — live AI check waits on the same two Vercel keys |
| 4 | Live learning: lessons, slides, diagrams, voice | Not started |
| 5 | Academic systems: curriculum content, revision, flashcards, quizzes, exam practice, marking | Not started |
| 6 | Progress & family: analytics, gamification, reports, exam tracking, notifications | Foundations done in 2b (activity ledger, streaks, goals); rest not started |
| 7 | Commercial: Stripe, subscriptions, allowances, cost accounting, admin | Not started (schema foundations exist) |
| 8 | Testing & launch | Not started |

## Phase 1 — Foundation

### Done
- [x] Fresh Next.js 16.4 / React 19.3 / TypeScript / Tailwind 4 app (no code from the previous application)
- [x] ESLint (flat config), Prettier, Vitest + Testing Library; npm scripts `lint`, `typecheck`, `test`, `build`, `check`
- [x] GitHub Actions CI workflow (lint, typecheck, test, build)
- [x] Design system: tokens, self-hosted fonts, surfaces, motion presets, reduced-motion support
- [x] Brand: logo mark, tutor orb (4 states), ambient background
- [x] UI primitives: buttons, fields, notices, badges, spinner, skeletons
- [x] App shell: desktop sidebar, tablet rail, mobile top bar + tab bar + "More" sheet; student and parent navigation
- [x] Global error, route error, not-found and loading states
- [x] Public landing page (no fabricated stats or testimonials)
- [x] Supabase: new project `lumio` in London; browser/server/admin clients; proxy session refresh
- [x] Auth foundation: sign up (student/parent), sign in, forgot/reset password, email confirm + OAuth landing, sign out, Google behind a flag
- [x] Role-gated student (`/app`) and parent (`/parent`) areas; honest "not available yet" pages for unbuilt areas; working settings page
- [x] Database: 5 migrations (identity, family links, curriculum, plans/usage/audit, hardening); generated types
- [x] RLS permission suite — all passing; Supabase security advisor clean
- [x] Seven central technical documents

### Verification (2026-11-01)
| Check | Result |
|---|---|
| `tsc --noEmit` | 0 errors |
| ESLint | 0 problems |
| Vitest | 7 files, 43 tests passing |
| `next build` (production) | succeeds; 28 routes |
| Production server smoke test | public pages 200; `/app`, `/parent` → 307 to sign-in; unknown → 404; `/api/health` ok |
| Browser checks (Chrome, 1440 / 900 / 390 px) | landing, auth, shell rail/sidebar/tab bar, More sheet (opens, Escape closes); no console errors |
| Server-side validation in browser | sign-up field errors returned, inputs preserved |
| RLS suite against live database | all assertions pass; negative control fails as expected |

### Outstanding to close Phase 1
- [x] **GitHub**: `ajtollady11-collab/lumio` (new, empty repo; the previous app was renamed to `lumio-legacy` and left untouched)
- [x] **Vercel**: new project `lumio`, functions in London (`lhr1`), public env vars set, production deployment at `lumio-rose-three.vercel.app` (Vercel Authentication on — only signed-in team members can view until launch)
- [ ] **Supabase Auth settings** (dashboard): Site URL, redirect URLs, email templates (token-hash links), SMTP sender
- [x] Supabase Auth Site URL and redirect URLs set to the production domain
- [x] Live verification (2026-11-01): sign-up email sent and confirmed, password sign-in on production succeeded (Supabase auth logs), profile row created with role `student`
- [ ] Not yet verified live: password reset, sign-out, parent sign-up and role redirect, Google (disabled)
- [ ] Email templates switched to token-hash links (cross-device confirmation) and a custom SMTP sender (Supabase's default sender is rate-limited and not for production)
- [x] ~~Leaked-password protection (Supabase Pro)~~ — replaced by a free equivalent in Phase 2 (common-password list + Have I Been Pwned range check). Owner decision: stay on Supabase Free
- [ ] `SUPABASE_SECRET_KEY` added to Vercel — **now required** by the AI tutor (Phase 3)

## Phase 2 — User experience

### Done (2026-11-01)
- [x] **Student onboarding, 8 steps**: about you (name, age band, school year, level) → qualification → subjects (13, searchable, removable) → exam board per subject (filtered to boards that offer the qualification; "not sure yet" allowed) → current/target grades on the right scale, confidence, goals → exam dates (add/edit/remove, countdown) → learning preferences → summary
- [x] Every step saves to the database; resume on any device from the saved step; step URLs can't skip ahead; completion re-checked in Postgres
- [x] Under-13s: consent set to pending automatically; explained to the student; granted when a parent links
- [x] **Parent onboarding**: name → optional invite; can finish and invite later
- [x] **Invitation linking**: parent generates a 12-character code (hashed, 7-day, single-use, max 5 open); student previews the parent's first name, then accepts; parent can cancel codes; either side can unlink; 10 wrong codes/hour limit; audit log entries
- [x] Multiple children per parent (data model and dashboard list)
- [x] **Parent dashboard foundation**: empty state with working "Invite your child", pending codes, linked-child cards (name, level, year, subjects) — no analytics yet, by design
- [x] **Student dashboard** now shows the student's real subjects, exam countdowns and preferences; nothing invented
- [x] **Settings**: students edit every onboarding answer (same rows, no duplicates) and manage family sharing; parents edit their name and children
- [x] Privacy: tutor conversations never shared by default and not offered to parents; students can switch activity/results sharing off
- [x] Free-plan resilience: breached-password check without Supabase Pro; cached reference data; friendly "temporarily unavailable" screen if the database is paused or unreachable; save failures keep the user's answers and offer "Try again"

### Verification (2026-11-01)
| Check | Result |
|---|---|
| `tsc --noEmit` / ESLint | 0 errors / 0 problems |
| Vitest | 12 files, 77 tests passing — includes a full click-through of all 8 student steps with server calls mocked, failure-and-retry, under-13 notice, board filtering |
| `next build` (production) | succeeds; 29 routes |
| SQL: `onboarding_and_linking.sql` against live DB | all passed (completion guards, grade scales, caps, consent, invite expiry/reuse/revoke/role/rate limit, parent visibility, unlink) |
| SQL: `rls_permissions.sql` against live DB | all passed (updated for the new invitations table) |
| Test data left behind | none (checked) |
| Visual check (Playwright, 1440 px and 390 px) | steps 1, 3–6, 8 render correctly; no console errors; no horizontal scroll |
| Bug found and fixed in testing | impossible dates such as 30 February were accepted by the form (database would still have refused) |

### Outstanding
- [x] **Live end-to-end run on production by the owner (2026-11-01)**: student completed all 8 steps; parent signed up and created a code; student accepted; child appears on parent dashboard. Database confirms: link active, conversations not shared, code marked used, audit entries written
- [x] Found in live testing: signing in to a second account in the same browser replaces the first; stale pages now explain this instead of a generic "no permission" (commit `b3e719e`)
- [ ] Not yet tried live: unlink, cancelling a code, the under-13 path
- [ ] Custom SMTP sender — Supabase Free's built-in email sender allows only a few emails per hour, so testing many sign-ups in a row will hit that limit
- [ ] Playwright E2E against a test Supabase project (needs a second free project or local Supabase) — currently covered by component tests + SQL tests
- [ ] Nonce-based Content Security Policy
- [ ] Audit entries for sharing-switch changes
- [ ] Legal review: is parent-account linking sufficient verification of consent for under-13s?

## Phase 2b — Intelligent student dashboard (owner's "Prompt 3")

> The owner's prompt calls this "Phase 3". In this roadmap Phase 3 remains the AI tutor; the dashboard is recorded as 2b because it completes the student experience and lays Phase 6's data foundations.

### Done (2026-11-01)
- [x] Personal greeting: time of day in the student's timezone, one factual summary line (exam countdown / streak / lapse / week's study / what they've set up)
- [x] Quick actions: five real links; four lead to honest "coming later" pages and are labelled "Soon"
- [x] Learning overview: lessons, active study time, subjects, topics, quiz average, streak — empty states where no data exists (topics: until lessons ship)
- [x] Subject cards for every subject: qualification, board (or "not set"), target/current grade, next exam, performance from real assessments or "Not assessed yet", last studied
- [x] Subject pages `/app/subjects` and `/app/subjects/[slug]`
- [x] Recommendations: rule engine with reason, subject, duration and working link; one per subject; max four
- [x] Upcoming exams: chronological, days remaining, highlights within 14 days, links to subject exam section; empty state to add dates
- [x] Recent activity timeline from the activity ledger (type, subject, time, duration, result)
- [x] Weekly goals: study time, lessons, subjects, revision sessions — editable, stored in Supabase, measured against tracked activity only
- [x] Study streak: current, best, Mon–Sun calendar; student timezone; only qualifying activities count
- [x] Personalisation rules (exam soon, new student, lapsed student, under-13 consent)
- [x] Loading skeleton; responsive desktop and phone layouts
- [x] Database: migration 0008 (ledger, streaks, goals, dashboard RPC); old unused goal column migrated and dropped

### Verification (2026-11-01)
| Check | Result |
|---|---|
| `tsc` / ESLint | 0 errors / 0 problems |
| Vitest | 15 files, 119 tests — rule engine (10), dashboard model (13), full dashboard rendering for: new student, no subjects, no exams, exams soon, active student, goals set / not set, lapsed student, under-13; goals editor create / error / edit / remove |
| SQL: `learning_activity.sql` against live DB | all passed — streak maths, timezone, qualifying rules, idempotency, three separate students, parent and anonymous access |
| SQL: earlier suites | still pass |
| Supabase advisors | no new security findings; performance: only "unused index" notices (expected with no traffic yet) |
| `next build` | succeeds (30 routes) |
| Visual check (1440 px, 390 px; new and active student) | no console errors, no horizontal scroll; fixed uneven panel heights and phone swipe-row padding |
| Bug found in testing | "Studied yesterday" showed as "Studied today" (day difference reversed) — fixed and covered by a test |

### Limitations (honest)
- No feature records activity yet (lessons, quizzes, flashcards arrive in Phases 3–5), so for real students lessons, study time, quiz average, streak, goal progress and recent activity show their empty states until then. The pipeline is tested end to end with test data in SQL.
- Topic completion/attention needs curriculum topics (Phase 5) and lesson tracking.
- Timezone defaults to Europe/London; there is no timezone picker yet.
- Parents can't see activity yet (scoped reporting is Phase 6).

## Phase 3 — Personal AI tutor (owner's "Phase 4" prompt)

### Done (2026-11-01)
- [x] Tutor pages: `/app/tutor`, `/app/tutor/c/[id]`, `/app/tutor/settings`; linked from navigation, dashboard quick action and each subject page
- [x] Customisation: name, personality (6), teaching style (6), pace (3), depth (3) — saved to Supabase, loaded every turn, and **each option changes the instructions the AI receives** (unit-tested); live preview; defaults from the student's onboarding learning preferences
- [x] Real AI integration: Anthropic provider behind a provider interface; streaming replies; prompt caching; server-only keys
- [x] Clear setup message naming missing variables when keys aren't set; the rest of Lumio unaffected
- [x] Teaching behaviour, honesty, safeguarding and curriculum-honesty instructions (see AI architecture §0)
- [x] Student context from saved data only: name, age band, year, qualification + board per subject, grades, confidence, exam dates, assessment averages, learning preferences, goals, recorded memory
- [x] Curriculum context service: verified-specification lookup (none loaded yet) vs clearly-labelled general knowledge
- [x] Conversations: new, continue, history list, reopen, rename, delete, auto-titles, "load earlier" pagination, stop generating
- [x] Memory foundation: structured `student_memory`, server-written, student can view/delete; records topics studied
- [x] Usage tracking: provider, model, tokens (incl. cache), estimated cost, request id per reply; monthly allowances; rate limits; escalation budget
- [x] Security: session-only identity, RLS on all new tables, parents excluded, input limits, safe rendering, consent gate for under-13s
- [x] Each first exchange appears as a "Tutor session" in the dashboard's recent activity (doesn't count towards streaks)

### Verification (2026-11-01)
| Check | Result |
|---|---|
| `tsc` / ESLint | 0 errors / 0 problems |
| Vitest | 21 files, **179 tests** — prompt builder (settings change instructions; only stored facts; verified vs general curriculum; struggle signal), router, cost maths, quota, validation, stream decoding, orchestrator end-to-end with fakes (new/continue/someone else's conversation/wrong subject/consent/allowance/rate limit/provider failure/stop/database down/defaults), API route security, tutor UI (greeting, streaming send, failure restores text, dropped connection, not-configured, consent, reopen with Markdown + maths, rename, delete, subject preselect), settings form + memory panel; earlier dashboard/onboarding tests still pass |
| SQL `tutor.sql` + context tests on live DB | all passed (A/B/parent/anon isolation, no forged replies or memory, cascade delete, quota) |
| Supabase advisors | no new security findings |
| `next build` | succeeds (33 pages) |
| Visual check (1440 / 390 px) | chat with tables + maths, welcome, setup notice, settings; fixed phone composer overlap and setup-notice placement; no console errors or horizontal scroll |

### Not yet verified — needs the owner
- [ ] Add `ANTHROPIC_API_KEY` and `SUPABASE_SECRET_KEY` in Vercel and redeploy; then a **live conversation** (real AI replies have only been tested against a simulated provider — no key was available)
- [ ] Set a monthly spend limit in the Anthropic console
- [ ] Confirm model prices on Anthropic's pricing page (recorded from a third-party table)

### Known limitations / next
- ~~Automatic extraction of strengths, weaknesses and misconceptions~~ — done in Phase 3b (in the same AI call, not a batch job).
- No exam-board specification content is loaded, so the tutor teaches general knowledge for the level and says when boards may differ (Phase 5 loads licensed specifications).
- No voice, diagrams or images in the tutor yet (Phase 4).
- Tutor usage isn't yet shown on the parent dashboard or admin dashboard (Phases 6–7).
- Safeguarding relies on the model's instructions; a human escalation process and designated safeguarding lead are required before public launch.

## Phase 3b — Long-term student intelligence (owner's "Phase 5" prompt)

### Done (2026-11-02)
- [x] Evidence-based insight extraction in the **same** tutor call (tool `record_learning_evidence`), re-validated on the server; questions alone never count; personal information dropped
- [x] Topic mastery with six levels (Not started → Mastered), transparent weighted rule in SQL, "Not assessed yet" under 2 pieces of evidence, a single answer can't give mastery, time spent isn't an input, level history
- [x] Insights with topic, category, evidence summary ("why"), confidence, recorded and updated dates: weaknesses, strengths, misconceptions, learning patterns
- [x] Tutor receives only memory relevant to the current subject/topic (filtered in SQL), with rules to build on prior learning, revisit gaps differently and reuse what worked; dismissed items never sent; corrections trusted
- [x] **My Learning Profile** (`/app/progress`): counts, recommended next steps, recent improvements, areas to improve, strengths, how you learn best (onboarding preferences + tutor style + observed patterns), topic mastery by subject with history and reset
- [x] Memory management: view when/why, confirm, correct with a note, dismiss/restore, delete one, clear all (confirmation); parents have no access
- [x] Recommendation engine topic rules: revisit, ready for harder questions, review due (21+ days, exam-weighted), check understanding — on the dashboard and the profile page
- [x] Dashboard: "My Learning Profile" summary panel; subject cards show real topic counts; tutor settings links to the profile; `/app/tutor?subject=&topic=` deep links

### Verification (2026-11-02)
| Check | Result |
|---|---|
| `tsc` / ESLint | 0 errors / 0 problems |
| Vitest | 25 files, **238 tests** — evidence validation (questions ignored, personal/unknown/malformed dropped), tutor orchestrator (relevant memory in the prompt, tool offered in one request, evidence recorded/ignored/interrupted), prompt learning section, profile view-model, recommendation rules, learning actions (session-scoped ids, validation, role refusal), profile page (empty state, real counts, "Not assessed yet", no percentages, patterns ≥ 2, confirm/correct/dismiss/restore/delete/reset/clear), dashboard (topic counts, snapshot, weak topic recommended) |
| SQL `learning_intelligence.sql` and `tutor.sql` on the live DB | all passed (see schema doc §6) |
| Supabase advisors | no new security findings |
| `next build` | succeeds; `/app/progress` partially prerendered |
| Visual check (1440 / 390 px) | profile (populated, empty, topic expanded) and dashboard; no console errors or horizontal scroll. Found and fixed: a function passed to a client component (crashed the page — not catchable by unit tests); duplicate topic lines in the dashboard snapshot |

### Not yet verified — needs the owner
- [ ] Same as Phase 3: add `ANTHROPIC_API_KEY` and `SUPABASE_SECRET_KEY` in Vercel. Until then no real evidence is recorded, so the live profile will be empty (by design — nothing is invented).

### Limitations
- Evidence relies on the model judging answers; not independently verified. Levels are presented as Lumio's estimate, not grades.
- Topics are free-text names until curriculum topics are loaded; then evidence should link to topic ids.
- Quizzes/exam practice will feed in as `assessment` evidence once built (Phase 5 content).
- Deleting a weakness/strength note removes it, but new evidence can recreate it; **dismiss** is the way to keep it out permanently.

## Phases 3–8
See `LUMIO_AI_ARCHITECTURE.md` (3–6), `LUMIO_COST_CONTROL.md` (7) and `LUMIO_SECURITY_REQUIREMENTS.md` (release gates, 8). Each phase adds its tables to `LUMIO_DATABASE_SCHEMA.md` §5 with RLS tests before UI work begins.
