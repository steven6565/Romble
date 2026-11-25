// API routes — all endpoints live under /api.
const express = require('express');
const router = express.Router();

const dashboardController = require('../controllers/dashboardController');
const platformController = require('../controllers/platformController');
const settingsController = require('../controllers/settingsController');
const playbackController = require('../controllers/playbackController');
const analyticsController = require('../controllers/analyticsController');

router.get('/health', dashboardController.health);
router.get('/stats', dashboardController.stats);
router.get('/stats/history', (req, res) => {
  const db = require('../services/db');
  const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 200));
  res.json({ ok: true, history: (db.get('statsHistory') || []).slice(-limit).reverse() });
});
router.get('/activity', dashboardController.activity);

router.get('/settings', settingsController.getSettings);
router.post('/settings', settingsController.updateSettings);

router.get('/platform/validate', platformController.validate);
router.get('/platform/video', platformController.videoInfo);
router.get('/platform/status', platformController.status);

// Verified platform analytics (never simulated).
router.get('/analytics', analyticsController.getAnalytics);
router.get('/analytics/history', analyticsController.getHistory);
router.get('/analytics/growth', analyticsController.getGrowth);

// Playback testing engine (local sessions, never creates platform engagement).
router.get('/playback', playbackController.getState);
router.get('/playback/config', playbackController.getConfig);
router.post('/playback/config', playbackController.updateConfig);
router.post('/playback/start', playbackController.start);
router.post('/playback/pause', playbackController.pause);
router.post('/playback/resume', playbackController.resume);
router.post('/playback/stop', playbackController.stop);
router.post('/playback/sessions/:sessionId/:action', playbackController.sessionAction);
router.delete('/playback', playbackController.clear);
router.delete('/playback/history', playbackController.clearHistory);

module.exports = router;
