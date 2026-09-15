# Attribution & Licensing

Wortgarten is free and non-commercial.

## Data

| Source | License | Use in Wortgarten |
|---|---|---|
| top-1000-german-words.md (onewholearns.com-derived, DaF/DaZ-annotated) | Strictly personal use only | Primary knowledge source — parsed deterministically into `words.json`. Never distributed or published. |
| hermitdave/FrequencyWords (de) | Data: CC BY-SA 4.0; Code: MIT | License-clean fallback spine (not currently in use). If used, the derived word list stays CC BY-SA with attribution below. |

**hermitdave/FrequencyWords attribution (if fallback spine is used):**

> Word frequency data derived from [hermitdave/FrequencyWords](https://github.com/hermitdave/FrequencyWords), licensed under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).

## Audio

All audio in Wortgarten is self-generated using [Piper TTS](https://github.com/rhasspy/piper), licensed under the [MIT License](https://github.com/rhasspy/piper/blob/master/LICENSE). No scraped or ripped audio is used.

Voice model: `de_DE-thorsten-medium` from [rhasspy/piper-voices](https://huggingface.co/rhasspy/piper-voices), licensed under [MIT](https://huggingface.co/rhasspy/piper-voices).

## Fonts

- **Source Serif 4** — [SIL Open Font License](https://scripts.sil.org/OFL)
- **Inter** — [SIL Open Font License](https://scripts.sil.org/OFL)

## Icons

- **OpenMoji** — [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) (if icons are shipped in a future version)

## Software

| Package | License |
|---|---|
| React | MIT |
| Vite | MIT |
| Dexie.js | Apache-2.0 |
| ts-fsrs | MIT |
| Zustand | MIT |
| React Router | MIT |
| vite-plugin-pwa | MIT |

## Non-redistributable content (curation QA only, never shipped)

- Leipzig Corpora Collection (CC BY-NC) — used for frequency ranking QA only
- SUBTLEX-DE (research/non-commercial) — used for spoken-register coverage check only
- Goethe-Institut A1/A2 Wortlisten (© Goethe-Institut) — used as coverage checklist only

None of the above content is included in any shipped artifact.

## Content completeness

Every vocabulary entry ships with: grammatical gender, plural (or explicit no-plural), part of speech, English gloss, and at least one case-marked example sentence. A bare word-to-word mapping is considered a bug.

## Honest claims

Wortgarten does not claim to teach "fluency." Coverage is stated per register:

- ~65% of non-fiction texts
- ~72% of fiction texts
- ~83% of spoken German

These 1,000 words represent the highest-utility core vocabulary for English-speaking learners reaching approximately B1 level.
