# 02 — Environment & Tooling

Derived from and subordinate to PLAN.md — on conflict, PLAN.md wins. Status date: 2026-09-15.

Owner profile behind every choice below: **personal use, single user, macOS**, deploy = `docker compose up` on the owner's machine (owner decision 2026-09-15, recorded in PLAN.md §6). No backend, no external services, no CI pipeline required for MVP. Sibling docs: [01-technical-specification.md](./01-technical-specification.md) · [03-testing-strategy.md](./03-testing-strategy.md) · [04-design-assets.md](./04-design-assets.md) · [05-constraints-and-nfrs.md](./05-constraints-and-nfrs.md) · [06-examples-and-edge-cases.md](./06-examples-and-edge-cases.md) · [07-task-breakdown.md](./07-task-breakdown.md).

---

## 1. Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Node.js | Active LTS, major pinned (e.g. `22`) | Pinned three ways: `.nvmrc`, `.node-version` (same content, for mise/asdf/fnm users), and `package.json` `engines`: `"node": ">=22 <23"`, `"npm": ">=10"` |
| npm | 10+ (bundled with Node) | Lockfile (`package-lock.json`) is committed; installs use `npm ci`, never `npm install` in automation |
| Docker Desktop for Mac | 4.x, Compose v2 | Verify with `docker compose version` (space, not hyphen). The only deployment mechanism — see §7 |
| Git | 2.x | Hooks managed per §5 |
| Python | 3.12 (Phase 0 only) | Via Homebrew; used solely by the content pipeline — see §6 |
| VS Code | current | Recommended editor; settings/extensions in §9 |

**Dev browser targets** (PLAN.md §2 exit criterion): current **Chrome, Safari, Firefox**. Safari is first-class here — it is the owner's PWA install target on macOS and has the strictest media/storage behavior (see §10).

## 2. Repository layout plan

No `package.json` exists yet. Scaffolding (Phase 0/1 boundary) **must** produce this tree:

```
.
├── AGENTS.MD · PLAN.md · top-1000-german-words.md
├── docs/                        # this document + siblings
├── Dockerfile                   # multi-stage: vite build → nginx (§7)
├── docker-compose.yml
├── .dockerignore                # node_modules, dist, .git, scripts/.venv, scripts/curation
├── .nvmrc · .node-version
├── package.json · package-lock.json
├── tsconfig.json                # strict, §5
├── vite.config.ts               # incl. vite-plugin-pwa config (manifest lives here, not in public/)
├── playwright.config.ts
├── eslint.config.js             # flat config, §5
├── .prettierrc.json
├── index.html                   # Vite entry
├── public/
│   ├── words.json               # seed deck, versioned via dataVersion (Phase 0 output, §6)
│   ├── audio/                   # ~2,000 generated .ogg (Phase 0 output, §6)
│   │   ├── words/<id>.ogg
│   │   └── examples/<id>.ogg
│   └── icons/                   # PWA icons + OpenMoji assets with attribution (Phase 2/3)
├── scripts/                     # Phase 0 content pipeline (§6)
│   ├── validate-words.mjs       # schema + quality gates
│   ├── generate-audio.sh        # venv + Piper wrapper
│   ├── voices/                  # Piper voice models — GITIGNORED (large binaries)
│   └── curation/                # Leipzig / SUBTLEX-DE / Goethe QA data — GITIGNORED, never shipped
├── src/
│   ├── main.tsx · App.tsx · vite-env.d.ts
│   ├── db/                      # Dexie schema, words.json seed import (idempotent, dataVersion-gated)
│   ├── scheduler/               # ts-fsrs integration — no custom scheduling code
│   ├── session/                 # session composition (due-first, interleaved new blocks)
│   ├── screens/ · components/
│   ├── store/                   # Zustand UI/session state
│   └── styles/                  # design tokens from PLAN.md §4
├── tests/                       # Vitest + Testing Library
└── e2e/                         # Playwright, incl. the offline gate
```

Licensing hygiene is structural: `scripts/curation/` holds non-redistributable QA data (Leipzig Corpora, SUBTLEX-DE, Goethe Wortlisten — PLAN.md §7). It is gitignored from day one so a `git add -A` can never commit it and `docker build` can never ship it.

