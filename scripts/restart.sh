#!/usr/bin/env bash
# Restarts the dashboard backend. Usage: bash scripts/restart.sh
set -Eeuo pipefail
cd "$(dirname "$(dirname "$0")")"
echo "==>] Restarting dashboard ..."
bash stop.sh
sleep 0.5
bash start.sh
