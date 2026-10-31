# Zen-Style German Vocabulary PWA — Planning Document

_Status: draft for review. No application code yet — implementation begins only after this plan is approved. Grounded in the prompt's summary of the research paper (the paper itself was not attached; see §9 assumptions)._

**App name: Wortgarten** ✅ (owner decision 2026-09-15). Former candidates:

| Name                      | Rationale                                                                         | Risk                                  |
| ------------------------- | --------------------------------------------------------------------------------- | ------------------------------------- |
| **Wortgarten** _(chosen)_ | "Word garden" — calm growth metaphor, fits zen philosophy, memorable for learners | Slightly playful                      |
| **Wortkern**              | "Word core" — directly signals the 1,000-word core mission                        | More austere, less warm               |
| **Lichtung**              | "Forest clearing" — pure zen, distinctive                                         | Meaning opaque to non-German speakers |

---

## 1. Product Definition & Scope

**One-line pitch:** A calm, offline-first web app that takes an English-speaking learner from zero to the 1,000 highest-utility German words via spaced repetition — honest about coverage (~65% of non-fiction, ~72% of fiction, ~83% of spoken German), never gamified into anxiety.

**MVP feature set (Phase 1–2):**

- Curated 1,000-word deck with gender, plural, POS, English gloss, case-marked example sentence, audio, theme + CEFR tags.
- FSRS-based scheduling with typed active recall as the default interaction.
- Daily session: due reviews first, then new words interleaved in small thematic blocks.
- Zen UI: one action per screen, gender-color-coded cards, pronunciation button, calm progress rings.
- Streaks with freeze mechanics (optional, dismissible), local progress dashboard.
- Offline-first PWA install (Phase 3 completes full offline + reboot flow).

**V2/V3 backlog:**

- Accounts + cross-device sync of SRS state.
- Web-push reminders timed to predicted forgetting.
- Speech recognition for pronunciation practice.
- Thematic deep-dive packs.
- Community/shared decks (only if a strong use case emerges).

**Explicit non-goals:**

- Not a grammar course (grammar appears only as one-line micro-tips on cards).
- Not exam-certification prep (no Goethe/telc mock tests).
- No leaderboards, social pressure, ads, or dark patterns — ever.
- No claims of "fluency"; coverage is stated per-register (spoken vs. written) in all copy.

---

## 2. Content & Data Architecture

**Sourcing pipeline (Phase 0) — revised 2026-09-15 (owner decision: no LLM in the product or anywhere in the pipeline):**

1. **Knowledge source:** the curated, pedagogically annotated list [`top-1000-german-words.md`](./top-1000-german-words.md) — 1,000 lemmas spanning A1–B1, already carrying article+plural, POS, grammar/Rektion, CEFR band, theme, and example sentences. It provides all §2 enrichment metadata, so **no LLM enrichment pass exists**. The list's `#` column is the frequency spine (`freq_rank`); `GER` → `cefr`; `Themenfeld` → `theme`.
2. **Parse, don't generate:** a deterministic script maps the markdown table → the §2 `words.json` schema (headword notation like `der Automat, -en` → gender/plural; principal parts → separable/reflexive handling; Rektion → `case_note`). Schema corners are resolved via the amendment proposals in `docs/06-examples-and-edge-cases.md` §8.3 before import.
3. **Coverage check (QA only):** verify A1/A2 coverage against the official Goethe-Institut Wortlisten (© Goethe-Institut — checklist only, never redistributed); exclusions recorded with reasons. Leipzig/SUBTLEX-DE cross-validation is optional curation-time QA, never shipped (§7).
4. **Validate & spot-check:** automated validation gates per §7, plus an owner spot-check sample (no external review budget — personal-use app).

**Per-word schema (seeded as `words.json`, imported into IndexedDB):**

