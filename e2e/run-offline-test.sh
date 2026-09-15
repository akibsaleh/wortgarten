#!/usr/bin/env bash
# P3-T3: Offline E2E gate helper script.
#
# Builds the app, starts vite preview on port 4173, runs the Playwright
# offline E2E tests, then tears down the server.
#
# Usage: bash e2e/run-offline-test.sh [optional playwright args]
set -euo pipefail

cd "$(dirname "$0")/.."

echo "── Building the app ──"
npm run build

echo ""
echo "── Starting vite preview on :4173 ──"
# Kill any existing server on port 4173
lsof -ti:4173 2>/dev/null | xargs kill 2>/dev/null || true
sleep 1
npx vite preview --port 4173 &
SERVER_PID=$!

# Give the server time to start
sleep 3

# Verify the server is up
if ! curl -s -o /dev/null http://localhost:4173/; then
  echo "ERROR: vite preview failed to start"
  kill "$SERVER_PID" 2>/dev/null || true
  exit 1
fi

echo "── Server ready (PID $SERVER_PID) ──"
echo ""

# Run the offline E2E tests (pass through any extra args)
set +e
npx playwright test e2e/offline.e2e.ts "$@"
EXIT=$?
set -e

echo ""
echo "── Shutting down preview server ──"
kill "$SERVER_PID" 2>/dev/null || true
wait "$SERVER_PID" 2>/dev/null || true

echo ""
if [ "$EXIT" -eq 0 ]; then
  echo "✅ Offline E2E gate PASSED"
else
  echo "❌ Offline E2E gate FAILED (exit $EXIT)"
fi

exit "$EXIT"