## 3. Dependencies plan

License posture (PLAN.md §7): runtime/build dependencies must be **MIT / BSD / Apache-2.0 / ISC / 0BSD** only. GPL/LGPL or any CC/NC-licensed package is a blocker — stop and flag. Verify at scaffold time and on every dependency addition:

```bash
npx license-checker --onlyAllow 'MIT;Apache-2.0;BSD-2-Clause;BSD-3-Clause;ISC;0BSD' --production
```

**Runtime dependencies:**

| Package | Purpose | License (verify at scaffold) |
|---|---|---|
| `react`, `react-dom` | UI framework, React 18 | MIT |
| `react-router-dom` | Routing | MIT |
| `dexie` | IndexedDB — local source of truth | Apache-2.0 |
| `dexie-react-hooks` | Live queries → React (words/cards/sessions) | Apache-2.0 |
| `ts-fsrs` | FSRS scheduler — never SM-2 or hand-rolled | MIT |
| `zustand` | UI/session state | MIT |
| `workbox-window` | SW registration/update hooks (only if a custom update prompt is wanted; registration can also be auto-injected) | MIT |

**Build / dev dependencies:**

| Package | Purpose | License |
|---|---|---|
| `typescript` | Strict type-checking | Apache-2.0 |
| `vite`, `@vitejs/plugin-react` | Dev server + build | MIT |
| `vite-plugin-pwa` | Workbox-powered SW + manifest generation | MIT |
| `vitest`, `jsdom` | Unit/component test runner + DOM | MIT |
| `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event` | Component testing | MIT |
| `@playwright/test` | Offline E2E (PLAN.md §3 gate) | Apache-2.0 |
| `eslint`, `typescript-eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-jsx-a11y` | Linting incl. a11y rules (WCAG 2.2 AA support) | MIT / BSD-2-Clause |
| `prettier` | Formatting | MIT |
| `husky`, `lint-staged` | Pre-commit hook (§5) | MIT |
| `ajv` | JSON-schema validation for `words.json` (`validate:content`) | MIT |
| `@types/react`, `@types/react-dom` | Types | MIT |

**Piper TTS is a Phase 0 build-time tool, not an app dependency.** It lives in `scripts/.venv` (Python pip), generates the `.ogg` assets once, and never appears in `package.json` or the Docker image. Use the original MIT-licensed Piper; check the chosen German voice model's license during Phase 0 and record it in the attribution page (PLAN.md §7).

## 4. npm scripts contract

These ten scripts are the whole interface to the project — automation and docs reference them, never ad-hoc commands (AGENTS.MD):

| Script | Command intent |
|---|---|
| `dev` | `vite` — HMR dev server (default :5173) |
| `build` | `tsc -b && vite build` → `dist/` (type-check is part of every build) |
| `preview` | `vite preview` — serve `dist/` locally; sanity check before `docker compose up --build` |
| `test` | `vitest run` — unit/component suite, single pass |
| `test:watch` | `vitest` — watch mode |
| `test:e2e` | `playwright test` — E2E incl. the offline gate (details: [03-testing-strategy.md](./03-testing-strategy.md)) |
| `lint` | `eslint .` — zero-warning policy |
| `format` | `prettier --write .` |
| `validate:content` | `node scripts/validate-words.mjs` — ajv schema check + PLAN.md §7 quality gates against `public/words.json` (every noun has gender+plural; example contains the lemma; audio file present for every entry) |
| `generate:audio` | `bash scripts/generate-audio.sh` — activates `scripts/.venv`, runs Piper over `words.json`, writes `public/audio/**` (idempotent: skips files that already exist unless `--force`) |

## 5. Code quality tooling

**TypeScript strict** (`tsconfig.json` — key flags, not exhaustive):

```jsonc
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,   // SRS card lookups must be null-safe
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "verbatimModuleSyntax": true,
    "skipLibCheck": true
  }
}
```

No `any` without an inline comment justifying it (AGENTS.MD); enforce via `@typescript-eslint/no-explicit-any` at `error`.

**ESLint (flat config) + Prettier:**

