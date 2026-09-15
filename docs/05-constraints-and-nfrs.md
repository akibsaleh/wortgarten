# 05 — Constraints & Non-Functional Requirements

Derived from and subordinate to PLAN.md — on conflict, PLAN.md wins. Status date: 2026-09-15.

This document restates the non-negotiable constraints of AGENTS.MD and PLAN.md (§1, §5, §6, §7) as **numbered, verifiable NFRs**. Every NFR carries a verification method: **automated test** (unit/E2E/CI script), **audit** (repeatable scripted or checklist inspection), or **manual review** (human sign-off). §11 is the master verification matrix referenced by [07-task-breakdown.md](./07-task-breakdown.md).

**Approved owner decisions (2026-09-15) this document encodes:** personal use, single user, free and non-commercial forever; learner starts at zero German, goal ~B1; deployment = Docker Compose self-hosting on the owner's own hardware (PLAN.md §6); app name: **Wortgarten** (chosen 2026-09-15).

**Verification method key:** `AT` = automated test · `AU` = audit (scripted/checklist) · `MR` = manual review.

---

## 1. Product Constraints

Normative product behavior. These are constraints on *what may be built*, not quality attributes.

| NFR | Requirement (normative) | Verification |
|---|---|---|
| NFR-PROD-1 | The app **must never** contain ads, paywalls, purchase flows, or aggressive upgrade prompts. There is no payment code path. | AU: dependency + code audit per release (no ad/payment SDKs); MR: UI copy review |
| NFR-PROD-2 | The app **must never** use guilt or shame copy (e.g., streak-loss shaming, "you failed" messaging). Streaks and reminders **must** be optional, dismissible, and hidable in Settings (PLAN.md §5). | AT: settings-toggle E2E; MR: copy review against banned-pattern list |
| NFR-PROD-3 | The core learning loop **must** use typed active recall as the default interaction. Multiple choice **must not** appear anywhere in the core loop (PLAN.md §3). | AT: component/E2E tests assert no MC widget in session flow; MR: session-flow review |
| NFR-PROD-4 | Scheduling **must** be FSRS via the `ts-fsrs` library only. SM-2, hand-rolled schedulers, or local forks of scheduling logic **must not** be introduced. Rating mapping (wrong→Again … instant→Easy) follows PLAN.md §3. | AT: scheduling output matches ts-fsrs reference vectors; AU: dependency audit |
| NFR-PROD-5 | All coverage claims in UI/copy **must** state per-register figures (~65% non-fiction, ~72% fiction, ~83% spoken). The word "fluency" and equivalent absolute claims **must not** appear in any copy. | AT: copy lint test over string resources; MR: copy review |
| NFR-PROD-6 | A session **must** end cleanly at the configured target (5/10/15/20 min) and **must never** pad with filler items. Due reviews come first (capped, default 60), then new words (default 10/day) in interleaved thematic blocks of 3–5 (PLAN.md §3). | AT: session-composition unit tests |
| NFR-PROD-7 | A streak day **must** be defined as completing the daily minutes goal, never as clearing the due queue; FSRS workload **must not** inflate to protect a streak (PLAN.md §5). | AT: streak-logic unit tests |

---

## 2. Content Completeness Constraints

From AGENTS.MD constraint 5 and PLAN.md §7 quality gates. A bare word-to-word mapping is a bug.

