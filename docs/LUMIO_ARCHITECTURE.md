# Lumio — Architecture

> Central technical reference. Keep current: update this file in the same change as any structural decision.
> Last updated: 2026-11-01 (student dashboard).

## 1. System overview

```
                        ┌──────────────────────────── Vercel ─────────────────────────────┐
 Browser / phone  ───▶  │  proxy.ts (session refresh, coarse route protection)            │
 (React 19 client)      │  Next.js 16 App Router                                           │
                        │   ├─ Server Components  ── Data Access Layer (src/lib/auth)      │
                        │   ├─ Server Actions     ── validation (zod) → services           │
                        │   └─ Route Handlers     ── webhooks, health, streaming AI        │
                        └───────────────┬──────────────────────────┬──────────────────────┘
                                        │ publishable key + user   │ secret key (server only)
                                        ▼ JWT → RLS applies        ▼ bypasses RLS — audited
                        ┌──────────────────────── Supabase (eu-west-2, London) ───────────┐
                        │  Auth · Postgres 17 (+RLS) · Storage                            │
                        └─────────────────────────────────────────────────────────────────┘
                                        ▲
     Phase 3+:  AI providers (Anthropic / OpenAI / voice) — called only from server code
     Phase 7:   Stripe — checkout from server actions, state from signed webhooks
```

**Principles**

1. **The server is the only trusted party.** Authorisation, allowances, prices and payment state are decided server-side; the client renders.
2. **Defence in depth for data access.** Proxy redirect → Data Access Layer check → Postgres Row Level Security. Any one layer failing must not expose data.
3. **Modular services, one direction of dependency.** `app/` (routes) → `components/` (UI) and `server/` (domain services) → `lib/` (infrastructure). Lower layers never import higher ones.
4. **No fake functionality.** Areas that are not built render an explicit "not available yet" state.
5. **UK-first data residency.** Supabase project is in London (eu-west-2).

## 2. Stack

| Concern | Choice | Notes |
|---|---|---|
| Framework | Next.js 16.4 (App Router, Turbopack) | `cacheComponents` + Partial Prefetching on (framework defaults for this version) |
| UI runtime | React 19.3 | Server Components by default |
| Language | TypeScript 5 (strict) | |
| Styling | Tailwind CSS 4 | Tokens in `src/app/globals.css` `@theme` |
| Motion | Framer Motion 14 | `MotionConfig reducedMotion="user"` app-wide |
| Auth / DB / Storage | Supabase (`@supabase/ssr`, `@supabase/supabase-js`) | Publishable + secret API keys (not legacy anon/service_role JWTs) |
| Validation | Zod 4 | All server action inputs and env |
| Icons | lucide-react | |
| Tests | Vitest 5 + Testing Library + jsdom; SQL RLS suite | Playwright E2E planned for Phase 2 |
| Hosting | Vercel | Node runtime (proxy cannot run on edge in Next 16) |
| CI | GitHub Actions | lint → typecheck → test → build |

## 3. Repository layout

```
lumio/
├─ docs/                      Central technical documents (this folder)
├─ supabase/
│  ├─ migrations/             Ordered SQL migrations — the schema source of truth
│  └─ tests/                  RLS permission suite (transactional, rolls back)
├─ src/
│  ├─ proxy.ts                Next 16 "proxy" (formerly middleware): session refresh + redirects
│  ├─ app/                    Routes only — thin; delegate to components and services
│  │  ├─ (marketing)/         Public site
│  │  ├─ (auth)/              Sign in / up / password flows
│  │  ├─ (onboarding)/onboarding/  Student and parent set-up (signed in, not yet onboarded)
│  │  ├─ (app)/app/           Student area   (role-gated)
│  │  ├─ (app)/parent/        Parent area    (role-gated)
│  │  ├─ auth/confirm/        Email-link + OAuth landing (route handler)
│  │  ├─ api/                 Route handlers (health; webhooks & AI streams later)
│  │  ├─ fonts/ fonts.ts      Self-hosted variable fonts
│  │  └─ error / global-error / not-found
│  ├─ components/
│  │  ├─ ui/                  Primitives: Button, fields, Badge, Notice, Spinner
│  │  ├─ brand/               Logo, TutorOrb, AmbientBackdrop
│  │  ├─ motion/              MotionProvider, presets, PageTransition
│  │  ├─ shell/               AppShell, navigation config, RoleGate, page header
│  │  ├─ onboarding/          Student 8-step flow, steps (reused by Settings), exams manager, parent set-up
│  │  ├─ family/ settings/    Invite/link/unlink UI; settings forms
│  │  ├─ dashboard/           Student dashboard sections, SubjectCard, Panel/EmptyState, skeleton
│  │  ├─ auth/ account/ marketing/ feedback/
│  ├─ lib/                    Infrastructure, framework-agnostic where possible
│  │  ├─ config/              env (public, server-only), plans
│  │  ├─ supabase/            browser, server, admin, proxy clients
│  │  ├─ auth/                session DAL, server actions, schemas, route rules, password checks
│  │  ├─ onboarding/          options, step rules, zod schemas, date helpers (shared client/server)
│  │  ├─ errors.ts            ActionResult type; maps database errors to friendly messages
│  │  ├─ dashboard/           Pure dashboard model (subjects, exams, goals, greeting) + zod shape of the activity RPC
│  │  ├─ recommendations/     Rule-based recommendation engine (pure, unit-tested)
│  │  ├─ subjects/            Subject accent colours
│  │  └─ utils/
│  ├─ server/                 Domain services (server-only): curriculum/ (cached reference data), onboarding/, family/, dashboard/; later ai/, usage/, billing/
│  ├─ test/                   Test-only fixtures (never imported by app code)
│  └─ types/database.ts       Generated from the live schema
└─ .github/workflows/ci.yml
```

