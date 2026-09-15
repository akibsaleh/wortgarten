# 01 — Technical Specification / Design Doc

Derived from and subordinate to PLAN.md — on conflict, PLAN.md wins. Status date: 2026-09-15.

Sibling docs: [02 — Environment & Tooling](./02-environment-and-tooling.md) · [03 — Testing Strategy](./03-testing-strategy.md) · [04 — Design Assets](./04-design-assets.md) · [05 — Constraints & NFRs](./05-constraints-and-nfrs.md) · [06 — Examples & Edge Cases](./06-examples-and-edge-cases.md) · [07 — Task Breakdown](./07-task-breakdown.md)

---

## 1. System Overview

A zen-style, offline-first Progressive Web App that teaches the 1,000 most frequent, highest-utility German words to an English-speaking learner (starting from zero, goal ≈ B1 vocabulary coverage) via FSRS spaced repetition with typed active recall (PLAN.md §1). Single user, personal use, no accounts, no backend. All learning state lives in the browser's IndexedDB; the server is a static file host and can be replaced or rebuilt at any time without data consequences.

**Architecture summary (one paragraph):** A React 18 + TypeScript (strict) single-page app built with Vite. Persistence is Dexie.js over IndexedDB (local source of truth). Scheduling is delegated entirely to `ts-fsrs` (FSRS-4.5). Zustand holds transient UI/session state only; SRS state is never held in memory. React Router maps the PLAN.md §4 screen inventory to routes. `vite-plugin-pwa` + Workbox generate a service worker that precaches the app shell and bundled Piper-TTS audio, with runtime caching for images. Deployment is a single `docker compose up`: a multi-stage Dockerfile builds the Vite bundle and serves it with nginx. No backend container exists.

**Offline-first data flow** (from PLAN.md §6, refined with component boundaries):

```
                        ┌──────────── build time ────────────┐
                        │ words.json (seed, ~400KB,          │
                        │   dataVersion-versioned)           │
                        │ audio/*.ogg (~2,000 Piper files)   │
                        └──────────────┬─────────────────────┘
                                       │ ships in bundle / precache
┌────────────── nginx (static) ────────┼──────────────────────────┐
│ first load ▼                          ▼                          │
│  ┌──────────────────── IndexedDB (Dexie) ────────────────────┐  │
│  │ words · cards · reviewLogs (append-only) · sessions ·     │  │
│  │ settings                                                  │  │
│  └───────▲──────────────────────────┬────────────────────────┘  │
│   writes │                          │ live queries              │
│  ┌───────┴────────┐         ┌───────▼─────────┐                 │
│  │ ts-fsrs engine │ answers │ React UI        │                 │
│  │ (pure compute) │◀────────│ (Zustand store) │                 │
│  └────────────────┘         └─────────────────┘                 │
│  Service worker: precache shell+audio · runtime-cache images    │
└─────────────────────────────────────────────────────────────────┘
   (V2 optional) account backend ◀── background sync of reviewLogs
                                       (additive, never in MVP)
```

After first load, every arrow above the nginx box resolves locally; the learning loop requires zero network (proven by the Playwright offline E2E, see [03](./03-testing-strategy.md)).

---

## 2. Architecture Layers

### 2.1 Frontend — React 18 + TypeScript (strict) + Vite

- Strict TS throughout; no `any` without an inline justification comment (AGENTS.MD).
- Component tree mirrors the screen inventory (§2.4); one screen = one job = one obvious action (PLAN.md §4).
- Design tokens (palette, type scale, spacing, motion timings) are consumed exactly as defined in PLAN.md §4; no new colors or springs are introduced at this layer.

### 2.2 Persistence — Dexie.js (IndexedDB)

Dexie is the local source of truth. Five tables:

