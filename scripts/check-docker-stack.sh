#!/usr/bin/env bash
# 001-T11.5 / @001-S13, @001-S14: brings up the Docker Compose stack, confirms the app is
# reachable and its logs are readable, then runs the E2E suite against the containerized app.
set -euo pipefail

COMPOSE="docker compose"
TIMEOUT_SECONDS=90
URL="http://localhost:3000"

cleanup() {
  echo "check-docker-stack: tearing down..."
  $COMPOSE down --remove-orphans >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "check-docker-stack: starting app service..."
$COMPOSE up -d --build app

echo "check-docker-stack: polling $URL for HTTP 200 (timeout ${TIMEOUT_SECONDS}s)..."
start_time=$(date +%s)
until curl -s -o /dev/null -w "%{http_code}" "$URL" | grep -q 200; do
  now=$(date +%s)
  if [ $((now - start_time)) -ge "$TIMEOUT_SECONDS" ]; then
    echo "check-docker-stack: FAILED — $URL did not return HTTP 200 within ${TIMEOUT_SECONDS}s"
    echo "--- docker compose logs app ---"
    $COMPOSE logs app
    exit 1
  fi
  sleep 2
done
echo "check-docker-stack: app responded with HTTP 200."

echo "check-docker-stack: checking app logs for the Next.js ready line..."
if ! $COMPOSE logs app 2>&1 | grep -q "Ready"; then
  echo "check-docker-stack: FAILED — no Next.js ready line found in 'docker compose logs app'"
  exit 1
fi
echo "check-docker-stack: logs are readable and contain the ready line (@001-S13 satisfied)."

echo "check-docker-stack: running the E2E suite against the containerized app..."
if $COMPOSE run --rm test; then
  echo "check-docker-stack: E2E suite passed against the containerized app (@001-S14 satisfied)."
else
  status=$?
  echo "check-docker-stack: E2E suite FAILED (exit $status) — see playwright-report/ for details."
  exit "$status"
fi

echo "check-docker-stack: PASS"