| NFR | Requirement (normative) | Verification |
|---|---|---|
| NFR-CONT-1 | Every one of the 1,000 `words.json` entries **must** ship with: `gender` (or explicit `null` for non-nouns), `plural` (or explicit `null` for no-plural nouns), `pos`, `gloss_en`, `example_de` with case usage visible, `example_en`, `theme`, `cefr`, `freq_rank`, `source`. Zero schema violations at ship time. | AT: schema validation script in Phase 0 gate (CI) |
| NFR-CONT-2 | Every noun entry **must** carry grammatical gender **and** plural or an explicit no-plural marker; the example sentence **must** contain the lemma or an inflected form; separable verbs **must** be flagged. | AT: automated validation per PLAN.md §7 step 2 |
| NFR-CONT-3 | Every entry **must** have a bundled audio file for word and example (`audio_word`, `audio_example` present on disk). Ship gate: audio present for 100% of entries. | AT: audio-existence check in Phase 0 pipeline |
| NFR-CONT-4 | A1 coverage vs. the Goethe A1 Wortliste **must** be ≥98%, with every exclusion documented with a recorded reason. No Goethe content ships (see NFR-LIC-4). | AU: coverage report artifact from Phase 0; MR: exclusion list sign-off |
| NFR-CONT-5 | Content review (owner decision 2026-09-15 — no LLM in product or pipeline; enrichment is a deterministic parse of `top-1000-german-words.md`): owner spot-check **must** cover ≥10% of A1 and ≥5% of A2/B1 entries (gender/plural correctness vs. Duden/Wiktionary, example naturalness) before ship (PLAN.md §7). Accepted risk: no external reviewer. | MR: spot-check log committed as curation artifact |
| NFR-CONT-6 | Gender color **must never** be the sole information carrier: every noun display **must** show the article as text plus the 4px color ribbon (PLAN.md §4). | AT: component tests assert article text rendered; AU: a11y audit |

---

## 3. Licensing & Legal Constraints

Violating this section is a legal problem, not a style problem (AGENTS.MD). Standing assumption: the app is **personal-use, free, and non-commercial** — this posture **must** be re-verified before any distribution beyond the owner's own hardware, and is the sole basis for the defensibility of Leipzig/SUBTLEX-DE curation-time use and of the personal-use posture for the annotated source list (NFR-LIC-8).

| NFR | Requirement (normative) | Verification |
|---|---|---|
| NFR-LIC-1 | hermitdave/FrequencyWords (de) data is CC BY-SA 4.0: attribution **must** ship in-app (license/attribution page, PLAN.md §4 screen 7) and the derived word list **must** remain CC BY-SA. | AU: attribution page presence + content check; MR: release checklist |
| NFR-LIC-2 | Leipzig Corpora and SUBTLEX-DE **must** be used for curation-time QA only and **must never** ship in any artifact (bundle, `words.json`, audio, docs samples). Non-commercial use only. | AU: pipeline artifact scan (no Leipzig/SUBTLEX strings in shipped data) |
| NFR-LIC-3 | SUBTLEX-DE / Leipzig influence **must** be re-audited if the non-commercial posture ever changes. | MR: posture review gate |
| NFR-LIC-4 | Goethe-Institut Wortlisten **must** be used as a coverage checklist only; no Goethe content **must** be redistributed in any form. | AU: shipped-data diff against checklist artifacts |
| NFR-LIC-5 | All audio **must** be self-generated with Piper TTS (MIT). No scraped, ripped, or third-party-recorded audio **must** enter the repo or bundle. | AU: asset provenance check in Phase 0 pipeline |
| NFR-LIC-6 | Icons **must** be OpenMoji (CC BY-SA 4.0) with attribution, used for concrete nouns only (~40% of deck). | AU: attribution page + asset manifest check |
| NFR-LIC-7 | **Hard stop rule:** if monetization is ever introduced, work **must** stop and PLAN.md §7 **must** be reworked and re-approved before any further Leipzig/SUBTLEX-influenced curation or distribution. | MR: mandatory escalation; not waivable |
| NFR-LIC-8 | `top-1000-german-words.md` (source base onewholearns.com; DaF/DaZ annotations) is the primary knowledge source, used under a **strictly personal-use** posture (owner decision 2026-09-15): the app and derived data (`words.json`) **must never** be distributed or published (a public repo counts). If the posture ever changes, work **must** stop and the deck be rebuilt on the CC BY-SA hermitdave spine with self-authored metadata (or rights verified in writing) before any release. | MR: posture gate; verdict recorded in PLAN.md §7 |

---

## 4. Accessibility NFRs (WCAG 2.2 AA)

