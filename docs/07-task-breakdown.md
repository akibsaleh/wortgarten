# 07 — Task Breakdown & Acceptance Criteria

Derived from and subordinate to [PLAN.md](../PLAN.md) — on conflict, PLAN.md wins. Status date: 2026-09-15.

**Conventions**

- Task IDs: `DG-n` (decision gates), `P<phase>-T<n>` (build tasks). Phase order per PLAN.md §8 is sacred: no service-worker/offline work before Phase 3, no accounts/backend in MVP.
- Acceptance criteria (AC) are verifiable checkbox statements. A task is done only when every AC is checked **and** the cross-cutting Definition of Done (§6) passes.
- NFR references (`NFR-n`) point to [05-constraints-and-nfrs.md](./05-constraints-and-nfrs.md); test-suite references point to [03-testing-strategy.md](./03-testing-strategy.md); tooling/script contract to [02-environment-and-tooling.md](./02-environment-and-tooling.md); design tokens/assets to [04-design-assets.md](./04-design-assets.md); edge cases to [06-examples-and-edge-cases.md](./06-examples-and-edge-cases.md).
- Rough sizing (1 engineer) follows PLAN.md §8: P0 ≈ 2–3 wks · P1 ≈ 3–4 wks · P2 ≈ 3 wks · P3 ≈ 2–3 wks.
- Owner decisions recorded 2026-09-15: personal use, single user; learner starts at zero German, goal ~B1 via the 1,000 words; `docker compose up` is the entire deploy story (multi-stage image: Vite build → nginx serving the static PWA; no backend container, no external services). Because this is personal use by a motivated beginner, a usable daily-learning loop ships as early as possible (see milestone M3, §7).

---

## 0. Decision gates — before any build work

These convert the open sign-offs in PLAN.md §9 into explicit tasks. Gates DG-1…DG-6 must be resolved (checked) before the phase they block starts; the "blocks" column says which.

| ID | Decision | Recommendation | Blocks |
|---|---|---|---|
| DG-1 | App name: Wortgarten / Wortkern / Lichtung (or other) | **Wortgarten** | P1-T1 (package name, branding), P3 manifest |
| DG-2 | Non-commercial posture confirmed | Confirmed by owner 2026-09-15 | P0 licensing posture (PLAN.md §7) |
| DG-3 | ~~Human-review budget for Phase 0~~ — moot: owner decided 2026-09-15 that **no LLM is used in the product or pipeline**; `top-1000-german-words.md` is the knowledge source | Resolved: deterministic parse + automated validation + owner spot-check; no external reviewer, no budget | P0-T5 |
| DG-4 | B1 scope ambition for launch | **Resolved 2026-09-15:** deck ships with its A1–B1 tags as-is (A1 415 / A2 293 / B1 292); B1 *extension* (words 1,001–2,000) dropped — not needed | P0-T2 (CEFR tagging), P2 dashboard copy |
| DG-5 | Accounts/sync: never vs. later | **Resolved 2026-09-15: later** — keep the sync-ready schema (append-only `reviewLogs`, stable IDs); zero sync code in MVP | P1-T2 (schema design) |
| DG-6 | Provenance/licensing posture of `top-1000-german-words.md` — the **primary knowledge source** (owner decision 2026-09-15), parsed into `words.json` | **Resolved 2026-09-15: strictly personal use** — app and derived data (`words.json`) are never distributed or published (a public repo counts). Rights verification unnecessary under this posture; if it ever changes → hermitdave fallback spine + self-authored metadata | P0-T1 (parse input) |

Tasks:

- [x] **DG-2** Non-commercial posture — confirmed by owner 2026-09-15. If monetization is ever introduced, stop: PLAN.md §7 must be reworked before any further Leipzig/SUBTLEX-DE usage.
- [x] **DG-1** App name chosen and recorded in PLAN.md — **Wortgarten** (2026-09-15).
  - AC: PLAN.md header and §9 updated with the chosen name; candidate table marked resolved.
