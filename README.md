# Lumio

An AI-powered personal tutor for UK GCSE and A-level students, with a dedicated experience for parents.

This repository is a **complete fresh build** — it shares no code, schema or deployment with any previous Lumio application.

## Documentation

| Document | What it covers |
|---|---|
| [Architecture](docs/LUMIO_ARCHITECTURE.md) | System design, layout, data access, auth flows, decisions |
| [Development roadmap](docs/LUMIO_DEVELOPMENT_ROADMAP.md) | Phase status, completed work, outstanding tasks |
| [Database schema](docs/LUMIO_DATABASE_SCHEMA.md) | Tables, policies, planned tables, RLS tests |
| [Design system](docs/LUMIO_DESIGN_SYSTEM.md) | Colour, type, motion, components, responsive rules |
| [AI architecture](docs/LUMIO_AI_ARCHITECTURE.md) | Engines, routing, memory, voice evaluation |
| [Security requirements](docs/LUMIO_SECURITY_REQUIREMENTS.md) | Controls, children's data, release gates |
| [Cost control](docs/LUMIO_COST_CONTROL.md) | Allowances, usage ledger, routing policy, budget |

## Getting started

Requirements: Node.js 22+.

```bash
npm install
cp .env.example .env.local   # fill in the Supabase values
npm run dev                  # http://localhost:3000
```

| Script | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and server |
| `npm run lint` | ESLint |
| `npm run typecheck` | Route type generation + `tsc` |
| `npm test` | Vitest unit and component tests |
| `npm run check` | Lint, typecheck and tests together |

## Database

Migrations live in `supabase/migrations` and are applied in filename order (Supabase CLI: `npx supabase db push`, or the SQL editor). After changing policies, run the permission suite in `supabase/tests/rls_permissions.sql` — it runs inside a transaction and rolls back.

## Deployment

Vercel, Node.js runtime. Set the variables from `.env.example` per environment. Builds succeed without secrets; features that need a missing integration say so in the UI.
