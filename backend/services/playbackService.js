// Playback test engine.
//
// IMPORTANT — what this does and does not do:
//   * "Preview" sessions are real, official YouTube/Rumble embeds rendered in
//     the browser. They play through the platform's own player.
//   * "Background" sessions are LOCAL SIMULATED test sessions. They only run a
//     timer in this Node process so you can load-test the dashboard UI. They
//     never open the video, never send requests to the platform and can never
//     produce a view, like or comment.
//
// Nothing in this file fabricates platform engagement.
const { loadEnv } = require('./env');
const log = require('./logService');
const db = require('./db');
const activityService = require('./activityService');
const statsService = require('./statsService');
const { validateVideoUrl } = require('./platformService');

loadEnv();

const QUALITIES = ['auto', '1080p', '720p', '480p', '360p'];

const DEFAULT_CONFIG = {
  videoUrl: '',
  platform: 'youtube',
  totalSessions: 20,
  visiblePreviews: 4,
  durationSec: 60,
  maxConcurrent: 4,
  backgroundSessions: 16,
  quality: 'auto',
  muted: true,
  sessionTimeoutSec: 120,
  maxCpuPercent: 85,
  maxMemPercent: 88,
  autoCleanup: true,
  keepCompleted: 40
};

// [min, max] bounds so a bad request can never exhaust the phone.
const BOUNDS = {
  totalSessions: [1, 500],
  visiblePreviews: [0, 12],
  durationSec: [5, 3600],
  maxConcurrent: [1, 20],
  backgroundSessions: [0, 500],
  sessionTimeoutSec: [10, 3600],
  maxCpuPercent: [10, 100],
  maxMemPercent: [10, 100],
  keepCompleted: [5, 500]
};

const TICK_MS = 1000;
let engineTimer = null;
let tickCount = 0;
let lastResource = { cpu: 0, mem: 0 };

