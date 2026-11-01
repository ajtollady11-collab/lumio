# Lumio — Development Roadmap

> Record of completed work and what's next. Rule: a phase starts only after the previous one is verified.
> Last updated: 2026-11-01 (Phase 2 onboarding).

## Status at a glance

| Phase | Scope | Status |
|---|---|---|
| 1 | Foundation | **Built, verified and deployed** — Supabase auth URL settings and a live sign-up test outstanding |
| 2 | User experience: onboarding, profiles, linking, dashboards | **Complete — built, tested and verified live** (2026-11-01) |
| 3 | AI tutor: customisation, routing, context, memory, chat | Not started |
| 4 | Live learning: lessons, slides, diagrams, voice | Not started |
| 5 | Academic systems: curriculum content, revision, flashcards, quizzes, exam practice, marking | Not started |
| 6 | Progress & family: analytics, gamification, reports, exam tracking, notifications | Not started |
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
- [ ] `SUPABASE_SECRET_KEY` added to Vercel — **not needed yet**: all Phase 2 work runs as the signed-in user. Needed from Phase 3 (usage ledger)

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

## Phases 3–8
See `LUMIO_AI_ARCHITECTURE.md` (3–6), `LUMIO_COST_CONTROL.md` (7) and `LUMIO_SECURITY_REQUIREMENTS.md` (release gates, 8). Each phase adds its tables to `LUMIO_DATABASE_SCHEMA.md` §5 with RLS tests before UI work begins.