| Table | Fields | Notes |
|---|---|---|
| `words` | `id` (PK, stable slug), `lemma`, `gender`, `plural`, `pos`, `gloss_en`, `example_de`, `example_en`, `case_note`, `separable`, `prefix`, `audio_word`, `audio_example`, `image_ref`, `theme`, `cefr`, `freq_rank`, `source[]`, `dataVersion` | Imported once from `words.json`; re-import is idempotent (§3.2) and never touches SRS state |
| `cards` | `id` (PK), `wordId` (FK→`words.id`), `cardType` (`recognition`\|`production`), `due`, `stability`, `difficulty`, `elapsed_days`, `scheduled_days`, `reps`, `lapses`, `state`, `last_review` | FSRS-4.5 card fields per PLAN.md §6; two rows per word, scheduled independently |
| `reviewLogs` | `id` (PK), `cardId`, `wordId`, `rating`, `state`, `due`, `stability`, `difficulty`, `elapsed_days`, `scheduled_days`, `review` (timestamp), `durationMs`, `interactionType` | **Append-only** — never updated or deleted (§3.3) |
| `sessions` | `id` (PK), `startedAt`, `endedAt`, `targetMinutes`, `cardsReviewed`, `newWordsIntroduced`, `outcome` (`completed`\|`abandoned`\|`repair`\|`comeback`\|`diagnostic`) | Backs streak detection, dashboard stats, and lapse detection (§6) |
| `settings` | `key` (PK), `value` | Daily goal minutes, notification opt-in, reduced-motion override, audio voice choice, streak visibility, `dataVersion` of last import |

Indexes: `cards.due`, `cards.state`, `cards.wordId`; `reviewLogs.cardId`, `reviewLogs.review`; `sessions.startedAt`.

### 2.3 Scheduling — ts-fsrs (FSRS-4.5)

- `ts-fsrs` is the **only** scheduler. No SM-2, no hand-rolled interval logic (AGENTS.MD).
- FSRS-4.5 default parameters; target retrievability **0.9**.
- Each word yields two cards — *recognition* (DE→EN) and *production* (EN→DE, typed; article required for nouns) — scheduled independently so weak production cannot hide behind strong recognition (PLAN.md §3).
- Parameter personalization is deferred: defaults until ≥1,000 review logs exist; optional offline re-fit with `fsrs-optimizer` is a Phase 4 consideration only (PLAN.md §3).
- The engine is a pure function layer: reads due cards from Dexie → computes next state → writes `cards` + `reviewLogs`. Identical behavior online and offline.

### 2.4 UI state — Zustand; Routing — React Router

- Zustand holds only transient state: current session queue position, answer-in-progress, audio playback status, audio precache progress. **SRS state is never duplicated into Zustand**; components subscribe to Dexie live queries for persistent data.
- Routes map 1:1 to the PLAN.md §4 screen inventory:

| Route | Screen |
|---|---|
| `/onboarding` | 3-step onboarding (goal picker → typing practice card → audio voice check), skippable |
| `/` | Home (greeting, progress ring, *Begin session*) |
| `/session` | Session (the card) |
| `/session/summary` | Session summary |
| `/progress` | Progress dashboard (three rings, honest copy) |
| `/word/:id` | Word detail (full schema, audio, personal retention stats) |
| `/settings` | Settings (goal, notifications, motion, voice, JSON export, attribution) |
| `/reboot` | Returning-user Home variant (§6) |

### 2.5 PWA — vite-plugin-pwa + Workbox

- **Precache:** app shell (HTML/JS/CSS, self-hosted fonts), `words.json`, and all bundled audio. Audio is precached **in chunks** on first run with visible progress state (§5).
- **Runtime cache:** images/icons (OpenMoji set) — cache-first with network fallback; absence of a cached icon degrades gracefully (no image shown), never blocks the loop.
- Update strategy: new `dataVersion` in a freshly served `words.json` triggers idempotent re-import; service worker updates apply on next launch (no forced reload mid-session).

---

## 3. Data Model

### 3.1 `words.json` per-word schema (PLAN.md §2, normative)

