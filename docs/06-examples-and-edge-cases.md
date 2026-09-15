# 06 — Examples & Edge Cases

Derived from and subordinate to PLAN.md — on conflict, PLAN.md wins. Status date: 2026-09-15.

Every German example below is quoted verbatim from `top-1000-german-words.md` (cited as `#<rank>`). Schema per PLAN.md §2, grading per §3, streaks/reboot per §5, import per §6. Technical details live in [01-technical-specification.md](./01-technical-specification.md); test suites in [03-testing-strategy.md](./03-testing-strategy.md); non-functional requirements in [05-constraints-and-nfrs.md](./05-constraints-and-nfrs.md).

**Conventions used below**

- **Slugs:** lowercase; `ä→ae, ö→oe, ü→ue, ß→ss`; spaces/hyphens → `-`; punctuation stripped. Examples: `können` → `koennen`, `sich freuen auf` → `sich-freuen-auf`, `Auf Wiedersehen!` → `auf-wiedersehen`.
- **Theme slugs** (proposed; final ~30-unit taxonomy is a Phase 0 deliverable): `Alltag & Begrüßung → essentials`, `Familie & Soziales → people-family`, `Essen & Trinken → food`, `Freizeit & Sport → leisure`, `Reisen & Verkehr → travel`, `Wohnen & Haushalt → home`, time vocabulary → `time`.
- **freq_rank** mirrors the source list position; the final merged-spine ordering is computed in Phase 0 (PLAN.md §2).
- **Card ids:** `<slug>.rec` (recognition, DE→EN) and `<slug>.prod` (production, EN→DE), scheduled independently (PLAN.md §3).
- Items marked **[Amendment A n]** propose a PLAN.md clarification and need owner sign-off (AGENTS.MD conflict rule) before implementation; see §8.3.

---

## 1. Worked `words.json` entries

Eight complete entries in the PLAN.md §2 schema, each exercising a different corner of the source list.

### 1a. Regular noun, umlaut plural — `das Buch, ¨-er` (#8, A1, Freizeit & Sport)

```json
{
  "id": "buch",
  "lemma": "Buch",
  "gender": "das",
  "plural": "Bücher",
  "pos": "noun",
  "gloss_en": "book",
  "example_de": "Ich lese ein Buch.",
  "example_en": "I am reading a book.",
  "case_note": "Pl. ¨-er (Umlaut): Buch → Bücher",
  "separable": false,
  "prefix": null,
  "audio_word": "audio/buch.ogg",
  "audio_example": "audio/buch.example.ogg",
  "image_ref": "openmoji:1F4D6",
  "theme": "leisure",
  "cefr": "A1",
  "freq_rank": 8,
  "source": ["frequencywords-de", "top1000-annotated"]
}
```

### 1b. n-declension noun — `der Automat, -en` (#5, A1, Reisen & Verkehr)

```json
{
  "id": "automat",
  "lemma": "Automat",
  "gender": "der",
  "plural": "Automaten",
  "pos": "noun",
  "gloss_en": "machine, vending machine",
  "example_de": "Der Automat nimmt keine Zehn-Euro-Scheine an.",
  "example_en": "The machine doesn't accept ten-euro notes.",
  "case_note": "n-Deklination: Akk./Dat./Gen. Sg. → den/dem/des Automaten",
  "separable": false,
  "prefix": null,
  "audio_word": "audio/automat.ogg",
  "audio_example": "audio/automat.example.ogg",
  "image_ref": null,
  "theme": "travel",
  "cefr": "A1",
  "freq_rank": 5,
  "source": ["frequencywords-de", "top1000-annotated"]
}
```