| NFR | Requirement (normative) | Verification |
|---|---|---|
| NFR-A11Y-1 | All text **must** meet ≥4.5:1 contrast against its background, covering every palette token in PLAN.md §4 (ink 13.5:1; accent text variant `#2E5E46`; gender colors `#3B6EA5` / `#9E4B63` / `#8A6D1F`; error `#B3563B`). | AT: token contrast test in CI; AU: axe-core audit per screen |
| NFR-A11Y-2 | The full keyboard map **must** work: Space = flip, Enter = submit, 1–4 = rate when applicable, P = pronounce. All functionality **must** be keyboard-reachable with no traps. | AT: Playwright keyboard E2E; AU: axe/manual keyboard pass |
| NFR-A11Y-3 | Every icon-only button **must** have an aria-label. | AT: Testing Library queries + axe-core in CI |
| NFR-A11Y-4 | On card reveal, screen readers **must** announce word, gender, and plural (spec: "Hund, masculine, plural Hunde"). | AT: aria-live region test; MR: screen-reader pass (VoiceOver/NVDA) |
| NFR-A11Y-5 | `prefers-reduced-motion` **must** be honored at OS level **and** via an in-app toggle (auto + manual, PLAN.md §4 settings); with reduced motion, all animation **must** collapse to instant opacity crossfade. | AT: E2E with emulated media; MR: toggle verification |
| NFR-A11Y-6 | Focus rings **must** be visible (accent color) on all interactive elements; focus **must** move logically through the session flow (auto-focused answer input). | AT: focus-order E2E; AU: visual audit |
| NFR-A11Y-7 | The Phase 2 exit gate **must** include a full WCAG 2.2 AA audit pass (PLAN.md §8). | AU: audit report; MR: sign-off |

---

## 5. Offline-First NFRs

| NFR | Requirement (normative) | Verification |
|---|---|---|
| NFR-OFF-1 | After first load, the **entire** learning loop (session composition, answering, scheduling, audio, dashboard) **must** function with zero network. Proof: Playwright E2E that kills the network **mid-session** and completes the session (PLAN.md §8 Phase 3 exit gate). | AT: offline E2E (must be green before Phase 3 ships) |
| NFR-OFF-2 | The service worker **must** precache the app shell plus all bundled audio, with a visible progress state during first-run caching; live TTS **must** be used until precaching completes. | AT: SW precache manifest test + E2E; MR: first-run UX review |
| NFR-OFF-3 | Bundled `.ogg` audio **must** guarantee a German voice offline; Web Speech API (`speechSynthesis`, de-DE) **must** exist only as a live fallback for anything not bundled. | AT: audio-playback E2E offline; AU: fallback path test on Chrome/Safari/Firefox |
| NFR-OFF-4 | No service-worker/offline work **must** begin before Phase 3, per PLAN.md §8 phase order; conversely Phase 3 **must not** be declared done without the offline E2E green. | MR: phase-gate review |

---

## 6. Privacy & Data NFRs

| NFR | Requirement (normative) | Verification |
|---|---|---|
| NFR-DATA-1 | 100% of user data **must** live locally in IndexedDB (Dexie). There **must** be no accounts, no backend, and no server-side user data in MVP. | AU: architecture review; AT: network-call E2E (see NFR-DATA-3) |
| NFR-DATA-2 | The app **must not** include analytics, tracking, telemetry, or third-party beacons of any kind. | AU: dependency + network audit per release |
| NFR-DATA-3 | After first load and precache, the app **must** make zero network calls. | AT: Playwright E2E asserting no outbound requests during a full session |
| NFR-DATA-4 | A complete JSON data export **must** be available in Settings (PLAN.md §4 screen 7). Export **must** include words progress, card state, review logs, sessions, and settings. | AT: export unit test (round-trip parse + field completeness) |
| NFR-DATA-5 | SRS state **must** be durable in IndexedDB and **must never** be memory-only; every answer **must** write `cards` + `reviewLogs` before the next card is shown. | AT: persistence test (answer → reload → state intact) |
| NFR-DATA-6 | `reviewLogs` **must** be append-only: no update or delete paths may exist in application code. | AT: API surface test; AU: code review per change touching `reviewLogs` |

---

## 7. Performance & Resource Budgets