- [x] **DG-3** Resolved by owner decision 2026-09-15: no LLM in product or pipeline; enrichment = deterministic parse of `top-1000-german-words.md`; review = automated validation + owner spot-check (no external budget). Recorded in PLAN.md §9.
- [x] **DG-4** B1 scope confirmed 2026-09-15: deck ships with its A1–B1 tags as-is (distribution A1 415 / A2 293 / B1 292, recorded); B1 extension (words 1,001–2,000) dropped as not needed. PLAN.md §9 question 5 resolved.
  - Remaining AC: dashboard copy in P2-T6 must reflect this scope.
- [x] **DG-5** Accounts/sync answered "later" 2026-09-15. PLAN.md §9 question 4 resolved.
  - Remaining AC: schema keeps append-only `reviewLogs` + stable IDs (verified again at P1-T2 review).
- [x] **DG-6** Resolved 2026-09-15: **strictly personal use** — app and derived data (`words.json`) are never distributed or published (a public repo counts); verdict recorded in PLAN.md §7.
  - Standing guardrail: if the distribution posture ever changes, stop — rebuild on the CC BY-SA hermitdave spine + self-authored metadata (or verify rights in writing) before any release.

---

## 1. Phase 0 — Content pipeline (≈2–3 wks)

**Phase exit (PLAN.md §8): all §7 quality gates pass** — zero schema violations; A1 coverage vs. Goethe list ≥98% with documented exclusions; audio present for every entry.

### Epic P0-E1 — Frequency spine & cross-validation

- [ ] **P0-T1** Establish the knowledge source: `top-1000-german-words.md` (owner decision 2026-09-15 — no LLM; personal-use posture per DG-6).
  - AC: source file committed and versioned; its `#` rank column adopted as `freq_rank`, `GER` → `cefr`, `Themenfeld` → `theme`.
  - AC: hermitdave/FrequencyWords (CC BY-SA 4.0) fetched to gitignored `scripts/curation/` as the license-clean fallback spine; attribution text drafted for the fallback path (P0-T8).
- [ ] **P0-T2** Optional ranking sanity check against Leipzig Corpora / SUBTLEX-DE (curation-time only; skippable if the source list is trusted as-is).
  - AC: if run, a ranked comparison report exists (displacements/inclusions with rationale); **no Leipzig or SUBTLEX-DE data is present in any shipping artifact** — verified by grep over the repo in P0-T6.
  - AC: `cefr` band and `freq_rank` 1–1000 come from the source list's `GER` / `#` columns (not from a merged spine).
- [ ] **P0-T3** Goethe A1/A2 coverage check (checklist only).
  - AC: coverage of official Goethe A1 vocabulary within our frequency range is ≥98%, with every exclusion recorded alongside a one-line reason.
  - AC: no Goethe content is copied into any project artifact (list used as a checklist only).

### Epic P0-E2 — Parsing, validation, owner spot-check

- [ ] **P0-T4** Write the deterministic parser: `top-1000-german-words.md` table → `words.json` per the PLAN.md §2 schema (no LLM anywhere in the pipeline).
  - AC: headword parsing handles the source's notation: `der Automat, -en` → gender/plural (n-declension note → `case_note`), `¨-er` umlaut plurals, Singulariatantum/Pluraliatantum, principal parts (`buchstabieren, buchstabierte, habe buchstabiert`), `trennb.`/`untrennb.` → `separable`/`prefix`, `refl.`, Rektion (`+ Dat.`, Wechselpräp.) → `case_note`.
  - AC: schema-corner resolutions follow the signed-off amendments A1–A6 in [06-examples-and-edge-cases.md](./06-examples-and-edge-cases.md) §8.3.
  - AC: `words.json` contains exactly 1,000 entries with a top-level `dataVersion`; every field of the §2 schema present (`id, lemma, gender, plural, pos, gloss_en, example_de, example_en, case_note, separable, prefix, audio_word, audio_example, image_ref, theme, cefr, freq_rank, source`).
  - AC: deck partitioned into ~30 thematic units; every entry has exactly one `theme`.