function clamp(value, [min, max], fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function sanitizeConfig(input, base) {
  const merged = Object.assign({}, DEFAULT_CONFIG, base || {}, input || {});
  const cfg = {
    videoUrl: typeof merged.videoUrl === 'string' ? merged.videoUrl.trim() : '',
    platform: merged.platform === 'rumble' ? 'rumble' : 'youtube',
    quality: QUALITIES.includes(merged.quality) ? merged.quality : 'auto',
    muted: merged.muted !== false,
    autoCleanup: merged.autoCleanup !== false
  };
  for (const key of Object.keys(BOUNDS)) {
    cfg[key] = clamp(merged[key], BOUNDS[key], DEFAULT_CONFIG[key]);
  }
  // Visible previews can never exceed the total session count.
  cfg.visiblePreviews = Math.min(cfg.visiblePreviews, cfg.totalSessions);
  cfg.backgroundSessions = Math.min(cfg.backgroundSessions, cfg.totalSessions - cfg.visiblePreviews);
  return cfg;
}

function emptyState() {
  return { config: Object.assign({}, DEFAULT_CONFIG), run: null, history: [] };
}

function loadState() {
  const raw = db.get('playback');
  if (!raw || typeof raw !== 'object') return emptyState();
  const state = {
    config: sanitizeConfig(raw.config || {}),
    run: raw.run || null,
    history: Array.isArray(raw.history) ? raw.history : []
  };
  if (state.run && !Array.isArray(state.run.sessions)) state.run = null;
  return state;
}

function saveState(state) {
  db.set('playback', state);
  return state;
}

function getConfig() {
  return loadState().config;
}

function updateConfig(input) {
  const state = loadState();
  state.config = sanitizeConfig(input, state.config);
  saveState(state);
  return state.config;
}

function getState() {
  const state = loadState();
  return { config: state.config, run: publicRun(state.run), history: state.history, limits: lastResource };
}

function publicRun(run) {
  if (!run) return null;
  const sessions = run.sessions.map((s) => ({
    id: s.id,
    index: s.index,
    kind: s.kind,
    status: s.status,
    elapsedSec: s.elapsedSec,
    durationSec: s.durationSec,
    progress: s.durationSec > 0 ? Math.min(100, Math.round((s.elapsedSec / s.durationSec) * 1000) / 10) : 0,
    startedAt: s.startedAt,
    finishedAt: s.finishedAt,
    error: s.error || null
  }));
  const count = (st) => sessions.filter((s) => s.status === st).length;
  return {
    id: run.id,
    status: run.status,
    config: run.config,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    pausedReason: run.pausedReason || null,
    sessions,
    summary: {
      total: sessions.length,
      queued: count('queued'),
      running: count('running'),
      paused: count('paused'),
      completed: count('completed'),
      failed: count('failed'),
      stopped: count('stopped')
    }
  };
}

function buildSessions(config) {
  const sessions = [];
  const previews = Math.min(config.visiblePreviews, config.totalSessions);
  let index = 0;
  for (let i = 0; i < previews; i += 1) {
    sessions.push({
      id: `p${index + 1}`,
      index: index++,
      kind: 'preview',
      status: 'queued',
      elapsedSec: 0,
      durationSec: config.durationSec,
      startedAt: null,
      finishedAt: null,
      error: null
    });
  }
  const background = Math.min(config.backgroundSessions, Math.max(0, config.totalSessions - previews));
  for (let i = 0; i < background; i += 1) {
    sessions.push({
      id: `b${index + 1}`,
      index: index++,
      kind: 'background',
      status: 'queued',
      elapsedSec: 0,
      durationSec: config.durationSec,
      startedAt: null,
      finishedAt: null,
      error: null
    });
  }
  return sessions;
}

function startRun(inputConfig) {
  const state = loadState();
  const config = sanitizeConfig(inputConfig || state.config, state.config);
  const validation = validateVideoUrl(config.videoUrl);
  if (!validation.ok) {
    const err = new Error(validation.reason === 'missing_url' ? 'A video URL is required.' : 'The video URL is not a supported YouTube or Rumble URL.');
    err.status = 400;
    throw err;
  }
  if (state.run && (state.run.status === 'running' || state.run.status === 'paused' || state.run.status === 'resource_paused')) {
    const err = new Error('A playback test is already active. Stop it before starting another.');
    err.status = 409;
    throw err;
  }

  const run = {
    id: Date.now(),
    status: 'running',
    config: Object.assign({}, config, { platform: validation.platform, videoUrl: validation.normalized, videoId: validation.videoId }),
    startedAt: new Date().toISOString(),
    finishedAt: null,
    pausedReason: null,
    sessions: buildSessions(config)
  };
  state.config = config;
  state.run = run;
  saveState(state);
  activityService.addActivity(
    'playback_started',
    `Playback test started — ${config.totalSessions} local sessions (${Math.min(config.visiblePreviews, config.totalSessions)} preview, ${run.sessions.length - Math.min(config.visiblePreviews, config.totalSessions)} simulated). No platform views are created.`
  );
  ensureEngine();
  broadcast();
  return publicRun(run);
}

function withRun(mutator) {
  const state = loadState();
  if (!state.run) return null;
  mutator(state.run);
  saveState(state);
  broadcast();
  return publicRun(state.run);
}

function pauseRun(reason) {
  return withRun((run) => {
    if (run.status !== 'running') return;
    run.status = 'paused';
    run.pausedReason = reason || 'paused_by_user';
    for (const s of run.sessions) {
      if (s.status === 'running') { s.status = 'paused'; }
    }
    activityService.addActivity('playback_paused', reason === 'resource_limit' ? 'Playback test paused automatically — resource limit reached.' : 'Playback test paused.');
  });
}

function resumeRun() {
  return withRun((run) => {
    if (run.status !== 'paused' && run.status !== 'resource_paused') return;
    run.status = 'running';
    run.pausedReason = null;
    for (const s of run.sessions) {
      if (s.status === 'paused') s.status = 'queued';
    }
    activityService.addActivity('playback_resumed', 'Playback test resumed.');
  });
}

function stopRun() {
  return withRun((run) => {
    run.status = 'stopped';
    run.finishedAt = new Date().toISOString();
    for (const s of run.sessions) {
      if (s.status === 'running' || s.status === 'paused' || s.status === 'queued') s.status = 'stopped';
    }
    activityService.addActivity('playback_stopped', `Playback test stopped — ${run.sessions.filter((s) => s.status === 'completed').length} session(s) had completed.`);
  });
}

function controlSession(sessionId, action) {
  return withRun((run) => {
    const s = run.sessions.find((x) => x.id === sessionId);
    if (!s) return;
    if (action === 'pause' && s.status === 'running') s.status = 'paused';
    if (action === 'resume' && s.status === 'paused') s.status = 'queued';
    if (action === 'stop' && ['running', 'paused', 'queued'].includes(s.status)) {
      s.status = 'stopped';
      s.finishedAt = new Date().toISOString();
    }
  });
}

function clearRun() {
  const state = loadState();
  if (state.run && ['running', 'paused', 'resource_paused'].includes(state.run.status)) {
    const err = new Error('Stop the active playback test before clearing it.');
    err.status = 409;
    throw err;
  }
  if (state.run) {
    state.history = state.history.concat([{
      id: state.run.id,
      startedAt: state.run.startedAt,
      finishedAt: state.run.finishedAt || new Date().toISOString(),
      status: state.run.status,
      config: state.run.config,
      summary: publicRun(state.run).summary
    }]).slice(-state.config.keepCompleted);
  }
  state.run = null;
  saveState(state);
  broadcast();
  return true;
}

function clearHistory() {
  const state = loadState();
  state.history = [];
  saveState(state);
  broadcast();
  return true;
}

function promoteQueued(run) {
  const runningCount = run.sessions.filter((s) => s.status === 'running').length;
  let slots = run.config.maxConcurrent - runningCount;
  if (slots <= 0) return;
  const queued = run.sessions
    .filter((s) => s.status === 'queued')
    .sort((a, b) => (a.kind === b.kind ? a.index - b.index : a.kind === 'preview' ? -1 : 1));
  for (const s of queued.slice(0, slots)) {
    s.status = 'running';
    s.startedAt = s.startedAt || new Date().toISOString();
    slots -= 1;
    if (slots <= 0) break;
  }
}

async function tick() {
  tickCount += 1;
  const state = loadState();
  const run = state.run;
  if (!run || run.status !== 'running') return;

  // Resource guard — sample CPU/memory and auto-pause before the phone struggles.
  if (tickCount % 3 === 1) {
    try {
      const cpu = await statsService.cpu();
      const mem = statsService.memory().usedPercent;
      lastResource = { cpu, mem };
      if (cpu > run.config.maxCpuPercent || mem > run.config.maxMemPercent) {
        run.status = 'resource_paused';
        run.pausedReason = 'resource_limit';
        for (const s of run.sessions) if (s.status === 'running') s.status = 'paused';
        saveState(state);
        activityService.addActivity('playback_resource_pause', `Playback test auto-paused — CPU ${cpu}% / memory ${mem}% exceeded the configured limits.`);
        broadcast();
        return;
      }
    } catch { /* sampling failure must not stop the engine */ }
  }

  promoteQueued(run);

  for (const s of run.sessions) {
    if (s.status !== 'running') continue;
    s.elapsedSec += 1;
    if (s.elapsedSec >= run.config.sessionTimeoutSec) {
      s.status = 'failed';
      s.error = 'session_timeout';
      s.finishedAt = new Date().toISOString();
    } else if (s.elapsedSec >= s.durationSec) {
      s.status = 'completed';
      s.finishedAt = new Date().toISOString();
    }
  }

  const unfinished = run.sessions.some((s) => s.status === 'queued' || s.status === 'running');
  if (!unfinished) {
    run.status = 'completed';
    run.finishedAt = new Date().toISOString();
    const completed = run.sessions.filter((s) => s.status === 'completed').length;
    activityService.addActivity('playback_completed', `Playback test completed — ${completed}/${run.sessions.length} local sessions finished. These are test sessions, not platform views.`);
    if (run.config.autoCleanup) {
      state.history = state.history.concat([{
        id: run.id,
        startedAt: run.startedAt,
        finishedAt: run.finishedAt,
        status: run.status,
        config: run.config,
        summary: publicRun(run).summary
      }]).slice(-run.config.keepCompleted);
    }
  }

  saveState(state);
  broadcast();
}

// --- socket broadcast (set by server.js) --------------------------------
let broadcaster = null;
function setBroadcaster(fn) { broadcaster = fn; }
function broadcast() {
  if (!broadcaster) return;
  try { broadcaster(getState()); } catch (err) { log.debug('[playback] broadcast error: ' + err.message); }
}

function ensureEngine() {
  if (engineTimer) return;
  engineTimer = setInterval(() => { tick().catch((err) => log.debug('[playback] tick error: ' + err.message)); }, TICK_MS);
  if (engineTimer.unref) engineTimer.unref();
  log.info('Playback test engine started');
}

function stopEngine() {
  if (engineTimer) clearInterval(engineTimer);
  engineTimer = null;
}

function shutdown() {
  stopEngine();
  const state = loadState();
  if (state.run && ['running', 'paused', 'resource_paused'].includes(state.run.status)) {
    state.run.status = 'stopped';
    state.run.finishedAt = new Date().toISOString();
    for (const s of state.run.sessions) {
      if (['running', 'paused', 'queued'].includes(s.status)) s.status = 'stopped';
    }
    saveState(state);
  }
}

module.exports = {
  DEFAULT_CONFIG, BOUNDS, QUALITIES,
  getConfig, updateConfig, getState, startRun, pauseRun, resumeRun, stopRun,
  controlSession, clearRun, clearHistory, setBroadcaster, ensureEngine, shutdown,
  sanitizeConfig, publicRun
};
