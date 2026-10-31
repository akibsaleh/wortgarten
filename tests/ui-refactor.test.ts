/**
 * Modern Zen UI refactor: regression guards.
 *
 * These assert on the stylesheet and component SOURCE, read from disk.
 * jsdom does not apply stylesheets, so a computed-style assertion would
 * pass regardless of what the CSS actually says.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// ── Helpers ───────────────────────────────────────────────────────────────────

const STYLE_DIR = 'src/styles';
const SRC_DIR = 'src';

function styleFiles(): string[] {
  return readdirSync(STYLE_DIR).filter((f) => f.endsWith('.css'));
}

function css(file: string): string {
  return readFileSync(join(STYLE_DIR, file), 'utf8');
}

function allCss(): string {
  return styleFiles().map(css).join('\n');
}

function allCssCode(): string {
  return stripComments(allCss());
}

/** Strip /* ... *​/ comments so guards read code, not prose. */
function stripComments(s: string): string {
  return s.replace(/\/\*[\s\S]*?\*\//g, '');
}

function walk(dir: string, ext: string[]): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p, ext));
    else if (ext.some((x) => e.name.endsWith(x))) out.push(p);
  }
  return out;
}

function tsxSources(): string[] {
  return walk(SRC_DIR, ['.tsx', '.ts']);
}

function allTsx(): string {
  return tsxSources().map((f) => readFileSync(f, 'utf8')).join('\n');
}