- [ ] **P0-T5** Owner spot-check (replaces paid human review per DG-3 resolution — personal-use app).
  - AC: random sample per CEFR band (≥10% of A1, ≥5% of A2/B1) checked against Duden/Wiktionary for gender/plural correctness and example naturalness; findings log (sample IDs + findings + fixes) committed as a curation artifact.
  - AC: accepted-risk note recorded: no external reviewer; residual errors are the owner's to catch while learning.
- [ ] **P0-T6** Automated validation script (`validate:content` npm script or standalone tool per [02-environment-and-tooling.md](./02-environment-and-tooling.md)).
  - AC: `validate:content` exits 0 with exactly 1,000 valid entries — this is the Phase 0 gate.
  - AC: validator fails on: missing field; noun without gender+plural and without explicit no-plural marker; `example_de` not containing the lemma or an inflected form; separable verb missing `prefix`; `pos`/`cefr` outside enums; duplicate `id` or `freq_rank`.
  - AC: validator asserts no Leipzig/SUBTLEX-DE/Goethe provenance strings leak into `source` fields or shipped files.

### Epic P0-E3 — Audio & attribution

- [ ] **P0-T7** Generate bundled audio with Piper TTS (MIT, Standard German voice).
  - AC: ~2,000 `.ogg` files exist — one word file + one example file per lemma — at paths matching `audio_word`/`audio_example`.
  - AC: no scraped or ripped audio anywhere in the repo (self-generated only).
  - AC: spot-check log: ≥50 files listened to; mispronunciations regenerated or logged with fix.
- [ ] **P0-T8** Attribution page content.
  - AC: page copy covers OpenMoji (CC BY-SA 4.0, if icons ship), Piper TTS (MIT), fonts used, and — if the hermitdave fallback spine is ever used — hermitdave/FrequencyWords (CC BY-SA 4.0, share-alike notice for the derived word list).
  - AC: copy states the app is free and non-commercial; no Goethe/Leipzig/SUBTLEX content is shipped or claimed.

---

## 2. Phase 1 — MVP (≈3–4 wks)

**Phase exit (PLAN.md §8):** 100-session dogfood completed; scheduling matches FSRS reference outputs; 0 data-loss bugs. **Milestone M3 (first usable daily habit) lands here — see §7.**

### Epic P1-E1 — Scaffold & data layer

- [ ] **P1-T1** Scaffold the app (requires DG-1).
  - AC: Vite + React 18 + TypeScript **strict**; ESLint + Prettier configured; React Router and Zustand wired; no `any` without a justifying comment.
  - AC: npm scripts contract from [02-environment-and-tooling.md](./02-environment-and-tooling.md) exists and runs: `dev`, `build`, `test`, `test:e2e` (e2e may be a placeholder suite until Phase 3).
- [ ] **P1-T2** Dexie schema + idempotent seed import (informed by DG-5).
  - AC: tables `words`, `cards`, `reviewLogs` (append-only), `sessions`, `settings` exist; `cards` holds the FSRS fields `due, stability, difficulty, elapsed_days, scheduled_days, reps, lapses, state, last_review`.
  - AC: import of `words.json` is idempotent: re-importing the same `dataVersion` changes nothing; importing a newer `dataVersion` upserts word content without touching any SRS state (unit test: review a card, bump `dataVersion`, re-import, card state byte-identical).
  - AC: two schedulable cards are created per word — recognition (DE→EN) and production (EN→DE) — scheduled independently.

### Epic P1-E2 — Learning engine