| NFR | Requirement (normative) | Verification |
|---|---|---|
| NFR-PERF-1 | `words.json` **must** stay ~400KB (1,000 entries). Any growth beyond +20% **must** be justified in the change. | AT: bundle-size CI check |
| NFR-PERF-2 | Bundled audio **must** total ~30–50MB across ~2,000 short `.ogg` files and **must** be precached in chunks with progress (not one blocking fetch). | AT: build-time size report; E2E: chunked precache |
| NFR-PERF-3 | First load on a mid-tier connection **must** reach an interactive shell promptly (app shell first, audio caching deferred/background with progress state). | AU: Lighthouse / WebPageTest run at Phase 3; MR: budget sign-off |
| NFR-PERF-4 | All UI animation **must** be pure CSS, 120–250ms ease-out (card flip 280ms), no spring overshoot, no animation library, and **must** hold 60fps on a low-end device. | AT: stylelint/code audit (no JS animation deps); AU: DevTools performance trace |
| NFR-PERF-5 | Query load is trivial by design — 1,000 words, ≤60 due reviews per session (default cap): session composition and dashboard queries **must** complete without perceptible latency on a low-end device. | AT: timing assertion in session-composition tests |
| NFR-PERF-6 | The app **must** run acceptably on low-end hardware and on Safari (the PWA-constrained browser); audio pre-caching **must** not jank the session UI. | MR: device pass (low-end + Safari) at Phase 3 |

---

## 8. Deployment & Operability NFRs

Deployment decision (owner-approved 2026-09-15, PLAN.md §6): personal-use, single-user self-hosting. There is no backend and there are no external services.

| NFR | Requirement (normative) | Verification |
|---|---|---|
| NFR-DEP-1 | `docker compose up -d --build` **must** be the entire deploy story: one multi-stage image (Vite build → nginx serving the static PWA), no backend container, no external service dependencies. | AT: clean-checkout deploy test (fresh clone → compose up → app serves) |
| NFR-DEP-2 | The container **must** be stateless with respect to user data: all user state lives in the browser's IndexedDB, so redeploy/rebuild **must never** lose SRS data. | AT: E2E — session → rebuild container → state intact |
| NFR-DEP-3 | nginx cache headers **must** be correct: hashed static assets `Cache-Control: immutable` (long max-age); `index.html` served no-cache/no-store so service-worker updates ship immediately. | AT: header assertions in deploy E2E |
| NFR-DEP-4 | The app **must** run on the owner's hardware with zero external runtime dependencies (no CDN fonts — Inter/Source Serif self-hosted; no hosted APIs; no third-party calls). | AU: network audit of running container |
| NFR-DEP-5 | The update path **must** be exactly: `git pull` + `docker compose up -d --build`. Data migrations between versions **must** be handled by the idempotent `dataVersion` re-import (see NFR-REL-2), never by manual steps. | AT: upgrade E2E (v(n) data → deploy v(n+1) → state preserved) |

---

## 9. Reliability & Data-Integrity NFRs

| NFR | Requirement (normative) | Verification |
|---|---|---|
| NFR-REL-1 | **Zero data-loss tolerance.** No user action, crash, reload, or redeploy **must** lose recorded review history or SRS state. Phase 1 exit criterion: 0 data-loss bugs (PLAN.md §8). | AT: crash/reload persistence E2E; MR: dogfood log review |
| NFR-REL-2 | `words.json` re-import **must** be idempotent, keyed by stable slug IDs, triggered by `dataVersion`, and **must never** touch SRS state (`cards`, `reviewLogs`, `sessions`). | AT: double-import test yields identical DB; import-after-progress test |
| NFR-REL-3 | The backup story **is** the JSON export (NFR-DATA-4): export **must** be sufficient to reconstruct user progress after a browser-data wipe (import/restore path or documented manual recovery). | AT: export → wipe → restore equivalence test; MR: recovery doc review |
| NFR-REL-4 | Lapsed-return backlog handling **must** follow PLAN.md §5: visible due queue capped at 50/day, remainder re-staggered by predicted retrievability; a lapsed return **must never** dump the full overdue backlog. Reboot flow **must** be tested at 3/14/60-day lapses. | AT: reboot-flow E2E at the three lapse boundaries |

---

## 10. Browser / Platform Support Matrix

Normative support targets. "Supported" = all NFRs above verified on that platform.