| Field | Type | Notes |
|---|---|---|
| `id` | string | Stable slug, e.g. `hund` |
| `lemma` | string | Dictionary form |
| `gender` | `der\|die\|das\|null` | `null` for non-nouns |
| `plural` | string\|null | e.g. `Hunde`; `null` for explicit no-plural nouns |
| `pos` | enum | `noun, verb, adj, adv, prep, conj, pron, num, part` |
| `gloss_en` | string | Concise English gloss, 1–3 senses max |
| `example_de` | string | One sentence with case usage visible |
| `example_en` | string | Translation of `example_de` |
| `case_note` | string\|null | One-line micro-grammar, e.g. `mit + Dativ` |
| `separable` | bool | Verb prefix flag |
| `prefix` | string\|null | e.g. `an` for `ankommen` |
| `audio_word` | string | Asset path, e.g. `audio/hund.ogg` |
| `audio_example` | string | Asset path |
| `image_ref` | string\|null | OpenMoji ref; concrete nouns only (~40% of deck) |
| `theme` | string | One of ~30 thematic units |
| `cefr` | `A1\|A2\|B1` | Band from Goethe cross-check (checklist only, never shipped content) |
| `freq_rank` | number | 1–1000 position on the merged frequency spine |
| `source` | string[] | Provenance for attribution/licensing |

Content completeness (AGENTS.MD constraint 5): every entry ships with gender, plural (or explicit no-plural), POS, gloss, and ≥1 case-marked example. A bare word-to-word mapping is a bug.

### 3.2 Seeding & idempotent re-import

- `words.json` (~1,000 entries, ~400KB) ships in the bundle.
- On app start, the stored `settings.dataVersion` is compared with the bundle's `dataVersion`; a newer version triggers re-import.
- Re-import is **upsert-by-`id`**: content fields are refreshed; no `cards`, `reviewLogs`, `sessions`, or `settings` rows are modified. Words removed from the deck are orphaned content-wise but their cards keep scheduling (never delete user state).

### 3.3 `reviewLogs` append-only rationale

Three consumers justify the never-update/never-delete rule (PLAN.md §6): (1) **audit** — any card's current state can be replayed and verified against FSRS reference outputs (Phase 1 exit criterion); (2) **optimizer** — offline `fsrs-optimizer` re-fit consumes raw logs; (3) **future sync** — an append-only log with stable IDs makes the optional V2 backend additive, not a migration.

### 3.4 Card state machine

FSRS-4.5 states per card: `New → Learning → Review`, and on lapse during Review, `Review → Relearning → Review`. `New` cards enter `Learning` on first presentation. The two cards of one word transition independently. Lapsed *mature* cards re-enter Relearning with the FSRS-standard interval penalty — never a punitive reset to zero (PLAN.md §5).

---

## 4. Learning Engine Spec

### 4.1 Rating mapping (interaction → FSRS rating; PLAN.md §3)

| Interaction outcome | Mapped rating |
|---|---|
| Wrong / no idea | `Again` |
| Right after hint, typo fixed, or very slow | `Hard` |
| Correct, normal pace | `Good` |
| Instant, confident correct | `Easy` |

Ratings are derived from observed behavior (correctness, hint use, correction path, latency); the user is never asked to self-grade in the typed loop. Recognition cards may use a short typed gloss or explicit self-rating when typing a gloss is impractical (PLAN.md §3 type 2).

### 4.2 Typo-tolerant grading (production answers)

- Normalize, then compare: trimmed, case-insensitive, Levenshtein distance ≤ 1 → accepted as `Hard` (typo path), with the correct form always displayed.
- Umlaut fallback: `ae/oe/ue/ss` accepted for `ä/ö/ü/ß`; correct form always shown regardless.
- Nouns require the article (`der/die/das`) as part of the answer; a missing/wrong article is not `Good`.
- Gender color is never the sole carrier of feedback — the article is always shown as text (AGENTS.MD constraint 6).

### 4.3 Session composition algorithm

Pseudo-code (authoritative prose in PLAN.md §3):

