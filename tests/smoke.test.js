// Smoke tests — run against a live server (default http://127.0.0.1:3000).
// Usage: node tests/smoke.test.js
const { validateVideoUrl } = require('../backend/services/platformService');

const BASE = (process.env.SMOKE_BASE || `http://127.0.0.1:${process.env.PORT || 3000}`);

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

async function api(path, options = {}) {
  const res = await fetch(`${BASE}/api${path}`, options);
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function run() {
  console.log(`Smoke tests against ${BASE}\n`);

  // --- Unit: URL validation ---------------------------------------------
  console.log('Unit: validateVideoUrl');
  const yt = validateVideoUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  check('youtube watch ok', yt.ok && yt.platform === 'youtube' && yt.videoId === 'dQw4w9WgXcQ', JSON.stringify(yt));
  const ytShorts = validateVideoUrl('https://youtube.com/shorts/AbCdEfGhIjK');
  check('youtube shorts ok', ytShorts.ok && ytShorts.platform === 'youtube');
  const ytBe = validateVideoUrl('https://youtu.be/dQw4w9WgXcQ');
  check('youtube youtu.be ok', ytBe.ok && ytBe.platform === 'youtube' && ytBe.videoId === 'dQw4w9WgXcQ', JSON.stringify(ytBe));
  const rumble = validateVideoUrl('https://rumble.com/vabc123-example-video.html');
  check('rumble ok', rumble.ok && rumble.platform === 'rumble', JSON.stringify(rumble));
  const bad = validateVideoUrl('not-a-url');
  check('rejects invalid url', !bad.ok, JSON.stringify(bad));
  const missing = validateVideoUrl('');
  check('rejects missing url', !missing.ok);

  // --- API: health --------------------------------------------------------
  console.log('\nAPI: health & stats');
  const health = await api('/health');
  check('GET /api/health 200', health.status === 200);
  check('health shape', health.data && health.data.status === 'ok' && health.data.port > 0, JSON.stringify(health.data));

  const stats = await api('/stats');
  check('GET /api/stats 200', stats.status === 200);
  check('stats has uptime', typeof stats.data?.uptimeSec === 'number', JSON.stringify(stats.data?.uptimeSec));
  check('stats has task counters', ['activeTasks', 'completedTasks', 'failedTasks'].every((k) => typeof stats.data?.[k] === 'number'), JSON.stringify(stats.data));
  check('stats has platformStatus key', 'platformStatus' in stats.data);

  const hist = await api('/stats/history');
  check('GET /api/stats/history 200', hist.status === 200 && Array.isArray(hist.data?.history));

  // --- API: activity ------------------------------------------------------
  console.log('\nAPI: activity');
  const activity = await api('/activity?limit=20');
  check('GET /api/activity 200', activity.status === 200 && Array.isArray(activity.data?.activity));

  // --- API: settings -------------------------------------------------------
  console.log('\nAPI: settings');
  const before = (await api('/settings')).data;
  const saved = await api('/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshIntervalSec: 2 }) });
  check('POST /api/settings 200', saved.status === 200 && saved.data?.settings?.refreshIntervalSec === 2, JSON.stringify(saved.data));
  const after = (await api('/settings')).data?.settings;
  check('settings persisted', after?.refreshIntervalSec === 2, JSON.stringify(after));
  // restore original value
  await api('/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(before.settings) });

  // --- API: platform --------------------------------------------------------
  console.log('\nAPI: platform');
  const val = await api('/platform/validate?url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3DdQw4w9WgXcQ');
  check('GET /api/platform/validate ok', val.status === 200 && val.data?.ok === true && val.data?.platform === 'youtube', JSON.stringify(val.data));
  const valBad = await api('/platform/validate?url=https%3A%2F%2Fexample.com%2Fvideo');
  check('GET /api/platform/validate rejects unknown platform', valBad.status === 400 && valBad.data?.ok === false, JSON.stringify(valBad.data));

  // --- API: tasks lifecycle --------------------------------------------------
  console.log('\nAPI: task lifecycle');
  const created = await api('/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }) });
  check('POST /api/tasks 201', created.status === 201 && created.data?.task?.id, JSON.stringify(created.data));
  const id = created.data?.task?.id;
  await new Promise((r) => setTimeout(r, 5000));

  let list = (await api('/tasks')).data;
  let t = (list.tasks || []).find((x) => x.id === id);
  check('task exists', Boolean(t));
  check('task requests sent after ~5s', t && t.requestsSent >= 1, `requestsSent=${t?.requestsSent}`);

  const statCountBefore = ((await api('/stats')).data?.totalOrganicRequests) || 0;
  check('stats totalOrganicRequests >= 0', typeof statCountBefore === 'number');

  const paused = await api(`/tasks/${id}/pause`, { method: 'POST' });
  check('POST /pause 200', paused.status === 200 && paused.data?.task?.status === 'paused', JSON.stringify(paused.data));
  const reqsAtPause = ((await api('/tasks')).data.tasks.find((x) => x.id === id))?.requestsSent || 0;
  await new Promise((r) => setTimeout(r, 3200));
  const reqsAfterWait = ((await api('/tasks')).data.tasks.find((x) => x.id === id))?.requestsSent || 0;
  check('paused task stops sending', reqsAtPause === reqsAfterWait, `requestsSent ${reqsAtPause} -> ${reqsAfterWait}`);

  const resumed = await api(`/tasks/${id}/resume`, { method: 'POST' });
  check('POST /resume 200', resumed.status === 200 && resumed.data?.task?.status === 'running', JSON.stringify(resumed.data));

  const stopped = await api(`/tasks/${id}/stop`, { method: 'POST' });
  check('POST /stop 200', stopped.status === 200 && stopped.data?.task?.status === 'stopped', JSON.stringify(stopped.data));
  list = (await api('/tasks')).data;
  t = list.tasks.find((x) => x.id === id);
  check('stopped task has finishedAt', Boolean(t?.finishedAt));

  const del = await api(`/tasks/${id}`, { method: 'DELETE' });
  check('DELETE /api/tasks/:id 200', del.status === 200 && del.data?.ok === true, JSON.stringify(del.data));

  const badStop = await api('/tasks/999999/stop', { method: 'POST' });
  check('stop missing task -> 404', badStop.status === 404, String(badStop.status));

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => { console.error(err); process.exit(1); });
