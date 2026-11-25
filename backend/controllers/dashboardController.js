// Dashboard controller — health & real statistics.
const statsService = require('../services/statsService');
const activityService = require('../services/activityService');
const db = require('../services/db');
const playbackService = require('../services/playbackService');
const { probePlatformStatus } = require('../services/platformService');

const VERSION = '5.0.0';
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '127.0.0.1';

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
  const activity = db.get('activity') || [];
  let playback = null;
  try {
    const state = playbackService.getState();
    const run = state.run;
    playback = {
      status: run ? run.status : 'idle',
      totalSessions: run ? run.sessions.length : 0,
      runningSessions: run ? run.sessions.filter((s) => s.status === 'running').length : 0,
      completedSessions: run ? run.sessions.filter((s) => s.status === 'completed').length : 0,
      failedSessions: run ? run.sessions.filter((s) => s.status === 'failed').length : 0,
      previewCount: run ? run.sessions.filter((s) => s.kind === 'preview').length : 0
    };
  } catch { /* playback state unavailable */ }

  return {
    ok: true,
    version: VERSION,
    uptimeSec: statsService.uptime(),
    uptimeFormatted: statsService.uptimeFormatted(),
    cpuUsage: 0,
    memory: statsService.memory(),
    playback,
    platformStatus: null,
    lastActivityAt: activity.length ? activity[activity.length - 1].ts : null
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
