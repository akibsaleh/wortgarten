#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────
# P3-T6  Docker Deploy Smoke Test
# Builds, starts, probes, and tears down the Docker Compose stack.
# Exit code 0 = all checks passed; 1 = at least one failure.
# ──────────────────────────────────────────────────────────────────────
set -euo pipefail

PORT=3080
BASE="http://localhost:${PORT}"
PASS=0
FAIL=0
RESULTS=()

# ── helpers ──────────────────────────────────────────────────────────
pass() { PASS=$((PASS + 1)); RESULTS+=("  ✅  $1"); }
fail() { FAIL=$((FAIL + 1)); RESULTS+=("  ❌  $1 — $2"); }

check_http_ok() {
  local label="$1" url="$2"
  local code
  code=$(curl -s -o /dev/null -w '%{http_code}' "$url" 2>/dev/null) || true
  if [[ "$code" == "200" ]]; then
    pass "$label (HTTP $code)"
  else
    fail "$label" "expected HTTP 200, got $code"
  fi
}

check_body_contains() {
  local label="$1" url="$2" needle="$3"
  local body
  body=$(curl -sf "$url" 2>/dev/null) || { fail "$label" "curl failed"; return; }
  if echo "$body" | grep -qi "$needle"; then
    pass "$label (contains '$needle')"
  else
    fail "$label" "response body does not contain '$needle'"
  fi
}

check_file_served() {
  local label="$1" url="$2"
  local code
  code=$(curl -s -o /dev/null -w '%{http_code}' "$url" 2>/dev/null) || true
  if [[ "$code" == "200" ]]; then
    pass "$label (HTTP $code)"
  else
    fail "$label" "expected HTTP 200, got $code"
  fi
}

# ── banner ───────────────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║   Wortgarten — Docker Deploy Smoke Test         ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""

# ── 1. Build ─────────────────────────────────────────────────────────
echo "▶ Building Docker image …"
if docker compose build 2>&1; then
  pass "Docker build succeeded"
else
  fail "Docker build" "docker compose build exited non-zero"
  echo ""; echo "Build failed — aborting."; exit 1
fi
echo ""

# ── 2. Start ─────────────────────────────────────────────────────────
echo "▶ Starting container …"
docker compose down --remove-orphans 2>/dev/null || true
if docker compose up -d 2>&1; then
  pass "Container started"
else
  fail "Container start" "docker compose up -d exited non-zero"
  echo ""; echo "Start failed — aborting."; exit 1
fi
echo ""

# ── 3. Wait for readiness ────────────────────────────────────────────
echo "▶ Waiting for ${BASE} to respond …"
MAX_WAIT=30
ELAPSED=0
until curl -sf "$BASE" > /dev/null 2>&1; do
  sleep 1
  ELAPSED=$((ELAPSED + 1))
  if [[ $ELAPSED -ge $MAX_WAIT ]]; then
    fail "Readiness check" "no response after ${MAX_WAIT}s"
    echo ""; echo "Container not ready — aborting."
    docker compose logs --tail=30 2>&1 || true
    docker compose down 2>/dev/null || true
    exit 1
  fi
done
pass "Container ready in ~${ELAPSED}s"
echo ""

# ── 4. App shell loads (HTTP 200) ────────────────────────────────────
echo "▶ Checking app shell …"
check_http_ok "App shell loads" "$BASE"

# ── 5. HTML contains 'Wortgarten' ────────────────────────────────────
check_body_contains "HTML title contains Wortgarten" "$BASE" "Wortgarten"

# ── 6. Service worker file is served ─────────────────────────────────
echo "▶ Checking service worker …"
check_file_served "Service worker (sw.js)" "${BASE}/sw.js"

# ── 7. Audio file is accessible ──────────────────────────────────────
echo "▶ Checking audio file …"
check_file_served "Audio file (audio/words/auto.ogg)" "${BASE}/audio/words/auto.ogg"

# ── 8. Manifest is served ───────────────────────────────────────────
echo "▶ Checking PWA manifest …"
check_file_served "PWA manifest (manifest.webmanifest)" "${BASE}/manifest.webmanifest"

# ── 9. Teardown ──────────────────────────────────────────────────────
echo ""
echo "▶ Stopping container …"
docker compose down 2>&1 || true
pass "Container stopped"

# ── Report ───────────────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║                   RESULTS                       ║"
echo "╚══════════════════════════════════════════════════╝"
for r in "${RESULTS[@]}"; do echo "$r"; done
echo ""
echo "──────────────────────────────────────────────────"
echo "  Passed: ${PASS}   Failed: ${FAIL}"
echo "──────────────────────────────────────────────────"
echo ""

if [[ $FAIL -eq 0 ]]; then
  echo "🎉  All checks passed."
  exit 0
else
  echo "💥  ${FAIL} check(s) failed."
  exit 1
fi
