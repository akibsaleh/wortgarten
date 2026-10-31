# 04 — Design Assets

*Derived from and subordinate to PLAN.md — on conflict, PLAN.md wins. Status date: 2026-09-16.*

Scope: every visual, typographic, icon, audio, and generative asset the app ships, with production tool, license, phase, and status. This document specifies *assets*; component behavior lives in PLAN.md §4, stack/integration in [01-technical-specification.md](./01-technical-specification.md), verification in [03-testing-strategy.md](./03-testing-strategy.md), licensing NFRs in [05-constraints-and-nfrs.md](./05-constraints-and-nfrs.md), and scheduling of production work in [07-task-breakdown.md](./07-task-breakdown.md).

Owner decisions applied (2026-09-15): personal use, single user; zero-German learner targeting B1; Docker Compose deployment. App name: **Wortgarten** (owner decision 2026-09-15, recorded in PLAN.md §9) — artwork may commit to the garden/leaf motif.

---

## 1. Design tokens

Single authoritative token copy, mirroring PLAN.md §4 exactly. Values are never restyled here; token *names* are the implementation format.

### 1.1 Palette

*Owner decision 2026-09-16: Claymorphism direction (third reskin, after zen-paper and modern-futuristic). All ratios re-measured per WCAG 2.x relative-luminance formula.*

| Token | Value | Role | Contrast (measured) | Requirement |
|---|---|---|---|---|
| `--color-paper` | `#EFEBF7` | Lilac-mist background (+ faint white radial glow) | — | — |
| `--color-surface` | `#FFFFFF` | Clay card — puffy white objects on the mist | — | — |
| `--color-surface-2` | `#F6F3FC` | Inputs, chips, segmented tracks | — | — |
| `--color-ink` | `#322E48` | Primary text (deep violet ink) | 11.1:1 on bg, 13.0:1 on card | ≥4.5:1 |
| `--color-accent` | `#6D5AE0` | Juicy violet — the *only* accent (fills, rings, focus) | — | Fill only |
| `--color-on-accent` | `#FFFFFF` | Text/icon on accent fills | 5.0:1 | ≥4.5:1 |
| `--color-accent-text` | `#4A3EDB` | Accent as *text*/link on background | 6.0:1 | ≥4.5:1 |
| `--color-der` | `#2B5CB8` | Gender: der (clay blue) | 6.3:1 on card | ≥4.5:1 |
| `--color-die` | `#C22E63` | Gender: die (clay rose) | 5.4:1 on card | ≥4.5:1 |
| `--color-das` | `#8F6C00` | Gender: das (clay gold) | 4.9:1 on card | ≥4.5:1 |
| `--color-error` | `#B8402A` | Error feedback (clay coral); never neon red | 5.5:1 on card | ≥4.5:1 |
| `--color-success` | `#257247` | Success feedback (leaf green) | 5.9:1 on card | ≥4.5:1 |
| `--color-neutral-1…4` | `#E2DCF0` / `#CFC8E4` / `#69638A` / `#5B5578` | Dividers, borders, secondary text, disabled | 3: 4.8:1 · 4: 6.0:1 on bg | Any text use ≥4.5:1; non-text boundaries ≥3:1 (WCAG 2.2 SC 1.4.11) |

Clay surface tokens (the style signature — double shadow per element):
`--shadow-clay` / `--shadow-clay-raised` (outer soft drop, ink-tinted `rgba(50,46,72,…)`, + inset top-left highlight), `--shadow-clay-pressed` (inset, for active states), `--shadow-clay-input` (inset, recessed fields/tracks), `--shadow-focus`, `--shadow-banner`, `--gradient-backdrop` (faint white radial over `--color-paper`).

Derived usage rules (specifications, not new tokens):
- Primary button: `--color-accent` fill + `--color-on-accent` text = 5.0:1 — passes AA.
- Gender color is **never the sole carrier**: article text + card-edge ribbon always accompany it (§7.1).
- Single light theme in MVP. No dark-mode palette exists in PLAN.md; do not invent one.

### 1.2 Type scale (modular 1.25, copied from PLAN.md §4)

| Token | px | Primary use |
|---|---|---|
| `--text-12` | 12 | Captions, metadata |
| `--text-14` | 14 | Secondary UI |
| `--text-16` | 16 | Body, answer input (base) |
| `--text-20` | 20 | Card gloss, small headings |
| `--text-25` | 25 | Screen titles |
| `--text-31` | 31 | Emphasis display |
| `--text-39` | 39 | German word display (serif, §2) |

