# Youtube‑Rumble‑Termux — YouTube & Rumble Platform Dashboard

A modern, self‑hosted **YouTube & Rumble platform dashboard** that runs natively
on Android with **Termux** — no desktop, no Electron, no Windows, no root.

It was originally a desktop-only Electron app. This rewrite turns it into a
lightweight, mobile‑first **Node.js backend + React dashboard** served over
**localhost**: `http://127.0.0.1:3000`.

## What it does

- **Dashboard** — real‑time stats (uptime, CPU, memory, task counters, organic
  requests, platform API status), animated stat cards, live charts, terminal‑style
  activity logs, connection status, toast notifications, loading indicators.
- **Video tools** — URL validation and metadata retrieval for YouTube and Rumble
  (YouTube Data API v3 when you set `YOUTUBE_API_KEY`, Invidious fallback, yt‑dlp
  for Rumble on Termux).
- **Organic viewer tasks** — start, pause, resume and stop tasks that send real
  HTTP requests (random user agents, referrers, spoofed IPs) to your platform
  video. Stats displayed are **organic requests sent**, never invented views.
- **Settings panel** — persistent settings stored in `database/db.json`.
- **Background daemon** — runs headless on your phone with `start.sh`/`stop.sh`
  and automatic recovery.

> **Honest labeling:** platform‑reported numbers (YouTube API views, Rumble
> scrape) and locally measured numbers (requests sent by this app) are labeled
> separately in the UI. No simulated data is ever presented as genuine platform data.

## System requirements

| Requirement | Details |
|---|---|
| Android | 5.0+ recommended; Termux app installed |
| Architecture | Android ARM64 (tested here: `aarch64`) |
| Node.js | Termux `nodejs-lts` (auto‑installed by `install.sh`) |
| Disk | ~50 MB backend, ~80 MB frontend + dependencies |
| RAM | ~80–150 MB while running |
| Network | Localhost (127.0.0.1:3000) — external access only if explicitly enabled |

## Installation (Termux)

On a fresh Android device:

```bash
pkg update -y
pkg install git nodejs-lts -y
git clone https://github.com/JijaProGaming/Youtube-Rumble-View-Bot.git
cd Youtube-Rumble-View-Bot
chmod +x install.sh start.sh
bash install.sh
```

What `install.sh` does:

1. Detects the Termux environment and architecture (`aarch64`).
2. Installs system packages (`nodejs-lts`, `git`, `curl`, `jq`, `termux-api`).
3. Installs backend dependencies (`backend/package.json`).
4. Installs and builds the frontend (`frontend/` with pnpm).
5. Creates `config/`, `database/`, `logs/`, `tests/`, `.app/`.
6. Copies `.env.example` → `.env` for your credentials.
7. Prints the localhost URL and readiness status.

## Configuration (`.env`)

Copy `.env.example` to `.env` and edit (sensitive keys never get committed —
`.env` is gitignored). Key options:

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `3000` | Dashboard port |
| `HOST` | `127.0.0.1` | Bind address (localhost by default) |
| `PUBLIC_BIND` | `0` | Set `1` to expose on the LAN (not recommended on phones) |
| `YOUTUBE_API_KEY` | — | YouTube Data API v3 key for metadata (optional) |
| `INVIDIOUS_INSTANCE` | `https://yewtu.be` | Public Invidious instance used as fallback |
| `TASK_REQUEST_INTERVAL` | `5` | Seconds between organic requests |
| `TASK_MAX_CONCURRENCY` | `3` | Max parallel requests |
| `STATS_REFRESH_SECONDS` | `3` | Dashboard live update interval |
| `LOG_RETENTION_DAYS` | `7` | Keeps ~7 days of logs in `logs/` |

For real Rumble metadata run `pkg install yt-dlp` on Termux.

## Usage

```bash
bash start.sh        # Start the dashboard        (or: npm start)
bash scripts/status.sh       # Check status + health      (or: npm run status)
bash stop.sh         # Stop the backend gracefully (or: npm run stop)
bash scripts/restart.sh      # Stop + start again         (or: npm run restart)
bash update.sh       # Pull, reinstall, rebuild, restart (or: npm run update)
node tests/smoke.test.js  # Smoke tests (server must be running)
```

Open **http://127.0.0.1:3000** in your phone browser. The dashboard is served
as static files by the backend itself — nothing extra to run.

## Architecture

```
Youtube-Rumble-Termux/
├── backend/
│   ├── server.js              # HTTP server + static UI + socket.io
│   ├── controllers/           # health, stats, platform, settings, tasks
│   ├── routes/api.routes.js   # REST endpoints under /api
│   ├── services/              # stats, platform, tasks, activity, db, logs
│   ├── middleware/            # request logger, error handler, rate limiter
│   └── utils/                 # URL validation helpers
├── frontend/                  # React + Vite dashboard (pnpm)
│   ├── src/pages/             # DashboardPage, SettingsPage
│   ├── src/components/        # StatCard, Chart, TerminalLog, TaskControls, Sidebar, Toasts
│   └── src/hooks/useRealtime.js # WebSocket connection
├── config/                    # Environment templates & docs
├── database/db.json           # Settings, tasks, activity, stats history (JSON)
├── logs/backend.log           # Timestamped server + activity logs
├── scripts/                   # (restart, status, etc.)
├── tests/smoke.test.js        # End‑to‑end smoke tests
├── install.sh, start.sh, stop.sh, restart.sh, status.sh, update.sh
├── package.json, .env.example, .gitignore
└── README.md

archive/                      # Original Electron + Svelte code, preserved untouched
```