- [ ] **P1-T3** ts-fsrs wrapper + rating mapping.
  - AC: all scheduling goes through `ts-fsrs` (default parameters, target retrievability 0.9); no SM-2, no hand-rolled scheduler code anywhere (grep-verifiable).
  - AC: interaction outcomes map to ratings exactly per PLAN.md §3: wrong/no idea → `Again`; right after hint, typo fixed, or very slow → `Hard`; correct normal pace → `Good`; instant confident correct → `Easy`.
  - AC: every answered review appends one row to `reviewLogs` and updates the card in IndexedDB (never memory-only); killing the tab mid-session loses at most the in-flight card (per [06-examples-and-edge-cases.md](./06-examples-and-edge-cases.md)).
  - AC: unit tests compare wrapper outputs against FSRS reference outputs for a fixed review history (per [03-testing-strategy.md](./03-testing-strategy.md)).
- [ ] **P1-T4** Typed production + recognition interactions.
  - AC: production (EN→DE) requires typing the lemma **plus article for nouns**; grading is typo-tolerant (Levenshtein ≤1; umlaut fallbacks `ae/oe/ue/ss` accepted) and the correct form is always shown after answering.
  - AC: recognition (DE→EN) accepts a short typed gloss or self-rating for first exposures/abstract words.
  - AC: immediate corrective feedback after every answer: correct form, gender (color **and** article text), plural, one-tap audio replay.
  - AC: **no multiple choice exists anywhere in the core loop** (grep-verifiable); typed recall is the default (NFR: typed-recall constraint in [05-constraints-and-nfrs.md](./05-constraints-and-nfrs.md)).
- [ ] **P1-T5** Session composition engine.
  - AC: due reviews first, capped at the daily review cap (default 60), prioritized by lowest predicted retrievability; then new words (default 10/day) in thematic blocks of 3–5, **interleaved** with remaining reviews — never one blocked batch (unit tests per [03-testing-strategy.md](./03-testing-strategy.md), cases from [06-examples-and-edge-cases.md](./06-examples-and-edge-cases.md)).
  - AC: session target configurable at 5/10/15/20 min; session ends cleanly at target with no filler cards.
  - AC: identical behavior with the network disabled (all decisions from the local DB).

### Epic P1-E3 — Minimal zen UI + early Docker

- [ ] **P1-T6** Minimal zen UI for the core loop only (frontend-design skill mandatory).
  - AC: screens: Home (greeting, progress ring, one *Begin session* button), Session (card, auto-focused input, pronunciation button), Session summary (words learned, retention today, time — no confetti).
  - AC: design tokens come from PLAN.md §4 (paper `#FBFAF7`, ink `#23282D`, accent `#3F7D5D`/`#2E5E46`, gender colors) — no invented colors; motion 120–250ms ease-out, pure CSS, no animation library.
  - AC: baseline accessibility from day one: ≥4.5:1 text contrast, full keyboard map (Space = flip, Enter = submit, P = pronounce), aria labels on icon buttons, visible focus rings.
- [ ] **P1-T7** Unit tests green.
  - AC: `npm test` (Vitest + Testing Library) passes, covering scheduler wrapper, grading/typo tolerance, session composition, and import idempotency, per [03-testing-strategy.md](./03-testing-strategy.md).
- [ ] **P1-T8** Early Docker deliverable: `Dockerfile` + `docker-compose.yml` (owner decision 2026-09-15).
  - AC: multi-stage image (Vite build → nginx serving the static build); `docker compose up -d --build` from a clean checkout serves the MVP on a documented port.
  - AC: app reachable over HTTP; hard reload and direct navigation to a client-side route work (nginx SPA fallback configured).
  - AC: no backend container, no external services — the compose file is the entire deploy story.

---

## 3. Phase 2 — Polish (≈3 wks)

**Phase exit (PLAN.md §8):** WCAG 2.2 AA audit passes; reduced-motion verified; TTS fallback tested on Chrome/Safari/Firefox.

### Epic P2-E1 — Design system & interactions