### 1.3 Spacing, shape, layout

| Token | Value | Notes |
|---|---|---|
| `--space-N` | 4px base grid (`--space-1` = 4px … `--space-16` = 64px) | Generous whitespace; all layout multiples of 4 |
| `--radius-card` | 20px | Cards, chips — chunky clay rounding |
| `--radius-lg` | 24px | Sheets, large surfaces |
| `--border-soft` | 1px solid, neutral step | Rarely used; clay prefers double shadows over borders |
| `--layout-max` | 640px | Single centered column |

### 1.4 Motion

| Token | Value | Use |
|---|---|---|
| `--motion-fast` | 120ms | Hovers, chip appearance |
| `--motion-med` | 180ms | Standard transitions |
| `--motion-slow` | 250ms | Progress-ring fill, max for UI transitions |
| `--motion-flip` | 280ms | Card flip (explicit PLAN §4 exception) |
| `--ease` | `ease-out` (CSS keyword) | No spring, no overshoot, no animation library |

`prefers-reduced-motion` (OS level + in-app Settings toggle): **all animation collapses to an instant opacity crossfade** (opacity-only, ≤120ms). Ambient loops (§7.5) collapse to a static frame.

### 1.5 Token format plan

CSS custom properties in `src/styles/tokens.css` (Vite import; cross-link 01). Naming: `--color-*`, `--text-*`, `--space-*`, `--radius-*`, `--motion-*`. No preprocessor variables, no runtime theming, no token values outside this table set.

---

## 2. Typography assets

| Asset | Family | Weights (max 3/family) | Role | License | Source |
|---|---|---|---|---|---|
| Word display serif | **Source Serif 4** (Newsreader is the approved alternative per PLAN §4; exactly one ships) | 400, 600 | German lemma at `--text-39`, example sentences | SIL OFL 1.1 | Self-hosted |
| UI sans | **Nunito** (Claymorphism direction — rounded, friendly; replaced Inter 2026-09-16) | 400, 700, 800 | All UI text, answer input, wordmark | SIL OFL 1.1 | Self-hosted via `@fontsource/nunito` |

Production rules:
- Self-hosted only — no CDN/Google Fonts runtime request (offline-first constraint, PLAN §6).
- Format: `.woff2`, latin + latin-ext subsets, **explicitly including German glyphs `ä ö ü ß ẞ` (U+00E4, U+00F6, U+00FC, U+00DF, U+1E9E and capitals `Ä Ö Ü`)** — `ẞ` lives in the latin-ext subset; presence in the shipped Nunito latin-ext file verified with fontTools.
- `@font-face` with `font-display: swap` per family/weight/subset.
- File layout: `src/assets/fonts/source-serif-4-{latin,latin-ext}.woff2`, `nunito-{latin,latin-ext}-{400,700,800}-normal.woff2` (+ OFL license text alongside).
- Tooling (font download, subsetting): cross-link [02-environment-and-tooling.md](./02-environment-and-tooling.md).

---

## 3. Icon assets (OpenMoji)

| Property | Specification |
|---|---|
| Source | OpenMoji color SVG set, one consistent style — never mixed with other icon sets |
| License | CC BY-SA 4.0 — attribution shipped in-app (§9) |
| Coverage | Concrete nouns only, ~40% of the deck (PLAN §2 `image_ref`, §7) |
| Selection | (1) Visually depictable single concrete object; (2) unambiguous at card size; (3) 1:1 with `words.json` entry |
| No image, by design | Abstract nouns (*die Geduld*, *das Ausland*, *die Krankenversicherung*), function words (*am*, *aus*), verb phrases (*einverstanden sein*) get **no image** — absence is a design decision, not missing content |
| Examples | `der Hund` → `hund.svg`, `der Kuli` → `kuli.svg`, `das Haus` → `haus.svg` |
| Naming | `public/icons/<slug>.svg`, slug = `words.json` `id`; referenced from `image_ref` |
| Modification | Ship artwork unmodified (license notes "no changes made"); the card UI frames it, no recoloring |
| Optimization | SVGO at build time; runtime-cached by the service worker (PLAN §6) |

