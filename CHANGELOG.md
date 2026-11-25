# Romble Changelog

## [5.0.0] — 2026-11-25 (completed during V5 upgrade)

### Removed (breaking)
- Deleted the misleading HTTP-request "organic viewer" engine (`services/taskService.js`,
  `controllers/taskController.js`, `/api/tasks/*` endpoints). The old engine fabricated
  "requests sent" and "organic growth" by sending HTTP requests to platforms; all of it is gone.

### Added — Playback Testing (real, honest engine)
- New `services/playbackService.js` — local playback-testing engine:
  - "Preview" sessions use **official platform embeds** (YouTube via `youtube-nocookie.com`,
    Rumble via `rumble.com/embed/`) rendered in the browser.
  - "Background" sessions are **local timers only** — no network requests, no views possible.
- New `controllers/playbackController.js` and API surface:
  - `GET/POST /api/playback` + `/api/playback/config`, `/api/playback/start`, `/api/playback/pause`,
    `/api/playback/resume`, `/api/playback/stop`, `/api/playback/sessions/:id/:action`,
    `DELETE /api/playback` (clear), `DELETE /api/playback/history`.
- Playback config fields: video URL, platform (`youtube`|`rumble`), number of test sessions
  (`totalSessions`), visible preview screens, duration (seconds), max concurrent, background
  session count, quality (`auto|1080p|720p|480p|360p`), mute/unmute, session timeout,
  automatic resource management, auto-cleanup of completed sessions. All values are clamped
  server-side to sane ranges.
- Engine ticks at 1s, **auto-pauses on resource limits** (`resource_paused`,
  `pausedReason: 'resource_limit'`); CPU is sampled every 3rd tick.
- Live preview UI: per-session status, progress bar, elapsed/remaining, thumbnails,
  play/pause/stop per session, configurable preview grid, fullscreen previews, error reporting.

### Added — Verified Analytics (never simulated)
- New `services/analyticsService.js` — stats come **only** from authorized platform APIs:
  - YouTube via Data API v3 with `YOUTUBE_API_KEY`; without it returns `api_key_missing`
    (no numbers shown).
  - Rumble returns `no_public_api` — Rumble has no public statistics API; this app does not
    display guessed numbers.
  - watch time, retention and traffic sources are always labelled `unavailable` with a reason.
- New `controllers/analyticsController.js` + `GET /api/analytics[?url&refresh]`,
  `GET /api/analytics/history`, `GET /api/analytics/growth`.
- Organic growth features: title & description optimization suggestions, recommendations &
  schedules, platform-native share tracking — local, honest recommendations only.

### Fixed
- Chart.jsx: resolved `undefined` variables, invalid canvas dimensions, invalid gradient colors;
  charts now use a `toRgba()` helper, set real `canvas.width/height` with `devicePixelRatio`,
  use `ResizeObserver`, and render a flat baseline for empty data.
- Mobile UI: no horizontal overflow (`overflow-x: hidden` on `html/body/#root`), `min-width: 0`
  globally, sidebar became an overlay drawer on narrow screens, terminal messages wrap
  (`overflow-wrap: anywhere`), breakpoints at 520/640/1024/1440px — no controls overflow or
  horizontal scrolling.
- Backend/frontend build fixed for Termux: Vite invoked via Node (no `/usr/bin/env` shebang),
  install scripts hardened, frontend `package.json` uses npm with a lockfile.

### Changed
- DB schema: `DEFAULTS = { settings, activity, statsHistory, playback: null, analytics: {} }`;
  the old `tasks` key is ignored on load (harmless for existing DBs).
- Version bumped to 5.0.0 in root, backend and frontend `package.json`; `VERSION` file updated.
- Stats endpoint reports playback counters instead of organic-request/task counters.

### Tests
- `tests/smoke.test.js` rewritten for V5 — 61 tests: URL validation, config clamping, health,
  stats, activity, settings, platform validate, dashboard + WebSocket handshake, analytics
  (verified/unavailable/growth/history), playback lifecycle (start/pause/resume/complete),
  per-session controls, validation errors, resource-guard auto-pause. **All 61 pass**
  (see `docs/test-results.md`).

### Compatibility
- Termux/Android ARM64 preserved; no root, no Electron; existing install works with
  `bash install.sh` (non-reinstalling `update.sh` also available).
- Node wrapper required: run `export PATH="$HOME/bin:$PATH"` before npm/node (system node is
  broken in this environment: ICU 78/79 ABI mismatch).
