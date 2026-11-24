#!/usr/bin/env bash
# Updates the project (git pull + reinstall + rebuild + restart).
# Usage: bash update.sh
set -Eeuo pipefail
cd "$(dirname "$0")"

echo "==>] Updating Youtube-Rumble-Termux ..."
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git pull --ff-only 2>&1 || true
else
  echo "[WARN] Not a git repository — skipping pull"
fi

bash install.sh

if [ -f .app/app.pid ] && kill -0 "$(cat .app/app.pid)" 2>/dev/null; then
  echo "==>] Restarting updated instance ..."
  bash restart.sh
fi

echo "[OK] Update complete."