```
due        = cards.where(due <= now).sortBy(predictedRetrievability ASC)
dueCapped  = due.take(DAILY_REVIEW_CAP)          // default 60; lowest retrievability first
newPool    = next frequency-eligible words not yet in cards
newBlocks  = chunk(newPool, 3..5) by theme       // thematic blocks, default 10 new words/day
queue      = interleave(dueCapped, newBlocks)    // never one blocked batch
session    = serve(queue) until minutesTarget in {5,10,15,20} reached
             → end cleanly at target; never pad with filler
```

- Due reviews always precede new words in priority but are **interleaved** in presentation order, not blocked.
- Default pace 10 new words/day → ~100 days to complete the core deck.
- All inputs come from the local DB; composition is identical offline.

### 4.4 Interaction type mix (target distribution across a session)

| Type | Share | Notes |
|---|---|---|
| Typed production (EN→DE) | ~50% | Default interaction; article required for nouns |
| Recognition (DE→EN) | ~25% | Mainly first exposures and abstract words |
| Cloze (word blanked from its own example) | ~15% | Reuses `example_de`; case context visible |
| Audio recall (hear it, type it) | ~10% | Only when bundled audio is available |

Immediate corrective feedback after every answer: correct form, gender color + article text, plural, one-tap audio replay. No multiple choice anywhere in the core loop (AGENTS.MD constraint 7).

---

## 5. Audio Subsystem

- **Bundled assets:** ~2,000 short `.ogg` files (one word + one example per lemma), estimated 30–50MB total, generated at content-pipeline time (Phase 0) with Piper TTS (MIT, German voices) — license-clean because self-generated (PLAN.md §6–§7).
- **Precache strategy:** Workbox precache in chunks on first run, with a persisted progress state (Zustand for UI + a settings flag for completion). The app remains fully usable during caching.
- **Live fallback:** Web Speech API `speechSynthesis` with `de-DE` voice is used (a) until precaching completes and (b) permanently for any string not bundled (e.g. dynamic feedback text). Fallback behavior is verified on Chrome/Safari/Firefox (Phase 2 exit criterion).
- **No scraped or ripped audio, ever** (AGENTS.MD licensing table).

---

## 6. Retention & Reboot Mechanics (technical flows)

### 6.1 Streaks (humane, decoupled)

- **Streak day definition:** completing the daily minutes goal (a `sessions` row with `outcome = completed` and duration ≥ goal), *not* clearing the due queue — FSRS workload never inflates to protect a streak (PLAN.md §5).
- **Freeze:** 1 freeze earned per 7 streak days, cap 3, auto-applied on a missed day with a calm note ("Rest day — your streak is safe").
- **Repair:** after a miss, one 5-minute rebuild session (`sessions.outcome = repair`) restores the streak — once per lapse.
- All streak surfaces are optional and hideable in Settings. No shame copy (AGENTS.MD constraint 1).

### 6.2 Lapse detection

Computed at app start from `max(sessions.startedAt)`:

| Gap | Classification | Flow |
|---|---|---|
| < 3 days | active | Normal session composition |
| ≥ 3 days | *lapsed* | Reboot flow (§6.3) |
| ≥ 14 days | *dormant* | Reboot flow (§6.3), comeback framing |

### 6.3 Reboot flow (PLAN.md §5)

1. **Welcome screen** with encouraging copy ("Welcome back. There's nothing to catch up on — we've picked out what matters."). Guilt copy is banned.
2. **Backlog capping & staggering:** visible due queue capped at **50/day**; the remainder is redistributed by FSRS predicted retrievability over following days, most-forgotten first, so the curve re-stabilizes naturally. No full-backlog dump ever.
3. **10-card diagnostic** (`sessions.outcome = diagnostic`) mixing previously mature cards to re-estimate memory state; lapsed mature cards drop to Relearning with FSRS-standard interval penalty (no reset to zero).
4. **Comeback session:** a short, low-friction 5-minute session (`outcome = comeback`) is the only call to action on day one back.

