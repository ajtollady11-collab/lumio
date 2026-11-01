# Lumio — Design System

> Tokens live in `src/app/globals.css` (`@theme`). Components in `src/components/{ui,brand,motion,shell}`.
> Last updated: 2026-11-01.

## 1. Idea

Lumio should feel like a **quiet, well-lit study at night**: a deep navy field, light that comes from the tutor, and nothing competing with the work. The signature element is the **tutor orb** — the tutor's presence — and the logo is a miniature of it. Everything around the orb stays disciplined so it can carry the personality.

What we avoid: generic SaaS card grids, one radius everywhere, grey drop shadows, gradient washes as decoration, ALL-CAPS eyebrow labels, childish illustration, chat-app layouts.

## 2. Colour

| Token | Hex | Use |
|---|---|---|
| `ink-950` | `#050816` | Page background (navy, never neutral black) |
| `ink-900` / `850` / `800` | `#080d20` / `#0b122a` / `#0f1734` | Sidebars, sheets, inputs |
| `ink-700` / `600` | `#172146` / `#222e5c` | Raised surfaces, hovers |
| `fg` | `#edf1ff` | Primary text |
| `fg-muted` | `#a2adcf` | Body copy, secondary text |
| `fg-subtle` | `#6f7ba3` | Hints, metadata — 4.8:1 on ink-950 (AA) |
| `blue-500` | `#3b7bff` | **Electric blue** — accents, active state, focus glow |
| `blue-600` | `#2a62e6` | Primary button fill — white text 5.3:1 (blue-500 is only 3.8:1, so it is not used behind text) |
| `blue-400` | `#6b9bff` | Links, icons on dark |
| `violet-500` / `400` | `#8a6bff` / `#a48bff` | Secondary accent, gradients with blue, "planned" badges |
| `cyan-400` | `#3ed8e8` | **Live** states only: focus rings, listening, current lesson step |
| `success` / `warning` / `danger` | `#39d3a1` / `#f5b85a` / `#ff6f86` | Semantic |
| `line` / `line-strong` | `rgb(148 170 255 / .10 / .18)` | Hairlines and borders, tinted blue |

Rules: blue means "act" or "you are here"; cyan means "happening now"; violet is supporting colour. Gradients only on the orb, the logo and progress fills.

## 3. Surfaces & radius

| Class / token | Use |
|---|---|
| `.surface` | Layered translucent navy panel with blur and an inset highlight |
| `.surface-raised` | One level up — featured plan, floating captions, secondary buttons |
| `rounded-control` (12px) | Buttons, inputs, nav items |
| `rounded-panel` (20px) | Content panels |
| `rounded-stage` (28px) | The main stage of a page (hero card, lesson stage, sheets) |

Radius grows with the size and importance of the container — never one radius everywhere.

## 4. Typography

| Role | Family | Notes |
|---|---|---|
| Display | **Bricolage Grotesque** (variable 200–800) | Headings, numerals, wordmark. Tight tracking at large sizes |
| Text | **Hanken Grotesk** (variable 100–900) | All reading text. Open apertures, calm at small sizes |
| Mono | **JetBrains Mono** | Equations, working-out, timestamps — never decorative labels |

Self-hosted via `next/font/local` (no Google requests). Scale (major third): `display-xl 68px`, `display-lg 52px`, `display-md 36px`, `display-sm 26px`, body 15–18px. Headings use `text-wrap: balance`; paragraphs `pretty`; line length ≤ ~70ch. Sentence case everywhere.

## 5. Motion

Framer Motion with `MotionConfig reducedMotion="user"`, plus a CSS kill-switch for `prefers-reduced-motion`.

| Preset (`components/motion/presets.ts`) | Use |
|---|---|
| `springs.gentle` | Default UI response |
| `springs.snappy` | Active indicators (`layoutId` nav pill, tab bar) |
| `springs.sheet` | Bottom sheets, modals |
| `pageEnter` | Each page settles in (8px rise, 320ms) via route `template.tsx` |
| `sequence()` + `riseIn` | **One** orchestrated reveal per view (e.g. the hero lesson plan) |

Ambient background: two blurred light fields drifting over ~30s, CSS-only, GPU-composited.

Tutor orb states — each has exactly one motion: **idle** breathes, **listening** emits cyan rings, **thinking** circles an orbit arc, **speaking** pulses. With reduced motion the orb is static and the state is carried by colour and its accessible label.