## Battery / background behavior

On Android, Termux apps can be killed by the system after a while. To keep the
dashboard alive:

1. **Keep it running:** start it via `bash start.sh`.
2. **Optionally use Termux:API** — install `termux-api` and use
   `termux-wake-lock` manually from the Termux shell:

   ```bash
   termux-wake-lock
   bash start.sh
   ```

3. **Don’t force “Don’t optimize” off** if you want the dashboard always on:
   Battery → App info → Don’t optimize / allow background activity.

If the app crashes, `server.js` catches `uncaughtException`/`unhandledRejection`,
logs them to `logs/backend.log`, and you can restart with `bash scripts/restart.sh`.

## Troubleshooting

| Problem | Fix |
|---|---|
| Port 3000 in use | `bash stop.sh` then start again |
| `npm install` slow on phone | Use pnpm inside `frontend/` and run `npm run build` only if needed |
| Rumble metadata missing | `pkg install yt-dlp` |
| Dashboard not loading after reboot | `bash start.sh` |
| Wrong time in logs | Logs are UTC (ISO format) |
| High CPU | Reduce `TASK_REQUEST_INTERVAL` and `TASK_MAX_CONCURRENCY` in `.env` |

## Security notes

- Binds to `127.0.0.1` by default; only expose publicly with `PUBLIC_BIND=1`.
- Simple per‑IP rate limits on settings and platform endpoints.
- All credentials (YouTube API key) come from `.env` — never commit or display them.
- Local logs can contain request URLs; delete `logs/` if you want a clean slate.

## Testing (performed on Termux aarch64, Android 14, Node 26.13.1)

- ✅ `bash install.sh` — dependency installation verified.
- ✅ `bash start.sh` — backend starts, health endpoint responds on `127.0.0.1:3000`.
- ✅ `npm run build` (frontend) — production build completes (`dist/` generated).
- ✅ `bash start.sh` serves `/` and `/assets/*` from the built frontend.
- ✅ `GET /api/health` — 200 with version and uptime.
- ✅ `GET /api/stats`, `/api/stats/history`, `/api/activity`, `/api/settings` — 200.
- ✅ `GET /api/platform/validate` — 200 for YouTube (watch, shorts, youtu.be) and Rumble; 400 for unsupported URLs.
- ✅ `POST /api/tasks` + task lifecycle — create → requests sent → pause (requests stop) → resume → stop → delete.
- ✅ Socket.IO handshake verified (`/socket.io/?EIO=4&transport=polling`).
- ✅ `node tests/smoke.test.js` — **29 passed, 0 failed**.
- ✅ `bash scripts/status.sh`, `bash scripts/restart.sh`, `bash stop.sh` verified.

Note: during this session, `pkg install nodejs-ltt` on this machine downgraded `nodejs` to 26.13.0, which is ABI-incompatible with the environment's ICU 79.1 (the loader reports `UCNV_TO_U_CALLBACK_STOP_78` missing). `install.sh` now skips `pkg install` when a working `node` exists and never breaks a working environment; the runnable Node v26.13.1 is available via the `node` wrapper in `$HOME/bin` (uses `$PREFIX/glibc/lib/ld-linux-aarch64.so.1` + `$PREFIX/glibc/lib`). On a normal Termux setup without this quirk, `pkg install nodejs` works fine.

## Dependency compatibility report

| Dependency | Status |
|---|---|
| Node.js ≥ 18 (Termux: 26.13.1 here) | ✅ Compatible (built‑ins used: `os`, `fs`, `http`, `fetch`) |
| Express 4 + Socket.IO 4 | ✅ Tested in Termux |
| pnpm (frontend install) | ✅ Tested in Termux (esbuild builds fine on aarch64) |
| sqlite3 (old app) | ✅ Dropped — plain JSON DB is lighter and sufficient |
| Electron, electron‑forge, svelte, playwright‑anti‑fingerprinter, vm2, find‑chrome‑bin, electron‑squirrel‑startup | ❌ Removed (not needed, desktop/Windows only) |
| `yt-dlp` (Rumble metadata) | ✅ Optional — install with `pkg install yt-dlp` |
| termux‑api (wake lock) | ✅ Optional — installed by `install.sh` |

## Summary of changes

- Kept the original repository intact under `archive/` (untouched).
- New branch `termux-mobile-app` created from `master`.
- Replaced the Electron+Svelte desktop stack with a Node/Express + Socket.IO backend and React+Vite dashboard, both Termux‑compatible.
- Added real backend logic: stats, platform metadata (YouTube API/Invidious/yt‑dlp), organic tasks, activity log, file‑based JSON database, timestamped logging, rate limits, graceful shutdown, real‑time socket streaming.
- Added scripts: `install.sh`, `start.sh`, `stop.sh`, `restart.sh`, `status.sh`, `update.sh`.
- Added `.env.example`, `README.md`, `tests/smoke.test.js`.
- Cleaned/removed Windows‑only and desktop‑only dependencies.

## Known limitations

- Example.com/ videos and unsupported platforms are rejected by URL validation (see `/api/platform/validate`).
- Rumble metadata falls back to page‑title scraping when `yt-dlp` is absent — duration/views are then unknown (labels indicate `rumble_page_scrape`).
- YouTube metadata requires either a YouTube Data API key or reachable Invidious instances.
- Android may kill background Termux processes; use Termux wake‑lock for always‑on operation.
- No real GUI automations (Playwright) — replaced with lightweight organic HTTP requests to stay light on mobile.
