# AGENTS.MD — Working Agreement for Coding Agents

Guidance for any coding agent (Copilot, Claude Code, etc.) working in this repository. Read this before writing code.

## Project

A **zen-style, offline-first PWA** that teaches the **1,000 most frequent, highest-utility German words** to English-speaking learners via spaced repetition. Name: **Wortgarten** (owner decision 2026-09-15; former candidates Wortkern / Lichtung).

**The single source of truth is [PLAN.md](./PLAN.md).** It contains the full planning document (product scope, data schema, learning engine, design system, retention system, architecture, licensing, roadmap). If a task conflicts with PLAN.md, stop and flag the conflict instead of improvising. `coding-agent-planning-prompt.md` is background context only.

## Current status

- ✅ Planning complete (PLAN.md) — pending final review/approval
- ⬜ No application code exists yet. Next up: **Phase 0 — content pipeline** (word list sourcing, enrichment, validation, generated audio)
- Follow the phase order in PLAN.md §8. Do not jump ahead (e.g., no service-worker/offline work before Phase 3, no accounts/backend ever in MVP).

## Planned stack (do not substitute without discussion)

| Layer | Choice |
|---|---|
| App | React 18 + TypeScript (strict) + Vite |
| Local DB | Dexie.js (IndexedDB) — local source of truth |
| SRS scheduler | `ts-fsrs` — **FSRS only, never SM-2 or a hand-rolled scheduler** |
| PWA | `vite-plugin-pwa` + Workbox |
| State | Zustand (UI) + Dexie (persistence) |
| Routing | React Router |
| Audio | Bundled `.ogg` generated with Piper TTS (MIT); Web Speech API (de-DE) as live fallback |
| Tests | Vitest + Testing Library; Playwright for offline E2E |

No `package.json` exists yet — scaffold it in Phase 1 per PLAN.md §6, then use npm scripts (`dev`, `build`, `test`, `test:e2e`) rather than ad-hoc commands.

## Installed project skills (`.claude/skills/`)

Skills vendored into this project under `.claude/skills/`. Trigger them proactively when the situation matches — do not wait to be asked.

| Skill | Use it for | Project touchpoints |
|---|---|---|
| **frontend-design** *(mandatory)* | Any UI work: new screens, components, design tokens, reshaping existing UI | **Required** for all of PLAN.md §4 implementation (zen design system, screen inventory, signature interactions). Never ship templated-default-looking UI |
| **ui-ux-pro-max** | UI/UX design intelligence: searchable design systems, styles, product palettes, font pairings, 119 UX guidelines, accessibility rules, interaction patterns | Complement to frontend-design for structured design-system generation, WCAG accessibility checks, responsive layout, touch targets |
| **webapp-testing** | Playwright-driven verification of the running app: functionality, screenshots, browser logs | All UI changes; **required** for the offline E2E gate in Phase 3 (kill network mid-session) |
| **canvas-design** | Static visual assets (.png/.pdf): app icon, install/splash artwork, zen illustrations | Phase 2 polish; PWA manifest icons in Phase 3 |
| **algorithmic-art** | Generative art via p5.js (seeded, original): calm backgrounds, the "still-water" completion motif | Phase 2+ decorative assets — static exports only, never a runtime dependency |
| **skill-creator** | Authoring project-specific skills | Candidates once patterns stabilize: a Phase 0 vocab-content pipeline skill, an FSRS session-composition skill |

Rules: keep these folders intact (they include licenses); if a skill is upgraded, re-vendor from `anthropics/skills` and note it in the commit. Do **not** add `brand-guidelines` — it applies Anthropic's corporate branding, which is wrong for this product.

## Non-negotiable constraints

1. **No dark patterns**: no ads, no aggressive paywalls, no guilt copy. Streaks/reminders must be optional and dismissible.
2. **Offline-first**: after first load, the entire learning loop must work with no network. Prove it with Playwright offline E2E.
3. **Accessibility (WCAG 2.2 AA)**: text contrast ≥4.5:1, full keyboard navigation, aria labels on icon buttons, `prefers-reduced-motion` honored (all animation collapses to crossfade).
4. **Honest claims**: in-app copy states coverage per register (~65% non-fiction, ~72% fiction, ~83% spoken). Never write "fluency" marketing copy.
5. **Content completeness**: every vocabulary entry ships with grammatical gender, plural (or explicit no-plural), POS, gloss, and ≥1 case-marked example sentence. A bare word-to-word mapping is a bug.
6. **Gender color is never the sole carrier** — always also show the article as text.
7. **Typed active recall is the default interaction.** No multiple choice in the core learning loop.
8. **SRS state lives in IndexedDB**, not in memory; `reviewLogs` is append-only (audit, optimizer, future sync).

## Content & licensing rules (violating these is a legal problem, not a style problem)

| Dataset | Rule |
|---|---|
| top-1000-german-words.md (onewholearns.com-derived, DaF/DaZ-annotated) | **Primary knowledge source** (owner decision 2026-09-15 — parsed deterministically; **no LLM in product or pipeline**). **Strictly personal use** — app and derived `words.json` are never distributed/published; if that ever changes, rebuild on the hermitdave spine first |
| hermitdave/FrequencyWords (de) | License-clean fallback spine. Data is **CC BY-SA 4.0** → ship attribution in-app; derived word list stays CC BY-SA |
| Leipzig Corpora / SUBTLEX-DE | **Curation-time QA only. Never ship their data.** Non-commercial use only |
| Goethe-Institut Wortlisten | Coverage checklist only. **Never redistribute any Goethe content** |
| Audio | Self-generated via Piper TTS only (license-clean). No scraped/ripped audio |
| Icons | OpenMoji (CC BY-SA 4.0) with attribution; concrete nouns only |

The app is **free and non-commercial** — the licensing posture depends on it. If a task introduces monetization, stop and surface that §7 of PLAN.md must be reworked first.

## Data model quick reference

- Seed: `words.json` (1,000 entries, versioned via `dataVersion`, idempotent re-import). Full per-word schema: PLAN.md §2.
- IndexedDB tables: `words`, `cards` (FSRS fields per card: `due, stability, difficulty, elapsed_days, scheduled_days, reps, lapses, state, last_review`), `reviewLogs` (append-only), `sessions`, `settings`.
- Two schedulable cards per word: recognition (DE→EN) and production (EN→DE, typed, article required for nouns), scheduled independently.

## Engineering conventions

- TypeScript strict mode; no `any` without a comment justifying it.
- Comments only where logic needs clarification — no narrating.
- Design tokens (palette, type scale, spacing, motion timings) come from PLAN.md §4 — don't invent new colors or springs. Motion: 120–250ms ease-out, pure CSS, no animation library.
- Session composition: due reviews first (capped), then new words in thematic blocks of 3–5, interleaved — never blocked. Details: PLAN.md §3.
- Keep changes surgical; match existing file structure rather than reorganizing.

## Before marking work done

- Run the smallest relevant test/build command; for offline behavior, the Playwright offline E2E must be green.
- Re-check the constraints above against your diff (accessibility, licensing, honest copy, offline).
- Update PLAN.md if an approved decision changes it — the plan and the code must not drift apart.