Same pattern: `der Bankautomat, -en` (#6). Cloze cards may surface the inflected form (`den Automaten`); the production target stays the nominative lemma + article.

### 1c. Singulariatantum (no plural) — `der Durst` (#169, A1, Essen & Trinken)

```json
{
  "id": "durst",
  "lemma": "Durst",
  "gender": "der",
  "plural": null,
  "pos": "noun",
  "gloss_en": "thirst",
  "example_de": "Ich habe großen Durst.",
  "example_en": "I am very thirsty.",
  "case_note": "Singulariatantum — kein Plural",
  "separable": false,
  "prefix": null,
  "audio_word": "audio/durst.ogg",
  "audio_example": "audio/durst.example.ogg",
  "image_ref": null,
  "theme": "food",
  "cefr": "A1",
  "freq_rank": 169,
  "source": ["frequencywords-de", "top1000-annotated"]
}
```

`plural: null` is explicit no-plural (AGENTS.MD content completeness), not missing data. Word detail renders "no plural form". Same pattern: `das Obst` (#199), `der Hunger` (#182), `die Butter` (#168).

### 1d. Pluraliatantum — `die Eltern` (#77, A1, Familie & Soziales) **[Amendment A1]**

```json
{
  "id": "eltern",
  "lemma": "Eltern",
  "gender": null,
  "plural": "Eltern",
  "pos": "noun",
  "gloss_en": "parents",
  "example_de": "Meine Eltern sind zu Hause.",
  "example_en": "My parents are at home.",
  "case_note": "Pluraliatantum — nur Plural; Artikel: die",
  "separable": false,
  "prefix": null,
  "audio_word": "audio/eltern.ogg",
  "audio_example": "audio/eltern.example.ogg",
  "image_ref": null,
  "theme": "people-family",
  "cefr": "A1",
  "freq_rank": 77,
  "source": ["frequencywords-de", "top1000-annotated"]
}
```

No singular exists, so no grammatical gender: `gender: null`, no gender ribbon (PLAN.md §2 allows `null` today only for non-nouns — hence A1). The production card still requires the plural article: target answer is `die Eltern`. Same pattern: `die Geschwister` (#87), `die Großeltern` (#88), `Kopfschmerzen` (#326, see §8).

### 1e. Separable verb — `aufstehen, stand auf, bin aufgestanden` (#225, A2, Familie & Soziales)

```json
{
  "id": "aufstehen",
  "lemma": "aufstehen",
  "gender": null,
  "plural": null,
  "pos": "verb",
  "gloss_en": "to get up, to stand up",
  "example_de": "Ich stehe jeden Morgen um sechs Uhr auf.",
  "example_en": "I get up at six o'clock every morning.",
  "case_note": "unreg.: stand auf, ist aufgestanden; trennb.",
  "separable": true,
  "prefix": "auf",
  "audio_word": "audio/aufstehen.ogg",
  "audio_example": "audio/aufstehen.example.ogg",
  "image_ref": null,
  "theme": "people-family",
  "cefr": "A2",
  "freq_rank": 225,
  "source": ["frequencywords-de", "top1000-annotated"]
}
```

`separable: true` + `prefix` drive the micro-tip ("prefix detaches to clause end: *Ich stehe … auf*"). Note `Hilfsverb: ist` — motion/change-of-state verbs take *sein*; the case_note carries the full principal parts.

### 1f. Reflexive + separable verb — `sich ausruhen, ruhte mich aus, habe mich ausgeruht` (#606, B1, Alltag & Begrüßung) **[Amendment A4]**

```json
{
  "id": "sich-ausruhen",
  "lemma": "sich ausruhen",
  "gender": null,
  "plural": null,
  "pos": "verb",
  "gloss_en": "to rest, to relax",
  "example_de": "Ich muss mich nach der Wanderung ausruhen.",
  "example_en": "I have to rest after the hike.",
  "case_note": "refl., trennb.: ruhte sich aus, hat sich ausgeruht",
  "separable": true,
  "prefix": "aus",
  "audio_word": "audio/sich-ausruhen.ogg",
  "audio_example": "audio/sich-ausruhen.example.ogg",
  "image_ref": null,
  "theme": "essentials",
  "cefr": "B1",
  "freq_rank": 606,
  "source": ["frequencywords-de", "top1000-annotated"]
}
```

§2 has no `reflexive` flag; reflexivity is encoded in the lemma (`sich …`) and `case_note` (A4 — no schema change). The production target is the full lemma `sich ausruhen`. Same pattern: `sich erholen` (#608), `sich freuen auf` (#867, see §8).

### 1g. Preposition with case government — `aus` (#4, A1, Alltag & Begrüßung)

```json
{
  "id": "aus",
  "lemma": "aus",
  "gender": null,
  "plural": null,
  "pos": "prep",
  "gloss_en": "from, out of",
  "example_de": "Ich komme aus der Schweiz.",
  "example_en": "I come from Switzerland.",
  "case_note": "+ Dat. (Herkunft / Material)",
  "separable": false,
  "prefix": null,
  "audio_word": "audio/aus.ogg",
  "audio_example": "audio/aus.example.ogg",
  "image_ref": null,
  "theme": "essentials",
  "cefr": "A1",
  "freq_rank": 4,
  "source": ["frequencywords-de", "top1000-annotated"]
}
```

For a Wechselpräposition the case_note carries both cases, e.g. `in` (#642): `"Wechselpräp.: Wo? + Dat. / Wohin? + Akk."` with example *"Wir leben in einer kleinen Stadt."* Prepositions get both card types; production prompts include a hint noun so the case government is exercised, e.g. "from (___ Schweiz)".

### 1h. Modal verb — `können, konnte, habe gekonnt` (#241, A1, Alltag & Begrüßung)

```json
{
  "id": "koennen",
  "lemma": "können",
  "gender": null,
  "plural": null,
  "pos": "verb",
  "gloss_en": "can, to be able to",
  "example_de": "Ich kann Deutsch sprechen.",
  "example_en": "I can speak German.",
  "case_note": "Modalverb: konnte, hat gekonnt",
  "separable": false,
  "prefix": null,
  "audio_word": "audio/koennen.ogg",
  "audio_example": "audio/koennen.example.ogg",
  "image_ref": null,
  "theme": "essentials",
  "cefr": "A1",
  "freq_rank": 241,
  "source": ["frequencywords-de", "top1000-annotated"]
}
```

Modal verbs are `pos: "verb"` (the enum has no `modal`); the class lives in `case_note`. Same pattern: `mögen` (#194), `müssen` (#248), `wollen` (#265), `dürfen` (#579), `sollen` (#613).

---

## 2. Grading worked examples (typed production, EN→DE)

**Comparison pipeline** (precise reading of PLAN.md §3): trim → collapse internal whitespace → case-fold → exact match → Levenshtein ≤ 1 → umlaut fallback equivalence (`ae↔ä, oe↔ö, ue↔ü, ss↔ß`). Fallback and case are accepted as correct; the correct form is **always shown** in feedback. Nouns require article + lemma. Pace thresholds **[Amendment A6]**: *instant* < 2.5 s → `Easy`; *very slow* > 20 s → `Hard`; between → `Good`. Rating mapping per PLAN.md §3: wrong/no idea → `Again`; hint/typo-fixed/very slow → `Hard`; correct → `Good`; instant confident → `Easy`.

Target card `buch.prod` (prompt: "book"), expected `das Buch`, unless noted:

| # | User input | Latency | Verdict | FSRS rating | Feedback shown |
|---|---|---|---|---|---|
| 1 | `das Buch` | 4.1 s | correct | **Good** | "das Buch" + audio replay |
| 2 | `das Bich` | 3.8 s | typo, Levenshtein 1 | **Hard** | "Almost — das Buch" (diff highlighted) |
| 3 | `Buch` | 3.0 s | article missing → wrong | **Again** | "Article, please — always der/die/das: **das** Buch" |
| 4 | `die Buch` | 3.2 s | wrong article → wrong | **Again** | "das Buch — neuter" (article text + sand ribbon, never color alone) |
| 5 | `DAS BUCH` | 4.0 s | correct (case-folded) | **Good** | Correct casing shown: "das Buch" |
| 6 | `  das   Buch ` | 4.4 s | correct (trimmed/collapsed) | **Good** | "das Buch" |
| 7 | *(empty)* | — | treated as "no idea" | **Again** | One confirm guard ("No idea? Enter again to reveal"), then reveal |
| 8 | `das Buch` | 24.3 s | correct, very slow | **Hard** | "das Buch" |
| 9 | `das Buch` | 1.9 s | correct, instant | **Easy** | "das Buch" |
| 10 | `Bucher` — cloze on #189 *lesen*: "Ich lese gern interessante ___." (target `Bücher`) | 5.0 s | ue→ü fallback, accepted | **Good** | "Bücher" (proper umlaut always shown) |
| 11 | `fuer` — card `fuer.prod`… expected `für` (#283) | 3.1 s | ue→ü fallback, accepted | **Good** | "für" |
| 12 | `die Strasse` — card `strasse.prod`, expected `die Straße` (#302) | 4.6 s | ss→ß fallback, accepted | **Good** | "die Straße" |
| 13 | `gross` — card `gross.prod`, expected `groß` (#996) | 3.5 s | ss→ß fallback, accepted | **Good** | "groß" |

Rules worth stating once: fallback acceptance never produces `Again`; repeated fallback reliance is a word-detail statistic, not a grading penalty (MVP). Wrong article is a full error — gender is core content (AGENTS.MD), so rows 3–4 map to `Again` with distinct corrective feedback.

---

## 3. Session composition walk-through

### 3a. Normal day (learner on day 17, target 10 min, settings: 60 review cap / 10 new per day)

Backlog: **47 due** (under cap), ordered by ascending FSRS predicted retrievability. Next frequency-eligible new words form three thematic blocks (3–5 each, PLAN.md §3):

- **Block A (4, food):** die Butter (#168) · der Durst (#169) · das Fleisch (#175) · der Hunger (#182)
- **Block B (3, food):** das Obst (#199) · die Pasta (#200) · die Suppe (#207)
- **Block C (3, time):** die Stunde (#206) · die Uhrzeit (#212) · um (#213)

Exact interleaved order (R = due review):

```
R1–R8 → [Block A: Butter, Durst, Fleisch, Hunger]
→ R9–R21 → [Block B: Obst, Pasta, Suppe]
→ R22–R34 → [Block C: Stunde, Uhrzeit, um]
→ R35–R47
```

57 cards ≈ 9 min at ~9 s/card — fits the 10-min target; the session ends cleanly at target even if cards remain (leftover due cards stay due tomorrow, no penalty, PLAN.md §3). New words are never presented as one blocked batch.

### 3b. Heavy day (after a busy weekend)

**180 due** → serve the 60 with the lowest predicted retrievability; the remaining 120 are redistributed by FSRS over the following days:

| Day | Natural due | Redistributed | Served (cap 60) |
|---|---|---|---|
| Today | 180 | — | 60 |
| +1 | 22 | +20 | 42 |
| +2 | 18 | +20 | 38 |
| +3 … +6 | ~20/day | +20/day | ~40/day |

New-word intake continues at 10/day (learner-configurable down to 0); the backlog never blocks it and never exceeds the cap silently.

---

## 4. Reboot scenario — 21-day timeline

Learner: 19-day streak, 1 freeze banked, 412 cards will fall due during the absence. Daily goal 10 min.

| Date | Day | State | What happens |
|---|---|---|---|
| Tue Sep 1 | 0 | active | Last session completed (streak 19) |
| Sep 2 | 1 | — | Freeze auto-applies: "Rest day — your streak is safe." (0 left) |
| Sep 3 | 2 | — | No freeze left → streak ends quietly. No loss copy, no email |
| Sep 4 | 3 | **lapsed** | Detection threshold (3+ days, PLAN.md §5) |
| Sep 15 | 14 | **dormant** | Second threshold (14+). Nothing user-visible changes while away |
| Wed Sep 16 | 15 | return | Welcome screen: *"Welcome back. There's nothing to catch up on — we've picked out what matters."* Banned: "You lost your 19-day streak!" |
| | | | Overdue: **412**. Visible queue capped at **50/day**; the other 362 are re-staggered across days +1…+7 (~52/day) by predicted retrievability, most-forgotten first |
| | | | **10-card diagnostic**: 6 previously mature cards (interval ≥ 21 d, e.g. `buch.prod`, `aus.prod`) + 4 young cards → re-estimates memory state |
| | | | Lapsed mature example: `buch.prod` (stability 34 d, was due Sep 3), rated Good on return → state Review → **Relearning** with FSRS-standard interval penalty; never reset to New/zero |
| | | | Only CTA: a **5-minute comeback session**. Streak restarts at 1 with zero-shame copy ("Day 1 — nice to see you"); repair mechanic is not offered after dormancy (it repairs a single miss, §5) |
| Sep 17–21 | 16–20 | recovering | 50 capped backlog + natural due per day; intake of new words stays paused until day 17's queue ≤ cap (default; configurable) |
| Mon Sep 21 | 20 | stable | Backlog drained; queue = natural daily load (~35). New words resume Sep 22 |

---

## 5. Streak mechanics — worked week

Rules (PLAN.md §5): a streak day = meeting the **minutes goal** (10 min), *not* clearing the due queue. Freeze: 1 earned per 7 streak days, cap 3, auto-applied. Repair: one 5-minute rebuild session restores the streak, once per lapse.

Learner enters the week at streak 6, 0 freezes:

| Day | Minutes | Due cleared | Streak event | Streak | Freezes |
|---|---|---|---|---|---|
| Mon | 12 | 41/41 | goal met → 7-day mark: **freeze earned** | 7 | 1 |
| Tue | 10 | 38/44 | goal met (queue unfinished — irrelevant to streak) | 8 | 1 |
| Wed | 11 | 40/40 | goal met | 9 | 1 |
| Thu | 0 | 0 | **freeze auto-applied**: "Rest day — your streak is safe." | 9 | 0 |
| Fri | 14 | 38/52 | goal met | 10 | 0 |
| Sat | 0 | 0 | no freeze → streak paused; repair offered once: "One quiet 5-minute session rebuilds your streak." | — | 0 |
| Sun | 5 (rebuild) | 12 | **repair** → streak restored | 11 | 0 |

Had Sun also been missed, the streak would end without shame copy; the next goal-met day simply starts a new one. All streak UI is optional/hideable in Settings (AGENTS.MD no-dark-patterns rule).

---

## 6. Data & import edge cases

| Scenario | Expected behavior |
|---|---|
| First-load seeding | Bundled `words.json` (~400 KB) → Dexie: 1,000 `words` rows, 2,000 `cards` rows (state New, one `.rec` + one `.prod` per word), default `settings`, `dataVersion` recorded. Atomic transaction; partial import never persisted |
| `dataVersion` bump (1 → 2) | Idempotent upsert keyed by `id`: changed fields overwrite, unchanged rows untouched, re-running import is a no-op. **`cards`, `reviewLogs`, `sessions`, `settings` are never touched** (PLAN.md §6) |
| Word removed in v2 (e.g. `pasta` #200 dropped) | Keep SRS state, archive **[Amendment A5]**: word row retained with `archived: true`; existing cards stay due-eligible (learner effort is never destroyed); no new cards are generated for it; it still counts in dashboard coverage |
| Duplicate slug after slugification | Build-time guard fails the content pipeline. Real collision risks: `ärgern` (#887) → `aergern` vs a hypothetical `argern`; `sich freuen auf` (#867) vs `sich freuen über` (#868) both stem from `sich freuen` — distinct ids `sich-freuen-auf` / `sich-freuen-ueber` |
| Schema-invalid entry (noun without gender/plural) | Phase 0 validation gate rejects the whole import; the app never ships a partial schema violation (AGENTS.MD content completeness; PLAN.md §7 quality gates) |

---

## 7. Platform & runtime edge cases

| # | Scenario | Expected behavior |
|---|---|---|
| 1 | First-ever load attempted offline | The bundle itself can't be fetched → calm blocking state: "First run needs a connection once — after that, everything works offline." + retry. Never an error wall (NFR: [05](./05-constraints-and-nfrs.md)) |
| 2 | Network killed mid-session | Session continues 100%: grading, FSRS scheduling, and DB writes are fully local. **The Phase 3 Playwright offline E2E gate** (PLAN.md §8; suite in [03](./03-testing-strategy.md)) |
| 3 | Bundled audio file missing (e.g. `audio/pasta.ogg`) | Web Speech API `speechSynthesis` with de-DE voice as live fallback (PLAN.md §6); pronunciation button behavior unchanged |
| 4 | No de-DE voice **and** audio not yet precached | Chunked precache shows progress on Home ("Audio 340 / 2,000 — you can keep learning"); sessions never block on audio; button hidden with aria-label until a voice exists |
| 5 | IndexedDB quota exceeded | Priority: app shell > `words.json` > SRS tables > audio. Audio precache pauses/degrades to on-demand fallback; **SRS writes are never sacrificed**; calm notice + pointer to Settings → data export |
| 6 | System clock changed (back/forward) | Due comparisons use absolute UTC instants; FSRS `elapsed_days` clamped ≥ 0; a clock jump never mass-fails or mass-resets cards |
| 7 | Timezone travel (Berlin → New York) across a due boundary | Due instants stored UTC; "day" boundaries computed in device-local time at answer time; no lost or double-counted streak day |
| 8 | Answering at 23:59 vs 00:01 | Each answer is attributed to the device-local day of its submission timestamp; minutes accrue to that day; a session spanning midnight splits naturally — 23:59 counts for today, 00:01 for tomorrow |
| 9 | Umlaut input on a US keyboard | Live helper chips `ä ö ü ß` insert at cursor (PLAN.md §4 signature interaction, keyboard-accessible); grading fallback (§2) means `fuer`/`gross` are never punished |
| 10 | Screen reader reveal | aria-live announcement on card reveal: **"Buch, neuter, plural Bücher"** (pattern per PLAN.md §4: "Hund, masculine, plural Hunde"); for no-plural nouns: "Durst, masculine, no plural form" |

---

## 8. Content edge cases discovered in the source list

### 8.1 Mapping table

| Source entry | Issue | Mapping to the two-card model |
|---|---|---|
| `buchstabieren, buchstabierte, habe buchstabiert` (#10) | Headword carries 3 principal parts | `lemma: "buchstabieren"`; principal parts → `case_note`; cards target the infinitive only. Same: `lesen` (#189), `können` (#241), `ankommen` (#527, additionally `separable: true, prefix: "an"`, Rektion `in/an + Dat.`) |
| `Auf Wiedersehen!` (#3) | Grußformel — `pos` enum has no "phrase" | **[Amendment A3]:** `pos: "part"`; production graded punctuation-insensitively (`auf wiedersehen` accepted); both cards kept |
| `Erhol dich!` (#580), `Ruh dich aus!` (#601) | Imperative fixed phrases duplicating reflexive verbs (#608, #606) | Kept as distinct phrase entries (fixed expressions are real vocabulary); A3 grading applies |
| `Durst haben` (#170) | Verbverbindung duplicating `der Durst` (#169) | Kept as separate phrase entry; its recognition card reinforces, not duplicates, #169 |
| `Deutschland` (#13) | Proper noun, "n., ohne Artikel" | **[Amendment A2]:** `gender: null`, production requires no article, `case_note: "Eigenname — ohne Artikel (Dat.: in Deutschland)"` |
| `die Niederlande` (#126) | Plural-only proper noun | Pluraliatantum policy (§1d): production target `die Niederlande` |
| `Kopfschmerzen (Pl.)` (#326), `Schmerzen (Pl.)` (#336), `Halsschmerzen (Pl.)` (#586) | "(Pl.)" marker inside headword | Marker stripped at import → `lemma: "Kopfschmerzen"`; Pluraliatantum policy (§1d) |
| `sich freuen auf` (#867) / `sich freuen über` (#868) | Two entries sharing one stem, different Rektion | Two words, distinct ids (`sich-freuen-auf`, `sich-freuen-ueber`); Rektion in `case_note`: "auf + Akk. (Zukunft) / über + Akk."; each gets its own card pair |
| `am` (#1) | Contraction of `an + dem`; Wechselpräp. fused form | Standalone prep entry; `case_note: "an + dem; + Dat. bei Zeit/Ort"` |
| `von ... bis` (#214) | Two-part preposition | `lemma: "von ... bis"` kept verbatim; production prompt supplies the frame, answer accepts the pair |
| `dafür sein` (#471) | Verbphrase, multiword | `lemma: "dafür sein"`, `pos: "verb"`, `case_note` carries "sein, war, ist gewesen" |
| `deutsch` (#12, Adjektiv) vs `Deutsch` (language noun) | Capitalization is semantic in German | Grading stays case-insensitive (§2), but correct casing is always shown; nouns are always displayed capitalized |

### 8.2 Non-noun `gender: null`

Per PLAN.md §2, all non-nouns (`aus` #4, `können` #241, `groß` #996, `deshalb` #700, connectors like `weil` #157 / `denn` #275) carry `gender: null, plural: null, separable: false` (verbs set their own flags) and `image_ref: null`. Images are for concrete nouns only (~40% of deck, PLAN.md §7).

### 8.3 Proposed PLAN.md amendments (owner sign-off required before implementation)

| # | Amendment |
|---|---|
| A1 | §2: Pluraliatantum nouns use `gender: null` + `plural` set; production expects `die <plural>` (today §2 limits `null` to non-nouns) |
| A2 | §2: article-less proper nouns (e.g. `Deutschland`) use `gender: null` |
| A3 | §2/§3: fixed phrases map to `pos: "part"`; production grading ignores trailing punctuation and the `!`/`?` of fixed expressions |
| A4 | §2: reflexivity is encoded in `lemma` ("sich …") + `case_note`; no new schema field |
| A5 | §2/§6: additive `archived: boolean` on `words` for the removed-word policy (§6) |
| A6 | §3: default pace thresholds — instant < 2.5 s, very slow > 20 s — tunable, owned by [01-technical-specification.md](./01-technical-specification.md) |

---

## 9. Edge case → test mapping

Suite names are proposals for [03-testing-strategy.md](./03-testing-strategy.md) to adopt; Phase 0/1 tasks in [07-task-breakdown.md](./07-task-breakdown.md).

| Edge case (this doc) | Suite | Type |
|---|---|---|
| §2 grading rows 1–13 (typo, article, case, whitespace, empty, pace, fallbacks) | `grading.spec.ts` | Vitest unit |
| §2 umlaut fallback + §7.9 chips | `grading.spec.ts`, `umlaut-chips.test.tsx` | unit + component |
| §3a interleaving (blocks of 3–5 among reviews) | `session-composer.spec.ts` | unit |
| §3b 60-cap + redistribution | `session-composer.spec.ts` (seeded FSRS fixtures) | unit |
| §4 reboot at 3/14/60-day lapses, 50/day cap, diagnostic, relearning penalty | `reboot.e2e.ts` | Playwright (PLAN.md §8 exit gate) |
| §5 freeze earn/auto-apply/cap, repair-once, minutes-not-queue rule, §7.8 day boundary | `streaks.spec.ts` (mocked clock) | unit |
| §6 seeding, idempotent re-import, removal/archive, slug guard, schema gate | `import.spec.ts` + build-time validator test | unit |
| §7.1 first-load-offline, §7.2 mid-session network kill | `offline.e2e.ts` | Playwright (Phase 3 gate) |
| §7.3/7.4 audio fallback + precache progress | `audio-fallback.e2e.ts` | Playwright |
| §7.5 quota exceeded | `quota.e2e.ts` (mocked storage) | Playwright |
| §7.6/7.7 clock & timezone travel | `clock.spec.ts` (fake timers, TZ env) | unit |
| §7.10 reveal announcements, gender never color-only (§2 row 4) | `a11y.spec.ts` (Testing Library + axe) | component/a11y |
