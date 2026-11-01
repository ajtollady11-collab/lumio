# Lumio — Development Roadmap

> Record of completed work and what's next. Rule: a phase starts only after the previous one is verified.
> Last updated: 2026-11-01.

## Status at a glance

| Phase | Scope | Status |
|---|---|---|
| 1 | Foundation | **Built, verified and deployed** — Supabase auth URL settings and a live sign-up test outstanding |
| 2 | User experience: onboarding, profiles, linking, dashboards | Not started |
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
- [ ] End-to-end sign-up → confirm → sign-in on the deployed preview (the build sandbox cannot reach Supabase Auth over HTTPS)

## Phase 2 — User experience (next)
- Multi-step student onboarding (qualification, boards, subjects, target grades, exam dates, learning preferences, age band) with animated progress
- Under-13 parental consent flow
- Parent onboarding; invite-code linking with acceptance and audit logging; student sharing controls UI
- Student dashboard v1 and parent dashboard v1 (real data only; empty states otherwise)
- Security headers / CSP; Playwright E2E for auth and linking
- Tables: `examination_dates`; link RPCs

## Phases 3–8
See `LUMIO_AI_ARCHITECTURE.md` (3–6), `LUMIO_COST_CONTROL.md` (7) and `LUMIO_SECURITY_REQUIREMENTS.md` (release gates, 8). Each phase adds its tables to `LUMIO_DATABASE_SCHEMA.md` §5 with RLS tests before UI work begins.