| Field           | Type                  | Notes                                             |
| --------------- | --------------------- | ------------------------------------------------- |
| `id`            | string                | Stable slug, e.g. `hund`                          |
| `lemma`         | string                | Dictionary form                                   |
| `gender`        | `der\|die\|das\|null` | null for non-nouns                                |
| `plural`        | string\|null          | e.g. `Hunde`; `null` for no-plural nouns          |
| `pos`           | enum                  | noun, verb, adj, adv, prep, conj, pron, num, part |
| `gloss_en`      | string                | Concise English gloss (1–3 senses max)            |
| `example_de`    | string                | One sentence, case usage visible                  |
| `example_en`    | string                | Translation                                       |
| `case_note`     | string\|null          | e.g. "mit + Dativ"; micro-grammar, one line       |
| `separable`     | bool                  | Verb prefix flag                                  |
| `prefix`        | string\|null          | e.g. `an` for `ankommen`                          |
| `audio_word`    | string                | Asset path, e.g. `audio/hund.ogg`                 |
| `audio_example` | string                | Asset path                                        |
| `image_ref`     | string\|null          | Icon ref for concrete nouns (~40% of deck)        |
| `theme`         | string                | One of ~30 thematic units                         |
| `cefr`          | `A1\|A2\|B1`          | Band from Goethe cross-check                      |
| `freq_rank`     | number                | 1–1000 position on merged frequency spine         |
| `source`        | string[]              | Provenance for attribution/licensing              |

**Curriculum structure:** frequency rank is the backbone (learn roughly in rank order). The deck is partitioned into **~30 thematic units** (essentials, people & family, home, food, time, numbers, movement, work, feelings, nature…) mapped onto CEFR bands **A1 → A2 → B1**, so a session's "new word block" is a small coherent thematic set drawn from the next frequency-eligible words.

---

## 3. Learning Engine

**Scheduler: FSRS, not SM-2.**

- Library: `ts-fsrs` (MIT, TypeScript port of FSRS-4.5) — no custom scheduler code.
- Start with default FSRS parameters, target retrievability **0.9**.
- Each vocabulary item produces **two schedulable cards**: _recognition_ (DE→EN) and _production_ (EN→DE, typed, article required for nouns). They schedule independently, so weak production doesn't hide behind strong recognition.
- Card states follow FSRS (New → Learning → Review, Relearning on lapse). Ratings: `Again / Hard / Good / Easy`, derived from the interaction rather than asked of the user directly:

| Interaction outcome                        | Mapped rating |
| ------------------------------------------ | ------------- |
| Wrong / no idea                            | Again         |
| Right after hint, typo fixed, or very slow | Hard          |
| Correct, normal pace                       | Good          |
| Instant, confident correct                 | Easy          |

- Parameter personalization: FSRS defaults until a user has ≥1,000 review logs; optionally re-fit offline with `fsrs-optimizer` and ship updated defaults (Phase 4 consideration, never blocks MVP).

**Interaction types (weighted toward production):** 0. **Intro** (first exposure) — a word is always _introduced_ before any recall attempt: article + lemma + plural + gloss + example + audio, self-graded "Got it" / "Show again" (no flip, no typed input). Cards stay recognition-only until 2 graded recalls; production/cloze/audio unlock after. The weights below apply to unlocked cards only.

1. **Typed production** (EN→DE, type lemma + article for nouns) — ~50% of reviews. Typo-tolerant grading (Levenshtein ≤1 + umlaut fallback `ae/oe/ue/ss` accepted, correct form always shown).
2. **Recognition** (DE→EN, self-rated or short typed gloss) — ~25%, mainly first exposures and abstract words.
3. **Cloze** — blank pre-computed at pipeline time from the exact surface form appearing in the example sentence (words whose lemma never appears verbatim, e.g. separable verbs, never receive cloze cards; their share redistributes to production). No flip: gapped sentence and typed input on one surface, the completed sentence is revealed only after submission — ~15%.
4. **Audio recall** (hear it, type it) — ~10%, only when audio available.

Immediate corrective feedback after every answer: correct form, gender color, plural, and one-tap replay of audio. No multiple choice anywhere in the core loop.

**Session composition:**

- Order: **due reviews first** (capped at the daily review cap, default 60, prioritized by lowest predicted retrievability), then **new words** (default 10/day → ~100 days to complete the core) in thematic blocks of 3–5, **interleaved** with remaining reviews rather than presented as one blocked batch.
- Session target configurable: 5 / 10 / 15 / 20 min. A session ends cleanly at target — never pads with filler.
- All scheduling decisions come from the local DB; the engine works identically offline.

