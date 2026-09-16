# Plan: Modern Zen UI/UX Refactor

## Summary

Refactor Wortgarten's presentation layer — layout, style, and animation/interactivity only — into a coherent "Modern Zen" UI. The work is corrective, not additive: two screens (Dashboard, WelcomeBack) render with **zero CSS**, the card-flip animation is **dead code that does nothing**, the session-summary "ripple" is a **static circle**, fonts load from a **CDN in an offline-first PWA**, and 978 lines of append-only CSS contain a **duplicate `.card` block** that silently overrides the flip transition. No business logic, no data layer, no new dependencies.

## User Story

As a learner using Wortgarten daily,
I want every screen to feel like one calm, deliberate, unhurried surface — with motion that confirms my actions rather than decorating them,
So that the app's visual quiet supports focused study instead of competing with it.

## Problem → Solution

**Current state:** A strong token system (`tokens.css`) sits on top of a 978-line append-only `base.css` that grew section-by-section across Phases 1–3. Growth-by-append produced orphaned selectors, duplicated blocks, hardcoded pixel values in JSX, and four of five specified signature interactions either unimplemented or implemented as no-ops. Two screens have no stylesheet at all.

**Desired state:** Tokens flow through a layered stylesheet set with zero orphan classes and zero hardcoded values in JSX. All five `docs/04-design-assets.md` §7 signature interactions actually run. Typography is self-hosted and survives offline. Layout is responsive across 320px–1440px. WCAG 2.2 AA and the reduced-motion guarantees from Phase 2 are preserved, not regressed.

## Metadata

- **Complexity**: Large
- **Source PRD**: `PLAN.md` (§4 Design & UX, §8 Roadmap) + `docs/04-design-assets.md`
- **PRD Phase**: N/A — standalone refactor (Phases 0–3 complete; this is not Phase 4)
- **Estimated Files**: 17 (6 CSS created, 1 CSS deleted, 8 TSX updated, 1 HTML updated, 1 config updated)

---

## Evidence: What Is Actually Broken

Every item was verified against the working tree, not assumed. D1–D11 come from direct code audit; D12–D14 come from applying the `ui-ux-pro-max` rule set.

