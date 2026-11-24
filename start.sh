#!/usr/bin/env bash
# Starts the dashboard backend on localhost. Usage: bash start.sh
set -Eeuo pipefail
cd "$(dirname "$0")"

if [ -f .env ]; then set -a; . ./.env 2>/dev/null; set +a; fi
PORT="${PORT:-3000}"

# Fail if something is already listening on the port.
if curl -sf "http://127.0.0.1:${PORT}/api/health" >/dev/null 2>&1; then
  echo "[ERROR] Port ${PORT} is already serving a dashboard instance."
  echo "Run: bash stop.sh   (or bash restart.sh)"
  exit 1
fi

mkdir -p .app logs

echo "==>] Starting backend on 127.0.0.1:${PORT} ..."
node backend/server.js > logs/backend.log 2>&1 &
echo $! > .app/app.pid

# Wait for the health endpoint (max ~10s)
for _ in $(seq 1 40); do
  if curl -sf "http://127.0.0.1:${PORT}/api/health" >/dev/null 2>&1; then
    break
  fi
  sleep 0.25
done

if curl -sf "http://127.0.0.1:${PORT}/api/health" >/dev/null 2>&1; then
  echo "[OK] Backend is running (pid $(cat .app/app.pid))"
  echo "Dashboard:  http://127.0.0.1:${PORT}"
else
  echo "[ERROR] Backend failed to start. Last log output:"
  tail -20 logs/backend.log
  exit 1
fi
