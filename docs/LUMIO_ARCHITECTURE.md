# Lumio — Architecture

> Central technical reference. Keep current: update this file in the same change as any structural decision.
> Last updated: 2026-11-01 (Phase 1 foundation).

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
│  │  ├─ auth/ account/ marketing/ feedback/
│  ├─ lib/                    Infrastructure, framework-agnostic where possible
│  │  ├─ config/              env (public, server-only), plans
│  │  ├─ supabase/            browser, server, admin, proxy clients
│  │  ├─ auth/                session DAL, server actions, schemas, route rules
│  │  └─ utils/
│  ├─ server/                 (Phase 2+) domain services: ai/, usage/, billing/, curriculum/…
│  └─ types/database.ts       Generated from the live schema
└─ .github/workflows/ci.yml
```

`src/server/` is created when the first domain service lands (Phase 2) — every module there starts with `import "server-only"`.

## 4. Rendering and data access

* **Cache Components** is enabled. Anything that reads cookies/session must sit inside `<Suspense>`; the static shell (navigation, layout chrome, marketing pages) prerenders. Signed-in layouts wrap page content in `<RoleGate>` inside a Suspense boundary, and the account chip has its own boundary, so navigation chrome appears instantly.
* **Data Access Layer** — `src/lib/auth/session.ts`. `getViewer()` (request-memoised with `React.cache`) verifies the JWT with `supabase.auth.getClaims()` and returns a narrow `Viewer`. `requireViewer()` redirects when signed out. Pages never read raw sessions.
* **Mutations** — Server Actions in `src/lib/auth/actions.ts` (and `src/server/**` later): parse `FormData` with zod → call Supabase as the user → return a typed `FormState`. Errors never reveal whether an account exists.
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

## 6. Route protection

1. `src/proxy.ts` — refreshes the session cookie on every request; redirects signed-out users from `/app`, `/parent`, `/admin` to `/sign-in?next=…`; redirects signed-in users away from sign-in/up pages. Fail-closed: with no Supabase config, protected areas redirect to sign-in.
2. `RoleGate` — re-verifies and enforces role per area (students ↔ `/app`, parents ↔ `/parent`).
3. RLS — the database enforces ownership regardless of what the app does.

## 7. Environments

| Environment | Supabase | Vercel |
|---|---|---|
| Local | `lumio` project (ref `axyavuiaxcgzzyjxepzp`) via `.env.local` | `next dev` |
| Preview | same project until a staging branch/project is created (Phase 8) | Preview deployments per PR |
| Production | `lumio` project | Production deployment |

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