---

## 4. UI/UX Design Plan — Claymorphism

_(Third design direction — owner decision 2026-09-16, after zen-paper and modern-futuristic were both rejected. Soft-3D "clay" world: puffy surfaces, chunky radii, double shadows (inset highlight + soft outer drop), squish-press interactions. The functional constraints below — WCAG 2.2 AA contrast, gender-color-never-sole-carrier, reduced-motion, offline-first, no dark patterns — are unchanged and remain non-negotiable. Implemented via `src/styles/tokens.css`; token **names** are stable across redesigns so a reskin is a pure value/surface swap.)_

**Design principle:** "Toy, not billboard." One screen, one job, one obvious action — rendered as friendly, tactile clay objects an adult won't find childish (restrained pastel-on-lilac, no mascots, no cartoon copy).

**Visual design system (light, lilac clay world):**

| Token          | Value                                                                               | Notes                                                                                                |
| -------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Background     | lilac mist `#EFEBF7` (+ faint white radial glow)                                    | Never pure white, never grey                                                                         |
| Card / surface | white `#FFFFFF`, inputs `#F6F3FC`                                                   | Puffy clay objects on the mist                                                                       |
| Ink            | deep violet `#322E48`                                                               | 11:1 on background, 13:1 on card                                                                     |
| Neutrals       | 4 cool-violet steps                                                                 | Dividers, borders, secondary text (3/4 ≥4.5:1)                                                       |
| Accent         | juicy violet `#6D5AE0` (text-on-fill `#FFFFFF` 5.0:1; text variant `#4A3EDB` 6.0:1) | The _only_ accent                                                                                    |
| Gender: der    | clay blue `#2B5CB8`                                                                 | 6.3:1 as text on the card                                                                            |
| Gender: die    | clay rose `#C22E63`                                                                 | 5.4:1                                                                                                |
| Gender: das    | clay gold `#8F6C00`                                                                 | 4.9:1                                                                                                |
| Feedback       | success = leaf green `#257247` (5.9:1); error = clay coral `#B8402A` (5.5:1)        | Never neon                                                                                           |
| Clay shadows   | `--shadow-clay(-raised/-pressed/-input)`                                            | Outer soft drop (ink-tinted, never black) + inset top-left highlight; pressed states invert to inset |

Gender color is **never the sole carrier**: nouns always show the article as text, plus a color ribbon on the card edge.

- **Typography:** German word displayed in a serif (Source Serif 4, self-hosted) at 39px; UI in **Nunito** (rounded, self-hosted via `@fontsource/nunito`, weights 400/700/800 — includes ẞ in latin-ext, verified with fontTools). Modular scale 1.25: 12 / 14 / 16 / 20 / 25 / 31 / 39.
- **Spacing & shape:** 4px base grid, single-column max-width 640px, cards centered. Chunky corner radius 20–24px; borders replaced by double clay shadows; squish-press (`scale(0.92–0.97)` + inset shadow) on all buttons/chips.
- **Motion:** 120–250ms ease-out; card flip 280ms; no spring overshoot. **`prefers-reduced-motion`: all animation collapses to instant opacity crossfade.** Motion is pure CSS; no animation library.

**Screen inventory & key flows:**

1. **Onboarding (3 quiet steps):** daily-goal picker → how typing answers works (one practice card) → audio voice check. Skippable.
2. **Home:** greeting, thin progress ring, one button: _Begin session_. Streak shown small, off to the side.
3. **Session:** the card. Flip on tap/Space. Answer input auto-focused. Pronunciation button top-right.
4. **Session summary:** words learned, retention today, time. No confetti — a slow "still water" ripple.
5. **Progress dashboard:** three rings (core coverage %, 30-day retention, streak), honest copy: "These 340 words cover about ~60% of spoken German you'll hear."
6. **Word detail:** full schema fields, audio for word + example, personal retention stats.
7. **Settings:** daily goal, notification opt-in, reduced motion (auto + manual), audio voice, data export (JSON), license/attribution page.
8. **Reboot state:** returning-user variant of Home (see §5).