| Platform | Support level | Notes / caveats |
|---|---|---|
| Chrome/Edge (current + previous major) | Full support | Reference platform for offline E2E |
| Safari (current + previous major), macOS | Full support | PWA install is manual (Add to Dock); stricter storage eviction — see below |
| Firefox (current + previous major) | Full support | TTS fallback verified per PLAN.md §8 Phase 2 gate |
| iOS / iPadOS (current), Safari | Supported with caveats | Install via Add to Home Screen; iOS may evict IndexedDB/storage under pressure after ~7 days of non-use for non-installed sites — mitigations: encourage install, JSON export backup (NFR-REL-3) |
| Android (current), Chrome | Supported | Standard PWA install prompt |

**Web Speech de-DE variance:** available `de-DE` voices, quality, and offline availability differ per platform and OS version (iOS voices are OS-managed; desktop Chrome may use network voices). This variance is the reason bundled Piper audio is the primary path (NFR-OFF-3): the Web Speech API **must** be treated as an unreliable fallback only, and pronunciation features **must** degrade gracefully to bundled audio.

---

## 11. Constraint Verification Matrix

Master checklist. Phases per PLAN.md §8. Every NFR must be green at its enforcement phase and re-verified at every subsequent release.

| NFR | Constraint (short) | Verified by | Enforced in phase |
|---|---|---|---|
| NFR-PROD-1 | No ads/paywalls ever | AU dependency audit + MR copy review | 1, then every release |
| NFR-PROD-2 | No guilt copy; streaks/reminders optional + dismissible | AT settings E2E + MR copy review | 2 |
| NFR-PROD-3 | Typed recall only; no multiple choice in core loop | AT component/E2E | 1 |
| NFR-PROD-4 | FSRS via ts-fsrs only | AT reference-vector tests | 1 |
| NFR-PROD-5 | Honest per-register coverage copy; never "fluency" | AT copy lint + MR | 2 (all copy-bearing phases) |
| NFR-PROD-6 | Clean session end; due-first capped composition, interleaved new blocks | AT unit tests | 1 |
| NFR-PROD-7 | Streak decoupled from review queue | AT unit tests | 2 |
| NFR-CONT-1 | Full per-word schema, zero violations | AT schema gate | 0 |
| NFR-CONT-2 | Nouns: gender + plural; example contains lemma; separables flagged | AT validation script | 0 |
| NFR-CONT-3 | Audio present for 100% of entries | AT pipeline check | 0 |
| NFR-CONT-4 | A1 Goethe coverage ≥98%, exclusions documented | AU report + MR sign-off | 0 |
| NFR-CONT-5 | Owner spot-check: ≥10% A1, ≥5% A2/B1 (no LLM enrichment) | MR spot-check log | 0 |
| NFR-CONT-6 | Article text always shown; color never sole carrier | AT component tests + AU a11y | 2 |
| NFR-LIC-1 | FrequencyWords CC BY-SA attribution + share-alike list | AU + MR release checklist | 0 (attribution page), 1 (in-app) |
| NFR-LIC-2 | Leipzig/SUBTLEX curation-only, never shipped | AU artifact scan | 0, then every build |
| NFR-LIC-3 | Re-audit on posture change | MR gate | Standing |
| NFR-LIC-4 | Goethe checklist-only, never redistributed | AU shipped-data diff | 0, then every build |
| NFR-LIC-5 | Piper-only self-generated audio | AU provenance check | 0 |
| NFR-LIC-6 | OpenMoji icons with attribution, concrete nouns only | AU manifest + attribution page | 2 |
| NFR-LIC-7 | Monetization = stop + rework PLAN §7 | MR escalation | Standing |
| NFR-LIC-8 | Annotated list: strictly personal use (verdict 2026-09-15); never distributed | MR posture gate | Standing |
| NFR-A11Y-1 | Text contrast ≥4.5:1 all tokens | AT token test + axe audit | 2 |
| NFR-A11Y-2 | Full keyboard map, no traps | AT keyboard E2E | 2 |
| NFR-A11Y-3 | aria-labels on all icon buttons | AT axe-core CI | 2 |
| NFR-A11Y-4 | SR announcement spec on reveal | AT aria-live test + MR screen-reader pass | 2 |
| NFR-A11Y-5 | Reduced motion: OS + in-app toggle, crossfade only | AT emulated-media E2E | 2 |
| NFR-A11Y-6 | Visible focus rings, logical focus order | AT focus E2E + AU | 2 |
| NFR-A11Y-7 | WCAG 2.2 AA audit passes | AU report + MR | 2 (exit gate) |
| NFR-OFF-1 | Full loop works offline; kill-network-mid-session proof | AT Playwright offline E2E | 3 (exit gate) |
| NFR-OFF-2 | SW precache shell + audio with progress; TTS until cached | AT + MR | 3 |
| NFR-OFF-3 | Bundled audio guarantees German voice; Web Speech fallback only | AT offline audio E2E + AU cross-browser | 2 (audio), 3 (offline) |
| NFR-OFF-4 | No offline work before Phase 3; Phase 3 gate enforced | MR phase gate | 3 |
| NFR-DATA-1 | 100% local data, no accounts/backend | AU architecture review | 1 |
| NFR-DATA-2 | No analytics/tracking/telemetry | AU dependency + network audit | 1, then every release |
| NFR-DATA-3 | Zero network calls after first load | AT no-request E2E | 3 |
| NFR-DATA-4 | JSON export of all user data | AT export round-trip | 2 |
| NFR-DATA-5 | SRS durable in IndexedDB, never memory-only | AT persistence test | 1 |
| NFR-DATA-6 | reviewLogs append-only | AT API-surface test + AU review | 1 |
| NFR-PERF-1 | words.json ~400KB budget | AT bundle-size CI | 0, then every build |
| NFR-PERF-2 | Audio 30–50MB, chunked precache | AT size report + E2E | 0 (size), 3 (chunking) |
| NFR-PERF-3 | Interactive shell promptly on first load | AU Lighthouse + MR | 3 |
| NFR-PERF-4 | CSS-only 120–250ms motion, 60fps low-end | AU code + performance trace | 2 |
| NFR-PERF-5 | Session queries imperceptible (1k words, ≤60 due) | AT timing tests | 1 |
| NFR-PERF-6 | Low-end device + Safari acceptable | MR device pass | 3 |
| NFR-DEP-1 | `docker compose up -d --build` is the whole deploy | AT clean-checkout deploy test | 3 |
| NFR-DEP-2 | Stateless container; redeploy never loses SRS data | AT rebuild E2E | 3 |
| NFR-DEP-3 | Correct cache headers (immutable hashed / no-cache index.html) | AT header E2E | 3 |
| NFR-DEP-4 | No external runtime dependencies | AU network audit | 3 |
| NFR-DEP-5 | Update = git pull + rebuild; migration via dataVersion only | AT upgrade E2E | 3 |
| NFR-REL-1 | Zero data loss | AT crash/reload E2E + MR dogfood | 1 (exit gate) |
| NFR-REL-2 | Idempotent dataVersion re-import, SRS untouched | AT import tests | 1 |
| NFR-REL-3 | Backup = JSON export; restore path exists | AT wipe/restore test + MR | 2 |
| NFR-REL-4 | Reboot cap/stagger; tested at 3/14/60-day lapses | AT reboot E2E | 3 (exit gate) |

---

## Cross-References

- [PLAN.md](../PLAN.md) — source of truth (scope §1, retention §5, architecture §6, licensing §7, phases §8, open questions §9).
- [AGENTS.MD](../AGENTS.MD) — the 8 non-negotiables restated here as NFRs.
- [01-technical-specification.md](./01-technical-specification.md) — implementation detail that must satisfy these NFRs.
- [02-environment-and-tooling.md](./02-environment-and-tooling.md) — toolchain used to run the automated verifications.
- [03-testing-strategy.md](./03-testing-strategy.md) — how the `AT` verifications above are implemented.
- [04-design-assets.md](./04-design-assets.md) — palette/type tokens referenced by NFR-A11Y-1 and NFR-PERF-4.
- [06-examples-and-edge-cases.md](./06-examples-and-edge-cases.md) — concrete cases (reboot lapses, umlaut input, no-plural nouns).
- [07-task-breakdown.md](./07-task-breakdown.md) — tasks cite NFR IDs from §11 as acceptance criteria.