- [ ] **P2-T1** Full design system per [04-design-assets.md](./04-design-assets.md) and PLAN.md §4 (frontend-design skill mandatory).
  - AC: all tokens implemented: palette (4 warm-gray neutrals, accent, three gender colors, terracotta `#B3563B` error), typography (Source Serif 4/Newsreader 39px for German words, Inter UI, self-hosted, modular scale 1.25: 12/14/16/20/25/31/39, max 2 weights/family), 4px spacing grid, single-column 640px, radius 12–16px, 1px soft borders.
  - AC: gender color is never the sole carrier — every noun shows the article as text plus the 4px color ribbon (verified in component tests and audit).
- [ ] **P2-T2** Remaining screens & signature interactions.
  - AC: screen inventory complete: 3-step skippable onboarding (daily-goal picker → typing practice card → audio voice check), word detail (full schema fields + audio + personal retention stats), reboot-state Home variant shell (logic lands in P3).
  - AC: signature interactions per §4: gender-ribbon card flip, pronunciation button ripple, progress rings filling over 250ms, live umlaut helper chips (ä ö ü ß) on the typing input.
  - AC: all animation honors `prefers-reduced-motion` and collapses to crossfade (automated + manual verification per [03-testing-strategy.md](./03-testing-strategy.md)).
- [ ] **P2-T3** Cloze + audio recall interaction types.
  - AC: interaction mix per PLAN.md §3: typed production ~50%, recognition ~25%, cloze (word blanked from its own case-marked example) ~15%, audio recall (hear it, type it) ~10% only when audio exists; mix verified by unit test over composed sessions.

### Epic P2-E2 — Audio, streaks, dashboard, settings

- [ ] **P2-T4** Bundled audio live with chunked precache.
  - AC: ~2,000 `.ogg` files precache in chunks on first run with a visible progress state; Web Speech API (de-DE) live TTS is the fallback until caching completes and for anything not bundled.
  - AC: TTS fallback manually verified on Chrome, Safari, and Firefox; results logged in [03-testing-strategy.md](./03-testing-strategy.md) test matrix.
- [ ] **P2-T5** Humane streaks with freeze/repair.
  - AC: a streak day = completing the daily goal (minutes), never clearing the due queue; freeze earned 1 per 7 streak days, cap 3, auto-applied with a calm note; one-time 5-minute rebuild session repairs a missed streak.
  - AC: everything streak-related is optional and hideable in Settings; no shame/guilt copy anywhere (copy review against the dark-patterns NFR in [05-constraints-and-nfrs.md](./05-constraints-and-nfrs.md)).
- [ ] **P2-T6** Progress dashboard with honest copy.
  - AC: three rings — core coverage %, 30-day retention, streak; copy states coverage per register (e.g. "These 340 words cover about ~60% of spoken German you'll hear"); the figures ~65% non-fiction / ~72% fiction / ~83% spoken are the only coverage claims used; the word "fluency" appears nowhere in app copy (grep-verifiable); copy reflects the DG-4 scope decision.
- [ ] **P2-T7** Settings.
  - AC: daily goal, notification opt-in, reduced-motion (auto + manual toggle), audio voice picker, JSON data export (full words/cards/reviewLogs/sessions/settings dump that re-imports cleanly), license/attribution page rendering P0-T8 content.

### Epic P2-E3 — Accessibility gate

- [ ] **P2-T8** WCAG 2.2 AA audit green.
  - AC: audit per the accessibility NFRs in [05-constraints-and-nfrs.md](./05-constraints-and-nfrs.md) passes: all text ≥4.5:1, full keyboard map, aria labels on every icon button, visible focus rings in accent, screen reader announces e.g. "Hund, masculine, plural Hunde" on reveal, reduced-motion honored at OS level and via in-app toggle.
  - AC: findings and fixes recorded; audit re-run clean.

---

## 4. Phase 3 — Offline & reboot (≈2–3 wks)

**Phase exit (PLAN.md §8):** Playwright offline E2E green (kill network mid-session); reboot flow tested at 3/14/60-day lapses. **No task in this phase may start before Phase 2 exit.**

