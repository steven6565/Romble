#!/usr/bin/env bash
# Shows the dashboard status: process, uptime, resources, connection.
# Usage: bash scripts/status.sh
set -Eeuo pipefail
cd "$(dirname "$(dirname "$0")")"

if [ -f .env ]; then set -a; . ./.env 2>/dev/null; set +a; fi
PORT="${PORT:-3000}"

echo "==>] Dashboard status"
if [ -f .app/app.pid ] && kill -0 "$(cat .app/app.pid)" 2>/dev/null; then
  echo "Process:  running (pid $(cat .app/app.pid))"
else
  echo "Process:  stopped"
fi

echo "Endpoint: http://127.0.0.1:${PORT}"
echo ""
curl -s --max-time 5 "http://127.0.0.1:${PORT}/api/health" | head -c 600 || true
echo ""