| # | Defect | Evidence | Impact |
|---|---|---|---|
| D1 | 18 classNames referenced in TSX have **no CSS rule anywhere** | `comm` diff of used-vs-defined classes | Dashboard + WelcomeBack render as unstyled block elements |
| D2 | `.card` declared **twice** — `base.css:261` and `base.css:590` | Second block re-declares `transition` | Later block silently wins; root cause of D3 |
| D3 | Card flip is a **no-op** | `base.css:598` `.card--flipped { transform: rotateY(0deg); }` — rotating to 0° from 0°. `preserve-3d` at `base.css:593` with **no `perspective` ancestor**. `Session.tsx:290/304` renders front **or** back, never both — there is no second face to flip to | Spec §7.1 (280ms flip) does not exist in the product |
| D4 | `.summary-ripple` is a **static circle** | `base.css:412-420` — fixed 120px, `opacity: 0.3`, no `animation` property | Spec §7.5 (~2.4s concentric ambient loop) unimplemented |
| D5 | Pronunciation ripple **missing** | `base.css:602-626` `.btn-pronounce` has only a `color` transition | Spec §7.2 (radial accent ripple) unimplemented |
| D6 | ProgressRing stroke is **8px, spec says 3px** | `ProgressRing.tsx:16` `strokeWidth = 8`; `Dashboard.tsx:101` passes no override | Rings read heavy, not the "thin rings" of §7.3 |
| D7 | ProgressRing animates via **rAF + setState per frame** | `ProgressRing.tsx:28-48` | ~15 React re-renders/ring × 3 rings on Dashboard mount; a CSS transition does this for free |
| D8 | Fonts load from **Google Fonts CDN** | `index.html:11-14` | Violates `docs/04-design-assets.md` §2 *"Self-hosted only — no CDN/Google Fonts runtime request"*. Cold offline start falls back to Georgia/system sans — the Zen serif identity disappears exactly when Phase 3's offline guarantee matters |
| D9 | `vite.config.ts` **does not cache font origins** | `globPatterns` covers same-origin `js,css,html,ogg,png,svg`; `runtimeCaching` has one `/audio/` rule only | Confirms D8 — nothing rescues CDN fonts offline |
| D10 | **One** responsive media query in 978 lines | `base.css:972` (`max-width: 480px`, install banner only) | No layout adaptation; `#root` is a fixed 640px column at every viewport |
| D11 | 33 inline `style={{}}` objects with **hardcoded px** | `Settings.tsx:147` `fontSize: 13` (off the 12/14/16 scale), `:144` `marginBottom: 28`, `:170` `borderRadius: 8` / `gap: 4` | Bypasses the token system the design docs call "single source of truth" |
| D12 | **Emoji used as structural icons** on three *controls* | `Session.tsx:286` (pronounce), `Session.tsx:368` (replay), `Onboarding.tsx:240` (play) | `ui-ux-pro-max` pro-rules *"No Emoji as Structural Icons"* — font-dependent, renders differently per OS, cannot be token-controlled or recoloured. Spec §3 calls for SVG icons |
| D13 | **`z-index: 100` collision** between skip-nav and install banner | `base.css:63` (`.skip-nav`) and `base.css:950` (`.install-banner`) | Equal z-index means DOM order decides; the fixed install banner paints later and can cover the skip link — a keyboard-navigation defect. No z-index scale exists (`z-index-management`) |
| D14 | Ring fill animates a **non-compositable property** (once D7's rAF is replaced naively) | Planned `.band-bar { transition: width }` would repeat the mistake | `transform-performance`: *"Use transform/opacity only; avoid animating width/height/top/left"* — forces layout on every frame |

**D3 is the headline.** The flip specified in `PLAN.md` §4, spec'd in `docs/04-design-assets.md` §7.1, and given its own motion token (`--motion-flip: 280ms`) has never run.

---

## UX Design

### Before

```
┌──────────────────────────────┐   ┌──────────────────────────────┐
│ HOME (styled, 640px fixed)   │   │ DASHBOARD (NO CSS AT ALL)    │
│                              │   │                              │
│        Wortgarten            │   │ Progress                     │
│        12 cards due          │   │ [ring]                       │  ← stacked
│           🔥 5               │   │ Core coverage                │     vertically,
│                              │   │ [ring]                       │     no flex
│     ┌──────────────┐         │   │ 30-day retention             │
│     │ Begin session│         │   │ [ring]                       │
│     └──────────────┘         │   │ Streak                       │
│       View progress          │   │ These 120 words cover…       │
│                              │   │ A1 (invisible bar) 415       │  ← .band-bar
└──────────────────────────────┘   │ A2 (invisible bar) 293       │     has no CSS:
  Same 640px at 320px and 1440px   │ ← Back                       │     zero height
                                   └──────────────────────────────┘

  CARD FLIP: tap → content swaps instantly. rotateY(0deg) = nothing.
  SUMMARY:   a static grey circle at 30% opacity. Named "ripple".
  CONTROLS:  🔊 emoji as the pronounce/replay/play buttons.
  OFFLINE:   serif → Georgia fallback. Identity lost.
```

### After

```
┌──────────────────────────────┐   ┌──────────────────────────────┐
│ HOME (fluid, breathing)      │   │ DASHBOARD (styled+responsive)│
│                              │   │                              │
│                              │   │  Progress                    │
│        Wortgarten            │   │                              │
│        12 cards due          │   │  ◯ 12%    ◯ 87%    ◯ 5      │  ← 3-up row
│           🔥 5               │   │  core     retention  streak  │     ≥480px,
│                              │   │                              │     wraps below
│     ┌──────────────┐         │   │  These 120 words cover        │
│     │ Begin session│         │   │  about ~18% of spoken German. │
│     └──────────────┘         │   │                              │
│       View progress          │   │  A1 ▓▓▓▓▓▓▓▓░░░░░░░  415     │  ← real bars,
│                              │   │  A2 ▓▓▓▓▓▓░░░░░░░░░  293     │     accent fill,
└──────────────────────────────┘   │  B1 ▓▓▓▓▓▓░░░░░░░░░  292     │     scaleX 250ms
  Fluid ≤640px; vertical rhythm    │  ← Back                      │
  scales with viewport             └──────────────────────────────┘

  CARD FLIP: real 280ms rotateY(180°). Both faces in DOM, hidden face `inert`.
  SUMMARY:   3 concentric rings expanding outward, 2.4s ambient loop. No confetti.
  CONTROLS:  inline SVG speaker icon, accent-tinted, token-sized.
  OFFLINE:   self-hosted woff2. Serif renders on a cold offline boot.
```

### Interaction Changes

| Touchpoint | Before | After | Notes |
|---|---|---|---|
| Card reveal | Instant content swap; `rotateY(0deg)` no-op | True 280ms `rotateY(180deg)` flip, `perspective: 1000px` on wrapper | Spec §7.1. Reduced motion → opacity crossfade |
| Pronunciation button | 🔊 emoji, colour transition only | Inline SVG speaker + radial accent ripple 250ms | Spec §7.2 + D12. Reduced motion → instant pressed state, no ripple |
| Progress rings | 8px stroke, rAF re-render/frame | 3px stroke, CSS `stroke-dashoffset` transition 250ms | Spec §7.3. D6 + D7 fixed together; deletes the rAF code |
| Umlaut chips | 120ms appear, `scale(0.95)` on `:active` | Unchanged timing; reduced motion gets fade-only, no positional shift | Spec §7.4 — already close; only the reduced-motion clause is missing. `scale` on press matches `scale-feedback` (0.95–1.05) |
| Session summary | Static 120px circle | 3 concentric thin rings, 2.4s ambient expand loop | Spec §7.5. No confetti |
| Dashboard bands | Invisible (no CSS) | Track + accent fill, `transform: scaleX()` 250ms on mount | D1 + D14 |
| Stat numbers / timer | Proportional figures | `font-variant-numeric: tabular-nums` | `number-tabular` — stops the `{min}:{sec}` timer at `Summary.tsx:60` jittering |
| Screen entry | Only 3 elements use `fadeSlideIn` | Consistent entry on all 7 screen roots | Reuses the existing keyframe — no new motion vocabulary |
| Skip-nav vs banner | Both `z-index: 100` | Named z-index scale; skip-nav always on top | D13 |
| Any viewport | Fixed 640px column | Fluid to 640px; adapts at 480/768/1024 | D10 |

### Edge Cases for UX

- **Dashboard with 0 reviewed words** — rings at 0%, bars at 0 scale. Bars must still show the track, never collapse to nothing.
- **Very long German compound nouns** (e.g. *Geschwindigkeitsbegrenzung*) at `--text-39` on a 320px screen — must wrap or scale, never overflow the card.
- **Card back with all optional blocks present** (gender ribbon + plural + example + pronounce + detail button) — must not exceed the flip container height, or the back face clips mid-rotation.
- **Rapid double-tap on a card** — `interruptible` / `cancellable-state-transitions`: the second tap must land on the correct final state; never depend on an `animationend` event for correctness.
- **Reduced motion toggled mid-flip** — the in-app toggle can flip `body.reduced-motion` while a card is rotating; the card must land face-correct, not frozen at 90°.
- **Streak + freeze + repair lines all visible at once on Home** — three stacked status paragraphs plus title, subtitle, and two buttons must fit 320×568 without scroll.
- **Install banner visible while tabbing** — skip-nav must stay reachable and on top (D13).

---

## Mandatory Reading

| Priority | File | Lines | Why |
|---|---|---|---|
| P0 (critical) | `src/styles/tokens.css` | 1-83 | The complete token vocabulary. **No value may be introduced outside this file.** |
| P0 (critical) | `docs/04-design-assets.md` | 59-70, 157-170 | §1.4 motion tokens + §7 the five signature interaction specs this plan implements |
| P0 (critical) | `src/styles/base.css` | 260-300, 586-600 | The duplicate `.card` blocks (D2) and the dead flip (D3) |
| P0 (critical) | `src/screens/Session.tsx` | 253-330 | Card JSX; the front/back conditional render that must become two persistent faces |
| P1 (important) | `e2e/offline.e2e.ts` | 37, 56, 115-141, 253-267 | **Selectors the refactor must not break**: `main.home`, `.card`, `.card--flipped`, `#session-answer`, button names |
| P1 (important) | `src/components/ProgressRing.tsx` | 1-100 | rAF animation to be replaced by CSS (D6, D7) |
| P1 (important) | `src/screens/Dashboard.tsx` | 86-175 | All 12 unstyled classNames live here |
| P1 (important) | `docs/04-design-assets.md` | 77-92 | §2 self-hosted font rules incl. the `ẞ` U+1E9E requirement (D8) |
| P1 (important) | `AGENTS.MD` | 51, 81 | "no animation library", "120–250ms ease-out, pure CSS", WCAG 2.2 AA |
| P1 (important) | `.claude/skills/ui-ux-pro-max/references/quick-reference.md` | 93-162 | §5 Layout & Responsive, §6 Typography & Color, §7 Animation — the rules behind D12–D14 |
| P2 (reference) | `.claude/skills/ui-ux-pro-max/references/pro-rules.md` | 9-24 | "No Emoji as Structural Icons", icon contrast, stable interaction states |
| P2 (reference) | `src/styles/base.css` | 70-95, 187-236 | Canonical button + screen-container CSS, and the existing inline-SVG icon precedent at `:231` |
| P2 (reference) | `src/screens/Settings.tsx` | 144-190, 300-370 | Densest inline-style cluster (D11) |
| P2 (reference) | `vite.config.ts` | 1-30 | PWA workbox config — `globPatterns` must pick up self-hosted fonts |

## External Documentation

No external research needed — zero new dependencies, and every CSS feature used is already in the codebase's baseline (`es2022` target, evergreen browsers). Two platform behaviours are load-bearing and documented as GOTCHAs rather than researched:

| Topic | Source | Key Takeaway |
|---|---|---|
| 3D transform flip | MDN `transform-style` / `backface-visibility` | `preserve-3d` requires `perspective` on an **ancestor**, not on the rotating element — precisely why D3 fails today |
| `inert` attribute | MDN `HTMLElement.inert` | Baseline across evergreen browsers; removes a subtree from tab order **and** the a11y tree — the correct tool for the hidden card face |

### Applied Skill Guidance

`ui-ux-pro-max` rules adopted: `transform-performance`, `motion-consistency`, `motion-meaning`, `interruptible`, `cancellable-state-transitions`, `fade-crossfade`, `opacity-threshold`, `scale-feedback`, `no-emoji-as-icons`, `icon-contrast`, `z-index-management`, `spacing-scale`, `breakpoint-consistency`, `viewport-units`, `horizontal-scroll`, `number-tabular`, `long-token-wrapping`, `visual-hierarchy`, `color-not-decorative-only`.

**One deliberate conflict.** The skill's `spring-physics` rule prefers spring curves. `AGENTS.MD:81` and `docs/04-design-assets.md` §1.4 forbid them outright (*"No spring, no overshoot, no animation library"*). **Project constraint wins** — `--ease: ease-out` only. Do not introduce spring easing on the skill's authority.

**One rule out of scope.** The skill's Light/Dark Mode section does not apply: `docs/04-design-assets.md` §1.1 mandates a single light theme and says *"do not invent one."*

---

## Patterns to Mirror

Actual snippets from this codebase. New code must be indistinguishable from these.

### NAMING_CONVENTION — flat BEM-ish classes, `block-element` and `block--modifier`
```css
/* SOURCE: src/styles/base.css:187-208 */
.home {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-4);
}

.home-title {
  font-family: var(--font-serif);
  font-size: var(--text-39);
  color: var(--color-ink);
}

.home-subtitle {
  font-size: var(--text-16);
  color: var(--color-neutral-4);
  margin-bottom: var(--space-12);
}
```
Rules encoded: screen root is `flex: 1` column centred with a token `gap`; children are `screen-element`; **every value is a token**, never a literal.

### SECTION_COMMENT — box-drawing header before each group
```css
/* SOURCE: src/styles/base.css:70, 158, 187, 237, 260 */
/* ── Buttons ───────────────────────────────────────────── */
/* ── Streak display ──────────────────────────────────── */
/* ── Home ──────────────────────────────────────────────── */
/* ── Session ───────────────────────────────────────────── */
/* ── Card ──────────────────────────────────────────────── */
```

### SPEC_CITATION — non-obvious rules cite the spec that mandates them
```css
/* SOURCE: src/styles/base.css:588-589 */
/* ── Card flip transition ──────────────────────────────────
   CSS transform with 280ms transition per PLAN §4.         */
```
```css
/* SOURCE: src/styles/tokens.css:72-73 */
/* ── Reduced motion ───────────────────────────────────────
   All animation collapses to instant opacity crossfade.
   OS-level preference + in-app toggle (§4 screen 7). */
```

### BUTTON_PATTERN — token-only, transition on one property, explicit `:disabled`
```css
/* SOURCE: src/styles/base.css:71-95 */
.btn-primary {
  display: block;
  width: 100%;
  max-width: 320px;
  margin: 0 auto;
  padding: var(--space-3) var(--space-6);
  background: var(--color-accent);
  color: var(--color-paper);
  border: none;
  border-radius: var(--radius-card);
  font-size: var(--text-16);
  font-weight: 500;
  cursor: pointer;
  transition: opacity var(--motion-fast) var(--ease);
}

.btn-primary:hover {
  opacity: 0.9;
}

.btn-primary:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
```

### MOTION_PATTERN — single keyframe, token duration + token easing
```css
/* SOURCE: src/styles/base.css:923-932, 679 */
@keyframes fadeSlideIn {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* applied as: */
.word-detail-mini {
  animation: fadeSlideIn var(--motion-med) var(--ease);
}
```
Note it animates `opacity` + `transform` only — already compliant with `transform-performance`. Keep every new keyframe to those two properties.

### REDUCED_MOTION_PATTERN — two parallel guards, OS + in-app class
```css
/* SOURCE: src/styles/tokens.css:74-83 and src/styles/base.css:444-455 */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}

body.reduced-motion *,
body.reduced-motion *::before,
body.reduced-motion *::after {
  animation-duration: 0.01ms !important;
  animation-iteration-count: 1 !important;
  transition-duration: 0.01ms !important;
  scroll-behavior: auto !important;
}
```
**Both must keep working.** New animations are automatically covered by these blanket rules — that is the mechanism. Add a per-rule override only where the spec demands a *different end state* (§7.5's static frame, §7.2's no-ripple).

### INLINE_SVG_ICON — the precedent for replacing emoji (D12)
```css
/* SOURCE: src/styles/base.css:231 — Home already ships an inline SVG icon */
.home-settings-link svg {
  /* token-sized, currentColor-tinted */
}
```
Mirror this for the speaker icon: inline `<svg>` in the TSX, `stroke="currentColor"`, sized from a token. No icon library, no asset pipeline, no new dependency.

### ICON_BUTTON_A11Y — icon-only controls always carry an `aria-label`
```tsx
/* SOURCE: src/screens/Session.tsx:274-283 */
<button
  className="btn-pronounce"
  onClick={(e) => {
    e.stopPropagation();
    playWord(word.id);
  }}
  aria-label={`Pronounce ${word.lemma}`}
  title="Pronounce (P)"
>
  🔊
</button>
```
The `aria-label` is correct and must survive; only the emoji glyph is replaced.

### SCREEN_ROOT — `<main>` with screen class and the skip-nav anchor id
```tsx
/* SOURCE: src/screens/Dashboard.tsx:86, src/screens/Home.tsx:65 */
<main className="dashboard" id="main-content">
<main className="home" id="main-content">
```

### GENDER_COLOR_RULE — colour is never the sole carrier
```tsx
/* SOURCE: src/screens/Session.tsx:305-311 */
{word.gender && (
  <span
    className="gender-ribbon"
    style={{ backgroundColor: `var(--color-${word.gender})` }}
    aria-hidden="true"
  />
)}
```
This is one of the **three inline styles that must survive** — a dynamic token lookup, not a hardcoded value. Same at `Onboarding.tsx:163`. Satisfies `color-not-decorative-only` because the article text always accompanies it.

### TEST_STRUCTURE — phase-tagged docblock, vitest, helpers under a rule comment
```ts
/* SOURCE: tests/p2-t5.test.ts:1-22 */
/**
 * P2-T5: Humane streaks with freeze / repair.
 * Tests freeze earning, auto-apply, repair, increment, and no-guilt copy.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../src/db/schema';

// ── Helpers ───────────────────────────────────────────────────────────────────

function dateStr(daysFromNow: number, ref: Date = new Date()): string {
  const d = new Date(ref);
  d.setDate(d.getDate() + daysFromNow);
  return todayString(d);
}
```

### E2E_SELECTOR_CONTRACT — selectors the refactor may not rename
```ts
/* SOURCE: e2e/offline.e2e.ts:56, 115, 140-141 */
const main = document.querySelector('main.home');
const inp = document.querySelector('#session-answer') as HTMLInputElement | null;
const card = document.querySelector('.card');
return card && !card.classList.contains('card--flipped');
```
Plus accessible names: `'Skip onboarding'`, `'Check answer'`, `'Next'`.

---

## Files to Change

| File | Action | Justification |
|---|---|---|
| `src/styles/tokens.css` | UPDATE | Add `--motion-ambient: 2400ms` (§7.5 loop — explicitly "ambient, not a UI transition token"), `--ring-stroke: 3px` (§7.3), `--icon-sm/--icon-md` (consistent icon sizing), and a `--z-*` scale (D13). No colour/type/space changes. |
| `src/styles/base.css` | DELETE | Replaced by the files below. Its 978 lines are redistributed, not rewritten. |
| `src/styles/reset.css` | CREATE | `@font-face` + reset + `body`/`#root` layout + focus ring + `.sr-only` + `.skip-nav` (from `base.css:3-68`) |
| `src/styles/components.css` | CREATE | Buttons, card, ribbon, input, chips, feedback, rings, badges, icons. **Single `.card` block, resolving D2.** |
| `src/styles/screens.css` | CREATE | Per-screen layout: home, session, summary, settings, onboarding, dashboard, welcome-back. **Closes all 18 orphan classes (D1).** |
| `src/styles/motion.css` | CREATE | All `@keyframes` + both reduced-motion guards in one place, so coverage is auditable at a glance |
| `src/styles/index.css` | CREATE | Import manifest in cascade order; the only file `main.tsx` imports |
| `src/main.tsx` | UPDATE | Point the stylesheet import at `index.css` |
| `src/screens/Session.tsx` | UPDATE | Card JSX → two persistent faces (D3); SVG speaker icons (D12); remove 3 inline styles |
| `src/screens/Dashboard.tsx` | UPDATE | Remove 3 inline style blocks; pass `strokeWidth={3}` (D6) |
| `src/screens/Settings.tsx` | UPDATE | Remove ~14 inline styles — the densest cluster (D11) |
| `src/screens/Home.tsx` | UPDATE | Remove 2 inline styles |
| `src/screens/WelcomeBack.tsx` | UPDATE | Remove 2 inline styles |
| `src/screens/Onboarding.tsx` | UPDATE | Remove 5 inline styles (keep the gender-ribbon one at `:163`); SVG play icon (D12) |
| `src/screens/Summary.tsx` | UPDATE | Ripple markup → 3 concentric rings (D4); tabular figures on the timer |
| `src/components/ProgressRing.tsx` | UPDATE | Delete the rAF block; CSS transition; `strokeWidth` default 3 (D6, D7) |
| `src/components/InstallPrompt.tsx` | UPDATE | Verify banner classes resolve after the split; z-index from the scale (D13) |
| `src/components/SpeakerIcon.tsx` | CREATE | One inline SVG, `currentColor`, token-sized — replaces 🔊 in 3 places (D12) |
| `src/assets/fonts/*.woff2` | CREATE | 4 self-hosted subset files (D8) |
| `index.html` | UPDATE | Remove the Google Fonts `<link>` + `preconnect` (D8) |
| `vite.config.ts` | UPDATE | Add `woff2` to `globPatterns` so fonts precache (D9) |
| `tests/ui-refactor.test.ts` | CREATE | Regression guard — see Testing Strategy |

## NOT Building

Explicitly out of scope. Do not add these even if they seem adjacent.

- **Dark mode / any second theme.** `docs/04-design-assets.md` §1.1: *"Single light theme in MVP. No dark-mode palette exists in PLAN.md; do not invent one."* This overrides the skill's Light/Dark Mode checklist.
- **Any new colour, type size, spacing step, or motion duration** outside `tokens.css`. `AGENTS.MD:81`: *"don't invent new colors or springs."*
- **Any animation library** (Framer Motion, GSAP, react-spring, Motion One). `AGENTS.MD:81`: *"pure CSS, no animation library."* This refactor adds **zero** dependencies.
- **Any icon library** (Lucide, Phosphor, react-icons). D12 is fixed with one hand-written inline SVG, mirroring the existing `.home-settings-link svg` precedent.
- **Spring / bounce / overshoot easing.** Skill rule `spring-physics` is explicitly overridden by `docs/04-design-assets.md` §1.4: *"No spring, no overshoot."*
- **CSS-in-JS, CSS Modules, Tailwind, or any styling-system migration.** Plain CSS + custom properties stays.
- **Confetti or celebratory particle effects.** `PLAN.md` §4 / spec §7.5: *"no confetti ever."*
- **Replacing the 🔥 streak emoji.** It sits beside visible text with an `aria-label` carrying the meaning — decorative, not a control. Only the three 🔊 *controls* are in scope for D12.
- **Shared-element / hero screen transitions** (skill rule `shared-element-transition`). Spec §1.4 caps UI transitions at 250ms and the app is a calm single-column flow; the existing `fadeSlideIn` is the whole vocabulary.
- **The generative art assets** (`still-water.svg`, `bg-*.webp`, ~400 OpenMoji word icons) from spec §6/§8. Asset production, not layout/style/animation. The summary ripple is built as pure CSS rings; if the SVG motif ships later it drops into the same markup.
- **Copy changes.** No user-facing text edits — the "no-guilt" streak copy is tested at `tests/p2-t5.test.ts` and is product-tuned.
- **Any change to scheduling, FSRS, session composition, DB schema, audio, notifications, streak, or reboot logic.**
- **Renaming any selector in the E2E contract** — `main.home`, `.card`, `.card--flipped`, `#session-answer`, `#main-content`.
- **New screens, new routes, new features.** Phase 4 items stay unplanned.
- **Font subsetting via `pyftsubset`.** Spec §2 prefers it, but Google's `latin-ext` woff2 files already carry `ä ö ü ß ẞ`. Ship those; subset later only if bundle size becomes a measured problem.

---

## Step-by-Step Tasks

Ordered so the app stays runnable after every single task.

### Task 1: Split `base.css` into a layered stylesheet set

- **ACTION**: Create `reset.css`, `components.css`, `screens.css`, `motion.css`, `index.css` in `src/styles/`. Move — do not rewrite — the existing 978 lines. Delete `base.css`.
- **IMPLEMENT**:
  - `index.css` is the only entry point:
    ```css
    /* ==========================================================
       index.css — stylesheet manifest. Cascade order is load-bearing:
       tokens → reset → components → screens → motion.
       ========================================================== */
    @import './tokens.css';
    @import './reset.css';
    @import './components.css';
    @import './screens.css';
    @import './motion.css';
    ```
  - `reset.css` ← `base.css:3-68` (reset, `body`, `#root`, focus ring, `.sr-only`, `.skip-nav`)
  - `components.css` ← buttons (`:70-157`), card + ribbon (`:260-342`), input (`:343-367`), feedback (`:368-401`), pronounce (`:602-626`), umlaut chips (`:627-670`), word detail (`:671-739`), skip (`:740-762`), badges, install banner (`:936-978`)
  - `screens.css` ← home (`:187-236`), session (`:237-259`), summary (`:402-443`), settings (`:456-587`), onboarding (`:763-922`), streak display (`:158-186`)
  - `motion.css` ← `@keyframes fadeSlideIn` (`:923-932`) + **both** reduced-motion guards (moved out of `tokens.css:74-83` and `base.css:444-455`)
- **MIRROR**: SECTION_COMMENT — keep every `/* ── Name ── */` header with its block.
- **IMPORTS**: `src/main.tsx` — change the stylesheet import to `./styles/index.css`.
- **GOTCHA**: **Resolve D2 during the move, not after.** `.card` appears at `:261` and again at `:590`. Merge into one block with the union of properties; the `:590` `transition` (which includes `transform var(--motion-flip)`) currently wins, so it is the one to keep. Dropping the wrong one silently changes behaviour.
- **GOTCHA**: `tokens.css` must stay first — everything depends on its custom properties. Vite hoists `@import` to the top of the bundled CSS; keep them contiguous at the top of `index.css` so order is preserved.
- **VALIDATE**: `npm run build` succeeds. `npm run dev` — every screen looks **byte-identical to before this task**. This is a pure move; any visual change means something was dropped.

### Task 2: Extend the token set

- **ACTION**: Add the tokens the later tasks depend on. `tokens.css` only.
- **IMPLEMENT**:
  ```css
  /* ── Ambient motion (NOT a UI transition token — spec §7.5) ── */
  --motion-ambient: 2400ms;

  /* ── Icon & ring sizing (spec §7.3; skill: consistent icon sizing) ── */
  --ring-stroke: 3px;
  --icon-sm: 16px;
  --icon-md: 24px;

  /* ── Z-index scale (skill: z-index-management) ──────────────
     Resolves the .skip-nav / .install-banner collision at 100.  */
  --z-base:    0;
  --z-raised:  10;
  --z-banner:  40;
  --z-skipnav: 100;
  ```
- **MIRROR**: `tokens.css` section-comment style with the aligned trailing-comment column.
- **IMPORTS**: none.
- **GOTCHA**: `--motion-ambient` is deliberately **not** part of the four-token UI motion scale — spec §7.5 calls it "ambient, not a UI transition token". Do not reuse `--motion-slow`, and do not extend the UI scale.
- **GOTCHA**: no colour, type-scale, or spacing tokens may be added. Those three sets are frozen by `AGENTS.MD:81`.
- **VALIDATE**: `npm run build`. No visual change yet — nothing consumes these tokens.

### Task 3: Style the 18 orphan classes (D1) — Dashboard and WelcomeBack

- **ACTION**: Add the missing rules to `screens.css`.
- **IMPLEMENT**: `.dashboard`, `.dashboard-rings`, `.ring-item`, `.ring-label`, `.dashboard-honest-copy`, `.dashboard-registers`, `.dashboard-bands`, `.band-row`, `.band-label`, `.band-bar-track`, `.band-bar`, `.band-count`, `.welcome-back`, `.welcome-back-message`, `.welcome-back-hint`, `.streak-day-one`, `.session-progress-text`, `.badge-type`, `.btn-replay`.
  - `.dashboard` mirrors `.home`: `flex: 1`, column, token `gap`.
  - `.dashboard-rings`: `display: flex; justify-content: space-around; gap: var(--space-6); flex-wrap: wrap`.
  - `.ring-item`: column, centred, `gap: var(--space-2)`.
  - `.band-row`: `display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: var(--space-3)`.
  - `.band-bar-track`: `height: var(--space-2); background: var(--color-neutral-1); border-radius: var(--radius-card); overflow: hidden`.
  - `.band-bar`: `height: 100%; background: var(--color-accent); border-radius: inherit; transform-origin: left center; transition: transform var(--motion-slow) var(--ease)`.
- **MIRROR**: NAMING_CONVENTION — token-only values, `screen-element` naming.
- **GOTCHA — D14**: animate `transform: scaleX()`, **not** `width`. `transform-performance` forbids animating layout properties. This means `Dashboard.tsx:150` changes from `style={{ width: ... }}` to `style={{ transform: `scaleX(${ratio})` }}` — that inline style is **legitimate** (dynamic data value) and stays, same category as GENDER_COLOR_RULE.
- **GOTCHA**: `.band-bar-track` needs an explicit `height`; a child with `height: 100%` inside an auto-height parent collapses to zero — the current invisible-bar bug in a different form.
- **GOTCHA**: `.band-label` / `.band-count` get `font-variant-numeric: tabular-nums` (`number-tabular`) so the three rows' digits align.
- **VALIDATE**: Re-run the orphan-class check from Validation Commands — it must print nothing. Dashboard renders three rings in a row and three visible CEFR bars.

### Task 4: Replace inline styles with token-backed classes (D11)

- **ACTION**: Remove all 33 `style={{}}` occurrences **except** the three dynamic ones.
- **IMPLEMENT**: Keep exactly: `Session.tsx:307` and `Onboarding.tsx:163` (gender colour lookup) and `Dashboard.tsx:150` (band `scaleX`). Convert the rest to classes.
  - `.loading-text` replaces the six repeats of `{{ color: 'var(--color-neutral-3)' }}` (`App.tsx:30,71`, `Home.tsx:60`, `Settings.tsx:246`, `WelcomeBack.tsx:56`, `Dashboard.tsx:74`).
  - `.settings-group`, `.settings-group-label`, `.settings-segmented`, `.settings-segment`, `.settings-row`, `.settings-field-label` for the `Settings.tsx` cluster.
  - `.dashboard-title`, `.dashboard-bands-title` for `Dashboard.tsx:87,138`.
  - `.stat-value` gains `font-variant-numeric: tabular-nums` — fixes the `{min}:{sec}` timer jitter at `Summary.tsx:60`.
- **MIRROR**: BUTTON_PATTERN and NAMING_CONVENTION.
- **GOTCHA**: Off-scale values are **snapped to the grid**, not preserved. `Settings.tsx:147` `fontSize: 13` → `var(--text-14)`; `:144` `marginBottom: 28` → `var(--space-7)`; `:170` `borderRadius: 8` / `gap: 4` → `var(--radius-card)` / `var(--space-1)`; `WelcomeBack.tsx:85` `fontSize: '13px'` → `var(--text-14)`. Expect small, intentional visual shifts — that is the refactor working.
- **GOTCHA**: `Settings.tsx:177` and `:314-330` build styles conditionally from state. Convert to conditional **classNames** (`--active` modifiers), not conditional style objects.
- **GOTCHA**: `readable-font-size` — body text stays ≥16px on mobile. `--text-14` and `--text-12` are fine for metadata/captions but must not become body copy.
- **VALIDATE**: `grep -rn "style={{" src/ | wc -l` returns exactly `3`. `npm run lint` clean.

### Task 5: Make the card flip real (D3) — the headline fix

- **ACTION**: Restructure the card in `Session.tsx` into two persistent faces inside a rotating inner element; write a working flip in `components.css`.
- **IMPLEMENT**:
  - JSX: keep `<div className={`card ${flipped ? 'card--flipped' : ''}`}>` as the **outer** element (E2E contract), add `<div className="card-inner">` inside, and render **both** `.card-front` and `.card-back` unconditionally as its children.
  - CSS:
    ```css
    /* ── Card flip ─────────────────────────────────────────────
       Two persistent faces; 280ms rotateY per PLAN §4 / spec §7.1.
       `perspective` lives on the OUTER element — `preserve-3d` on the
       rotating element alone renders flat (the pre-refactor bug).   */
    .card {
      perspective: 1000px;
    }

    .card-inner {
      position: relative;
      width: 100%;
      height: 100%;
      transform-style: preserve-3d;
      transition: transform var(--motion-flip) var(--ease);
    }

    .card--flipped .card-inner {
      transform: rotateY(180deg);
    }

    .card-front,
    .card-back {
      position: absolute;
      inset: 0;
      backface-visibility: hidden;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }

    .card-back {
      transform: rotateY(180deg);
    }
    ```
  - Reduced motion: the blanket guards collapse 280ms to ~0, which is spec §7.1's "crossfade between faces". Add an explicit crossfade only if the instant rotate reads as a flicker in manual testing.
- **MIRROR**: SPEC_CITATION — the comment above is the required style for a non-obvious rule.
- **GOTCHA — accessibility, non-negotiable**: both faces now live in the DOM permanently. The hidden face **must** get `inert` (removes it from tab order *and* the a11y tree). Without it a screen reader announces both faces and `Tab` lands on the invisible pronounce/detail buttons. Apply `inert={flipped ? undefined : true}` on `.card-back` and the inverse on `.card-front`. `backface-visibility` hides pixels, **not** assistive technology.
- **GOTCHA — `interruptible` / `cancellable-state-transitions`**: a rapid second tap must land on the correct final state. Drive everything from the `flipped` prop; never depend on an `animationend`/`transitionend` event for correctness.
- **GOTCHA**: `.card` currently sets `overflow: hidden` (`base.css:277`) — keep it, or the rotating back face bleeds past the rounded corners mid-flip.
- **GOTCHA**: absolutely-positioned faces need a real height on `.card`; `min-height: 280px` (`base.css:263`) provides it. Don't remove it.
- **GOTCHA**: the `aria-live` announcement at `Session.tsx:235` and the `.card` `aria-label` at `:266` must keep reflecting the **visible** face.
- **VALIDATE**: `npm run test:e2e:offline` — the `.card--flipped` assertion at `e2e/offline.e2e.ts:140` still passes. Manually: tap and watch an actual 280ms rotation; double-tap rapidly and confirm the final state is correct; Tab through a face-down card — focus must never enter the back face.

### Task 6: Replace emoji control icons with inline SVG (D12)

- **ACTION**: Create `src/components/SpeakerIcon.tsx`; use it at the three 🔊 control sites.
- **IMPLEMENT**:
  - One small component returning an inline `<svg>` speaker glyph with `stroke="currentColor"`, `width`/`height` from `var(--icon-md)`, and `aria-hidden="true"` (the parent button already carries the accessible name).
  - Swap in at `Session.tsx:286` (pronounce), `Session.tsx:368` (replay — keep the "Replay" text label beside it), `Onboarding.tsx:240` (play).
  - Leave the 🔥 streak emoji alone — decorative, beside visible text, meaning carried by `aria-label`.
- **MIRROR**: INLINE_SVG_ICON — the existing `.home-settings-link svg` precedent at `base.css:231`.
- **IMPORTS**: `import { SpeakerIcon } from '../components/SpeakerIcon';`
- **GOTCHA**: the icon inherits `currentColor`, so it tints from the button's `color`. Verify `icon-contrast` — a meaningful control icon needs ≥3:1 against its background (WCAG 2.2 SC 1.4.11). `--color-accent-text` on paper is 7.2:1; plain `--color-accent` is 4.7:1. Both pass.
- **GOTCHA**: `aria-hidden="true"` on the SVG is required. Without it a screen reader may announce the graphic *in addition to* the button's `aria-label`, producing a double announcement.
- **GOTCHA**: keep the existing `aria-label` and `title` on every button exactly as-is — `e2e/offline.e2e.ts` resolves controls by accessible name.
- **VALIDATE**: All three controls show a consistent vector speaker. Screen reader announces "Pronounce Hund", not "speaker Pronounce Hund". No new package in `package.json`.

### Task 7: Implement the remaining signature interactions (D4, D5)

- **ACTION**: Build the §7.5 summary ripple and the §7.2 pronunciation ripple in `motion.css`.
- **IMPLEMENT**:
  - **Summary ripple** — replace the static `.summary-ripple` circle. `Summary.tsx:44` becomes three nested `<span className="ripple-ring" />` inside `.summary-ripple` (keep `aria-hidden="true"`). Keyframe expands `scale()` outward with opacity falling to 0; `animation: rippleExpand var(--motion-ambient) var(--ease) infinite`; stagger children by `calc(var(--motion-ambient) / 3)`. Thin 1px accent borders, transparent fill.
  - **Pronounce ripple** — `.btn-pronounce::after`, a radial accent circle at low opacity scaling out over `var(--motion-slow)`, triggered on `:active`.
  - **Reduced motion**: §7.5 needs a *different end state*, not just instant — add an explicit override so the summary ripple settles as a **static frame** (outermost ring only, no loop) rather than freezing mid-expansion. §7.2 requires "no ripple; instant pressed state" — suppress `::after` entirely.
- **MIRROR**: MOTION_PATTERN for keyframe shape; REDUCED_MOTION_PATTERN for the guards.
- **GOTCHA**: both keyframes animate **`transform` and `opacity` only** (`transform-performance`). Never animate `width`/`height` for the ripple.
- **GOTCHA**: an `infinite` animation runs forever. Scope it to `.summary-ripple` so it unmounts with the screen; never attach an infinite loop to a persistent element.
- **GOTCHA**: the blanket reduced-motion rule sets `animation-iteration-count: 1`, which would play the ripple **once** rather than not at all. The explicit override above is what actually satisfies the spec.
- **GOTCHA — `opacity-threshold`**: rings must fade fully to 0, not linger at 0.2. The current static circle sits at `opacity: 0.3` — that is the anti-pattern being removed.
- **GOTCHA — `excessive-motion`**: the Summary screen animates the ripple **only**. Do not also animate the stat numbers or the streak line.
- **VALIDATE**: Finish a session — concentric rings expand on a calm ~2.4s loop, no confetti. Toggle reduced motion — a single static ring, no movement.

### Task 8: Fix the progress rings (D6, D7)

- **ACTION**: In `ProgressRing.tsx`, delete the rAF animation and default the stroke to 3px.
- **IMPLEMENT**:
  - Delete `useState`/`useRef`/`useEffect` and the whole `animate` loop (`ProgressRing.tsx:20-48`). Compute `offset` directly from the `value` prop.
  - Add `className="ring-fill"` to the fill `<circle>`; in `components.css`: `.ring-fill { transition: stroke-dashoffset var(--motion-slow) var(--ease); }`.
  - Default `strokeWidth = 3` — better, read `var(--ring-stroke)` in CSS and drop the prop default to match.
  - Delete the now-unused `reducedMotion` check — the global CSS guards cover the transition automatically.
- **MIRROR**: MOTION_PATTERN — token duration, token easing.
- **IMPORTS**: `ProgressRing.tsx` should end up importing nothing from `react`. Remove the import line entirely if empty, or TypeScript/ESLint will flag it.
- **GOTCHA**: a CSS transition fires only on a **change**. Mounting straight to the final `offset` renders a filled ring with no animation. Keep the "grow from 0" feel by starting `stroke-dashoffset` at `circumference` in CSS and letting it transition to the target on first paint.
- **GOTCHA**: `pct` text still comes from `value` — with rAF gone it no longer counts up. That is correct: spec §7.3 animates the **ring fill**, not the number. Add `font-variant-numeric: tabular-nums` to the `<text>` so the percentage does not jitter.
- **GOTCHA**: `Dashboard.tsx:101,110,119` pass `size`/`color` but no `strokeWidth`; the new default applies. Verify the 3px ring is visible against `--color-neutral-1` — non-text boundaries need ≥3:1 (WCAG 2.2 SC 1.4.11, and the skill's `icon-contrast`). If it fails, the **track** moves to `--color-neutral-2`; the 3px stroke is spec'd and does not change.
- **VALIDATE**: Rings are thin and fill smoothly. React DevTools shows **one** render per ring, not ~15.

### Task 9: Self-host the fonts (D8, D9)

- **ACTION**: Vendor Inter 400/600 and Source Serif 4 400/600 as `.woff2`; remove the CDN link.
- **IMPLEMENT**:
  - Four files in `src/assets/fonts/` per spec §2 naming: `inter-400.woff2`, `inter-600.woff2`, `source-serif-4-400.woff2`, `source-serif-4-600.woff2`, plus the OFL licence text alongside.
  - `@font-face` blocks at the **top of `reset.css`** with `font-display: swap`.
  - Delete `index.html:9-14` (the comment, both `preconnect` hints, and the stylesheet `<link>`).
  - `vite.config.ts`: `globPatterns: ['**/*.{js,css,html,ogg,png,svg,woff2}']`.
- **MIRROR**: SPEC_CITATION — cite `docs/04-design-assets.md` §2 above the `@font-face` block.
- **GOTCHA**: take the **`latin-ext`** subset, not `latin`. `ẞ` (U+1E9E) is outside the default latin range and spec §2 requires it explicitly. Verify by rendering `ä ö ü ß ẞ Ä Ö Ü` before considering this done.
- **GOTCHA**: `tokens.css:31-32` already names `'Source Serif 4'` and `'Inter'` — the `@font-face` `font-family` strings must match **exactly**, including the space and digit in `Source Serif 4`, or the fallback silently wins and nothing appears to change.
- **GOTCHA**: this is the one task touching build config. Confirm the emitted `dist/assets/*.woff2` files appear in the generated service-worker precache manifest, not merely on disk.
- **VALIDATE**: `npm run build && npm run preview`, then hard-reload offline in DevTools — the serif renders. Network tab shows **zero** requests to `fonts.googleapis.com` / `fonts.gstatic.com`.

### Task 10: Responsive layout (D10) and the z-index scale (D13)

- **ACTION**: Add breakpoint handling; make the fixed 640px column fluid; apply the z-index tokens.
- **IMPLEMENT**:
  - `#root`: `max-width: var(--layout-max)` stays; padding becomes fluid via `clamp()` between `--space-4` and `--space-8` (`adaptive gutters by breakpoint`).
  - Breakpoints at **480 / 768 / 1024** (`breakpoint-consistency`; 480 is the existing one at `base.css:972` — keep it, don't invent a parallel set).
    - `≤480px` — compact vertical rhythm; `.dashboard-rings` wraps; `.card` `min-height` relaxes; `.card-word` scales down so long compounds don't overflow.
    - `≥768px` / `≥1024px` — more generous vertical spacing only. The column stays 640px: spec §1.3 mandates a "single centered column", so **do not widen it or add side-by-side panels**.
  - `.skip-nav` → `z-index: var(--z-skipnav)`; `.install-banner` → `var(--z-banner)`; `.btn-pronounce` (`base.css:619`) → `var(--z-raised)`.
  - Touch targets ≥44×44px at every breakpoint (WCAG 2.2 SC 2.5.8 + the skill's `touch-target-minimum`).
- **MIRROR**: the existing `@media (max-width: 480px)` block (`base.css:972-978`) — same breakpoint value, same placement convention.
- **GOTCHA**: put each media query **in the file it modifies** (screen queries in `screens.css`, component queries in `components.css`). A central `responsive.css` recreates exactly the rule-far-from-its-context problem that caused D2.
- **GOTCHA**: `.card-word` must not scale below `--text-25`; the German lemma is the focal element of the whole app. Add `overflow-wrap: anywhere` (`long-token-wrapping`) so compounds reflow instead of overflowing.
- **GOTCHA**: `body` uses `min-height: 100dvh` (`base.css:19`). Keep `dvh`, not `vh` (`viewport-units`) — mobile browser chrome makes `vh` clip the primary button below the fold.
- **GOTCHA — `fixed-element-offset`**: `.install-banner` is `position: fixed` at the bottom. Home needs bottom padding equal to the banner height while it is shown, or it covers the "View progress" link.
- **VALIDATE**: 320, 375, 480, 768, 1024, 1440 px — no horizontal scroll, no overflow, no clipped controls. Tab to the skip link with the install banner visible — it must be on top.

### Task 11: Consistent screen-entry motion

- **ACTION**: Apply the existing `fadeSlideIn` to all seven screen roots.
- **IMPLEMENT**: in `motion.css`, `.home, .session, .summary, .settings, .onboarding, .dashboard, .welcome-back { animation: fadeSlideIn var(--motion-med) var(--ease); }`.
- **MIRROR**: MOTION_PATTERN — reuse the existing keyframe; introduce **no new** animation vocabulary (`motion-consistency`).
- **GOTCHA**: `.welcome-back` is applied alongside `.home` (`WelcomeBack.tsx:61` → `className="home welcome-back"`), so that screen would animate twice. Listing both in one rule makes it a single `animation` declaration — correct. Do not write separate rules.
- **GOTCHA**: use `--motion-med` (180ms), inside the 120–250ms band. Do not use `--motion-flip` (280ms) — documented as a card-flip-only exception.
- **VALIDATE**: Navigate between all screens — each settles quickly and calmly, none feels sluggish. With reduced motion on, transitions are instant.

### Task 12: Regression test + full verification

- **ACTION**: Add `tests/ui-refactor.test.ts`; run the full suite.
- **IMPLEMENT**: the orphan-class guard and token-compliance assertions in Testing Strategy below.
- **MIRROR**: TEST_STRUCTURE — docblock header, vitest imports, `// ── Helpers ──` separator.
- **IMPORTS**: `import { describe, it, expect } from 'vitest';` plus `node:fs` / `node:path` to read the stylesheets.
- **GOTCHA**: read the CSS files from disk rather than asserting on a jsdom render — jsdom does not apply stylesheets, so a computed-style assertion would pass no matter what the CSS says.
- **VALIDATE**: every command in Validation Commands passes.

---

## Testing Strategy

### Unit Tests (`tests/ui-refactor.test.ts`)

| Test | Input | Expected Output | Edge Case? |
|---|---|---|---|
| No orphan classes | All `className` strings in `src/**` vs all selectors in `src/styles/**` | Empty difference | No |
| No stray `base.css` reference | grep `src/` for `base.css` | Zero hits | No |
| Inline styles capped | count of `style={{` in `src/**` | Exactly 3 (the dynamic ones) | No |
| No hardcoded hex outside tokens | `#[0-9a-fA-F]{3,8}` in `src/styles/*.css` except `tokens.css` | Zero hits | Yes |
| No off-scale px | `\d+px` in stylesheets except `tokens.css` and 1px borders | Zero hits | Yes |
| Motion durations are tokens | every `transition` / `animation` shorthand | References a `--motion-*` token | Yes |
| **Only compositable properties animated** | every `transition`/`@keyframes` | Touches only `transform`, `opacity`, `stroke-dashoffset`, `box-shadow`, `color`, `background`, `border-color` — never `width`/`height`/`top`/`left` | Yes — the D14 guard |
| Reduced-motion guards intact | `motion.css` | Both the `@media` and `body.reduced-motion` blocks present | Yes |
| Every keyframe is reachable | each `@keyframes` name | Referenced by ≥1 rule | Yes |
| No raw z-index values | `z-index:` in `src/styles/*.css` except `tokens.css` | Every one uses a `--z-*` token | Yes — the D13 guard |
| No emoji in control markup | 🔊 in `src/**` | Zero hits (🔥 allowed) | Yes — the D12 guard |
| E2E selector contract | `Session.tsx`, `Home.tsx` | `.card`, `.card--flipped`, `main.home`, `#session-answer`, `#main-content` all still emitted | Yes |
| `.card` declared once | `components.css` | Exactly one top-level `.card {` block | Yes — the D2 regression guard |
| No CDN font request | `index.html` | No `fonts.googleapis.com` / `fonts.gstatic.com` | Yes |
| Fonts precached | `vite.config.ts` | `globPatterns` includes `woff2` | Yes |

### Edge Cases Checklist

- [ ] Dashboard with 0 reviewed words — rings at 0%, band tracks still visible
- [ ] Dashboard at 1,000/1,000 — rings at 100%, no overflow
- [ ] Longest German compound at `--text-39` on a 320px viewport — wraps, never overflows
- [ ] Card back with every optional block present — no clipping mid-flip
- [ ] Rapid double-tap on a card — lands on the correct final state
- [ ] Reduced motion toggled **mid-flip** — card lands face-correct, not stuck at 90°
- [ ] `Tab` through a face-down card — focus never enters the hidden face
- [ ] Screen reader on a face-down card — the hidden face is not announced
- [ ] Screen reader on the pronounce button — one announcement, not "speaker" + label
- [ ] Skip-nav reachable while the install banner is showing
- [ ] Home with streak + freeze + repair all showing at 320×568 — fits without scroll
- [ ] Cold offline boot — self-hosted serif renders
- [ ] 200% browser zoom — no clipped or unreachable controls (WCAG 2.2 SC 1.4.4)
- [ ] Landscape orientation on a phone — layout readable and operable

---

## Validation Commands

### Static Analysis
```bash
npm run build          # tsc -b && vite build
npm run lint           # eslint src/
```
EXPECT: Zero type errors, zero lint errors.

### Orphan-class check (the D1 guard, runnable standalone)
```bash
grep -roh 'className="[^"]*"' src/ | sed 's/className="//;s/"//' | tr ' ' '\n' \
  | grep -v '^$' | sort -u > /tmp/used.txt
cat src/styles/*.css | grep -oh '^\.[a-zA-Z0-9_-]*' | sed 's/^\.//' | sort -u > /tmp/defined.txt
comm -23 /tmp/used.txt /tmp/defined.txt
```
EXPECT: no output. (Before this refactor: 18 lines.)

### Inline-style budget (the D11 guard)
```bash
grep -rn "style={{" src/ | wc -l
```
EXPECT: `3` — gender colour ×2, band `scaleX` ×1.

### Duplicate-selector check (the D2 guard)
```bash
grep -c '^\.card {' src/styles/components.css
```
EXPECT: `1`.

### Non-compositable animation check (the D14 guard)
```bash
grep -nE 'transition:[^;]*\b(width|height|top|left|right|bottom|margin|padding)\b' src/styles/*.css
```
EXPECT: no output.

### Emoji-control check (the D12 guard)
```bash
grep -rn "🔊" src/
```
EXPECT: no output.

### Unit Tests
```bash
npm run test
```
EXPECT: all pass — `p1-t7`, `p2-t5`, `p3-t4`, and the new `ui-refactor` suite. **No existing test may be modified to accommodate the refactor**; if one fails, the refactor broke behaviour.

### E2E / Offline
```bash
npm run test:e2e:offline
```
EXPECT: green — this is the contract test for `.card` / `.card--flipped` / `main.home` / `#session-answer`.

### Browser Validation
```bash
npm run dev            # visit every route
npm run build && npm run preview   # verify the offline font path
```
EXPECT: all screens styled; DevTools Network shows zero `fonts.g*` requests; offline hard-reload renders the serif.

### Manual Validation
- [ ] Every route renders styled: `/`, `/session`, `/summary`, `/dashboard`, `/settings`, `/onboarding`, `/welcome-back`
- [ ] Card flip is a visible 280ms rotation
- [ ] Summary shows expanding concentric rings; no confetti
- [ ] Progress rings are thin (3px) and fill smoothly
- [ ] Pronounce button shows the SVG icon and ripples on press
- [ ] Settings reduced-motion toggle kills all motion, including the new animations
- [ ] OS-level reduced motion does the same independently
- [ ] Keyboard-only pass through every screen; focus ring always visible
- [ ] Screen-reader pass on the Session card — reveal announces *"Hund, masculine, plural Hunde"* per the §7 contract
- [ ] Gender colour never the sole carrier — article text + ribbon both present
- [ ] Contrast re-check on any changed pairing (≥4.5:1 text, ≥3:1 boundaries and icons)
- [ ] 320 / 375 / 480 / 768 / 1024 / 1440 px — no horizontal scroll

---

## Acceptance Criteria

- [ ] All 12 tasks complete
- [ ] All 14 evidenced defects (D1–D14) fixed
- [ ] All five `docs/04-design-assets.md` §7 signature interactions verifiably running
- [ ] Orphan-class check prints nothing
- [ ] Inline-style count is exactly 3
- [ ] Zero type errors, zero lint errors
- [ ] Existing tests pass **unmodified**
- [ ] Offline E2E green
- [ ] WCAG 2.2 AA holds — contrast, keyboard, screen reader, reduced motion
- [ ] Zero new dependencies in `package.json`

## Completion Checklist

- [ ] Code follows the discovered patterns (naming, section comments, spec citations)
- [ ] Every value in the stylesheets is a token
- [ ] No new colours, sizes, spacings, or durations invented beyond Task 2's declared set
- [ ] Only compositable properties animated
- [ ] Reduced motion covers every new animation
- [ ] Tests follow TEST_STRUCTURE
- [ ] `docs/04-design-assets.md` §8 status column updated (tokens/fonts → implemented)
- [ ] No scope additions beyond layout, style, and animation
- [ ] Self-contained — no questions needed during implementation

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Both card faces in DOM regress screen-reader/keyboard behaviour | **High** | **High** | `inert` on the hidden face is mandatory, not optional. `backface-visibility` hides pixels only. Explicit manual SR + Tab check in Task 5's VALIDATE. |
| Card-flip restructure breaks the offline E2E `.card--flipped` assertion | Medium | High | Keep `.card` as the outer element with the same class toggle; rotate `.card-inner`. Run `test:e2e:offline` immediately after Task 5. |
| CSS split drops a rule during the move | Medium | Medium | Task 1 is a pure move — any visual change is a dropped rule. Orphan-class check + screen-by-screen visual pass before Task 3. |
| Token snapping shifts spacing visibly (13→14px, 8→12px radius) | High | Low | Intended. Note it in the commit so it is not mistaken for a regression. |
| 3px ring stroke fails ≥3:1 against the neutral track | Medium | Medium | Measure in Task 8. Darken the **track** to `--color-neutral-2`; never thicken the spec'd stroke. |
| Hand-drawn SVG speaker icon looks off next to the existing settings icon | Medium | Low | Mirror the existing icon's stroke width and optical size; both use `currentColor` and a token size. |
| Wrong font subset omits `ẞ` | Medium | Medium | Take `latin-ext`; render `ä ö ü ß ẞ Ä Ö Ü` as an explicit check. |
| Self-hosted fonts miss the precache manifest | Medium | High | Verify the generated SW manifest lists `*.woff2`, not just that the files exist in `dist/`. |
| Infinite summary-ripple animation costs battery | Low | Low | Scoped to `.summary-ripple`; unmounts with the screen. Transform/opacity only — compositor-driven. |

## Notes

**Why this is corrective work, not a restyle.** Phases 1–3 shipped features by appending to one stylesheet. Each append was locally correct; the aggregate was not. The duplicate `.card` block (D2) is the clearest case — the flip transition was written twice, the later copy won, and its `rotateY(0deg)` meant the flip never ran. Nobody noticed because the content still swapped. The layered split in Task 1 exists to make that class of bug visible, which is why it is justified rather than cosmetic reorganisation.

**Scope discipline.** The request was layout, style, and animation/interactivity. Everything here stays inside that boundary. Font self-hosting (Task 9) touches `index.html` and `vite.config.ts` and is the one arguable edge — it is included because it is a *typography* defect: on a cold offline start the app currently renders in Georgia, so the Zen serif identity is absent exactly when Phase 3's offline guarantee is doing its job. It is also a documented spec violation (§2, "Self-hosted only").

**How the UI/UX skill shaped this.** The `ui-ux-pro-max` rule set was applied to the audit and produced three defects the code-only pass missed: D12 (emoji as structural icons), D13 (the `z-index: 100` collision that can bury the skip link), and D14 (the `transition: width` trap that the obvious Dashboard fix would have walked straight into). It also added `tabular-nums` on the stats and timer, `overflow-wrap: anywhere` for long compounds, and the systematic 480/768/1024 breakpoint set. Where the skill and the project docs conflict — `spring-physics`, dark mode — the project docs win, and both overrides are recorded in NOT Building.

**Zero new dependencies.** `AGENTS.MD:81` forbids animation libraries, and D12 is fixed with one hand-written SVG rather than an icon package. Task 8 *removes* code (the rAF loop) rather than adding any.

**Two constraints that will feel like missing features.** No dark mode and no new colours. Both are explicit: `docs/04-design-assets.md` §1.1 says *"do not invent one"*, `AGENTS.MD:81` says *"don't invent new colors or springs."* A Modern Zen surface here means restraint within the existing warm-paper palette, not a broader one.

**Suggested commit sequence** — one per task keeps every step reviewable and independently revertable. Task 1 should be its own commit with no other changes, so the pure-move diff can be verified as a move.