```js
// eslint.config.js — intent sketch
export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  reactHooks.configs['recommended-latest'],
  jsxA11y.flatConfigs.recommended,   // aria labels, keyboard support — backs WCAG 2.2 AA
  prettier,                          // eslint-config-prettier last: disables stylistic overlap
);
```

Prettier owns all formatting; ESLint owns code quality + a11y. They never fight (config-prettier last).

**Pre-commit hook — lightest reproducible option: `husky` + `lint-staged`.** A bare `.git/hooks/` script isn't committed and silently rots; husky v9 is ~zero-config (`.husky/pre-commit` + `"prepare": "husky"` in `package.json`) and lint-staged runs only on staged files:

```jsonc
// package.json
"lint-staged": { "*.{ts,tsx}": ["eslint --max-warnings 0", "prettier --write"], "*.json": ["prettier --write"] }
```

## 6. Phase 0 content pipeline tooling

Runs **outside** the Node app; only its *outputs* enter the repo (`public/words.json`, `public/audio/**`).

- **Python 3.12 venv** (pinned — Piper publishes macOS arm64 wheels for 3.10–3.12; 3.13 currently requires source builds):
  ```bash
  brew install python@3.12
  python3.12 -m venv scripts/.venv
  scripts/.venv/bin/pip install piper-tts
  ```
- **Voice model:** one German voice (`de_DE-*-high.onnx` + `.onnx.json`) downloaded into `scripts/voices/` (gitignored — large binaries; document the exact URL/checksum in `scripts/README.md`). License of the voice recorded for the attribution page.
- **Enrichment inputs:** the knowledge source `top-1000-german-words.md` is committed (owner decision 2026-09-15 — parsed deterministically into `words.json`, **no LLM in the pipeline**); Leipzig/SUBTLEX-DE/Goethe QA files and the hermitdave fallback spine go to gitignored `scripts/curation/` and are **never committed or shipped** (PLAN.md §7).
- **Validation:** `npm run validate:content` is the gate — zero schema violations before Phase 0 exit (all §7 quality gates, incl. audio-present-per-entry).
- **Outputs:** `public/words.json` (~400KB, 1,000 entries, top-level `dataVersion`) and `public/audio/words/<id>.ogg` + `public/audio/examples/<id>.ogg` (~30–50MB total). Paths must match the `audio_word` / `audio_example` fields in `words.json` — the validator enforces this.
- Audio files are committed to the repo (they are build *inputs* to the Docker image, not build artifacts of it — regeneration requires Python, so the owner machine only needs Docker to deploy).

## 7. Docker & deployment

The entire deploy story is `docker compose up` (owner decision 2026-09-15, PLAN.md §6). One image, no backend container, no external services.

**`Dockerfile`** (multi-stage):

```dockerfile
# ---- build stage ----
FROM node:lts-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./   # before source: layer-caches npm ci (§10)
RUN npm ci
COPY . .
RUN npm run build                        # tsc + vite build → /app/dist (incl. words.json, audio/, generated SW)

# ---- serve stage ----
FROM nginx:alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
```

**`docker/nginx.conf`** (cache headers are load-bearing — the service worker depends on them):

```nginx
server {
  listen 80;
  root /usr/share/nginx/html;
  index index.html;
  gzip on;
  gzip_types text/css application/javascript application/json image/svg+xml;

  # Entry, manifest, SW: never cache — update detection reads these every load
  location = /index.html          { add_header Cache-Control "no-cache"; }
  location = /manifest.webmanifest { add_header Cache-Control "no-cache"; }
  location = /sw.js               { add_header Cache-Control "no-cache"; }

  # Vite-hashed assets: content-addressed, safe to cache forever
  location /assets/ { add_header Cache-Control "public, max-age=31536000, immutable"; }

  # Audio: named by lemma, not hashed — moderate cache; SW precache owns freshness from Phase 3
  location /audio/ { add_header Cache-Control "public, max-age=604800"; }

  location / { try_files $uri $uri/ /index.html; }   # SPA fallback for client-side routes
}
```

**`docker-compose.yml`** (Compose v2 — no `version:` key):

