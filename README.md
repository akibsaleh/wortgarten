# Wortgarten

A zen-style, offline-first PWA that teaches the **1,000 most frequent, highest-utility German words** to English-speaking learners via spaced repetition (FSRS).

## Quick start

```bash
# Prerequisites: Node.js ≥ 22, npm ≥ 10
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

### Other commands

| Command | What it does |
|---|---|
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Type-check + production build |
| `npm run preview` | Serve the production build locally |
| `npm test` | Run unit tests (Vitest) |
| `npm run test:e2e:offline` | Run offline E2E tests (Playwright) |
| `npm run validate:content` | Validate `words.json` schema |
| `npm run parse:content` | Regenerate `words.json` from the word list |
| `npm run lint` | Lint `src/` with ESLint |
| `npm run format` | Format `src/` with Prettier |

### Docker

```bash
docker compose up -d --build
# App runs on http://localhost:3080
docker compose down
```

## Features

**Core learning loop**
- Typed active recall as the default interaction (no multiple choice)
- 4 interaction types: production (EN→DE, ~50%), recognition (DE→EN, ~25%), cloze (fill-the-blank, ~15%), audio recall (listen & type, ~10%)
- FSRS-4.5 spaced repetition scheduler with 0.9 target retention
- Two independent cards per word: recognition and production
- Umlaut helper chips (ä ö ü ß) below the typing input

**Content**
- 1,000 most frequent German words with full metadata: gender, plural, POS, English gloss, example sentences
- Honest coverage claims per register (~65% non-fiction, ~72% fiction, ~83% spoken)
- 2,000 bundled audio files (Piper TTS, MIT-licensed) with Web Speech API fallback

**PWA & offline**
- Service worker via Workbox — entire learning loop works offline after first load
- 4,013 precached entries (app shell + all audio + self-hosted fonts)
- Install prompt after 3 completed sessions, dismissible, never re-nags
- Manifest with app icons for home screen installation

**Streaks & motivation**
- Streak = daily goal met (not queue cleared)
- Freeze earned every 7 days (cap 3), auto-applied on missed days
- One-time repair after a lapse, calm copy, no guilt
- Optional and dismissible — no dark patterns

**Dashboard & progress**
- Three SVG progress rings: core word coverage, 30-day retention rate, streak
- CEFR band breakdown (A1/A2/B1/B2+)
- Honest copy: "These N words cover ~X% of spoken German"

**Reboot flow**
- Detects absence: active (≤2 days), lapsed (3–13 days), dormant (14+ days)
- Backlog capped at 50/day with FSRS redistribution
- 10-card diagnostic session mixing mature + young cards
- Guilt-free welcome-back copy

**Settings**
- Daily goal (5/10/15/20 min), new cards/day (5/10/15/20), review cap (30/60/100)
- Reduced motion toggle (auto/on/off)
- Optional daily reminders via Notification API with quiet hours
- JSON data export (full DB dump)
- Attribution & license page

**Accessibility (WCAG 2.2 AA)**
- Color contrast ≥ 4.5:1 everywhere
- Full keyboard navigation (Space = flip, Enter = submit, P = pronounce, Tab through all controls)
- ARIA labels on all icon buttons and form inputs
- `aria-live` region announces word details on card flip
- `prefers-reduced-motion` respected — all animations collapse to instant crossfade
- Skip navigation link, visible focus rings

## Navigation

| Route | Screen | Description |
|---|---|---|
| `/` | Home | Dashboard summary, start session button |
| `/onboarding` | Onboarding | 3-step first-run (daily goal, practice card, audio check) |
| `/session` | Session | Learning loop — card flip, typed input, feedback |
| `/summary` | Summary | Post-session stats and encouragement |
| `/dashboard` | Dashboard | Progress rings, coverage stats, CEFR breakdown |
| `/settings` | Settings | All preferences, data export, attribution |

## Keyboard shortcuts

| Key | Action |
|---|---|
| `Space` | Flip card (reveal answer) |
| `Enter` | Submit answer / go to next card |
| `P` | Pronounce current word |
| `Tab` | Navigate between interactive elements |

## Project structure

```
src/
  audio/          # AudioManager, precaching, useAudio hook
  components/     # ProgressRing, InstallPrompt
  db/             # Dexie schema, word import layer
  notifications/  # NotificationManager, useNotifications hook
  reboot/         # RebootManager (absence detection, backlog capping)
  scheduler/      # FSRS wrapper, Levenshtein grading
  screens/        # Home, Onboarding, Session, Summary, Dashboard, Settings, WelcomeBack
  session/        # Session composition (due reviews + new words)
  store/          # Zustand state management
  streaks/        # StreakManager (freeze, repair, increment)
  styles/         # tokens.css (design tokens), reset.css, components.css,
                  # screens.css, motion.css — imported in that cascade
                  # order by index.css
scripts/          # parse-words.mjs, validate-words.mjs, generate-audio.sh, smoke-test.sh
e2e/              # Playwright offline E2E tests
tests/            # Vitest unit tests
```

## Tech stack

| Layer | Choice |
|---|---|
| Framework | React 18 + TypeScript (strict) |
| Bundler | Vite |
| Local DB | Dexie.js (IndexedDB) |
| SRS | ts-fsrs (FSRS-4.5) |
| PWA | vite-plugin-pwa + Workbox |
| State | Zustand (UI) + Dexie (persistence) |
| Routing | React Router |
| Audio | Piper TTS (OGG) + Web Speech API fallback |
| Fonts | Inter + Source Serif 4, self-hosted woff2 (precached — no runtime CDN request) |
| Tests | Vitest + Testing Library, Playwright for E2E |
| Deploy | Docker (Node → nginx) |

## License

See [docs/08-attribution.md](docs/08-attribution.md) for full attribution and licensing details.