Every module in `src/server/` starts with `import "server-only"` (data) or `"use server"` (actions).

## 4. Rendering and data access

* **Cache Components** is enabled. Anything that reads cookies/session must sit inside `<Suspense>`; the static shell (navigation, layout chrome, marketing pages) prerenders. Signed-in layouts wrap page content in `<RoleGate>` inside a Suspense boundary, and the account chip has its own boundary, so navigation chrome appears instantly.
* **Data Access Layer** — `src/lib/auth/session.ts`. `getViewerState()` (request-memoised with `React.cache`) verifies the JWT with `supabase.auth.getClaims()` and returns `signed_in` (with a narrow `Viewer`), `signed_out`, or `unavailable` (database unreachable or paused — Supabase Free pauses idle projects). `RoleGate` shows a calm "temporarily unavailable" screen for the last case instead of signing the user out. Pages never read raw sessions.
* **Mutations** — Server Actions (`src/lib/auth/actions.ts`, `src/server/**/actions.ts`): validate with zod → call Supabase **as the user** (RLS applies) → return a typed `ActionResult` (`{ok:true,data}` or `{ok:false,error,message,fieldErrors?}`). Actions called from client components return results rather than calling `redirect()`; the client navigates. Errors never reveal whether an account exists or expose raw database text.
* **Reference data** (qualifications, boards, subjects) is read with a cookie-less client inside `"use cache"` + `cacheLife("hours")`, so onboarding doesn't query the database for it on every page view — this keeps us comfortably within Free-plan limits.
* **Privileged work** (webhooks, usage ledger, admin) uses `createSupabaseAdminClient()` from server-only code, performs its own authorisation, and writes `audit_logs`.

## 5. Authentication flows

| Flow | Path |
|---|---|
| Sign up (email) | `signUpAction` → Supabase sends confirmation → `/auth/confirm?token_hash…` → `verifyOtp` → `/app` (parents redirected to `/parent`) |
| Sign in | `signInAction` → redirect to safe `next` |
| Forgot / reset | `requestPasswordResetAction` → email → `/auth/confirm` (type=recovery) → `/reset-password` → `updatePasswordAction` |
| Google | `signInWithGoogleAction` (only when `NEXT_PUBLIC_AUTH_GOOGLE_ENABLED=true`) → provider → `/auth/confirm?code` → `exchangeCodeForSession` |
| Sign out | `signOutAction` |

Profiles are created by the `on_auth_user_created` trigger. The requested role is read from sign-up metadata **but only `student`/`parent` are accepted**; staff access lives in `private.staff_members` and is never self-assignable.

## 5a. Onboarding flow

* New users land on `/onboarding` (signed in, `onboarding_completed_at` null). `RoleGate` redirects any un-onboarded user there from `/app` or `/parent`.
* **Student — 8 steps**: about you → qualification → subjects → exam boards (optional) → goals (optional) → exam dates (optional) → learning preferences → summary. Each Continue saves to the database immediately and records `onboarding_step`, so the user can resume on any device.
* The page computes the **furthest step the saved data allows** (`furthestAllowedStep`) and clamps the resume point to it; the URL cannot skip ahead. Finishing calls `complete_student_onboarding()`, which re-checks the data in Postgres.
* **Parent — 2 steps**: name → invite a child (optional; they can finish and do it later from the dashboard).
* Settings reuses the same step components in "settings" mode, so students edit exactly the data they entered — the same rows are updated, never duplicated (unique constraints back this up).

