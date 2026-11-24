// Organic viewer/request task service.
// An "organic task" sends real HTTP requests to the target video (with random
// user agents, referrers and spoofed X-Forwarded-For IPs) and counts them.
// We display "requests sent" — never invented views.
const { loadEnv } = require('./env');
const log = require('./logService');
const db = require('./db');
const activityService = require('./activityService');
const { validateVideoUrl } = require('./platformService');

loadEnv();

const INTERVAL_MS = Math.max(1000, Math.round((Number(process.env.TASK_REQUEST_INTERVAL) || 5) * 1000));
const MAX_CONCURRENCY = Number(process.env.TASK_MAX_CONCURRENCY) || 3;
const HISTORY_LIMIT = 600;

const UA_LIST = [
  'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
  'Mozilla/5.0 (Linux; Android 14; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
  'Mozilla/5.0 (Linux; Android 13; SM-A525F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
];

let loopRunning = false;

function getTasks() {
  return db.get('tasks') || [];
}

function findTask(id) {
  return getTasks().find((t) => t.id === id) || null;
}

function saveTask(task) {
  db.update('tasks', (list) => list.map((t) => (t.id === task.id ? task : t)));
}

function startTask(platform, url, videoId) {
  const id = Date.now() * 1000 + Math.floor(Math.random() * 999);
  const task = {
    id,
    url,
    platform,
    videoId: videoId || null,
    status: 'running',
    requestsSent: 0,
    errors: 0,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    maxRequests: Number(process.env.TASK_MAX_REQUESTS) || 0
  };
  db.update('tasks', (list) => {
    const arr = list || [];
    arr.push(task);
    return arr.slice(-500);
  });
  activityService.addActivity('task_started', `Organic task #${id} started on ${platform}${videoId ? ` (${videoId})` : ''}`);
  runLoop();
  return task;
}

function setTaskStatus(id, status, activityType, activityMessage) {
  const task = findTask(id);
  if (!task) return null;
  task.status = status;
  if (status === 'stopped' || status === 'completed' || status === 'failed') task.finishedAt = new Date().toISOString();
  saveTask(task);
  if (activityMessage) activityService.addActivity(activityType, activityMessage);
  return task;
}

function pauseTask(id) {
  const t = findTask(id);
  if (!t || t.status !== 'running') return t;
  return setTaskStatus(id, 'paused', 'task_paused', `Organic task #${id} paused after ${t.requestsSent} requests`);
}

function resumeTask(id) {
  const t = findTask(id);
  if (!t || t.status !== 'paused') return t;
  const res = setTaskStatus(id, 'running', 'task_resumed', `Organic task #${id} resumed`);
  runLoop();
  return res;
}

function stopTask(id) {
  const t = findTask(id);
  if (!t) return null;
  return setTaskStatus(id, 'stopped', 'task_stopped', `Organic task #${id} stopped after ${t.requestsSent} requests`);
}

function deleteTask(id) {
  db.update('tasks', (list) => (list || []).filter((t) => t.id !== id));
  activityService.addActivity('task_deleted', `Organic task #${id} removed`);
  return { ok: true };
}

function isLoopRunning() { return loopRunning; }

function runLoop() {
  if (loopRunning) return;
  loopRunning = true;
  log.info('Organic request loop is active');

  const step = async () => {
    try {
      const running = getTasks().filter((t) => t.status === 'running');
      for (const task of running) {
        if (!loopRunning) break;
        if (task.maxRequests && task.requestsSent >= task.maxRequests) {
          setTaskStatus(task.id, 'completed', 'task_completed', `Organic task #${task.id} completed with ${task.requestsSent} requests`);
          continue;
        }
        await sendOrganicRequest(task);
      }
    } catch (err) {
      log.error('[loop] ' + (err && err.message));
    }
    const stillRunning = getTasks().some((t) => t.status === 'running');
    if (loopRunning && stillRunning) setTimeout(step, INTERVAL_MS);
    else loopRunning = false;
  };
  step();
}

async function sendOrganicRequest(task) {
  task.requestsSent += 1;
  saveTask(task);
  const ua = UA_LIST[Math.floor(Math.random() * UA_LIST.length)];
  const referer = task.platform === 'rumble' ? 'https://rumble.com/' : 'https://www.youtube.com/';
  const ip = `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(task.url, {
      method: 'GET',
      redirect: 'manual',
      signal: controller.signal,
      headers: { 'User-Agent': ua, 'Referer': referer, 'X-Forwarded-For': ip, Accept: 'text/html' }
    });
    await res.arrayBuffer().catch(() => {}); // drain so the socket closes
    activityService.addActivity('request_sent', `Organic request #${task.requestsSent} to ${task.platform} video`, { taskId: task.id, httpStatus: res.status });
  } catch (err) {
    task.errors += 1;
    saveTask(task);
    activityService.addActivity('request_error', `Organic request failed for task #${task.id}`, { taskId: task.id });
  } finally {
    clearTimeout(timer);
  }
}

function stopAll() {
  let count = 0;
  for (const t of getTasks()) {
    if (t.status === 'running' || t.status === 'paused') {
      t.status = 'stopped';
      t.finishedAt = new Date().toISOString();
      count += 1;
    }
  }
  if (count) db.set('tasks', getTasks());
  loopRunning = false;
  if (count) log.info(`Stopped ${count} running/paused organic task(s)`);
}

module.exports = {
  startTask, pauseTask, resumeTask, stopTask, deleteTask, getTasks, findTask,
  saveTask, runLoop, stopAll, isLoopRunning, setTaskStatus, MAX_CONCURRENCY
};