Selection pass happens during Phase 0 enrichment (`image_ref` is a `words.json` field); asset fetch/optimization lands in Phase 2 UI polish. Cross-link [07-task-breakdown.md](./07-task-breakdown.md).

---

## 4. Audio assets

| Property | Specification |
|---|---|
| Count | ~2,000 files: one word + one example per lemma |
| Generation | Piper TTS (MIT), Standard German voices, generated at build time — license-clean because self-generated (PLAN §7); no scraped/ripped audio |
| Layout | `public/audio/<slug>.ogg` (word) and `public/audio/<slug>.example.ogg` (example), matching `words.json` `audio_word` / `audio_example` (e.g. `audio/hund.ogg`) |
| Voices | One default voice; alternates selectable in Settings → audio voice (PLAN §4 screen 7); Web Speech API (`speechSynthesis`, de-DE) is the live fallback |
| Format | Ogg container, mono, Piper native sample rate, speech-quality Vorbis encode |
| Loudness | Normalized to a single integrated target (−16 LUFS, true peak ≤ −1.5 dBTP, `ffmpeg loudnorm`) so sequential cards never jump in volume; exact target pinned in the Phase 0 pipeline |
| Size budget | 30–50MB total (PLAN §6), ~15–25KB average per file |
| Delivery | Service worker precaches audio **in chunks on first run with a progress state**; live TTS covers playback until caching completes (PLAN §6). Audio dominates the Docker image size — single-stage static serving keeps it acceptable (cross-link 01) |

---

## 5. App icon & PWA artwork

Produced with the **canvas-design** skill (AGENTS.MD touchpoints: Phase 2 polish for artwork, Phase 3 for manifest icons).

| Asset | Spec | Phase |
|---|---|---|
| `public/icon-192.png`, `public/icon-512.png` | Manifest icons | P3 |
| `public/icon-maskable-192.png`, `public/icon-maskable-512.png` | Maskable variants; motif inside the 80% safe zone | P3 |
| `favicon` | Same motif, simplified | P2 |
| Splash / install artwork | One calm composition for install prompt + splash | P2/P3 |

Design constraints:
- **Name chosen: Wortgarten** (owner decision 2026-09-15): motif is a leaf / garden ring. No letterforms, no logotype in the icon itself.
- Wordmark: "Wortgarten" set in Nunito 800 (rounded UI sans, Claymorphism direction) at UI size; final lockup deferred to Phase 2 branding work.
- Colors restricted to §1.1 tokens: lilac-mist background, violet accent, deep-violet ink. No new brand colors.

---

## 6. Generative art: backgrounds & completion motif

Produced with the **algorithmic-art** skill: seeded p5.js, **static exports only (SVG/PNG/WebP) — never a runtime dependency** (AGENTS.MD). Seeds are recorded in an asset manifest so every export is reproducible.

| Asset | Form | Use |
|---|---|---|
| "Still water" completion motif | SVG ring set + WebP still frame | Session-summary ripple (§7.5); still frame is the `prefers-reduced-motion` fallback and the layout reference for the CSS animation |
| Calm background textures (2–3) | WebP, ≤200KB each | Paper-grain / soft radial calm backgrounds behind cards |

Grounding: PLAN §4 session summary — *"No confetti — a slow 'still water' ripple."* Generative exports land in `src/assets/art/` and are imported as static bundle assets. Phase 2.

---

## 7. Signature interaction specs (asset level)

| # | Interaction | Asset-level spec | Motion | Reduced motion |
|---|---|---|---|---|
| 7.1 | Gender-ribbon card flip | 4px ribbon on the card edge in `--color-der/die/das`; **ribbon color + article text are always both shown** (color never the sole carrier); card uses `--radius-card`, `--border-soft` | Flip 280ms ease-out (`--motion-flip`) | Crossfade between faces |
| 7.2 | Pronunciation button | Icon button, top-right of card, `aria-label="Play pronunciation"`; keyboard `P`; gentle radial ripple in accent at low opacity | Ripple 120–250ms ease-out from tap point | No ripple; instant pressed state |
| 7.3 | Thin progress rings | SVG ring: 3px stroke, round linecap, neutral track, `--color-accent` fill; dashboard shows three rings (core coverage %, 30-day retention, streak) | Fill transition 250ms ease-out (`--motion-slow`) | Instant fill, no transition |
| 7.4 | Umlaut helper chips | Chips `ä ö ü ß` above the auto-focused answer input; 1px soft border, `--radius-card`; insert at caret, keyboard-reachable, each an `<button>` with visible focus ring | Appear 120ms (`--motion-fast`) | Fade in, no positional shift |
| 7.5 | Session-summary slow ripple | Concentric thin rings expanding from center, rendered from §6 motif; ambient loop (~2.4s cycle — ambient, not a UI transition token); **no confetti ever** | Loop, ease-out | Static §6 still frame, crossfade in only |

