# Lumio — Security & Privacy Requirements

> Lumio serves children. Security and privacy are product requirements, not hardening tasks.
> Status: ✅ implemented · 🔜 planned (phase) · ⚠️ needs a decision or external action.
> Last updated: 2026-11-01 (Phase 2 onboarding).
> **Plan constraint:** Lumio stays on the Supabase **Free** plan during development. Nothing below depends on a paid Supabase feature; where Supabase's paid option exists we use a free equivalent (noted inline).

## 1. Secrets and configuration

| Requirement | Status |
|---|---|
| All credentials via environment variables; none in the repository (`.env*` ignored, `.env.example` documents names only) | ✅ |
| Public vs server env split; server module guarded by `server-only` so importing it in client code fails the build | ✅ `src/lib/config/{env,server-env}.ts` |
| Env validated with zod at startup; missing secrets fail loudly at point of use | ✅ |
| Supabase **secret** key only in server code (`src/lib/supabase/admin.ts`) | ✅ |
| AI keys server-only: `ANTHROPIC_API_KEY` is read only in `server-only` modules; the browser talks to `/api/tutor/chat`, never to the provider. Missing keys are reported by **name** only | ✅ |
| Stripe keys server-only; voice uses short-lived server-minted tokens | 🔜 4, 7 |
| Secret rotation runbook | 🔜 8 |

## 2. Authentication & sessions

| Requirement | Status |
|---|---|
| Supabase Auth, cookie sessions via `@supabase/ssr`; refresh in `proxy.ts` | ✅ |
| JWTs verified with `getClaims()` (signature check), never trusting `getSession()` on the server | ✅ |
| Email verification required before sign-in | ⚠️ confirm "Confirm email" is ON in Supabase Auth settings (default ON) |
| Password policy: 10–72 chars, length over complexity (NCSC guidance) | ✅ |
| Breached/common passwords refused **without** Supabase's paid leaked-password protection: (1) local blocklist of common passwords and patterns, and passwords containing the user's name or email; (2) Have I Been Pwned *range* check — only the first 5 characters of the password's SHA-1 hash leave our server (k-anonymity), 2.5 s timeout, fails open so an outage never blocks sign-up. Applied on sign-up and password reset, server-side | ✅ `src/lib/auth/password-check.ts` + tests. The Supabase advisor will keep showing "leaked password protection disabled" — expected on Free |
| No account enumeration in sign-in, sign-up or reset messages | ✅ |
| Open-redirect-safe `next` parameter | ✅ `safeRedirectPath` + tests |
| Google OAuth only when explicitly enabled | ✅ flag `NEXT_PUBLIC_AUTH_GOOGLE_ENABLED` |
| Auth rate limits | ✅ Supabase built-in (Free plan limits) · ✅ invite-code guessing: 10 failures/hour per student, recorded in `audit_logs` · 🔜 app-level limits on AI endpoints (3) |
| MFA for staff/admin accounts | 🔜 7 (required before admin dashboard ships) |

## 3. Authorisation

