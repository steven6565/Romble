// V5 smoke tests — run against a live server (default http://127.0.0.1:3000).
// Usage: bash start.sh && npm test && bash stop.sh
const path = require('path');
const { validateVideoUrl } = require('../backend/services/platformService');
const { sanitizeConfig, BOUNDS } = require('../backend/services/playbackService');

const BASE = process.env.SMOKE_BASE || `http://127.0.0.1:${process.env.PORT || 3000}`;
const JSON_HEADERS = { 'Content-Type': 'application/json' };
const YT_URL = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

let passed = 0;
let failed = 0;

function check(name, condition, detail) {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failed += 1;
    console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(p, options = {}) {
  const res = await fetch(`${BASE}/api${p}`, options);
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}
const post = (p, body) => api(p, { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(body || {}) });
const del = (p) => api(p, { method: 'DELETE' });

async function stopAndClear() {
  const state = (await api('/playback')).data;
  if (state?.run && ['running', 'paused', 'resource_paused'].includes(state.run.status)) await post('/playback/stop');
  await del('/playback');
}

async function run() {
  console.log(`Romble V5 smoke tests against ${BASE}\n`);

  // --- Unit: URL validation ---------------------------------------------
  console.log('Unit: validateVideoUrl');
  const yt = validateVideoUrl(YT_URL);
  check('youtube watch ok', yt.ok && yt.platform === 'youtube' && yt.videoId === 'dQw4w9WgXcQ', JSON.stringify(yt));
  const ytShorts = validateVideoUrl('https://youtube.com/shorts/AbCdEfGhIjK');
  check('youtube shorts ok', ytShorts.ok && ytShorts.platform === 'youtube');
  const ytBe = validateVideoUrl('https://youtu.be/dQw4w9WgXcQ');
  check('youtube youtu.be ok', ytBe.ok && ytBe.videoId === 'dQw4w9WgXcQ', JSON.stringify(ytBe));
  const rumble = validateVideoUrl('https://rumble.com/vabc123-example-video.html');
  check('rumble ok', rumble.ok && rumble.platform === 'rumble', JSON.stringify(rumble));
  check('rejects invalid url', !validateVideoUrl('not-a-url').ok);
  check('rejects missing url', !validateVideoUrl('').ok);

  // --- Unit: config hardening -------------------------------------------
  console.log('\nUnit: sanitizeConfig');
  const clamped = sanitizeConfig({
    totalSessions: 99999,
    visiblePreviews: 999,
    backgroundSessions: 99999,
    durationSec: -5,
    quality: 'ultra-hdr',
    muted: false
  });
  check('totalSessions clamped to max', clamped.totalSessions === BOUNDS.totalSessions[1], String(clamped.totalSessions));
  check('visiblePreviews clamped', clamped.visiblePreviews === BOUNDS.visiblePreviews[1], String(clamped.visiblePreviews));
  check('backgroundSessions clamped', clamped.backgroundSessions === BOUNDS.totalSessions[1] - BOUNDS.visiblePreviews[1], String(clamped.backgroundSessions));
  check('durationSec clamped to min', clamped.durationSec === BOUNDS.durationSec[0], String(clamped.durationSec));
  check('unknown quality falls back to auto', clamped.quality === 'auto');
  check('muted=false preserved', clamped.muted === false);

  // --- API: health, stats, activity, settings ---------------------------
  console.log('\nAPI: health & stats');
  const health = await api('/health');
  check('GET /api/health 200', health.status === 200);
  check('health reports V5', health.data?.status === 'ok' && health.data?.version === '5.0.0', JSON.stringify(health.data));

  const stats = await api('/stats');
  check('GET /api/stats 200', stats.status === 200);
  check('stats has playback counters', stats.data?.playback && typeof stats.data.playback.runningSessions === 'number', JSON.stringify(stats.data?.playback));
  check('stats no longer reports organic requests', !('totalOrganicRequests' in (stats.data || {})) && !('activeTasks' in (stats.data || {})));
  check('stats has platformStatus key', 'platformStatus' in (stats.data || {}));

  const hist = await api('/stats/history');
  check('GET /api/stats/history 200', hist.status === 200 && Array.isArray(hist.data?.history));

  console.log('\nAPI: activity & settings');
  const activity = await api('/activity?limit=20');
  check('GET /api/activity 200', activity.status === 200 && Array.isArray(activity.data?.activity));
  const beforeSettings = (await api('/settings')).data?.settings || {};
  const saved = await post('/settings', { refreshIntervalSec: 2 });
  check('POST /api/settings 200', saved.status === 200 && saved.data?.settings?.refreshIntervalSec === 2, JSON.stringify(saved.data));
  check('settings persisted', (await api('/settings')).data?.settings?.refreshIntervalSec === 2);
  await post('/settings', beforeSettings);

  console.log('\nAPI: platform');
  const val = await api('/platform/validate?url=' + encodeURIComponent(YT_URL));
  check('GET /api/platform/validate ok', val.status === 200 && val.data?.ok === true && val.data?.platform === 'youtube', JSON.stringify(val.data));
  const valBad = await api('/platform/validate?url=https%3A%2F%2Fexample.com%2Fvideo');
  check('GET /api/platform/validate rejects unknown platform', valBad.status === 400 && valBad.data?.ok === false);

  // --- Static dashboard + socket handshake ------------------------------
  console.log('\nStatic dashboard & websocket');
  const home = await fetch(`${BASE}/`);
  const homeHtml = await home.text();
  check('GET / serves built dashboard', home.status === 200 && /<div id="root"><\/div>/i.test(homeHtml), `status=${home.status}`);
  const assetMatch = homeHtml.match(/src="(\/assets\/[^"]+\.js)"/);
  const asset = assetMatch ? await fetch(`${BASE}${assetMatch[1]}`) : null;
  check('JS bundle served', Boolean(asset && asset.status === 200));

  const wsUrl = BASE.replace(/^http/, 'ws') + '/socket.io/?EIO=4&transport=websocket';
  const handshake = await new Promise((resolve) => {
    const ws = new WebSocket(wsUrl);
    const timer = setTimeout(() => { try { ws.close(); } catch {} resolve(null); }, 3000);
    ws.onmessage = (event) => {
      const text = String(event.data || '');
      if (text.startsWith('0')) {
        clearTimeout(timer);
        try { ws.close(); } catch {}
        resolve(text);
      }
    };
    ws.onerror = () => { clearTimeout(timer); resolve(null); };
  });
  check('socket.io websocket handshake', Boolean(handshake && handshake.startsWith('0{')), String(handshake).slice(0, 80));

  // --- Verified-only analytics ------------------------------------------
  console.log('\nAPI: verified analytics');
  const anMissing = await api('/analytics');
  check('GET /api/analytics requires url', anMissing.status === 400 && anMissing.data?.ok === false);
  const anBad = await api('/analytics?url=not-a-url');
  check('GET /api/analytics rejects invalid url', anBad.status === 200 && anBad.data?.ok === false && !anBad.data?.verified, JSON.stringify(anBad.data));
  const anRumble = await api('/analytics?url=' + encodeURIComponent('https://rumble.com/vabc123-example-video.html'));
  check('Rumble reports no public API (no fake numbers)', anRumble.data?.error === 'no_public_api' && anRumble.data?.verified === false, JSON.stringify(anRumble.data));
  const anYt = await api('/analytics?url=' + encodeURIComponent(YT_URL));
  const hasKey = Boolean(process.env.YOUTUBE_API_KEY);
  check(hasKey ? 'YouTube analytics verified from API (key configured)' : 'YouTube analytics reports missing API key (no fake numbers)',
    hasKey ? anYt.data?.verified === true && typeof anYt.data?.metrics?.views === 'number'
           : anYt.data?.error === 'api_key_missing' && anYt.data?.verified === false,
    JSON.stringify({ error: anYt.data?.error, verified: anYt.data?.verified, views: anYt.data?.metrics?.views }));
  const growth = await api('/analytics/growth?url=' + encodeURIComponent(YT_URL));
  check('GET /api/analytics/growth ok', growth.status === 200 && growth.data?.ok === true && Array.isArray(growth.data?.suggestions));
  const anHistory = await api('/analytics/history?url=' + encodeURIComponent(YT_URL));
  check('GET /api/analytics/history ok', anHistory.status === 200 && anHistory.data?.ok === true && Array.isArray(anHistory.data?.history));
  const unavail = await api('/analytics?url=' + encodeURIComponent(YT_URL));
  const labels = unavail.data?.unavailable || {};
  check('watch time / retention / traffic labelled unavailable', ['watchTime', 'retention', 'trafficSources'].every((k) => labels[k]?.available === false && Boolean(labels[k]?.reason)), JSON.stringify(labels));

  // --- Removed legacy engine --------------------------------------------
  console.log('\nAPI: legacy engine removed');
  const legacy = await api('/tasks');
  check('GET /api/tasks -> 404', legacy.status === 404, String(legacy.status));

  // --- Playback configuration -------------------------------------------
  console.log('\nAPI: playback config');
  await stopAndClear();
  await del('/playback/history');
  const cfgRes = await api('/playback/config');
  check('GET /api/playback/config 200', cfgRes.status === 200 && cfgRes.data?.config?.durationSec > 0);
  const cfgPost = await post('/playback/config', { totalSessions: 9000, visiblePreviews: 50, quality: 'bogus', muted: false });
  check('POST /api/playback/config clamps & persists', cfgPost.status === 200 && cfgPost.data?.config?.totalSessions === 500 && cfgPost.data?.config?.visiblePreviews === 12 && cfgPost.data?.config?.quality === 'auto' && cfgPost.data?.config?.muted === false, JSON.stringify(cfgPost.data?.config));
  check('config persisted', (await api('/playback/config')).data?.config?.totalSessions === 500);

  // --- Playback lifecycle ------------------------------------------------
  console.log('\nAPI: playback lifecycle');
  const smallCfg = {
    videoUrl: YT_URL,
    platform: 'youtube',
    totalSessions: 3,
    visiblePreviews: 1,
    backgroundSessions: 2,
    durationSec: 5,
    maxConcurrent: 2,
    sessionTimeoutSec: 15,
    maxCpuPercent: 100,
    maxMemPercent: 100,
    autoCleanup: true
  };
  const started = await post('/playback/start', smallCfg);
  check('POST /playback/start 201', started.status === 201 && started.data?.run?.status === 'running', JSON.stringify(started.data?.error || started.data?.message));
  const runId = started.data?.run?.id;
  check('run has 1 preview + 2 background sessions', started.data?.run?.sessions?.length === 3 && started.data?.run?.sessions?.filter((s) => s.kind === 'preview').length === 1 && started.data?.run?.sessions?.filter((s) => s.kind === 'background').length === 2, JSON.stringify(started.data?.run?.summary));
  check('sessions expose progress field', typeof started.data?.run?.sessions?.[0]?.progress === 'number');
  const state0 = (await api('/playback')).data;
  check('GET /playback exposes computed progress', typeof state0?.run?.sessions?.[0]?.progress === 'number');

  const dup = await post('/playback/start', smallCfg);
  check('second start -> 409', dup.status === 409, String(dup.status));

  await sleep(2200);
  const mid = (await api('/playback')).data;
  const running = mid.run?.sessions?.filter((s) => s.status === 'running') || [];
  check('sessions progress over time', running.length > 0 && running.every((s) => s.elapsedSec >= 1), JSON.stringify(mid.run?.summary));
  check('concurrency respected', running.length <= 2, `running=${running.length}`);

  const paused = await post('/playback/pause');
  check('POST /playback/pause 200', paused.status === 200 && paused.data?.run?.status === 'paused');
  const elapsedAtPause = (await api('/playback')).data.run.sessions.reduce((n, s) => n + s.elapsedSec, 0);
  await sleep(2200);
  const elapsedAfterWait = (await api('/playback')).data.run.sessions.reduce((n, s) => n + s.elapsedSec, 0);
  check('paused run does not advance', elapsedAtPause === elapsedAfterWait, `${elapsedAtPause} -> ${elapsedAfterWait}`);

  const resumed = await post('/playback/resume');
  check('POST /playback/resume 200', resumed.status === 200 && resumed.data?.run?.status === 'running');
  let done = { run: null };
  for (let i = 0; i < 10; i += 1) {
    await sleep(1000);
    done = (await api('/playback')).data;
    if (done.run?.status === 'completed') break;
  }
  check('run completes automatically', done.run?.status === 'completed', String(done.run?.status));
  check('all sessions finished', done.run?.summary?.running === 0 && done.run?.summary?.queued === 0 && done.run?.summary?.completed === 3, JSON.stringify(done.run?.summary));

  const cleared = await del('/playback');
  check('DELETE /playback 200', cleared.status === 200 && cleared.data?.ok === true);
  const afterClear = (await api('/playback')).data;
  check('run cleared & archived in history', afterClear.run === null && afterClear.history?.some((h) => h.id === runId), JSON.stringify({ run: afterClear.run, historyLen: afterClear.history?.length }));
  check('archive records local test (no views)', afterClear.history?.some((h) => h.config?.platform === 'youtube' && h.summary?.total === 3));

  // --- Per-session controls ---------------------------------------------
  console.log('\nAPI: per-session controls');
  const second = await post('/playback/start', Object.assign({}, smallCfg, { totalSessions: 2, visiblePreviews: 0, backgroundSessions: 2, durationSec: 60 }));
  check('second run started', second.status === 201);
  const sid = second.data?.run?.sessions?.[0]?.id;
  const sPause = await post(`/playback/sessions/${sid}/pause`);
  check('session pause (or queued->pause no-op) 200', sPause.status === 200 && sPause.data?.ok === true);
  const sStop = await post(`/playback/sessions/${sid}/stop`);
  check('session stop 200', sStop.status === 200 && sStop.data?.session?.status === 'stopped', JSON.stringify(sStop.data?.session));
  const sMissing = await post('/playback/sessions/nope/stop');
  check('unknown session -> 404', sMissing.status === 404);
  await post('/playback/stop');
  await del('/playback');

  // --- Validation & resource guard --------------------------------------
  console.log('\nAPI: validation & resource guard');
  const badUrl = await post('/playback/start', Object.assign({}, smallCfg, { videoUrl: 'https://example.com/video' }));
  check('unsupported URL -> 400', badUrl.status === 400 && badUrl.data?.ok === false, String(badUrl.status));
  const noUrl = await post('/playback/start', Object.assign({}, smallCfg, { videoUrl: '' }));
  check('missing URL -> 400', noUrl.status === 400, String(noUrl.status));

  const guard = await post('/playback/start', Object.assign({}, smallCfg, {
    totalSessions: 1, visiblePreviews: 0, backgroundSessions: 1, durationSec: 60,
    maxCpuPercent: 100, maxMemPercent: 10
  }));
  check('guard test run started', guard.status === 201);
  let guarded = { run: null };
  for (let i = 0; i < 20; i += 1) {
    await sleep(300);
    guarded = (await api('/playback')).data;
    if (guarded.run?.status === 'resource_paused') break;
  }
  check('resource limit auto-pauses run', guarded.run?.status === 'resource_paused' && guarded.run?.pausedReason === 'resource_limit', JSON.stringify({ status: guarded.run?.status, reason: guarded.run?.pausedReason }));
  await post('/playback/stop');
  await del('/playback');
  await del('/playback/history');

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => { console.error(err); process.exit(1); });