**Signature interactions:** gender-ribbon card flip; pronunciation button with gentle ripple; thin progress rings that fill over 250ms; typing input that shows live umlaut helper chips (ä ö ü ß) for non-German keyboards.

**Accessibility (WCAG 2.2 AA):** all text ≥4.5:1; full keyboard map (Space = flip, Enter = submit, 1–4 = rate when applicable, P = pronounce); visible focus rings in accent; every icon button aria-labeled; screen reader announces "Hund, masculine, plural Hunde" on reveal; honor reduced-motion at OS level plus in-app toggle.

---

## 5. Retention & Reboot System

**Humane streaks (decoupled from the review queue):**

- A streak day = completing the daily goal (minutes), _not_ clearing the due queue — FSRS workload never inflates to protect a streak.
- **Freeze:** one freeze earned per 7 streak days, cap 3, auto-applied with a calm note ("Rest day — your streak is safe").
- **Repair:** after a miss, a 5-minute "rebuild session" restores the streak once.
- Everything streak-related is optional and can be hidden in Settings. No streak loss copy that shames.

**Lapsed-user reboot flow (the differentiator):**

- Detection: no session for 3+ days = _lapsed_; 14+ = _dormant_.
- On return, the app **never** dumps the full overdue backlog. Instead:
  1. **Welcome screen with encouraging copy** — e.g. _"Welcome back. There's nothing to catch up on — we've picked out what matters."_ Guilt copy is banned.
  2. **Backlog capping & staggering:** visible due queue capped at 50/day; the remainder is re-distributed by FSRS predicted retrievability over the following days (most-forgotten first), so the curve re-stabilizes naturally.
  3. **10-card diagnostic** mixing previously mature cards to re-estimate memory state; lapsed mature cards drop into relearning with FSRS-standard interval penalty (no punitive reset to zero).
  4. **Comeback session:** a short, low-friction 5-minute session is the only call to action on day one back.

**Reminders tied to the forgetting curve, not spam:**

- Opt-in only, max 1/day, quiet hours respected, deep-link straight into the session.
- Timing heuristic: nudge when predicted retrievability of recently learned words drops toward ~0.85 — "your new words are about to fade" is the _only_ nudge category, plus an optional fixed-time habit reminder.
- MVP reality check: true web push needs a backend; Phase 1–2 uses in-app surfacing only, Phase 3 adds local notifications where the platform allows, real push only if/when accounts ship.

---

## 6. Technical Architecture

**Stack (with rationale):**

| Layer     | Choice                                                                                                | Why                                                              |
| --------- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Framework | React 18 + TypeScript + Vite                                                                          | Type-safe SRS state, fast HMR, huge hiring pool                  |
| Local DB  | Dexie.js (IndexedDB)                                                                                  | Local source of truth, clean async API, observable queries       |
| SRS       | `ts-fsrs` (MIT)                                                                                       | Reference-quality FSRS, zero scheduler code to maintain          |
| PWA       | `vite-plugin-pwa` + Workbox                                                                           | Precache app shell + audio, runtime cache for images             |
| Audio     | Bundled `.ogg` for 1,000 words + examples; Web Speech API (`speechSynthesis`, de-DE) as live fallback | Guarantees German voice offline; API covers anything not bundled |
| State     | Zustand (UI/session state) + Dexie as persistence                                                     | Minimal, no boilerplate; SRS state lives in DB, not memory       |
| Routing   | React Router                                                                                          | Standard                                                         |
| Testing   | Vitest + Testing Library; Playwright for offline E2E                                                  | Offline behavior must be E2E-proven                              |

**Offline-first data flow:**

```
words.json (seed, versioned) ──first load──▶ IndexedDB (Dexie)
                                                │  tables:
                                                │  words · cards · reviewLogs
                                                │  sessions · settings
UI (React/Zustand) ◀──live queries──┘
        │
        ▼ answers
   ts-fsrs (in-memory) ──writes──▶ cards + reviewLogs   [100% local]
        │
Service worker: precache shell + audio · runtime-cache images
        │
   (V2, optional) account backend ◀── background sync of reviewLogs
                                        (append-only log, last-write-wins per card)
```

