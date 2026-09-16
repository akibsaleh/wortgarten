# Implementation Report: Modern Zen UI/UX Refactor

## Summary

Refactored Wortgarten's presentation layer — layout, style, and animation/interactivity only. The 978-line append-only `base.css` became a five-file layered set; two screens that rendered with **zero CSS** are now styled; the card flip, which had never run, now actually rotates; fonts are self-hosted so the serif survives a cold offline boot. No business logic, data-layer, or scheduling code was touched. **Zero new dependencies.**

All 14 planned defects (D1–D14) are fixed, plus 3 more found during implementation. Verified in a real browser: 16/16 behavioural checks, 113/113 unit tests, 3/3 offline E2E.

## Assessment vs Reality

| Metric | Predicted (Plan) | Actual |
|---|---|---|
| Complexity | Large | Large — accurate |
| Confidence | 8/10 single-pass | Justified; the one flagged risk (card-face a11y) was the only thing needing careful handling |
| Files Changed | 17 | 22 (14 modified, 8 created, 1 deleted) |
| Defects fixed | 14 (D1–D14) | 17 (D1–D14 + D15–D17) |
| Tasks | 12 | 12 |

## Tasks Completed

| # | Task | Status | Notes |
|---|---|---|---|
| 1 | Split `base.css` into layered set | Complete | Verified as a *pure move*: zero selectors lost, only dropped declaration was already-dead code |
| 2 | Extend token set | Complete | `--motion-ambient`, `--ring-stroke`, `--icon-sm/md`, `--touch-min`, `--z-*` scale |
| 3 | Style the 18 orphan classes | Complete | Dashboard + WelcomeBack now render; orphan count 18 → 0 |
| 4 | Replace inline styles with classes | Complete | 33 → 4 (all 4 genuinely dynamic). Found D15 en route |
| 5 | Make the card flip real | Complete | Verified in-browser: real `matrix3d` rotation mid-transition |
| 6 | Vector icon replaces emoji controls | Complete | New `SpeakerIcon.tsx`; 3 control sites |
| 7 | Summary + pronounce ripples | Complete | 2.4s ambient loop confirmed; reduced motion gives a static frame |
| 8 | Fix progress rings | Complete | 3px stroke, CSS-driven fill, rAF loop deleted. Deviated — see below |
| 9 | Self-host fonts | Complete | 4 woff2 in SW precache. One known gap — see below |
| 10 | Responsive layout + z-index scale | Complete | Found D16, D17 during browser verification |
| 11 | Consistent screen-entry motion | Complete | Folded into Task 7's `motion.css` write |
| 12 | Regression test + verification | Complete | 26 new tests |

## Validation Results

| Level | Status | Notes |
|---|---|---|
| Static Analysis (`tsc -b`) | Pass | Zero type errors |
| Lint (`npm run lint`) | **Not run — pre-existing breakage** | See Issues |
| Unit Tests | Pass | 113/113 (87 existing **unmodified** + 26 new) |
| Build | Pass | `vite build` clean |
| Integration (offline E2E) | Pass | 3/3 — includes the `.card`/`.card--flipped` contract |
| Browser verification | Pass | 16/16 automated checks in system Chrome |

### Browser-verified behaviour

| Check | Result |
|---|---|
| No CDN font requests | PASS |
| Self-hosted fonts loaded | PASS — `Inter/400 600`, `Source Serif 4/400 600` |
| Dashboard rings in one row | PASS at 320 / 480 / 768px |
| CEFR band bars visible | PASS — 8px track + fill (were 0px) |
| Ring stroke 3px (spec §7.3) | PASS |
| Card flip has perspective + preserve-3d | PASS — `perspective: 1000px`, `preserve-3d` |
| Flip genuinely animates | PASS — mid-transition `matrix3d(0.64, 0, -0.77, …)` |
| Flip lands at 180° | PASS — `matrix3d(-1, 0, 0, …)` |
| Hidden face `inert` before flip | PASS — front:false back:true |
| `inert` swaps after flip | PASS — front:true back:false |
| No horizontal scroll at 320px | PASS |
| Reduced motion → static ripple frame | PASS — `animation: none`, 1 of 3 rings visible |
| Ripple loops on the ambient token | PASS — `rippleExpand`, `2.4s`, `infinite` |

## Defects Fixed

### Planned (D1–D14)