| Requirement | Status |
|---|---|
| Three layers: proxy redirect → Data Access Layer (`requireViewer`, `RoleGate`) → Postgres RLS | ✅ |
| RLS on every table; explicit column grants; deny-by-default | ✅ |
| Roles: student, parent (self-selected at sign-up, validated by trigger); staff only via `private.staff_members` | ✅ |
| Users cannot change their role or consent status | ✅ tested |
| Onboarding cannot be skipped: `onboarding_completed_at` is not user-writable; only the completion functions set it, after checking required answers in the database. Unfinished users are redirected to `/onboarding` server-side; step URLs are clamped to the furthest step the saved data allows | ✅ tested (SQL + unit) |
| AI tutor trust model: the student id comes only from the verified session (never the request body — tested); students write their own messages, but tutor replies, usage and memory are written by the server with the secret key, so none can be forged; conversations, messages and memory are visible only to their student — **not to parents**, regardless of sharing switches | ✅ tested (`tutor.sql`, route tests) |
| Tutor abuse controls: 2,000-char messages, 16 KB request bodies, 6 messages/min and 60/hour, monthly plan allowance, 300 conversations / 400 messages / 500 memory items per student; replies capped by explanation depth | ✅ tested |
| Prompt-injection posture: student text is only ever a user turn; the system prompt states that student messages are never instructions and not to reveal configuration; the tutor has no tools or data access beyond the student's own context, so a successful injection can't reach other data | ✅ |
| Model output rendering: Markdown without raw HTML; `javascript:`/`data:` links stripped; remote images not rendered; links open with `noopener noreferrer nofollow` | ✅ |
| Safeguarding in the tutor: age-appropriate behaviour; disclosures get a supportive reply plus trusted-adult, Childline (0800 1111), Samaritans (116 123) and 999 signposting; under-13s blocked until a parent links (consent) | ✅ prompt + consent gate · ⚠️ human safeguarding escalation path and DSL still needed before public launch |
| Learning activity is server-written only: students can read but not insert, update or delete `study_activity_events` or `student_streaks`, so streaks and goal progress can't be faked from the browser. Dashboard data is fetched per request with the user's own session (RLS) and never shared-cached | ✅ tested (`learning_activity.sql`) |
| Parent–student linking only through single-use, 7-day, hashed, 60-bit invite codes that the **student** enters and confirms (seeing the parent's first name first). Either side can unlink | ✅ tested |
| Intentional `security definer` RPCs in `public` (`create/preview/accept/revoke_parent_invitation`, `unlink_parent_student`, `complete_*_onboarding`): each checks `auth.uid()` and role, sets `search_path = ''`, is executable by `authenticated` only. The Supabase advisor lists these as warnings by design | ✅ |
| Students cannot read other students' data | ✅ tested |
| Parents read only **actively linked** children, only within student-controlled scopes; conversations private by default | ✅ tested |
| Billing, usage and audit tables writable only by server (secret key) | ✅ tested |
| Admin dashboard protected server-side by `private.is_staff('admin')` + MFA; never linked from user UI | 🔜 7 |
| Permission test suite rerun after every policy migration and in CI against a branch database | ✅ suite · 🔜 CI wiring (8) |

## 4. Input, output and transport

* All server action inputs validated with zod; DB constraints duplicate critical rules (lengths, enums, ranges). ✅
* React escapes output by default; no `dangerouslySetInnerHTML` on user or model content (lint rule to add). 🔜 3
* Model output parsed and validated before use; diagram specs rendered only through whitelisted components. 🔜 4
* HTTPS everywhere (Vercel). Baseline headers on every response — HSTS, `X-Frame-Options: DENY`, `nosniff`, strict referrer policy, Permissions-Policy denying camera/microphone/geolocation/payment ✅ `next.config.ts`. Nonce-based CSP 🔜 2; microphone enabled for own origin on lesson routes 🔜 4.
* File uploads (Phase 5 notes/images): Supabase Storage private buckets, per-user path policies, MIME + size limits, no SVG uploads, signed URLs. 🔜 5
* Stripe webhooks: signature verification, idempotency table, never trusting client payment state. 🔜 7

## 5. Audit & monitoring

* `audit_logs` append-only (update/delete blocked by trigger) ✅. ✅ written for: invitation accepted, failed code attempts, link removed. 🔜 Still to add: sharing changes, sharing changes, consent changes, staff role grants, plan/allowance edits, data exports/deletions. 🔜 2+
* Error reporting with PII scrubbing; structured logs without message content. 🔜 8

## 6. Children's data — UK GDPR & the Age Appropriate Design Code

| Standard (ICO Children's Code) | How Lumio meets it | Status |
|---|---|---|
| Best interests of the child | Learning-first design; gamification rewards learning, not screen time | 🔜 6 |
| Data minimisation | Age **band** not date of birth; first name only; no school name, address or phone | ✅ schema |
| Default settings / privacy by default | Tutor conversations not shared with parents unless the student opts in | ✅ schema |
| Parental controls transparency | Students see each linked parent, exactly what they can see, and can switch activity/results sharing off or unlink. Conversation sharing is off and not offered to parents | ✅ UI (Settings → Family) |
| Age assurance + parental consent | Under-13s (UK age of digital consent): choosing that band sets consent to `pending` (trigger); it becomes `granted` only when a parent links via an invite the child accepts. Dashboard explains this. The AI tutor refuses to run while consent is pending or withdrawn | ✅ flow · ✅ enforced at the tutor endpoint (tested) · ⚠️ legal review of whether parent-account linking is sufficient verification |
| Detrimental use / nudges | No streak-loss guilt mechanics, no dark patterns in upgrade flows | 🔜 6, 7 |
| Profiling off by default (except core service) | Learning profile is the core service; no advertising or third-party profiling | ✅ policy |
| Geolocation off | Not collected | ✅ |
| Data protection impact assessment (DPIA) | Required before launch | ⚠️ 8 |
| Online tools (export, deletion) | Account export and deletion | 🔜 6 |

Additional obligations:
* **Lawful basis & privacy notice** written for children and for parents (plain-language versions). ⚠️ legal review
* **AI providers as processors**: DPAs in place; no training on student data (Anthropic's commercial API terms don't train on API data by default — confirm in the account's terms); consider zero-data-retention; record transfers (UK IDTA / adequacy). The tutor sends the provider only: first name, age band, school year, subjects/boards/grades, exam dates, learning preferences, recorded memory topics and the conversation — no email, surname or school. ⚠️ Owner to review before opening the tutor to real students
* **Data residency**: primary data in London (eu-west-2) ✅.
* **Retention**: define per table (e.g. raw conversation text 12 months, aggregates longer). 🔜 6
* **Safeguarding**: disclosure-handling policy, designated safeguarding lead, escalation path in the tutor, signposting to Childline/Samaritans. ⚠️ before Phase 3 launch

## 7. Release gates

A phase cannot ship until: RLS suite passes; Supabase security advisor shows no findings (✅ currently clean); new tables have documented policies and tests; secrets reviewed; dependencies audited (`npm audit` — current moderate findings are dev/build-time and tracked).