```yaml
services:
  app:
    build: .
    ports:
      - "8080:80"
    restart: unless-stopped
```

**Owner commands:**

| Task | Command |
|---|---|
| First run / redeploy | `docker compose up -d --build` |
| Update to latest | `git pull && docker compose up -d --build` |
| Stop / start | `docker compose stop` / `docker compose start` |
| Logs | `docker compose logs -f` |

**Data persistence:** all learning state lives in the browser's IndexedDB (`words`, `cards`, `reviewLogs`, `sessions`, `settings`). **Redeploys never touch user data** — the container holds only static files. Rebuilding after `git pull` ships a new `words.json` (`dataVersion` bump triggers an idempotent re-import that preserves all SRS state, PLAN.md §6) and new audio.

**SW update flow behind nginx:** because `index.html`/`sw.js` are served `no-cache`, the browser detects the new service worker on next load; vite-plugin-pwa's registration activates it (auto-update or prompted — decision documented in [05-constraints-and-nfrs.md](./05-constraints-and-nfrs.md)). The hashed `/assets/` strategy guarantees old and new chunks never mix. Do not add `immutable` to anything that isn't content-hashed.

## 8. Environment variables & config

- **Runtime: none.** Static app, no backend, no secrets — by design there is nothing to configure at run time.
- **Build-time:** none required for MVP. If one ever appears, it must be a non-secret `VITE_*` var; secrets are architecturally impossible (there is no server to keep them on).
- **Content versioning:** `dataVersion` is a field **inside** `public/words.json`, not an env var — bump it on every content change.
- **User settings:** IndexedDB `settings` table (daily goal, notifications opt-in, reduced motion, audio voice) — never files, never env.
- `.gitignore` covers `.env*` anyway, so an accidental secret can't be committed.

## 9. VS Code setup

Commit `.vscode/extensions.json` recommendations and `.vscode/settings.json` so the environment is reproducible:

```jsonc
// .vscode/extensions.json
{ "recommendations": ["dbaeumer.vscode-eslint", "esbenp.prettier-vscode", "ms-playwright.playwright"] }

// .vscode/settings.json — expectations
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": { "source.fixAll.eslint": "explicit" },
  "typescript.tsdk": "node_modules/typescript/lib"
}
```

The Playwright extension gives per-test run buttons in `e2e/`; ESLint surfaces jsx-a11y violations inline (accessibility is a hard constraint, not a lint preference).

## 10. Troubleshooting quick reference

| Symptom | Likely cause / fix |
|---|---|
| App looks stale after `docker compose up -d --build` | SW serving old shell. Check `index.html`/`sw.js` return `Cache-Control: no-cache` (§7); DevTools → Application → Service Workers → Update; hard-refresh once. Never "fix" by lengthening entry-file caching |
| `docker build` re-runs `npm ci` on every code change | Layer order broken — `package.json`/`package-lock.json` must be `COPY`'d before the rest of the source (§7); verify `.dockerignore` excludes `node_modules`, `dist`, `.git`, `scripts/.venv`, `scripts/curation` |
| Port conflict on start | Something else owns 8080 — change only the host side: `"8081:80"` |
| Audio silent on Safari | Safari historically lacks `.ogg` Vorbis support; the Web Speech API (de-DE) fallback must engage (PLAN.md §6). Verify a German voice under System Settings → Spoken Content. A codec change (e.g. dual-encode) is a PLAN-level decision — flag, don't improvise |
| IndexedDB cleared / quota errors | Browser storage pressure (Safari evicts most aggressively). Phase 3 should request `navigator.storage.persist()`; diagnose with `navigator.storage.estimate()`. Details: [05-constraints-and-nfrs.md](./05-constraints-and-nfrs.md) |
| `playwright test` fails: "browser not found" | First run needs `npx playwright install` (macOS: no `--with-deps`, that's Linux-only). Browsers live in `~/Library/Caches/ms-playwright` |
| Git hook not running after clone | `npm install` must run once so the `prepare` script installs husky; verify `git config core.hooksPath` → `.husky` |
| `pip install piper-tts` fails on macOS | Python 3.13+ has no prebuilt wheel — use the pinned 3.12 venv (§6) |
