Romble V5 smoke tests against http://127.0.0.1:3001

Unit: validateVideoUrl
  PASS  youtube watch ok
  PASS  youtube shorts ok
  PASS  youtube youtu.be ok
  PASS  rumble ok
  PASS  rejects invalid url
  PASS  rejects missing url

Unit: sanitizeConfig
  PASS  totalSessions clamped to max
  PASS  visiblePreviews clamped
  PASS  backgroundSessions clamped
  PASS  durationSec clamped to min
  PASS  unknown quality falls back to auto
  PASS  muted=false preserved

API: health & stats
  PASS  GET /api/health 200
  PASS  health reports V5
  PASS  GET /api/stats 200
  PASS  stats has playback counters
  PASS  stats no longer reports organic requests
  PASS  stats has platformStatus key
  PASS  GET /api/stats/history 200

API: activity & settings
  PASS  GET /api/activity 200
  PASS  POST /api/settings 200
  PASS  settings persisted

API: platform
  PASS  GET /api/platform/validate ok
  PASS  GET /api/platform/validate rejects unknown platform

Static dashboard & websocket
  PASS  GET / serves built dashboard
  PASS  JS bundle served
  PASS  socket.io websocket handshake

API: verified analytics
  PASS  GET /api/analytics requires url
  PASS  GET /api/analytics rejects invalid url
  PASS  Rumble reports no public API (no fake numbers)
  PASS  YouTube analytics reports missing API key (no fake numbers)
  PASS  GET /api/analytics/growth ok
  PASS  GET /api/analytics/history ok
  PASS  watch time / retention / traffic labelled unavailable

API: legacy engine removed
  PASS  GET /api/tasks -> 404

API: playback config
  PASS  GET /api/playback/config 200
  PASS  POST /api/playback/config clamps & persists
  PASS  config persisted

API: playback lifecycle
  PASS  POST /playback/start 201
  PASS  run has 1 preview + 2 background sessions
  PASS  sessions expose progress field
  PASS  GET /playback exposes computed progress
  PASS  second start -> 409
  PASS  sessions progress over time
  PASS  concurrency respected
  PASS  POST /playback/pause 200
  PASS  paused run does not advance
  PASS  POST /playback/resume 200
  PASS  run completes automatically
  PASS  all sessions finished
  PASS  DELETE /playback 200
  PASS  run cleared & archived in history
  PASS  archive records local test (no views)

API: per-session controls
  PASS  second run started
  PASS  session pause (or queued->pause no-op) 200
  PASS  session stop 200
  PASS  unknown session -> 404

API: validation & resource guard
  PASS  unsupported URL -> 400
  PASS  missing URL -> 400
  PASS  guard test run started
  PASS  resource limit auto-pauses run

61 passed, 0 failed