| # | Defect | Resolution |
|---|---|---|
| D1 | 18 classNames with no CSS — Dashboard + WelcomeBack unstyled | All styled; orphan check returns empty |
| D2 | `.card` declared twice, later block silently winning | Merged into one block |
| D3 | **Card flip was a no-op** (`rotateY(0deg)`, no `perspective`, only one face in DOM) | Two persistent faces in `.card-inner`, `perspective` on the outer element, real 280ms `rotateY(180deg)` |
| D4 | `.summary-ripple` a static circle | Three concentric rings, 2.4s ambient loop |
| D5 | Pronunciation ripple missing | `.btn-pronounce::after` radial ripple on `:active` |
| D6 | Ring stroke 8px vs spec 3px | Default now 3px |
| D7 | Ring animated via rAF + setState per frame | Deleted; CSS `from`-keyframe. ~15 renders/ring → 1 |
| D8 | Fonts from Google CDN in an offline-first PWA | Self-hosted woff2, CDN link removed |
| D9 | SW didn't cache font origins | `woff2` added to `globPatterns`; all 4 in the precache manifest |
| D10 | One media query in 978 lines | Breakpoints at 480 / 768 / 1024 + fluid `clamp()` gutters |
| D11 | 33 inline styles with off-scale px | 4 remain, all dynamic; literals snapped to the token grid |
| D12 | Emoji as structural control icons | `SpeakerIcon` inline SVG at 3 sites |
| D13 | `z-index: 100` collision (skip-nav vs install banner) | `--z-*` scale; zero raw z-index values remain |
| D14 | Would have animated `width` on the band bars | `transform: scaleX()` instead |

### Found during implementation (D15–D17)

| # | Defect | Evidence | Resolution |
|---|---|---|---|
| **D15** | **`--color-primary` is not a defined token** — the "Daily reminder" toggle had **no fill when enabled**, visually identical to "off" | `Settings.tsx:320` referenced `var(--color-primary)`; grep showed it defined nowhere | Rebuilt as `.settings-toggle--on` using `--color-accent` |
| **D16** | Dashboard rings wrapped 2+1 below 480px | Browser check: `tops=[87,87,252]` at 320px | Added `viewBox` to the SVG so CSS can scale it; rings hold one row at 320px |
| **D17** | Onboarding goal picker overflowed the viewport by 2px at 320px | `scrollWidth 322 > clientWidth 320`; `.onboarding-goals` measured 324px | `flex-wrap: wrap` + `max-width: 100%`; overflow now 0 |

Also corrected in passing: a raw `rgba()` box-shadow on the install banner (spec §1.3 wants soft borders, not shadows) and `transition: top` on `.skip-nav` (a layout property, violating the compositor rule this refactor enforces elsewhere).

## Files Changed

| File | Action | Lines |
|---|---|---|
| `src/styles/base.css` | DELETED | −978 |
| `src/styles/index.css` | CREATED | +11 |
| `src/styles/reset.css` | CREATED | +117 |
| `src/styles/components.css` | CREATED | +524 |
| `src/styles/screens.css` | CREATED | +818 |
| `src/styles/motion.css` | CREATED | +146 |
| `src/styles/tokens.css` | UPDATED | +32 / −9 |
| `src/components/SpeakerIcon.tsx` | CREATED | +29 |
| `src/components/ProgressRing.tsx` | UPDATED | +20 / −41 |
| `src/screens/Session.tsx` | UPDATED | +38 / −29 |
| `src/screens/Settings.tsx` | UPDATED | +19 / −55 |
| `src/screens/Dashboard.tsx` | UPDATED | +5 / −19 |
| `src/screens/Onboarding.tsx` | UPDATED | +8 / −8 |
| `src/screens/Summary.tsx` | UPDATED | +5 / −1 |
| `src/screens/Home.tsx` | UPDATED | +2 / −3 |
| `src/screens/WelcomeBack.tsx` | UPDATED | +2 / −2 |
| `src/App.tsx` | UPDATED | +2 / −2 |
| `src/main.tsx` | UPDATED | +1 / −1 |
| `src/assets/fonts/*.woff2` | CREATED | 4 files, 227 KB |
| `src/assets/fonts/OFL.txt` | CREATED | SIL OFL 1.1 |
| `index.html` | UPDATED | +2 / −7 |
| `vite.config.ts` | UPDATED | +1 / −1 |
| `tests/ui-refactor.test.ts` | CREATED | +281 |
| `.gitignore` | UPDATED | +2 (Playwright artifacts) |

## Deviations from Plan

1. **Font files: 4 variable woff2, not 4 static weights.** The plan assumed `inter-400.woff2` / `inter-600.woff2` per family. Google serves *variable* fonts — the 400 and 600 files are byte-identical (verified by md5). Shipped one file per family per subset with `font-weight: 400 600`, which is the same coverage in half the files.

2. **Ring fill uses a `from`-only keyframe, not a transition.** The plan specified `transition: stroke-dashoffset`. A transition only fires on a *change*, and the ring mounts at its final value — so it would never animate. A `from`-only keyframe runs to each element's own computed offset, giving grow-from-empty with no JS state.

