# Lumio — AI Architecture

> Design for Phases 3–6. Nothing in this document is implemented yet unless marked ✅.
> Last updated: 2026-11-01 (personal AI tutor — see §0).

## 0. Implemented: personal AI tutor ✅ (2026-11-01)

| Part | Where | What it does |
|---|---|---|
| Provider abstraction | `src/server/ai/provider.ts` | `ChatProvider` interface; Anthropic implementation (streaming, prompt-cache blocks, usage incl. cache reads, error mapping: auth / rate limit / overloaded / bad request / aborted / network). Adding another provider touches only this file |
| Configuration check | `src/server/ai/config.ts` | `tutorReadiness()` → ready, or the **names** of missing variables (`ANTHROPIC_API_KEY`, `SUPABASE_SECRET_KEY`). The UI shows a setup message; nothing is faked |
| Model catalogue + cost | `src/lib/ai/models.ts` | Model ids, tiers, prices, `estimateCostMicros` |
| Model routing (engine 14) | `src/lib/ai/router.ts` | Haiku 5.5 default; Sonnet 5.5 when the student is stuck or writes a long question, within a monthly escalation budget |
| Tutor personality (engine 1) | `src/lib/tutor/options.ts`, `prompt.ts` | One table gives each option a label, description **and** the instruction the model receives — settings can't be cosmetic. Unit tests prove every option changes the prompt |
| Teaching behaviour | `TEACHING_FOUNDATION` in `prompt.ts` | Explain in steps; match GCSE vs A-level; on struggle change approach (never repeat); occasional checks; honest correction (never praise wrong answers); guide homework rather than complete it; no coursework; UK English; Markdown + LaTeX |
| Honesty | same | Only facts in `<student_record>` may be treated as known; curriculum is labelled verified vs general knowledge; no past papers / official marks / predicted grades |
| Safeguarding | same | Age-appropriate; disclosures → supportive response + trusted adult + Childline 0800 1111 / Samaritans 116 123 / 999; no personal details requested; states it is an AI if asked; refuses to reveal or override its instructions |
| Student context (engine 2) | `get_tutor_context()` RPC + `src/lib/tutor/context.ts` | One read: profile, subjects (qualification, board, grades, confidence, next exam, assessment average, last studied), tutor settings, memory, quota, conversation + last 12 messages |
| Curriculum context (engine 3, first step) | `curriculumSection` + `store.specification()` | Uses the student's own qualification/board for the chosen subject. If a **published** specification exists in Lumio it's listed as verified; otherwise the tutor is told plainly it has no verified spec content and to flag where boards differ. (No specifications are loaded yet — Phase 5.) |
| Student memory (engine 12, foundation) | `student_memory` table, `service_remember()` | Structured facts only (`topic_studied`, `strength`, `weakness`, `misconception`, `note`), each with source and count. Currently written: topics the student chose in a conversation. Students can see and delete every item; parents can't see them. No autonomous extraction yet |
| Orchestrator | `src/server/tutor/turn.ts` | consent → quota → conversation → save student message → route → prompt → stream → save reply, usage, memory, activity. Dependency-injected; unit-tested end to end with fakes |
| Transport | `POST /api/tutor/chat` | NDJSON stream (`start`, `delta`, `done`, `error`). Student id from the session only |

Struggle handling today: a deterministic detector (`soundsStuck`) flags phrases like "I still don't get it"; the prompt then tells the tutor to switch approach, and the router may escalate to the capable model. The fuller per-objective ladder in §4 arrives with the lesson engine.

## 1. Principles

1. **Many small engines, not one giant prompt.** Each engine has one job, a typed input/output contract (zod), and its own model tier.
2. **Structured state over transcripts.** What the tutor "knows" about a student lives in Postgres as typed records, assembled into a compact context per request. Conversation history is a short window, not the memory.
3. **Retrieve curriculum before teaching.** Subject-specific output is grounded in the student's specification (board + qualification) via retrieval.
4. **Server-only providers.** All model calls originate in server code. Keys never reach the browser. Voice uses short-lived, server-minted session tokens.
5. **Every call is metered** through the usage service *before* (allowance check) and *after* (ledger write) — see `LUMIO_COST_CONTROL.md`.
6. **Honest output.** Marking cites the criteria it used and never claims to be official; readiness is labelled an estimate.

## 2. Engines

| # | Engine | Responsibility | Default tier |
|---|---|---|---|
| 1 | Tutor personality | Renders tutor config (name, personality, style, speed, depth) into a compact system block | none (templating) |
| 2 | Student context | Assembles the per-request context: profile, subjects, current objectives, weak/strong topics, recent mistakes, preferences | none (SQL) |
| 3 | Curriculum retrieval | Hybrid search (pgvector + keyword) over topics, objectives, criteria filtered by the student's specification | embeddings |
| 4 | Lesson planning | Topic + duration + objective → timed plan of typed activities | mid |
| 5 | Teaching | Executes an activity: explanation, worked example, check question; adapts on failure | mid → high on escalation |
| 6 | Voice interaction | Realtime speech session bound to the current lesson state | realtime provider |
| 7 | Assessment | Generates check questions and short-answer judgements | low |
| 8 | Marking | Marks exam-style answers against criteria; returns per-criterion marks + feedback | high / reasoning |
| 9 | Flashcard generation | Cards from a topic or lesson | low |
| 10 | Quiz generation | MCQ + short answer with explanations | low |
| 11 | Revision planning | Deterministic scheduler (exam dates, availability, mastery) + light LLM wording | low |
| 12 | Student memory | Extracts durable facts after sessions (misconception, preference, mastery signal) | low, batched |
| 13 | Parent reporting | Weekly report from aggregated metrics only (never raw private chats) | mid, batched |
| 14 | Model routing | Picks provider/model per task, plan, budget and escalation signals | — |

