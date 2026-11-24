// Dashboard controller — health & real statistics.
const statsService = require('../services/statsService');
const activityService = require('../services/activityService');
const db = require('../services/db');
const taskService = require('../services/taskService');
const { probePlatformStatus } = require('../services/platformService');

const VERSION = '4.0.0';
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '127.0.0.1';

function getTasks() {
  const tasks = taskService.getTasks();
  return (Array.isArray(tasks) ? tasks : []).map((t) => ({
    id: t.id,
    platform: t.platform,
    videoId: t.videoId,
    status: t.status,
    requestsSent: t.requestsSent,
    errors: t.errors,
    startedAt: t.startedAt,
    finishedAt: t.finishedAt
  }));
}

async function health(req, res) {
  res.json({
    ok: true,
    status: 'ok',
    version: VERSION,
    uptimeSec: statsService.uptime(),
    port: PORT,
    host: HOST
  });
}

function statsSync() {
  const tasks = getTasks();
  const activity = db.get('activity') || [];
  return {
    ok: true,
    uptimeSec: statsService.uptime(),
    uptimeFormatted: statsService.uptimeFormatted(),
    cpuUsage: 0, // filled async in the async version below
    memory: statsService.memory(),
    activeTasks: tasks.filter((t) => t.status === 'running').length,
    completedTasks: tasks.filter((t) => t.status === 'completed').length,
    failedTasks: tasks.filter((t) => t.status === 'failed').length,
    totalTasks: tasks.length,
    totalOrganicRequests: tasks.reduce((s, t) => s + (t.requestsSent || 0), 0),
    platformStatus: null,
    lastActivityAt: activity.length ? activity[activity.length - 1].ts : null,
    statsHistoryCount: (db.get('statsHistory') || []).length
  };
}

async function stats(req, res) {
  const s = statsSync();
  s.cpuUsage = await statsService.cpu();
  s.platformStatus = await probePlatformStatus();
  s.recentActivity = activityService.listActivity(20);
  res.json(s);
}

async function activity(req, res) {
  const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 100));
  res.json({ ok: true, activity: activityService.listActivity(limit) });
}

module.exports = { health, stats, statsSync, activity, VERSION, PORT, HOST };