### Epic P3-E1 — PWA offline

- [ ] **P3-T1** Service worker via `vite-plugin-pwa` + Workbox.
  - AC: precache covers the app shell **and** all bundled audio; runtime cache covers images; versioned cache invalidation on deploy (old shells don't stick).
  - AC: after first load, the entire learning loop works with zero network (NFR: offline-first, [05-constraints-and-nfrs.md](./05-constraints-and-nfrs.md)).
- [ ] **P3-T2** Install prompt & manifest.
  - AC: manifest complete (name per DG-1, icons from the canvas-design skill, theme/background colors from tokens); install prompt shown once, dismissible, never re-nags (dark-pattern NFR).
- [ ] **P3-T3** THE offline E2E gate (webapp-testing skill required).
  - AC: Playwright E2E per [03-testing-strategy.md](./03-testing-strategy.md) kills the network mid-session and verifies: session continues uninterrupted, answers persist to IndexedDB, audio plays from precache, reload restores state; suite green in CI/local via `npm run test:e2e`.

### Epic P3-E2 — Reboot flow & reminders

- [ ] **P3-T4** Lapsed/dormant reboot flow (PLAN.md §5).
  - AC: detection: no session for 3+ days = lapsed, 14+ = dormant; on return the app never dumps the full overdue backlog.
  - AC: visible due queue capped at 50/day; remainder re-distributed by FSRS predicted retrievability (most-forgotten first) over following days; 10-card diagnostic mixes previously mature cards; lapsed mature cards drop into relearning with the FSRS-standard interval penalty (no punitive reset to zero); the only day-one CTA is a short 5-minute comeback session.
  - AC: welcome-back copy is encouraging and contains no guilt language (banned-copy list per [05-constraints-and-nfrs.md](./05-constraints-and-nfrs.md)); flow verified by Playwright at simulated 3-, 14-, and 60-day lapses.
- [ ] **P3-T5** Local notification exploration (platform-permitting).
  - AC: opt-in only, max 1/day, quiet hours respected, deep-link straight into a session; nudge categories limited to "new words about to fade" (predicted retrievability dropping toward ~0.85) plus an optional fixed-time habit reminder; findings/limitations per platform documented; no backend push attempted.

### Epic P3-E3 — Deploy proof

- [ ] **P3-T6** Docker deploy smoke test.
  - AC: from a clean checkout, `docker compose up -d --build` → first load → complete a full session → kill network → session continues offline → reload → all SRS state intact. Script/checklist committed; result green.

---

## 5. Phase 4 — Stretch (explicitly out of commitment)

Not scheduled. Each item is scoped separately, only after MVP retention data exists (PLAN.md §8). Phase 4 work never blocks or retrofits Phases 0–3.

| ID | Item | Trigger / precondition |
|---|---|---|
| P4-T1 | Speech recognition for pronunciation practice | Scoped proposal; offline feasibility review |
| P4-T2 | Thematic deep-dive packs | Core deck retention data reviewed |
| P4-T4 | FSRS personalization | ≥1,000 rows in `reviewLogs`; offline re-fit with `fsrs-optimizer`; ship updated defaults (never blocks MVP) |
| P4-T5 | Optional accounts + sync | DG-5 was "later": append-only `reviewLogs` + stable IDs make sync additive, not a migration; introducing any backend reopens the deploy story (§6 owner decision) and requires owner sign-off |

---

## 6. Cross-cutting definition of done

Applied to **every** task above before its checkboxes may be ticked:

- [ ] Smallest relevant test/build command run and green (targeted Vitest file, `npm run build`, or `npm run test:e2e` for offline behavior); suite selection per [03-testing-strategy.md](./03-testing-strategy.md).
- [ ] Constraints checklist re-read against the diff per the verification matrix in [05-constraints-and-nfrs.md](./05-constraints-and-nfrs.md): offline-first, WCAG 2.2 AA, typed recall only, FSRS only (ts-fsrs), SRS state in IndexedDB, `reviewLogs` append-only, content completeness, licensing/attribution.
- [ ] No dark patterns and honest-copy check: no ads, no guilt/shame copy, no "fluency" claims, streaks/reminders optional and dismissible, coverage stated per register.
- [ ] No new dependencies unless the task explicitly requires one; stack substitutions from AGENTS.MD's table need owner discussion first.
- [ ] TypeScript strict clean; no `any` without a justifying comment; comments only where logic needs clarification.
- [ ] PLAN.md updated if an approved decision changed behavior or scope — plan and code must not drift.
- [ ] Phase order respected: nothing from a later phase merged early (in particular, zero service-worker/offline code before Phase 3; no accounts/backend ever in MVP).

---

## 7. Dependency map & milestones

### Phase-level dependencies

| Phase | Depends on | Hard gate |
|---|---|---|
| Phase 0 | DG-2 ✅, DG-3 ✅, DG-4 ✅, DG-6 ✅ | `validate:content` exits 0; all §7 quality gates pass |
| Phase 1 | Phase 0 complete; DG-1 ✅, DG-5 ✅ | §8 exit: 100-session dogfood; FSRS reference match; 0 data-loss bugs |
| Phase 2 | Phase 1 complete | §8 exit: WCAG 2.2 AA audit; reduced-motion verified; TTS fallback on Chrome/Safari/Firefox |
| Phase 3 | Phase 2 complete | §8 exit: offline E2E green (network killed mid-session); reboot tested at 3/14/60-day lapses |
| Phase 4 | MVP retention data exists | Scoped separately; out of commitment |

### Key intra-phase blocking tasks

| Task | Blocks | Why |
|---|---|---|
| DG-1 | P1-T1, P3-T2 | Package name, branding, manifest |
| DG-3 | P0-T5 | Review depth depends on budget |
| DG-6 ✅ | P0-T4 | Resolved (strictly personal use) — no longer blocks |
| P0-T4 | P0-T6, P0-T7, P1-T2 | Validation validates the file; audio paths live in the file; import consumes it |
| P0-T6 | Phase 0 exit | Validation is the gate |
| P1-T2 | P1-T3, P1-T5 | Engine reads/writes the schema |
| P1-T3 | P1-T4, P1-T5 | Interactions and composition call the scheduler wrapper |
| P1-T5 | P1-T6 | UI renders composed sessions |
| P1-T8 | M3, P3-T6 | Docker path must exist before the daily-habit milestone and deploy proof |
| P2-T1 | P2-T2, P2-T8 | Components and audit consume tokens |
| P3-T1 | P3-T3, P3-T6 | The E2E gate and deploy proof exercise the service worker |

### Milestones

| ID | Milestone | Exit evidence | Rough sizing (1 eng.) |
|---|---|---|---|
| M1 | Content ready | Phase 0 exit: `validate:content` 0 violations on 1,000 entries; §7 gates pass | ~2–3 wks |
| M2 | MVP loop works in dev | Phase 1 engine + UI tasks green; dogfood started | cumulative ~5–7 wks |
| **M3** | **First usable daily habit** — earliest point the owner can learn daily: full core loop (typed recall, FSRS scheduling, session composition) served by `docker compose up` | End of **Phase 1**: §8 exit criteria met (100-session dogfood, FSRS reference match, 0 data-loss bugs) + P1-T8 compose smoke check | cumulative ~5–7 wks |
| M4 | Polished, accessible app | Phase 2 exit: WCAG 2.2 AA audit green | cumulative ~8–10 wks |
| M5 | Truly offline, reboot-safe PWA | Phase 3 exit: offline E2E green; reboot tested at 3/14/60 days; compose deploy smoke green | cumulative ~10–13 wks |

M3 is the priority milestone for this owner profile: a motivated beginner starting from zero should reach a dependable daily-learning loop before any polish, PWA, or reboot work begins.