Code home: pure logic in `src/lib/ai/` and `src/lib/tutor/` (testable, no secrets); server-only provider and data access in `src/server/ai/` and `src/server/tutor/`.

## 3. Request pipeline (text)

```
Server action / route handler
  → auth (DAL)                      → usage.reserve(feature, units)    ← rejects if over allowance / rate limit
  → student context (SQL, cached per session)
  → curriculum retrieval (top-k, filtered by specification)
  → tutor personality block
  → router.choose(task, signals)     → provider call (streaming)
  → output validation (zod; retry once on schema failure)
  → usage.commit(tokens, cost)        → memory extraction queued (async, after())
```

Prompt layout is ordered for **prompt caching**: stable blocks first (safety + tutor persona + curriculum excerpt), then student context, then the turn. Cache hits are recorded in `usage_events.cached_input_tokens`.

## 4. Adaptation when a student struggles

The teaching engine tracks, per objective in a lesson: attempts, check results and self-reported confusion. Escalation ladder:

1. Re-explain with a **different modality** (analogy → worked example → diagram → step-by-step questioning), chosen from strategies not yet used for this objective (recorded in `tutor_memory`).
2. If two strategies fail, route the next turn to a higher tier with the failed attempts summarised.
3. Record a `misconception` memory so future lessons and flashcards target it.

## 5. Visual learning

Diagrams are generated as **structured specs**, not images: the model emits JSON for a known component (`supply_demand`, `circuit`, `function_plot`, `cell_diagram`, `force_diagram`…), validated by zod and rendered by React/SVG components with accurate geometry. Free-form images are not used for teaching content. Slides are arrays of typed blocks (heading, explanation, diagram spec, example, key point) rendered in the design system.

## 6. Voice provider evaluation (to finalise in Phase 4)

Requirements: sub-second response, server-side VAD with barge-in (interruptions), streaming, tool calling (to advance lesson state), EU/UK data processing terms, and cost inside budget.

Snapshot of published third-party-verified pricing (developersdigest.tech, verified 2026-10-18 — **re-check provider pages before committing**):

| Option | Price | Est. cost for 120 min/month* | Notes |
|---|---|---|---|
| Gemini 3.8 Live | $3 / 1M audio in, $12 / 1M audio out (~$0.005 in, ~$0.018 out per min) | ≈ $1.40–2.80 | Stable; async function calling |
| OpenAI GPT-Realtime-2.1 Mini | $10 / 1M audio in, $20 / 1M audio out | depends on token rate — benchmark | Tool use |
| OpenAI GPT-Realtime-2.1 | $32 / 1M in, $64 / 1M out | highest | Strongest reasoning in voice |
| OpenAI GPT-Live 1 | $0.05 / min | $6.00 | Full duplex |
| Cascaded (STT → Claude → TTS) | sum of parts | benchmark | Best teaching quality/consistency with text tutor; higher latency |

\*Upper figure assumes the whole allowance is used with the tutor speaking half the time.

**Finding:** a $0.05/min provider at the full 120-minute allowance costs ~$6 — above the whole £3–4 per-subscriber target on its own. Recommendation: shortlist Gemini Live-class pricing and a cascaded pipeline, run a latency/quality spike with real lesson scripts, and keep the voice allowance configurable (it is, in `subscription_plans.allowances`).

## 7. Safety and safeguarding

* System safety block (always first): age-appropriate tone; no personal data requests; refuse off-platform contact; escalate self-harm or abuse disclosures to a safeguarding flow (signposting to Childline / Samaritans, notifying the designated safeguarding lead per policy) — defined before Phase 3 launch.
* Input/output moderation on free-text turns.
* Student data is not used to train provider models: use API terms with zero-retention / no-training where available; document in the privacy notice.

## 8. Evaluation

Golden sets per subject/board (lesson plans, explanations, marking) reviewed by qualified teachers; automated checks for schema validity, curriculum grounding (citations to retrieved objectives) and marking agreement with reference marks. Gate model or prompt changes on these evals (Phase 8: "AI accuracy testing").

## Recommendations (implemented 2026-11-01, no model)

Dashboard recommendations are produced by a deterministic rule engine (`src/lib/recommendations/engine.ts`) over real data: exam dates, the student's own "finding it hard" ratings, quiz/exam-practice averages, last-studied dates, goals, consent status. It costs nothing per request. When the Student Memory Engine exists (Phase 3), weak topics and misconceptions are added as extra rules passed to `buildRecommendations(ctx, [...DEFAULT_RULES, memoryRule])`; an LLM is only worth adding for phrasing, not for deciding.