### 6.4 Reminders

Opt-in only, max 1/day, quiet hours respected, deep-link into session. Single nudge category: predicted retrievability of recently learned words dropping toward ~0.85, plus an optional fixed-time habit reminder. Phase 1–2: in-app surfacing only; Phase 3: local notifications where the platform allows; real push only if accounts ever ship (PLAN.md §5).

---

## 7. Deployment Architecture (owner decision 2026-09-15)

**`docker compose up` is the entire deploy story.** Personal-use, single-user self-hosting; no external services; no backend container.

- **Multi-stage Dockerfile:**
  - Stage 1 (`node`): `npm ci` → `npm run build` (Vite production build; `vite-plugin-pwa` emits the service worker and precache manifest).
  - Stage 2 (`nginx`): serves the static `dist/` output. Nothing else runs.
- **docker-compose.yml:** one service (the image above), one published port, restart policy. No volumes required — the deployment is stateless.
- **nginx considerations:**
  - SPA fallback (`try_files ... /index.html`) for React Router paths.
  - Service worker (`sw.js` / `manifest.webmanifest`) served with `Cache-Control: no-cache` so updates are picked up; hashed Vite assets (`/assets/*`) served with long-lived immutable caching; `/audio/*` immutable (content-stable across releases unless `dataVersion` changes).
  - Correct MIME types for `.ogg` and `.webmanifest`.
- **Data locality:** all user data lives in the browser's IndexedDB on the learner's device. Rebuilding or replacing the container loses nothing; conversely, wiping browser storage loses everything — mitigated only by the user-initiated JSON export (PLAN.md §4 Settings screen). There is no server-side persistence to secure, back up, or migrate.
- The append-only `reviewLogs` + stable-ID schema keeps an optional V2 sync backend purely additive (PLAN.md §6).

---

## 8. Non-Goals, Boundaries & Security/Privacy Posture

**Non-goals (PLAN.md §1, binding):**
- Not a grammar course — grammar appears only as one-line micro-tips on cards.
- Not exam-certification prep — no Goethe/telc mock tests.
- No leaderboards, social pressure, ads, or dark patterns — ever.
- No "fluency" claims — coverage is stated per register in all copy (~65% non-fiction, ~72% fiction, ~83% spoken).

**Security/privacy posture:**
- No accounts, no tracking, no analytics, no third-party requests at runtime. After first load there is no network traffic at all.
- All data is local-only (IndexedDB). Nothing leaves the device.
- User-controlled escape hatch: full data export as JSON from Settings.
- Attack surface is the static bundle itself: no server-side code, no forms posting anywhere, no credentials stored. Fonts and all assets are self-hosted.
- Licensing posture (free, non-commercial) is a hard boundary — see PLAN.md §7 and [05 — Constraints & NFRs](./05-constraints-and-nfrs.md).

---

## 9. Traceability

| This document | PLAN.md |
|---|---|
| §1 System overview | §1 Product definition, §6 Technical architecture (data-flow diagram) |
| §2.1–2.2 Frontend & persistence | §2 Data architecture, §6 Stack table |
| §2.3 Scheduling | §3 Learning engine (FSRS), §6 SRS state model |
| §2.4 UI state & routing | §4 Screen inventory, §6 Stack table |
| §2.5 PWA | §6 Stack + data flow, §8 Phase 3 |
| §3.1 words.json schema | §2 Per-word schema (normative) |
| §3.2 Re-import · §3.3 reviewLogs · §3.4 state machine | §6 Data seeding / SRS state model, §3 Card states |
| §4.1–4.4 Ratings, grading, composition, mix | §3 Learning engine (normative) |
| §5 Audio subsystem | §6 Bundled audio, §7 Licensing (Piper) |
| §6 Retention & reboot | §5 Retention & Reboot System (normative) |
| §7 Deployment | §6 Deployment decision (2026-09-15) |
| §8 Non-goals & posture | §1 Non-goals, §7 Licensing |