- **Data seeding:** `words.json` (~1,000 entries, ~400KB) ships in the bundle; a `dataVersion` field triggers idempotent re-import on updates without touching SRS state.
- **SRS state model:** `cards` table holds FSRS fields per card (`due, stability, difficulty, elapsed_days, scheduled_days, reps, lapses, state, last_review`); `reviewLogs` is append-only (audit trail + future optimizer + future sync).
- **Bundled audio:** ~2,000 short `.ogg` files (word + example per lemma, est. 30–50MB) generated at build time with Piper TTS (MIT, German voices) — license-clean because self-generated. Precached in chunks on first run with a progress state; live TTS used until caching completes.
- **No backend in MVP.** Schema (append-only `reviewLogs`, stable IDs) is designed so optional sync later is additive, not a migration.
- **Deployment (owner decision 2026-09-15):** personal-use, single-user self-hosting — `docker compose up` must be the entire deploy story (multi-stage image: Vite build → nginx serving the static PWA). No external services, no backend container.

---

## 7. Content Sourcing & Licensing Plan

| Dataset                                                                                                                            | License                                    | Usable as-is?                      | Planned use                                                                                                                                                                                                                                                                            |
| ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`top-1000-german-words.md`](./top-1000-german-words.md) (source base: onewholearns.com top-1000; DaF/DaZ pedagogical annotations) | ⚠️ **rights unverified**                   | ⚠️ personal use only until cleared | **Primary knowledge source** (owner decision 2026-09-15): parsed deterministically into `words.json`. Before ANY distribution — including a public repo containing `words.json` — verify rights or fall back to the hermitdave spine + self-authored metadata (see posture note below) |
| hermitdave/FrequencyWords (de)                                                                                                     | Code MIT; **data CC BY-SA 4.0**            | ✅ with attribution + share-alike  | **License-clean fallback spine** if the annotated list's rights don't clear; optional ranking QA                                                                                                                                                                                       |
| Leipzig Corpora Collection                                                                                                         | CC BY-NC (freq. lists); some corpora CC BY | ⚠️ non-commercial only             | Offline cross-validation of the ranking — used during curation, not shipped                                                                                                                                                                                                            |
| SUBTLEX-DE                                                                                                                         | Research / non-commercial only             | ⚠️ non-commercial only             | Offline sanity check for spoken-register coverage — not shipped                                                                                                                                                                                                                        |
| Goethe-Institut A1/A2 Wortlisten                                                                                                   | © Goethe-Institut                          | ❌ not redistributable             | **QA checklist only**: verify coverage of official A1/A2 vocabulary; no Goethe content ships                                                                                                                                                                                           |
| Audio                                                                                                                              | self-generated via Piper TTS (MIT)         | ✅                                 | Bundled `.ogg` for all 1,000 words + examples                                                                                                                                                                                                                                          |
| Images/icons                                                                                                                       | OpenMoji (CC BY-SA 4.0)                    | ✅ with attribution                | Line-style icons for concrete nouns only (~40% of deck); abstract words get no image, by design                                                                                                                                                                                        |

**Enrichment production (gender, plural, POS, gloss, examples, case notes) — no LLM (owner decision 2026-09-15):**

1. **Deterministic parse** of `top-1000-german-words.md` into the §2 schema — the annotated list already contains gender, plural, POS, Rektion/case info, CEFR band, theme, and example sentences. No LLM is used in the product or anywhere in the pipeline.
2. **Automated validation:** schema checks; every noun must have gender+plural (or explicit no-plural); example sentence must contain the lemma (or inflected form); separable verbs flagged; parse-fidelity check — all 1,000 table rows accounted for, zero silent drops.
3. **Owner spot-check** (replaces paid human review — personal-use app): a random sample per CEFR band checked against Duden/Wiktionary for gender/plural correctness and example naturalness; findings logged as a curation artifact. Accepted risk: no external reviewer; residual errors are the owner's to catch while learning.
4. **Quality gates before ship:** zero schema violations; A1 coverage vs. Goethe list ≥ 98% (with documented exclusions); audio file present for every entry.