/** Class names referenced from className="..." attributes. */
function usedClasses(): Set<string> {
  const out = new Set<string>();
  for (const m of allTsx().matchAll(/className="([^"]*)"/g)) {
    for (const c of m[1].split(/\s+/)) if (c) out.add(c);
  }
  // template-literal classNames: className={`card ${...}`}
  for (const m of allTsx().matchAll(/className=\{`([^`]*)`\}/g)) {
    for (const c of m[1].replace(/\$\{[^}]*\}/g, ' ').split(/\s+/)) {
      // A fragment left dangling by an interpolation (`feedback--${kind}`)
      // is not a class name in its own right.
      if (c && !c.endsWith('-')) out.add(c);
    }
  }
  return out;
}

/** Class names defined by any selector in the stylesheets. */
function definedClasses(): Set<string> {
  const out = new Set<string>();
  for (const m of stripComments(allCss()).matchAll(/\.([a-zA-Z][a-zA-Z0-9_-]*)/g)) {
    out.add(m[1]);
  }
  return out;
}

// ── Structure ─────────────────────────────────────────────────────────────────

describe('stylesheet structure', () => {
  it('base.css is gone and the layered set exists', () => {
    const files = styleFiles().sort();
    expect(files).not.toContain('base.css');
    expect(files).toEqual([
      'components.css',
      'index.css',
      'motion.css',
      'reset.css',
      'screens.css',
      'tokens.css',
    ]);
  });

  it('main.tsx imports only the manifest', () => {
    const main = readFileSync('src/main.tsx', 'utf8');
    expect(main).toContain("./styles/index.css");
    expect(main).not.toContain('base.css');
  });

  it('index.css imports every other stylesheet in cascade order', () => {
    const order = [...css('index.css').matchAll(/@import '\.\/([\w-]+)\.css'/g)].map((m) => m[1]);
    expect(order).toEqual(['tokens', 'reset', 'components', 'screens', 'motion']);
  });

  it('.card is declared exactly once (was duplicated, which killed the flip)', () => {
    const hits = [...stripComments(css('components.css')).matchAll(/^\.card\s*\{/gm)];
    expect(hits).toHaveLength(1);
  });

  it('no stylesheet still references base.css', () => {
    expect(allCssCode()).not.toContain('base.css');
  });
});

// ── Token discipline ──────────────────────────────────────────────────────────

describe('token discipline', () => {
  it('defines no colour literals outside tokens.css', () => {
    for (const f of styleFiles().filter((f) => f !== 'tokens.css')) {
      const body = stripComments(css(f));
      expect(body, `${f} has a hex colour`).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(body, `${f} has an rgb()/hsl() colour`).not.toMatch(/\b(rgb|hsl)a?\(/);
    }
  });

  it('every motion duration comes from a --motion-* token', () => {
    for (const f of styleFiles().filter((f) => f !== 'tokens.css')) {
      const body = stripComments(css(f));
      for (const m of body.matchAll(/(?:transition|animation):([^;]+);/g)) {
        const decl = m[1];
        if (decl.trim() === 'none' || decl.includes('!important')) continue;
        expect(decl, `${f}: "${decl.trim()}" hardcodes a duration`).toMatch(/var\(--motion-/);
      }
    }
  });

  it('animates only compositor-friendly properties', () => {
    const banned = /\b(width|height|top|left|right|bottom|margin|padding)\b/;
    for (const f of styleFiles()) {
      for (const m of stripComments(css(f)).matchAll(/transition:([^;]+);/g)) {
        expect(m[1], `${f}: transition on a layout property`).not.toMatch(banned);
      }
    }
  });

  it('uses the z-index scale, never a raw value', () => {
    for (const f of styleFiles().filter((f) => f !== 'tokens.css')) {
      for (const m of stripComments(css(f)).matchAll(/z-index:\s*([^;]+);/g)) {
        expect(m[1], `${f}: raw z-index "${m[1].trim()}"`).toMatch(/var\(--z-/);
      }
    }
  });
});

// ── Coverage ──────────────────────────────────────────────────────────────────

describe('class coverage', () => {
  it('has no orphan classNames (Dashboard and WelcomeBack had 18)', () => {
    const defined = definedClasses();
    const orphans = [...usedClasses()].filter((c) => !defined.has(c)).sort();
    expect(orphans).toEqual([]);
  });

  it('keeps inline styles to genuinely dynamic values only', () => {
    const hits = tsxSources().flatMap((f) => {
      const body = readFileSync(f, 'utf8');
      return [...body.matchAll(/style=\{\{/g)].map(() => f);
    });
    // gender colour x2 (Session, Onboarding), band scaleX, ring circumference
    expect(hits).toHaveLength(4);
  });

  it('every @keyframes is referenced by at least one rule', () => {
    const body = allCssCode();
    for (const m of body.matchAll(/@keyframes\s+([\w-]+)/g)) {
      const name = m[1];
      const uses = [...body.matchAll(new RegExp(`animation:[^;]*\\b${name}\\b`, 'g'))];
      expect(uses.length, `@keyframes ${name} is never used`).toBeGreaterThan(0);
    }
  });

  it('declares all keyframes in motion.css', () => {
    for (const f of styleFiles().filter((f) => f !== 'motion.css')) {
      expect(stripComments(css(f)), `${f} declares a keyframe`).not.toContain('@keyframes');
    }
  });
});

// ── Motion & accessibility contracts ──────────────────────────────────────────

describe('motion contracts', () => {
  it('keeps both reduced-motion guards', () => {
    const m = css('motion.css');
    expect(m).toContain('@media (prefers-reduced-motion: reduce)');
    expect(m).toContain('body.reduced-motion');
  });

  it('gives the summary ripple a static end state under reduced motion (spec 7.5)', () => {
    const m = css('motion.css');
    // Not merely collapsed: the loop must be cancelled outright.
    expect(m).toMatch(/prefers-reduced-motion[\s\S]*\.ripple-ring\s*\{[\s\S]*animation:\s*none/);
    expect(m).toMatch(/body\.reduced-motion \.ripple-ring[\s\S]*animation:\s*none/);
  });

  it('suppresses the press ripple entirely under reduced motion (spec 7.2)', () => {
    const m = css('motion.css');
    expect(m).toMatch(/prefers-reduced-motion[\s\S]*\.btn-pronounce::after[\s\S]*display:\s*none/);
  });

  it('implements a real card flip, not a no-op rotate', () => {
    const c = stripComments(css('components.css'));
    expect(c).toMatch(/\.card\s*\{[^}]*perspective:/);           // on the OUTER element
    expect(c).toMatch(/\.card-inner\s*\{[^}]*transform-style:\s*preserve-3d/);
    expect(c).toMatch(/\.card--flipped \.card-inner\s*\{[^}]*rotateY\(180deg\)/);
    expect(c).toMatch(/backface-visibility:\s*hidden/);
    expect(c).not.toContain('rotateY(0deg)');
  });

  it('flips using the dedicated 280ms token', () => {
    expect(stripComments(css('components.css'))).toMatch(/\.card-inner\s*\{[^}]*var\(--motion-flip\)/);
  });
});

describe('accessibility contracts', () => {
  it('marks the hidden card face inert', () => {
    const s = readFileSync('src/screens/Session.tsx', 'utf8');
    expect(s).toContain('frontFaceRef.current.inert = flipped');
    expect(s).toContain('backFaceRef.current.inert = !flipped');
  });

  it('uses a vector icon, not an emoji, on controls', () => {
    for (const f of tsxSources()) {
      const body = readFileSync(f, 'utf8');
      expect(body, `${f} uses a speaker emoji`).not.toContain('\u{1F50A}');
    }
    expect(readFileSync('src/components/SpeakerIcon.tsx', 'utf8')).toContain('aria-hidden="true"');
  });

  it('keeps every E2E selector the offline suite depends on', () => {
    const session = readFileSync('src/screens/Session.tsx', 'utf8');
    const home = readFileSync('src/screens/Home.tsx', 'utf8');
    expect(session).toContain('card--flipped');
    expect(session).toContain('id="session-answer"');
    expect(session).toContain("aria-label=\"Replay audio\"");
    expect(home).toContain('className="home"');
    expect(readFileSync('src/App.tsx', 'utf8')).toContain('main-content');
  });

  it('meets the 44px touch-target minimum on icon controls', () => {
    const c = stripComments(css('components.css'));
    for (const cls of ['.btn-pronounce', '.btn-word-detail']) {
      const block = c.match(new RegExp(`\\${cls}\\s*\\{[^}]*\\}`))?.[0] ?? '';
      expect(block, `${cls} is below the touch minimum`).toMatch(/var\(--touch-min\)/);
    }
  });
});

// ── Offline typography ────────────────────────────────────────────────────────

describe('offline typography', () => {
  it('makes no CDN font request', () => {
    const html = readFileSync('index.html', 'utf8');
    expect(html).not.toContain('fonts.googleapis.com');
    expect(html).not.toContain('fonts.gstatic.com');
  });

  it('self-hosts both families', () => {
    const r = css('reset.css');
    expect(r).toContain("font-family: 'Nunito'");
    expect(r).toContain("font-family: 'Source Serif 4'");
    expect(r).toMatch(/src: url\('\.\.\/assets\/fonts\//);
    expect(r).toContain('font-display: swap');
  });

  it('ships both the latin and latin-ext subsets', () => {
    // latin carries ä ö ü ß; latin-ext carries ẞ (U+1E9E), required by
    // docs/04-design-assets.md §2.
    const ranges = [...css('reset.css').matchAll(/unicode-range:\s*([^;]+);/g)].map((m) => m[1]);
    expect(ranges.length).toBeGreaterThanOrEqual(4);
    expect(ranges.some((r) => /U\+0000-00FF/.test(r)), 'no latin range').toBe(true);
    expect(ranges.some((r) => /U\+0100-02BA/.test(r)), 'no latin-ext range').toBe(true);
  });

  it('sources fonts from upstream releases, not Google Fonts CDN', () => {
    // The ẞ (U+1E9E) gap: Google's re-served builds silently dropped it.
    // Current sources — Nunito via @fontsource/nunito (latin-ext subset
    // verified to carry U+1E9E with fontTools), Source Serif 4 via
    // adobe-fonts/source-serif 4.005R.
    const r = css('reset.css');
    expect(r).toContain('@fontsource/nunito');
    expect(r).toContain('adobe-fonts/source-serif');
    expect(r).not.toContain('KNOWN GAP');
  });

  it('precaches woff2 in the service worker', () => {
    expect(readFileSync('vite.config.ts', 'utf8')).toContain('woff2');
  });
});
