# 03 — Testing Strategy

Derived from and subordinate to PLAN.md — on conflict, PLAN.md wins. Status date: 2026-09-15.

Scope: personal-use, single-user PWA; tests run locally on the owner's macOS machine. All commands are CI-ready (headless, non-interactive, deterministic exit codes) so a CI pipeline can adopt them unchanged later. Stack under test per PLAN.md §6: React 18 + TS strict + Vite, Dexie/IndexedDB, `ts-fsrs`, `vite-plugin-pwa`/Workbox, Vitest + Testing Library, Playwright.

Sibling docs: [01-technical-specification.md](./01-technical-specification.md) · [02-environment-and-tooling.md](./02-environment-and-tooling.md) · [04-design-assets.md](./04-design-assets.md) · [05-constraints-and-nfrs.md](./05-constraints-and-nfrs.md) · [06-examples-and-edge-cases.md](./06-examples-and-edge-cases.md) · [07-task-breakdown.md](./07-task-breakdown.md)

---

## 1. Testing philosophy & pyramid

**What must be proven** (these are the product's promises; a bug in any of them is ship-blocking):

| Property | Why it matters | Primary layer |
|---|---|---|
| Scheduling correctness | FSRS is the core value; wrong intervals silently waste the learner's time | Unit (ts-fsrs conformance) |
| Zero data loss | SRS state is irreplaceable; `reviewLogs` is append-only | Unit + E2E (offline reload) |
| Offline-first | Non-negotiable constraint #2; must work with no network after first load | E2E offline gate |
| Accessibility (WCAG 2.2 AA) | Non-negotiable; keyboard-only must complete a full session | Component + E2E + axe |
| Content completeness | "Every entry ships gender/plural/POS/gloss/case-marked example" — a bare mapping is a bug | Content validation (Phase 0 gate) |
| Grading fairness | Typo tolerance must never mark a correct answer wrong (or vice versa) | Unit, 100% coverage |

**What is not worth testing:**

- Pixel-perfectness / visual regression — zen UI is intentionally spare; no snapshot-of-DOM or screenshot-diff tooling (see §9).
- Implementation details (component internal state, Zustand store shape) — test behavior at the DOM/DB boundary.
- Third-party internals (`ts-fsrs`, Dexie, Workbox) — we test *our wiring* of them, never the libraries themselves.
- Performance/load — single user, 1,000 words ≈ 2,000 cards; trivial for IndexedDB (see §9).

**Pyramid:** many fast unit suites → focused component tests → a small set of high-value E2E flows. E2E count stays low (target ≤ 12 specs); anything provable lower in the pyramid must not be an E2E test.

**Coverage expectations** (measured with Vitest `--coverage`, v8 provider):

| Area | Target |
|---|---|
| Typo-tolerant grading | **100%** lines + branches |
| FSRS wrapper / scheduling boundary logic (rating mapping, due-selection, cap, interleave) | **100%** lines + branches |
| `words.json` import / re-import | **100%** lines + branches |
| Streak & reboot logic | ≥ 95% |
| All other `src/` (UI, glue) | ≥ 80% lines |
| Overall repo | ≥ 80% |

---

## 2. Unit tests (Vitest)

Location: `src/**/*.test.ts(x)`, colocated. Run in `jsdom` with fake IndexedDB (`fake-indexeddb`) for DB-touching suites; pure-logic suites need no DOM.

### 2.1 Typo-tolerant grading — `src/lib/grading.test.ts` (100% coverage)

Grading rules under test (PLAN.md §3): Levenshtein distance ≤ 1 accepted; umlaut fallbacks `ae→ä`, `oe→ö`, `ue→ü`, `ss→ß` accepted; correct form always displayed afterward; case and surrounding whitespace normalized; **article required for nouns** in production direction.

Required cases (parametrized via `it.each`):

| Input | Expected | Rationale |
|---|---|---|
| `"Hund"` vs `Hund` | correct | exact |
| `"hund"` vs `Hund` | correct | case-insensitive |
| `"  Hund "` | correct | whitespace trim |
| `"Hundt"` / `"Hun"` vs `Hund` | correct | Levenshtein ≤ 1 |
| `"Hunde"` vs `Hund` | wrong | distance/lemma mismatch beyond 1 (and plural ≠ lemma) |
| `"Mueller"` vs `Müller` | correct | `ue→ü` fallback |
| `"Strasse"` vs `Straße` | correct | `ss→ß` fallback |
| `"aepfel"` vs `Äpfel` | correct | fallback + case normalization compose |
| `"schon"` vs `schön` | **wrong** | umlaut omission without fallback spelling is an error (`schon` ≠ `schön`, both real words) |
| `"der Hund"` (article + noun, noun answer) | correct | article required for nouns |
| `"Hund"` (missing article, noun) | wrong-with-hint | article omitted → prompt "article?" once, then maps to Hard, never to Good/Easy |
| `"die Hund"` | wrong | wrong gender is an error; shown correct article |
| `"gehst"` vs `gehen` (production card asks lemma) | wrong | inflected form ≠ lemma unless card explicitly asks for it |
| Empty string / whitespace only | no-grade | treated as "no idea" → Again, no crash |

Example assertion shape:

```ts
expect(gradeProduction("Mueller", { lemma: "Müller", gender: "der" }).verdict).toBe("correct");
expect(gradeProduction("Hund",    { lemma: "Hund",  gender: "der" }).verdict).toBe("missing-article");
expect(gradeProduction("schon",   { lemma: "schön", gender: null }).verdict).toBe("wrong");
```

Also unit-test the **outcome→rating mapping** exactly as specified in PLAN.md §3 (never ask the user to self-rate):

| Interaction outcome | Rating |
|---|---|
| Wrong / no idea | `Again` |
| Right after hint, typo fixed, or very slow | `Hard` |
| Correct, normal pace | `Good` |
| Instant, confident correct | `Easy` |

Include the timing thresholds that separate "instant" / "normal" / "very slow" as named constants and test their boundaries (threshold −1ms / threshold / threshold +1ms).

### 2.2 FSRS wrapper — `src/lib/srs/*.test.ts` (100% coverage)

- **Rating mapping:** every grading outcome + interaction context maps to the correct `ts-fsrs` `Rating` enum value (table-driven, exhaustive over the PLAN.md §3 matrix).
- **State transitions:** `New → Learning → Review`, and `Review → Relearning` on lapse (`Again`). Assert `state`, `reps`, `lapses` fields after each transition on seeded cards.
- **Reference-output conformance:** for a fixed card history (fixed ratings at fixed timestamps), our wrapper's computed `due`, `stability`, `difficulty`, `scheduled_days` **equal the raw `ts-fsrs` output** for the same inputs. Golden-file style: store 5–10 canned histories with expected outputs. This is the Phase 1 exit criterion "scheduling matches FSRS reference outputs" — the suite is the proof.
- **Target retrievability 0.9:** wrapper passes `request_retention: 0.9` and default FSRS parameters unless/until PLAN.md changes.
- **Two independent cards per word:** rating the recognition card never mutates the production card's FSRS fields (and vice versa).
- **Boundary logic:** due selection at exact `due` timestamp (due = inclusive), card due "now" vs "1s from now", empty deck, all-cards-new deck.
- **Determinism:** identical DB state + identical fake clock ⇒ identical next-due scheduling (no wall-clock leakage).

### 2.3 Session composition — `src/lib/session.test.ts` (100% coverage for selection logic)

PLAN.md §3 rules under test:

- **Due-first:** all due reviews are scheduled before any new word.
- **Cap 60:** with 200 due cards, session contains ≤ 60 due cards, selected by **lowest predicted retrievability first** (assert ordering, not just count).
- **New-word blocks:** new words (default 10/day) drawn in **thematic blocks of 3–5** — assert each block shares a `theme` and 3 ≤ block size ≤ 5.
- **Interleaving:** new-word blocks are interleaved with remaining reviews, never one blocked batch — assert no maximal run of new cards exceeds 5.
- **Session target:** with target 5/10/15/20 min, composition stops at target and **ends cleanly — no filler cards** appended to pad time.
- **Interaction mix:** over a composed session, the type distribution approximates typed production ~50% / recognition ~25% / cloze ~15% / audio recall ~10% (assert on a large composed sample with a tolerance band, seeded RNG for determinism).
- **Configurability:** daily review cap and new-per-day are settings-driven; changing them changes composition without code changes.

### 2.4 Streak logic — `src/lib/streak.test.ts`

- **Definition:** a streak day = completing the daily **minutes goal**, explicitly **not** clearing the due queue. Test: queue non-empty after session, minutes goal met ⇒ streak increments; queue cleared but minutes goal unmet ⇒ no increment.
- **Freeze:** one freeze earned per 7 streak days (assert at 6 vs 7 days), **cap 3** (assert at 21+ days with none spent), auto-applied on a missed day with the calm note surfaced (assert state + message key, not copy text).
- **Repair:** after a miss, completing a 5-minute rebuild session restores the streak **once**; a second miss without an intervening streak day is not repairable.
- **Decoupling:** streak operations never write to `cards` scheduling fields.
- **Dismissible:** streaks hidden in Settings ⇒ no streak state changes are surfaced in UI state (logic may still record; UI must not).
- All tests run against a mocked clock (see §7).

### 2.5 Reboot logic — `src/lib/reboot.test.ts`

PLAN.md §5 rules under test:

- **Detection:** last session 3+ days ago ⇒ `lapsed`; 14+ ⇒ `dormant`. Boundary tests at 2d23h, exactly 3d, 13d23h, exactly 14d.
- **Backlog cap:** visible due queue capped at **50/day** regardless of overdue volume.
- **Staggering:** remainder re-distributed over following days ordered by FSRS predicted retrievability, **most-forgotten first**; assert per-day caps and ordering.
- **Diagnostic:** the 10-card diagnostic mixes previously mature cards (assert selection pulls from `state = Review` with high `stability`, not from new/learning cards).
- **No punitive reset:** a lapsed mature card enters `Relearning` with FSRS-standard interval penalty — assert it is never reset to `New` and `stability` never zeroed.
- **Comeback CTA:** day-one-back state exposes exactly one call to action (5-minute session) — assert on the derived view-model, not the component.

### 2.6 `words.json` import — `src/lib/import.test.ts` (100% coverage)

- **Idempotent re-import:** importing the same `dataVersion` twice leaves `words` identical (deep-equal row count and content).
- **SRS state untouched:** bump `dataVersion` with changed glosses/examples ⇒ `words` rows update; `cards`, `reviewLogs`, `sessions`, `settings` byte-identical before/after.
- **Stable IDs:** a word's `id` (slug) is the join key; renamed lemma with same `id` updates in place, never inserts a duplicate.
- **First-load seeding:** empty DB + `words.json` ⇒ exactly 1,000 `words` rows and 2,000 `cards` rows (recognition + production), all cards `state = New`.
- **Failure atomicity:** a malformed payload (schema violation) aborts the import with **zero partial writes** (assert table counts unchanged) and a surfaced error.
- **`reviewLogs` append-only:** no code path in the import (or anywhere) issues `update`/`delete` on `reviewLogs` — enforced by a wrapper-level test that rejects mutating calls.

---

## 3. Component tests (Testing Library)

Location: `src/**/*.test.tsx`. Philosophy: query by role/label, assert on user-visible behavior, never on component internals. Keyboard interactions via `user-event`.

| Suite | Must assert |
|---|---|
| **Card / keyboard map** (PLAN.md §4) | `Space` flips the card; `Enter` submits the typed answer; `1`–`4` rate when a self-rate step applies; `P` triggers pronounce. No other keys hijacked; input focus preserved (answer input auto-focused on card mount). |
| **Umlaut helper chips** | Chips `ä ö ü ß` render while the typing input is focused; activating a chip (click or keyboard) inserts the character at the caret; chips never steal focus from the input. |
| **Gender ribbon + article text** | For every noun card, **both** the 4px color ribbon (data attribute / class per gender) **and** the article as text (`der`/`die`/`das`) are present — color is never the sole carrier (AGENTS.MD constraint #6, enforced in test). Non-nouns render neither. |
| **Feedback state** | After submit: correct form shown (even when answer accepted via typo tolerance), gender color + article + plural visible, one-tap audio replay button present. Error uses muted terracotta token, success uses moss accent — never neon red (assert token, not hex literal in the component). |
| **Reduced motion** | With `matchMedia('(prefers-reduced-motion: reduce)')` mocked true, the 280ms card flip and all 120–250ms transitions collapse to an instant opacity crossfade (assert reduced-motion class/style branch; assert no animation-duration > 0 other than opacity fade). In-app toggle in Settings does the same independent of OS setting. |
| **Aria labels on icon buttons** | Pronounce button, chip buttons, any icon-only control exposes an accessible name (`getByRole('button', { name: … })` must resolve). |
| **Honest copy guard** | Progress dashboard copy renders coverage per register with the tilde values from PLAN.md §1 (~65% non-fiction, ~72% fiction, ~83% spoken); snapshot-test the copy keys, and a grep-style guard test asserts the string "fluency" never appears in user-facing copy modules. |

Each suite also runs `axe` on the rendered component (see §5).

---

## 4. E2E tests (Playwright)

Config: Chromium, WebKit, Firefox projects (TTS fallback must be verified on Chrome/Safari/Firefox per PLAN.md §8 Phase 2 exit); baseURL from `vite preview` or the Docker stack (§4.5). Keep specs ≤ 12; each is a real user flow.

### 4.1 THE OFFLINE GATE — `e2e/offline.spec.ts` — ship-blocker for Phase 3

Exactly the scenario from AGENTS.MD and PLAN.md §8:

1. Launch online; complete first-load seeding; wait for service worker `activated` and audio precache to report complete.
2. Start a session online; answer 2–3 cards.
3. **Kill network mid-session:** `await context.setOffline(true)`.
4. Complete the full session offline — every card type reachable, grading works, audio still plays for precached items, and for any not-yet-cached audio the app degrades gracefully (no error toast storm; pronunciation button either uses cached audio or is calmly disabled — Web Speech API is unavailable offline, so the fallback must be tested in both cached and uncached states).
5. End session; view summary.
6. **Reload the app while still offline:** app boots from precache, Home renders, **progress persisted** (assert words-learned count, retention ring value, and one specific card's new `due` in IndexedDB via `page.evaluate` on Dexie).
7. Re-enable network; confirm no state corruption or duplicate `reviewLogs` entries.

This spec must be **green before Phase 3 ships** (PLAN.md §8 exit criterion). A failure here is a release stopper, never a skip.

### 4.2 First-load seeding — `e2e/seeding.spec.ts`

Cold profile → app loads → 1,000 words / 2,000 cards present in IndexedDB → `dataVersion` recorded → second load performs no re-import (instrument via console marker or DB timestamp). Audio precache shows progress state and completes; live TTS used until then.

### 4.3 Install prompt flow — `e2e/install.spec.ts`

Manifest valid (name, icons incl. maskable, `display: standalone`); beforeinstallprompt handling surfaces the calm install affordance; installed-launch smoke check. Where Chromium can't fully emulate install, assert manifest + SW readiness and document the manual step.

### 4.4 Reboot flow E2E — `e2e/reboot.spec.ts`

Seed a profile with review history, then mock dates (`page.clock` or seeded `sessions`/`reviewLogs` timestamps):

- **3-day lapse:** welcome-back screen with encouraging copy; assert **no guilt copy** (banned-phrase guard, e.g. /you lost|streak died|catch up on \d+/i absent); due queue visible ≤ 50; comeback session is the only CTA.
- **14-day and 60-day lapses:** diagnostic (10 cards) offered; mature cards enter Relearning, never reset to zero; staggered backlog spreads over subsequent days (advance the mocked clock and assert per-day caps).

These three lapse points are the PLAN.md §8 Phase 3 exit criterion ("reboot flow tested at 3/14/60-day lapses").

### 4.5 Deploy smoke test — `e2e/deploy-smoke.spec.ts`

Against the **docker-compose stack** (owner decision 2026-09-15: multi-stage image, Vite build → nginx serving the static PWA):

```bash
docker compose up -d --build && npx playwright test e2e/deploy-smoke --config playwright.docker.config.ts
```

Assertions: nginx serves the app on the configured port; SW registers and precaches from the containerized origin; one card can be answered with the network then cut (`setOffline(true)`) and the answer persists after reload. Proves `docker compose up` is the *entire* deploy story. Tagged `@docker` so it runs on demand, not in the default E2E pass.

---

## 5. Accessibility tests

WCAG 2.2 AA is non-negotiable; accessibility is tested at three layers, not audited once at the end.

1. **axe-core in component tests:** `expect(await axe(container)).toHaveNoViolations()` in every component suite in §3 (via `jest-axe`-style Vitest matcher).
2. **axe-core in E2E:** full-page `AxeBuilder` scan on Home, Session (pre- and post-answer), Summary, Dashboard, Settings, Reboot screens; zero serious/critical violations.
3. **Dedicated interaction specs:**
   - **Keyboard-only full session** — `e2e/a11y-keyboard.spec.ts`: complete an entire session using only Tab / Space / Enter / 1–4 / P; assert visible focus ring (accent token) at every step; assert no focus traps, no keyboard-inaccessible control.
   - **Screen-reader announcements (spot checks):** on card reveal the polite live region announces the pattern from PLAN.md §4 — `"Hund, masculine, plural Hunde"` (assert live-region text for der/die/das, a no-plural noun, and a verb); feedback (correct/incorrect) is announced, not only colored.
   - **Contrast token test (automated):** a unit test imports the design tokens from PLAN.md §4 and computes WCAG contrast ratios — ink on paper, accent-text `#2E5E46` on paper, all three gender colors on paper, error terracotta on paper, all neutral steps used as text — each **≥ 4.5:1**. This fails at build time if a token drifts, rather than waiting for an audit.
   - **`prefers-reduced-motion` emulation:** Playwright `reducedMotion: 'reduce'` context — card flip and rings render as instant crossfades; no element animates for longer than the fade.

---

## 6. Content validation tests (Phase 0 gate)

Runner: Node script over `words.json`, wired as `npm run validate:content` — fast, no browser. **Zero violations = the Phase 0 ship gate** (PLAN.md §7). This is a test suite, not a one-off script: it runs in watch mode during curation and as a pre-commit check once content exists.

| Check | Rule |
|---|---|
| Schema validation | All 1,000 entries conform to the PLAN.md §2 schema (strict: no missing/extra fields, enums enforced for `pos`, `cefr`, `gender`) |
| Count & rank integrity | Exactly 1,000 entries; `freq_rank` unique and within 1–1000; `id` slugs unique and stable |
| Parse fidelity (deterministic md→json, no LLM) | Every one of the 1,000 source table rows parses into exactly one `words.json` entry — zero silent drops, zero duplicates; headword notation round-trips into correct §2 fields (`der Automat, -en` → gender/plural + n-declension `case_note`; `¨-er` umlaut plurals; principal parts; `trennb.`/`refl.` flags; Rektion → `case_note`); parsed output spot-diffed against source row text |
| Noun completeness | Every `pos: "noun"` has `gender ∈ {der,die,das}` **and** (`plural` non-empty **or** explicit no-plural marker — e.g. *Singulariatantum* like `das Obst`); *Pluraliatantum* (e.g. `die Eltern`) handled explicitly |
| Non-noun nulls | `gender`/`plural` are `null` for non-nouns (no stray values) |
| Example contains lemma | `example_de` contains the lemma **or an inflected form** (stem match + inflection table allowance, e.g. `fragen` → `frage` in *"Ich frage den Lehrer."*); examples must show case usage per schema intent |
| Example pairing | `example_en` present and non-empty for every entry |
| Separable verbs | Every verb with a separable prefix is flagged `separable: true` with `prefix` set; cross-check against the trennb. annotations in the curated list (e.g. `ankommen` → `prefix: "an"`); inseparable-prefix verbs (`be-, ver-, zer-…`) must not be flagged |
| Gloss sanity | `gloss_en` present, ≤ 3 senses |
| Audio presence | `audio_word` **and** `audio_example` files exist on disk for all 1,000 entries (path check + non-zero size + `.ogg` decode header) — "audio file present for every entry" is a §7 gate |
| A1 Goethe coverage | Coverage vs. the A1 checklist ≥ **98%**, with every exclusion recorded in a committed `content-exclusions.json` (reason required). Goethe data itself never enters the repo — the check runs against a local-only reference (see licensing rules) |
| Licensing guards | Repo scan: no Leipzig/SUBTLEX-DE/Goethe data files present; `source` provenance array populated per entry; attribution page content exists |
| Icon policy | `image_ref` set only for concrete nouns (heuristic list), target ~40% of deck; refs resolve to licensed OpenMoji assets |

The curated reference `top-1000-german-words.md` (legend: m./f./n., plural markers, n-declension, trennb./untrennb., hat/ist auxiliary, Rektion) is the ground truth for spot-fixtures: include entries like `der Automat, -en` (n-declension), `das Buch, ¨-er` (umlaut plural), a separable verb, and a Singulariatantum in the validator's own unit fixtures so the validator itself is tested.

---

## 7. Test data & fixtures

- **Fixture deck:** `tests/fixtures/deck.fixture.json` — **10–20 hand-checked words, never the full 1,000.** Composition must include: ≥1 noun per gender, one no-plural noun, one Pluraliatantum, one separable verb, one inseparable verb, one umlaut lemma, one ß lemma, one adjective, one preposition with a case note. Every fixture word is verified against `top-1000-german-words.md`.
- **Seeded FSRS states:** factory helpers `makeCard({ state: 'Review', stability: …, due: … })` producing valid `cards` rows (all PLAN.md §6 fields: `due, stability, difficulty, elapsed_days, scheduled_days, reps, lapses, state, last_review`) plus matching canned `reviewLogs` histories for the golden conformance tests in §2.2.
- **Seeded RNG:** session-composition tests inject a seeded PRNG so interleaving/mix assertions are deterministic.
- **Date mocking:** Vitest `vi.setSystemTime()` in unit suites (streak, reboot, scheduling boundaries); Playwright `page.clock` in E2E. All time-dependent code must read a clock abstraction — tests fail if `Date.now()` appears in `src/lib/` (lint-style guard test). Timezone pinned to `Europe/Berlin` for streak-day boundary tests, plus one run at a DST transition date.
- **DB isolation:** every DB-touching test gets a fresh `fake-indexeddb` instance; E2E specs seed IndexedDB through a test-only helper route/module, never by replaying UI at scale.

---

## 8. Conventions & commands

**Naming & location:**

- Unit: `src/<area>/<module>.test.ts` colocated with source.
- Component: `src/components/<Name>.test.tsx`.
- E2E: `e2e/<flow>.spec.ts`; content validation: `content/validate.test.mjs` + fixtures under `tests/fixtures/`.
- Test names state behavior and expectation: `it('accepts "Mueller" for Müller via ue-fallback')`, not `it('works')`.

**Commands** (defined in `package.json` once scaffolded in Phase 1 per PLAN.md §6; keep these names stable):

| Command | Runs |
|---|---|
| `npm run test` | Vitest, headless, full unit + component pass with coverage |
| `npm run test:watch` | Vitest watch mode for TDD |
| `npm run test -- grading` | Single suite by path/name fragment (e.g. all grading tests) |
| `npm run test -- -t "ue-fallback"` | Single test by name |
| `npm run test:e2e` | Playwright headless, all projects |
| `npm run test:e2e -- --grep @docker` | Deploy smoke against docker-compose stack only |
| `npm run validate:content` | Phase 0 content gates (§6); exit 1 on any violation |

**Definition of done per phase** (maps to PLAN.md §8 exit criteria — the listed suites must be green for the phase to be complete):

| Phase | Required green |
|---|---|
| **0 — Content pipeline** | `validate:content` zero violations: schema, noun completeness, examples, separable flags, audio presence, A1 coverage ≥ 98% with documented exclusions, licensing guards |
| **1 — MVP** | All unit suites (§2) — incl. FSRS reference-output conformance (the "matches FSRS reference outputs" exit criterion) and 100% coverage on grading/scheduling/import; 0 data-loss bugs open; component suites for card/feedback |
| **2 — Polish** | All component suites (§3) incl. reduced-motion and gender-ribbon tests; axe clean at both layers; contrast token test green; TTS fallback verified on Chrome/Safari/Firefox E2E projects; WCAG 2.2 AA audit passes |
| **3 — Offline & reboot** | **Offline gate green (§4.1) — hard blocker**; reboot E2E green at 3/14/60-day lapses (§4.4); seeding + install specs green; deploy smoke green against the docker-compose stack |
| **4 — Stretch** | Scoped separately per PLAN.md; any new feature ships with unit + one E2E minimum |

A phase exit with a skipped (`test.skip`) or quarantined test in a required suite is not an exit.

---

## 9. Explicit non-goals

- **No load/performance testing.** Single user; 1,000 words ≈ 2,000 cards and a few thousand `reviewLogs` rows is trivial for IndexedDB. If a frame-budget check is ever wanted, add one Lighthouse pass — never a load suite.
- **No cross-device sync tests in MVP.** No backend exists (PLAN.md §6); the sync-ready schema (append-only logs, stable IDs) is verified only by the §2.6 import/log-mutation guards. Sync testing begins with the V2 accounts work.
- **No visual regression tooling.** No screenshot-diff/Percy-style snapshots; zen design correctness is enforced by token tests, component assertions, and the §5 contrast test — not pixels.
- **No multiple-choice UI tests** — multiple choice does not exist in the core loop; a test asserting its *absence* lives in §3, and none may ever be written for it.
- **No testing of third-party library internals** (`ts-fsrs` math, Workbox strategies, Dexie query engine) — conformance and wiring only (§2.2, §4.1).
- **No CI infrastructure build-out.** Commands are CI-ready by design (headless, deterministic, exit-coded), but provisioning a CI budget/pipeline is out of scope for this document.