## 6. Components (Phase 1)

| Component | Notes |
|---|---|
| `Button` / `ButtonLink` | primary · secondary · ghost · danger; sm/md/lg; `loading` shows spinner and sets `aria-busy` |
| `TextField` / `PasswordField` | Label, hint and error wired to `aria-describedby`; show/hide toggle with `aria-pressed` |
| `Notice` | info / error / success; errors use `role="alert"` |
| `Badge` | neutral · blue · violet · cyan |
| `Spinner`, `Skeleton`, `FormSkeleton`, `PageSkeleton` | Loading states shaped like the content they replace |
| `TutorOrb` | Signature element, 4 states |
| `LumioLogo` / `LumioMark` | Per-instance gradient ids (shared ids break when an instance is hidden) |
| `AmbientBackdrop` | `normal` / `low` intensity |
| `AppShell` | Sidebar ≥1024px, icon rail 768–1023px, top bar + tab bar + "More" sheet <768px |
| `PageHeader`, `SectionInDevelopment`, `ErrorPanel` | |

### Added in Phase 2
| Component | Notes |
|---|---|
| `ChoiceCard` | Large selectable card (radio or checkbox) with label + description; selected state uses a blue border and soft glow, not a fill |
| `ChipGroup` | Pill options in a labelled `fieldset`; radio or multi-select; optional deselect; unique `name` per instance via `useId` |
| `Dialog` | Focus moves in on open and returns on close; Escape closes; bottom sheet on phones |
| `ServiceUnavailable` | Calm full-page state when the database can't be reached (e.g. paused Free-plan project) — never a sign-out |
| Onboarding frame | Desktop: vertical step rail (done = blue tick, current = cyan ring, optional steps labelled). Phone: compact "Step n of 7" bar with a blue→violet fill. Steps slide horizontally in the direction of travel; reduced motion fades only |
| Step headings | Receive focus on each step change so screen readers announce it; `[tabindex="-1"]:focus` has no ring because they aren't interactive |

### Added for the student dashboard
| Component | Notes |
|---|---|
| `Panel` / `EmptyState` | Dashboard section frame (surface, icon + title, optional link/action); `highlight` adds a cyan ring and glow for time-sensitive content. Empty states use a dashed border and say what will appear and why |
| `RevealGroup` / `Reveal` | The dashboard's single orchestrated entrance — sections rise in reading order (50 ms stagger) |
| `ProgressBar` | Fills on mount; blue→violet, green when a goal is met; `role="progressbar"` with values |
| `SubjectCard` | Per-subject accent (thin top line, soft corner glow, target chip, hover shadow) from `subjectAccent(slug)` — nine hues inside the blue/violet/cyan family plus warm accents for humanities. Colour never carries meaning alone |
| Streak calendar | Mon–Sun squares: gradient = qualifying study, outline = past without, dashed = future, cyan = today |
| Quick actions | Built areas tinted blue; unbuilt ones neutral with a violet "Soon" chip. Swipeable row on phones, 3/5-column grid above |
| `DashboardSkeleton` | Mirrors the dashboard grid |

Dashboard layout: 12-column grid on desktop (greeting 8 + streak 4; next-up 7 + exams 5, swapped when an exam is within 14 days; subjects 12; overview 7 + goals 5; activity 12). Phones use a single column ordered by importance: greeting → what to do next → quick actions → exams → subjects → goals → streak → overview → activity.

## 7. Responsive behaviour

Mobile is designed separately, not shrunk: the phone gets a thumb-reachable tab bar (4 destinations + More), a bottom sheet with descriptions, single-column content, safe-area padding, 44px+ touch targets, and `100dvh` layouts. Tablets get an icon rail to keep content width.

## 8. Accessibility floor

Visible cyan focus ring on every interactive element · skip link · semantic landmarks (`header`, `nav[aria-label]`, `main#main`) · `aria-current="page"` on nav · form errors announced · colour never the only signal · reduced motion respected · `lang="en-GB"`.

## 9. Writing

Plain, active, sentence case. Buttons say what happens ("Send reset link", "Create account"). Errors say what went wrong and how to fix it, without apologising. Unbuilt features say so plainly. No invented statistics, testimonials or results.
