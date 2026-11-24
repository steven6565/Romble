#!/usr/bin/env bash
# Stops the dashboard backend gracefully. Usage: bash stop.sh
set -Eeuo pipefail
cd "$(dirname "$0")"

PID_FILE=.app/app.pid
if [ -f "$PID_FILE" ]; then
  PID="$(cat "$PID_FILE" 2>/dev/null || true)"
else
  PID=""
fi

if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
  echo "==>] Stopping backend (pid $PID) ..."
  kill "$PID" 2>/dev/null || true
  # Graceful shutdown: wait up to 5s
  for _ in $(seq 1 20); do
    if ! kill -0 "$PID" 2>/dev/null; then break; fi
    sleep 0.25
  done
  # Force if still alive
  if kill -0 "$PID" 2>/dev/null; then
    echo "[WARN] Backend did not exit after SIGTERM — sending SIGKILL"
    kill -9 "$PID" 2>/dev/null || true
  fi
  echo "[OK] Backend stopped."
else
  # Fallback: kill anything listening on the port
  PORT="${PORT:-3000}"
  if command -v fuser >/dev/null 2>&1; then
    fuser -k "${PORT}/tcp" 2>/dev/null || true
  fi
  echo "[OK] No running backend found (pid file: $PID_FILE)."
fi
rm -f "$PID_FILE"