**License posture:** the app as planned is free and non-commercial → Leipzig/SUBTLEX-DE usage in curation is defensible. **If monetization is ever introduced, all Leipzig/SUBTLEX-derived influence must be re-audited** (flagged in §9 for sign-off).

**Annotated-list rights (verdict 2026-09-15):** `top-1000-german-words.md` and everything derived from it (incl. `words.json`) are used under a **strictly personal-use** posture — the app and its data are never distributed, published, or pushed to a public repo (owner decision 2026-09-15). Under that posture the unverified redistribution rights block nothing. **If the distribution posture ever changes, work stops and the deck is first rebuilt on the CC BY-SA hermitdave spine with self-authored metadata** (or the rights are verified in writing).

---

## 8. Roadmap & Milestones

| Phase                    | Scope                  | Key deliverables                                                                                                                       | Exit criteria                                                                                     |
| ------------------------ | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| **0 — Content pipeline** | Word list + enrichment | 1,000-entry `words.json`; validation scripts; generated audio; attribution page                                                        | All §7 quality gates pass                                                                         |
| **1 — MVP**              | Core loop              | ts-fsrs integration; typed recall + recognition; session composition; minimal zen UI (web, online)                                     | 100-session dogfood; scheduling matches FSRS reference outputs; 0 data-loss bugs                  |
| **2 — Polish**           | Zen + motivation       | Full design system; gender color coding; cloze + audio recall; bundled audio live; streaks with freeze/repair; dashboard               | WCAG 2.2 AA audit passes; reduced-motion verified; TTS fallback tested on Chrome/Safari/Firefox   |
| **3 — Offline & reboot** | PWA + retention        | Service worker precache + full offline; install prompt; lapsed-user reboot flow (cap/stagger/diagnostic/comeback); local notifications | Playwright offline E2E green (kill network mid-session); reboot flow tested at 3/14/60-day lapses |
| **4 — Stretch**          | Depth                  | Speech recognition; thematic deep-dives; optional accounts + sync; FSRS personalization                                                | Scoped separately after MVP retention data exists                                                 |

Rough sizing (1 engineer): P0 ≈ 2–3 wks · P1 ≈ 3–4 wks · P2 ≈ 3 wks · P3 ≈ 2–3 wks.

---

## 9. Open Questions & Assumptions

**Assumptions made (to keep the plan concrete):**

1. **Learner's L1 = English** — all glosses/UI in English.
2. **Single-user, local-first, no accounts in MVP** — but schema is sync-ready (append-only logs, stable IDs).
3. **Free, non-commercial app** — this is what makes Leipzig/SUBTLEX-DE usable in curation (§7).
4. **Bundled audio is TTS-synthesized** (Piper), not human-recorded — acceptable quality, license-clean, offline-guaranteed.
5. German variety = Standard German (Germany).
6. The research paper itself was not attached; this plan is grounded in the prompt's summary of its findings.

**Needs explicit sign-off before building:**

1. ~~**App name**~~ ✅ **Wortgarten** (owner decision 2026-09-15).
2. **Non-commercial posture** — confirm the app stays free/non-commercial (licensing hinges on it); if monetization is planned, §7 must be reworked before any Leipzig/SUBTLEX usage.
3. ~~**Human review budget for Phase 0**~~ ✅ moot (owner decision 2026-09-15): no LLM enrichment — the annotated list is parsed deterministically; review = automated validation + owner spot-check; no external review budget.
4. ~~**Accounts/sync ever?**~~ ✅ **Later** (owner decision 2026-09-15): keep the sync-ready schema (append-only `reviewLogs`, stable IDs); zero sync code in MVP.
5. ~~**B1 ambition**~~ ✅ (owner decision 2026-09-15): the 1,000-word deck ships with its A1–B1 CEFR tags as-is — distribution A1 415 / A2 293 / B1 292 — B1 words within the deck are in scope (owner goal: ~B1). The B1 **extension** (words 1,001–2,000) is not needed and is dropped from the roadmap.