## 5b. Student dashboard

* **Data**: three parallel reads per request — `getStudentSnapshot` (profile, subjects, exams), `getDashboardActivity` (one RPC for every activity-derived figure) and cached reference names. All student data is RLS-scoped and **never cached across requests**, so nothing can leak between accounts.
* **Model**: `src/lib/dashboard/model.ts` turns those inputs into subjects, exams, goal progress and the greeting. Pure functions — the same code is unit-tested and rendered.
* **Recommendations**: `src/lib/recommendations/engine.ts`. Independent rules (consent, exam soon/upcoming, low scores, "finding it hard", resume, not studied this week, add exams, add boards, set goals) produce candidates with a reason, subject, duration and link; the engine ranks them, keeps one per subject and per kind (two for close exams), caps at four. No AI call. The tutor's structured memory will join later as additional rules.
* **Personalisation** (rule-based): an exam within 14 days moves the exam panel up and highlights it; students with no tracked learning get an explanation of where figures come from; lapsed students get a "pick up where you left off" greeting and suggestion; under-13s awaiting consent see the linking step first.
* **Availability**: `src/components/shell/availability.ts` lists built routes. Quick actions to unbuilt areas are real links to honest holding pages, labelled "Soon".
* **Subject pages**: `/app/subjects` and `/app/subjects/[slug]` (exams, grades, assessment average, recent subject activity; topics state that tracking starts with lessons).
* **Shell**: the navigation's current-page highlight reads the URL inside its own `<Suspense>` so dynamic routes can prerender the shell.

## 6. Route protection

1. `src/proxy.ts` — refreshes the session cookie on every request; redirects signed-out users from `/app`, `/parent`, `/onboarding`, `/admin` to `/sign-in?next=…`; redirects signed-in users away from sign-in/up pages. Fail-closed: with no Supabase config, protected areas redirect to sign-in.
2. `RoleGate` — re-verifies and enforces role per area (students ↔ `/app`, parents ↔ `/parent`) and sends unfinished users to `/onboarding`.
3. RLS — the database enforces ownership regardless of what the app does.

## 7. Environments

| Environment | Supabase | Vercel |
|---|---|---|
| Local | `lumio` project (ref `axyavuiaxcgzzyjxepzp`) via `.env.local` | `next dev` |
| Preview | same project until a staging branch/project is created (Phase 8) | Preview deployments per PR |
| Production | `lumio` project | Vercel project `lumio` (`lumio-rose-three.vercel.app`, functions in `lhr1`) |

The previous application's Supabase project (`lumio-staging`) and repository are **not** used or modified.

## 8. Decision log

| Date | Decision | Why |
|---|---|---|
| 2026-11-01 | Keep Next 16 defaults (`cacheComponents`, Partial Prefetching) | Instant navigation for the app shell; forces correct Suspense boundaries around session reads |
| 2026-11-01 | Self-host fonts with `next/font/local` | No third-party font requests (privacy), deterministic builds |
| 2026-11-01 | Supabase publishable/secret keys | Independent rotation; legacy JWT keys are being phased out |
| 2026-11-01 | Auth helpers in `private` schema | Not exposed as PostgREST RPC endpoints (Supabase advisor 0029) |
| 2026-11-01 | Single `/auth/confirm` handler for email + OAuth | One audited entry point, open-redirect-safe |
| 2026-11-01 | Holding route `[section]` for unbuilt areas | Every nav item works and states honestly that it isn't built; real routes override it |
| 2026-11-01 | Stay on Supabase **Free** plan | Owner decision. Free alternatives used: HIBP range check for breached passwords, cached reference data, graceful "unavailable" state for a paused project, no reliance on paid backups (migrations in Git are the schema record) |
| 2026-11-01 | Invite codes generated by the parent, entered by the student | The student (the data subject) makes the final decision to share; no email needed, so it works within Free-plan email limits |
| 2026-11-01 | Exam board optional per subject | Many students don't know their board; "not sure yet" is better than a wrong guess the tutor would act on |
| 2026-11-01 | One activity ledger with a database-defined "qualifies" rule | Every feature is judged the same way; students can't write events, so streaks/goals can't be gamed; parents' future reports read the same source |
| 2026-11-01 | Dashboard activity via one `security invoker` RPC | One round trip instead of ~6 queries; RLS still applies |
| 2026-11-01 | Rule-based recommendations, no LLM | Spec: don't spend AI on basic suggestions. Deterministic, explainable, free, testable |
