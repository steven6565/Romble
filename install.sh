#!/usr/bin/env bash
# Termux-compatible installer for the Romble V5 dashboard.
# Usage: bash install.sh
set -Eeuo pipefail
cd "$(dirname "$0")"

echo "==>] Installing Romble V5 (Termux edition)..."

if [ -d "${PREFIX:-/nonexistent}" ]; then
  echo "[OK] Termux environment detected ($PREFIX)"
else
  echo "[WARN] Termux environment not detected — continuing on this shell anyway"
fi

ARCH="$(uname -m)"
echo "[INFO] Architecture: $ARCH"
case "$ARCH" in
  aarch64|arm64) echo "[OK] Android ARM64 — supported" ;;
  x86_64)        echo "[INFO] x86_64 — supported" ;;
  *)             echo "[WARN] $ARCH — architecture not confirmed" ;;
esac

# --- Node.js (only when missing or broken) -------------------------------
echo "==>] Checking Node.js ..."
if command -v node >/dev/null 2>&1 && node --version >/dev/null 2>&1; then
  echo "[OK] Node.js available: $(node --version)"
else
  echo "[WARN] Node.js not found or broken — installing via pkg..."
  if command -v pkg >/dev/null 2>&1; then
    pkg install -y nodejs 2>/dev/null || pkg install -y nodejs-lts 2>/dev/null || true
  fi
  if command -v node >/dev/null 2>&1 && node --version >/dev/null 2>&1; then
    echo "[OK] Node.js now available: $(node --version)"
  else
    echo "[ERROR] Node.js is still not usable — try: pkg install nodejs"
    exit 1
  fi
fi

# --- system packages (best effort) ---------------------------------------
if command -v pkg >/dev/null 2>&1; then
  pkg update -y 2>/dev/null || true
  pkg install -y git curl jq 2>/dev/null || true
  pkg install -y termux-api 2>/dev/null || true
  # Rumble metadata (optional but recommended)
  pkg install -y yt-dlp 2>/dev/null || true
else
  echo "[SKIP] pkg not found — assuming Node/npm/curl/git are installed"
fi

# --- backend dependencies -----------------------------------------------
echo "==>] Installing backend dependencies..."
(cd backend && npm install --no-audit --no-fund)

# --- frontend dependencies + production build ----------------------------
echo "==>] Installing & building frontend (React + Vite)..."
(cd frontend && npm install --no-audit --no-fund)

echo "==>] Building frontend..."
# Some Termux setups have no /usr/bin/env, which breaks the vite shim's
# shebang. Invoke vite through node directly when that happens.
if node frontend/node_modules/vite/bin/vite.js build --config frontend/vite.config.js --root frontend >/dev/null 2>&1; then
  echo "[OK] Frontend built"
elif ! (cd frontend && npm run build); then
  echo "[ERROR] Frontend build failed."
  echo "        Try: cd frontend && node node_modules/vite/bin/vite.js build"
  exit 1
else
  echo "[OK] Frontend built"
fi

# --- directories & configuration -----------------------------------------
echo "==>] Creating directories & configuration files..."
mkdir -p config database logs scripts tests .app
[ -f .env ] || cp .env.example .env
echo "[OK] Environment file ready (edit .env to add YOUTUBE_API_KEY)"

echo "==>] Installation complete!"
echo "Start the app with:  bash start.sh"
echo "Dashboard:           http://127.0.0.1:3000"
