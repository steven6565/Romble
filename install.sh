#!/usr/bin/env bash
# Termux-compatible installer for the YouTube & Rumble platform dashboard.
# Usage: bash install.sh
set -Eeuo pipefail
cd "$(dirname "$0")"

echo "==>] Installing Youtube-Rumble-Termux (Termux edition)..."

if [ -d "${PREFIX:-/nonexistent}" ]; then
  echo "[OK] Termux environment detected ($PREFIX)"
else
  echo "[WARN] Termux environment not detected — continuing on this shell anyway"
fi

ARCH="$(uname -m)"
echo "[INFO] Architecture: $ARCH"
case "$ARCH" in
  aarch64|arm64) echo "[OK] Android ARM64 — supported" ;;
  x86_64)        echo "[INFO] x86_64 — supported (slower on Termux)" ;;
  *)             echo "[WARN] $ARCH — architecture not confirmed" ;;
esac

# --- Node.js (only when missing or broken) -------------------------------
echo "==>] Checking Node.js ..."
if command -v node >/dev/null 2>&1 && node --version >/dev/null 2>&1; then
  echo "[OK] Node.js available: $(node --version)"
else
  echo "[WARN] Node.js not found or broken — installing via pkg..."
  if command -v pkg >/dev/null 2>&1; then
    pkg install -y nodejs 2>/dev/null || pkg install -y nodejs-ltt 2>/dev/null || true
  fi
  if command -v node >/dev/null 2>&1 && node --version >/dev/null 2>&1; then
    echo "[OK] Node.js now available: $(node --version)"
  else
    echo "[ERROR] Node.js is still not usable — try: pkg install nodejs-ltt"
    exit 1
  fi
fi

# --- system packages (best effort) ---------------------------------------
if command -v pkg >/dev/null 2>&1; then
  pkg update -y 2>/dev/null || true
  pkg install -y git curl jq 2>/dev/null || true
  pkg install -y termux-api 2>/dev/null || true
else
  echo "[SKIP] pkg not found — assuming Node/npm/curl/git are installed"
fi

# --- backend dependencies -----------------------------------------------
echo "==>] Installing backend dependencies..."
(cd backend && npm install --no-audit --no-fund)

# --- frontend dependencies + production build ----------------------------
echo "==>] Installing & building frontend (React + Vite)..."
(cd frontend && npm install --no-audit --no-fund && npm run build)

# --- directories & configuration -----------------------------------------
echo "==>] Creating directories & configuration files..."
mkdir -p config database logs scripts tests .app
[ -f .env ] || cp .env.example .env
echo "[OK] Environment file ready (edit .env to add API keys)"

echo "==>] Installation complete!"
echo "Start the app with:  bash start.sh"
echo "Check status with:   bash scripts/status.sh"
