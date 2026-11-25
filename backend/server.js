// Main entry point — starts the Express server + Socket.IO + static dashboard.
// Run with: node backend/server.js   (or: bash start.sh)
const fs = require('fs');
const http = require('http');
const path = require('path');
const express = require('express');
const socketIo = require('socket.io');

const { loadEnv } = require('./services/env');
const log = require('./services/logService');
const statsService = require('./services/statsService');
const activityService = require('./services/activityService');
const playbackService = require('./services/playbackService');
const dashboardController = require('./controllers/dashboardController');
const apiRoutes = require('./routes/api.routes');
const requestLogger = require('./middleware/requestLogger');
const errorHandler = require('./middleware/errorHandler');

loadEnv();

const HOST = (process.env.PUBLIC_BIND === '1' ? '0.0.0.0' : (process.env.HOST || '127.0.0.1'));
const PORT = Number(process.env.PORT || 3000);

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  transports: ['websocket', 'polling'],
  cors: {
    origin: (origin, cb) => {
      if (!origin || origin.startsWith('http://127.0.0.1') || origin.startsWith('http://localhost') || origin.startsWith('http://[::1]')) {
        cb(null, origin);
      } else {
        cb(null, false);
      }
    }
  }
});

// --- Middleware & routes -------------------------------------------------
app.use(express.json({ limit: '1mb' }));
app.use(requestLogger);
app.use('/api', apiRoutes);

// Static dashboard (built React app) — serve if built.
const DIST_DIR = path.resolve(__dirname, '..', 'frontend', 'dist');
if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
  app.get('/', (req, res) => res.sendFile(path.join(DIST_DIR, 'index.html')));
} else {
  log.warn('[server] frontend/dist not found — run `cd frontend && npm run build`');
  app.get('/', (req, res) => res.status(503).json({ ok: false, error: 'frontend_not_built' }));
}
app.use(errorHandler);

// --- Real-time streaming --------------------------------------------------
let statsTimer = null;
let lastPlaybackPayload = '';

async function broadcastStats() {
  try {
    const s = dashboardController.statsSync();
    s.cpuUsage = await statsService.cpu();
    io.emit('stats', s);
  } catch (err) { log.debug('[ws] stats broadcast error: ' + err.message); }
}

// Playback state is broadcast only when it actually changes, to keep the
// phone's radio quiet.
playbackService.setBroadcaster((state) => {
  const run = state.run;
  const fingerprint = run
    ? `${run.id}:${run.status}:${run.sessions.map((s) => `${s.id}${s.status}${s.elapsedSec}`).join('')}`
    : 'idle';
  if (fingerprint === lastPlaybackPayload) return;
  lastPlaybackPayload = fingerprint;
  io.emit('playback', state);
});

io.on('connection', (socket) => {
  log.info('[ws] client connected');
  socket.on('request_stats', () => {
    socket.emit('stats', dashboardController.statsSync());
  });
  socket.on('request_activity', (limit) => {
    socket.emit('activity_update', activityService.listActivity(limit || 50));
  });
  socket.on('request_playback', () => {
    socket.emit('playback', playbackService.getState());
  });
  const unsubscribe = activityService.onNewActivity((entry) => {
    io.emit('activity', entry);
  });
  socket.on('disconnect', () => {
    unsubscribe();
    log.info('[ws] client disconnected');
  });
  socket.emit('stats', dashboardController.statsSync());
  socket.emit('playback', playbackService.getState());
});

// --- Background stats timer ----------------------------------------------
if (!statsTimer) {
  statsTimer = setInterval(broadcastStats, Math.max(1000, Number(process.env.STATS_REFRESH_SECONDS || 3) * 1000));
  if (statsTimer.unref) statsTimer.unref();
}

// Periodically persist stats history.
const historyTimer = setInterval(async () => {
  try {
    const db = require('./services/db');
    const stats = dashboardController.statsSync();
    const cpu = await statsService.cpu();
    db.update('statsHistory', (list) => (list || []).concat([{
      ts: new Date().toISOString(),
      uptimeSec: stats.uptimeSec,
      cpuUsage: cpu,
      memoryPercent: stats.memory?.usedPercent ?? 0,
      runningSessions: stats.playback?.runningSessions ?? 0,
      completedSessions: stats.playback?.completedSessions ?? 0
    }]).slice(-288));
  } catch { /* persistence must never crash the server */ }
}, 15000);
if (historyTimer.unref) historyTimer.unref();

// --- Startup --------------------------------------------------------------
playbackService.ensureEngine();

server.listen(PORT, HOST, () => {
  log.info(`Romble V5 dashboard listening on http://${HOST}:${PORT}`);
  console.log(`[OK] Dashboard: http://${HOST}:${PORT} (pid ${process.pid})`);
});

// --- Graceful shutdown ----------------------------------------------------
async function shutdown(signal) {
  log.info(`Received ${signal} — shutting down gracefully`);
  if (statsTimer) clearInterval(statsTimer);
  clearInterval(historyTimer);
  playbackService.shutdown();
  io.close();
  await new Promise((resolve) => server.close(resolve));
  setTimeout(() => process.exit(0), 1000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('uncaughtException', (err) => {
  log.error('[server] uncaughtException: ' + (err && err.stack ? err.stack.split('\n').slice(0, 3).join(' | ') : err));
});
process.on('unhandledRejection', (err) => {
  log.error('[server] unhandledRejection: ' + (err && err.message));
});

module.exports = server;
