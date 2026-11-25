# Dependency Compatibility Report — Romble V5 (2026-11-25)

Backend (`backend/package.json`) and frontend (`frontend/package.json`) dependencies are
compatible on Android/Termux (aarch64) without X11, desktop GL or platform-specific binaries.

| Package | Version | Why it matters | ARM64 (Termux) status |
|---|---|---|---|
| `express` (backend) | `^4.21.2` | Pure JS HTTP server. Works on Termux with system `nodejs`/`nodejs-lts`. | ✅ |
| `socket.io` (backend) | `^4.8.1` | WebSocket engine (polling/WebSocket transports). Pure JS core. | ✅ |
| `react` (frontend) | `^18.3.1` | UI library — no native deps. | ✅ |
| `react-dom` (frontend) | `^18.3.1` | Same. | ✅ |
| `socket.io-client` (frontend) | `^4.8.1` | Connects dashboard to backend via `/socket.io`; bundled by Vite. | ✅ |
| `vite` (frontend) | `^5.4.11` | Build tool. Vite 5.x is pure JS (esbuild is the only optional native dep — npm install warns "1 package had install scripts blocked: esbuild"). esbuild's android-arm64 binary is included via the `@esbuild/android-arm64` optional package; it is already present in `node_modules/@esbuild/`. If it ever disappears, `rm -rf node_modules && npm install` restores it. | ✅ (with the fix below) |
| `@vitejs/plugin-react` (frontend) | `^4.3.4` | Vite plugin; pure JS (uses babel). | ✅ |

### Build note (why `npm run build` failed and how it is fixed)

`npm run build` used the Vite shim (`node_modules/.bin/vite`) whose shebang is
`#!/usr/bin/env node` — Termux has no `/usr/bin/env` on PATH in some setups. Changes made:

- `frontend/package.json` scripts now call Node directly: `"build": "node node_modules/vite/bin/vite.js build"`.
- `install.sh` first tries `node frontend/node_modules/vite/bin/vite.js ...` before the
  npm script fallback.

Verified on this environment: `npm run build` →

```
✓ 74 modules transformed.
dist/index.html 0.60 kB
dist/assets/index-CMl0Kjtc.css 17.75 kB
dist/assets/index-BxaNviJo.js 218.12 kB
✓ built in ~1-6s
```

### Test results (docs/test-results.md)

```
V5 smoke suite — 61 passed, 0 failed
```
