# Romble V5 — YouTube & Rumble Dashboard for Android (Termux)

Romble V5 is a **local playback-testing and analytics dashboard** that runs natively on Android
with **Termux** — no desktop, no Electron, no Windows, no root.

The app never fabricates engagement. It has two clearly separate kinds of results:

- **Playback testing** — real, official platform embeds (YouTube/Rumble iframes) plus a set of
  local simulated sessions that only run timers in the dashboard. They load the platform's own
  player and show status/progress, but they cannot produce views, likes or comments.
- **Verified analytics** — views, likes, comments and related metrics read through the official
  YouTube Data API v3 with your own `YOUTUBE_API_KEY`. Anything the platform does not expose is
  labelled `unavailable` — it is never estimated or invented.

## What it does

- **Playback Testing** — configurable local test engine:
  - video URL (YouTube or Rumble), platform, quality, mute toggle
  - total test sessions, visible preview screens, background session count
  - per-session duration, max concurrency, session timeout
  - live per-session status, progress bar, elapsed/remaining, thumbnails
  - play / pause / stop per session, configurable preview grid, fullscreen previews
  - **automatic resource management** — the engine samples CPU/memory every 3s and
    auto-pauses when limits are exceeded (`pausedReason: 'resource_limit'`)
- **Verified Analytics** (YouTube only via API):
  - views, likes, comments, favorites, publish date, duration, thumbnail
  - traffic-change suggestions, sharing tips and schedule advice
  - watch time / retention / traffic sources always shown as `unavailable` with the reason
- **Organic growth features** — title & description optimization suggestions,
  recommendation & schedule tips, a share-tracking helper.
- **Dashboard** — real-time stats (uptime, CPU, memory, playback counters) over WebSocket,
  terminal-style activity log, connect status, toast notifications.
- **Settings panel** — persistent settings in `database/db.json`.
- **Background daemon** — `start.sh`/`stop.sh`/`status.sh`/`restart.sh`.

## System requirements

| Requirement | Details |
|---|---|
| Android | 7.0+ recommended; Termux app installed |
| Architecture | Android ARM64 (tested: `aarch64`) |
| Node.js | Termux `nodejs` (auto-installed by `install.sh`); see `docs/dependency-compatibility.md` |
| Disk | ~60 MB backend, ~100 MB frontend + dependencies |
| RAM | ~100–200 MB while running |
| Network | Localhost — `http://127.0.0.1:3000` |

## Installation (Termux)

```bash
pkg update -y
pkg install git nodejs -y
git clone https://github.com/steven6565/Romble.git
cd Romble
chmod +x install.sh start.sh
bash install.sh
```

`install.sh` detects the Termux environment, installs system packages, backend dependencies,
builds the frontend with Vite, and creates `config/`, `database/`, `logs/`, `tests/`, `.app/`.

> Build note: some Termux setups lack `/usr/bin/env`. `install.sh` calls the Vite binary via
> Node directly as a fallback — you may also run
> `cd frontend && node node_modules/vite/bin/vite.js build`.

## Start & stop

```bash
bash start.sh     # starts on http://127.0.0.1:3000
bash stop.sh
bash status.sh
```

## Configuration

Edit `.env` (a copy is made from `.env.example` on install). The important option:

| Variable | Purpose |
|---|---|
| `YOUTUBE_API_KEY` | Enable verified YouTube analytics (views/likes/comments). Leave empty — the app says so rather than inventing numbers. |
| `PORT` / `HOST` | Dashboard bind address (default `127.0.0.1:3000`). |
| `DB_DIR` | Database directory (default `database/`). |

For Rumble, the app uses official metadata via `yt-dlp` (`pkg install yt-dlp`) or the public
Invidious fallback — view counts there are **not verified by the app** and are simply not
displayed.

## Upgrading from V4

```bash
cd Romble          # your existing checkout
git pull --ff-only # or re-clone
bash install.sh    # rebuilds backend + frontend; a restart picks up the new code
```

The database is migrated automatically: the old V4 fields are ignored, the new playback state
(`playback`) starts at defaults. A stale `database/db.json` is not a problem.

Existing users do **not** need a full reinstall — `install.sh` can be re-run on top of an
existing install, and `update.sh` does pull + reinstall + restart automatically.

## Testing

Backend smoke tests run against a live server:

```bash
bash start.sh     # or: PORT=3001 bash start.sh
npm test          # runs tests/smoke.test.js
bash stop.sh
```

V5 smoke suite: **61 tests — pass** (see `docs/test-results.md`).

## Folder layout

```
backend/         Node + Express + Socket.IO dashboard server
frontend/        React + Vite dashboard (build → dist/)
tests/           smoke tests
docs/            dependency compatibility report, test results
config/          feature toggles (placeholder)
database/        JSON database (db.json — auto-created)
logs/            backend.log, terminal log
scripts/         restart.sh, status.sh
```

## Changelog

See `CHANGELOG.md` for the full version history.

## License

MIT — see `LICENCE`.