3. **`inert` set via ref effect, not a JSX prop.** The plan wrote `inert={flipped ? undefined : true}`. React 18.3 does not support `inert` as a JSX prop (React 19 added it). Set imperatively in a `useEffect` keyed on `flipped`. Same guarantee, verified in-browser.

4. **Inline-style budget is 4, not 3.** The plan counted gender colour ×2 and band width ×1. The rewritten `ProgressRing` needs a 4th to pass each ring's circumference to CSS — also a genuinely dynamic per-instance value. Test asserts exactly 4.

5. **Screen-entry motion (Task 11) landed inside Task 7's write** rather than as a separate step. Same result.

## Issues Encountered

### `npm run lint` is a pre-existing no-op — NOT run

`eslint.config.js` declares no `files` pattern for `.ts`/`.tsx`, and no TypeScript parser is installed (`@typescript-eslint/*` is absent from `package.json`). ESLint 9 therefore ignores every source file:

```
You are linting "src/", but all of the files matching the glob pattern "src/" are ignored.
```

Confirmed unchanged from `HEAD` — this predates the refactor. Fixing it requires adding a dependency, which this plan explicitly forbade and which is outside a layout/style/animation scope. **Static analysis was covered by `tsc -b` instead** (zero errors). Flagging for a separate decision.

### Resolved: capital eszett ẞ (U+1E9E) — re-sourced from upstream

Originally reported as a known gap: Google's re-served build of both families silently omits ẞ (`&text=ẞ` returned no font file at all), even though `docs/04-design-assets.md` §2 requires it. Investigated further at the user's request and **closed** rather than left open:

1. Installed `fonttools` + `brotli` in a scratch venv and pulled the actual upstream releases — `rsms/inter` v4.1 (`InterVariable.ttf`) and `adobe-fonts/source-serif` 4.005R (official variable WOFF2). Confirmed both genuinely contain `uni1E9E` with a real 2-contour outline (not `.notdef`).
2. Diffed table sizes against Google's files to find why re-subsetting upstream naively produced ~2.5× larger files: Google's build pins the `opsz` (optical size) axis to a single value and drops it, keeping only `wght` variable. Replicated that with `fonttools varLib.instancer` (Inter `opsz=14`, Source Serif 4 `opsz=20` — each family's own default) before subsetting, which matched Google's file sizes almost exactly (213 KB total vs. Google's 227 KB, slightly smaller).
3. Re-subsetted both families to the identical `latin` / `latin-ext` unicode-range split already in use, output as woff2, and swapped them into `src/assets/fonts/` under the same four filenames — no CSS or `@font-face` changes needed.
4. Verified in a real browser against the live app (not `page.setContent()`, which discards the linked stylesheet and gave a false negative on the first attempt): `document.fonts.check("90px 'Source Serif 4'", 'ẞ')` → `true`, and a screenshot shows the glyph rendering correctly, not as tofu.

No visual regression: `wght` stays variable at 400–600 as before, `opsz` was already pinned in the Google build (this just makes that pin explicit), and the unicode-range split is unchanged. `src/assets/fonts/OFL.txt` now credits the upstream repos directly. Full detail in `src/styles/reset.css`'s font-face comment and the `sources fonts from upstream releases` test.

## Tests Written

| Test File | Tests | Coverage |
|---|---|---|
| `tests/ui-refactor.test.ts` | 26 | Stylesheet structure (5), token discipline (4), class coverage (4), motion contracts (5), accessibility contracts (4), offline typography (4) |

Guards include: `.card` declared exactly once (D2), no colour literals outside `tokens.css`, every duration from a `--motion-*` token, no transitions on layout properties (D14), no raw z-index (D13), zero orphan classNames (D1), every keyframe referenced and declared in `motion.css`, both reduced-motion guards intact, spec-mandated reduced-motion end states for §7.5/§7.2, real flip mechanics with no `rotateY(0deg)` (D3), `inert` on the hidden face, no emoji on controls (D12), all E2E selectors preserved, 44px touch targets, no CDN font request (D8), woff2 precached (D9).

All 87 pre-existing tests pass **unmodified**.

## Out of Scope — Confirmed Not Built

No dark mode, no new colours/sizes/spacings/durations beyond the declared token additions, no animation library, no icon library, no spring easing, no CSS-in-JS migration, no confetti, no copy changes, no logic changes, no renamed E2E selectors, no new screens or routes.

## Next Steps

- [ ] Review the diff (`/code-review`)
- [ ] Decide on `eslint.config.js` — currently lints nothing
- [ ] Manual pass: screen reader on the Session card; 200% zoom
- [ ] Commit / PR