Screen-reader contract on reveal (PLAN §4): *"Hund, masculine, plural Hunde"* — the ribbon's meaning must survive without color.

---

## 8. Asset inventory & production status

| Asset class | What | Count | Source / tool | License | Phase needed | Status (2026-09-15) |
|---|---|---|---|---|---|---|
| Design tokens | `src/styles/tokens.css` | 1 file | This doc / PLAN §4 | Project | P1–P2 | Specified, not implemented |
| Serif font | Source Serif 4 woff2, 2 weights | 2 | Self-hosted, `pyftsubset` | SIL OFL 1.1 | P2 | Pending |
| UI font | Inter woff2, 2 weights | 2 | Self-hosted, `pyftsubset` | SIL OFL 1.1 | P1 | Pending |
| Word icons | OpenMoji SVG per concrete noun | ~400 (~40% of 1,000) | OpenMoji + SVGO | CC BY-SA 4.0 | P0 selection / P2 integration | Pending |
| Audio — word | `<slug>.ogg` | 1,000 | Piper TTS (build-time) | Self-generated (Piper MIT) | P0 | Pending |
| Audio — example | `<slug>.example.ogg` | 1,000 | Piper TTS (build-time) | Self-generated (Piper MIT) | P0 | Pending |
| App icons | PNG 192/512 + maskable pair + favicon | 5 | canvas-design skill | Project | P2 art / P3 manifest | Pending; name-agnostic |
| Splash / install art | PNG composition | 1–2 | canvas-design skill | Project | P2/P3 | Pending |
| Still-water motif | SVG + WebP fallback frame | 1 set | algorithmic-art skill (seeded) | Project | P2 | Pending |
| Background textures | WebP | 2–3 | algorithmic-art skill (seeded) | Project | P2 | Pending |
| Interaction chrome | Ribbons, rings, chips, ripple | 0 files — pure CSS/SVG in code | §7 specs | Project | P1–P2 | Specified |

Naming / organization tree:

```
public/
  audio/                    hund.ogg · hund.example.ogg · …      (~2,000 files, 30–50MB, chunked precache)
  icons/                    hund.svg · kuli.svg · haus.svg · …   (~400 files, runtime-cached)
  icon-192.png · icon-512.png · icon-maskable-192.png · icon-maskable-512.png · favicon
src/
  assets/
    fonts/                  source-serif-4-400.woff2 · source-serif-4-600.woff2
                            inter-400.woff2 · inter-600.woff2 · OFL license texts
    art/                    still-water.svg · ripple-frame.webp · bg-*.webp
  styles/
    tokens.css              §1 token definitions
```

---

## 9. Attribution inventory

Everything that must appear on the in-app license/attribution page (Settings entry, PLAN §4 screen 7). Normative licensing constraints: [05-constraints-and-nfrs.md](./05-constraints-and-nfrs.md); dataset posture: PLAN §7.

| Item | License | Required attribution action |
|---|---|---|
| Derived word list (spine: hermitdave/FrequencyWords, de) | CC BY-SA 4.0 | Credit + source link + license link; note the derived list stays CC BY-SA (share-alike) |
| Icons (OpenMoji) | CC BY-SA 4.0 | Credit "OpenMoji" + project link + license link; state artwork is unmodified |
| Source Serif 4 / Newsreader | SIL OFL 1.1 | Full OFL license text (in-app page + beside font files) |
| Inter | SIL OFL 1.1 | Full OFL license text |
| Audio | Self-generated with Piper TTS (MIT) | Note: audio is machine-generated with Piper; no third-party recordings ship |
| Leipzig Corpora, SUBTLEX-DE, Goethe-Institut Wortlisten | Non-commercial / © | **Never shipped** — curation-time QA only; documented here for audit, no in-app credit section |

Posture guard (PLAN §7): the app is free and non-commercial; if monetization is ever introduced, all Leipzig/SUBTLEX-DE curation influence must be re-audited before release.
