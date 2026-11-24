// API routes — all endpoints live under /api.
const express = require('express');
const router = express.Router();

const dashboardController = require('../controllers/dashboardController');
const platformController = require('../controllers/platformController');
const settingsController = require('../controllers/settingsController');
const taskController = require('../controllers/taskController');

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

router.get('/tasks', taskController.getTasks);
router.post('/tasks', taskController.startTask);
router.post('/tasks/:id/pause', taskController.pauseTask);
router.post('/tasks/:id/resume', taskController.resumeTask);
router.post('/tasks/:id/stop', taskController.stopTask);
router.delete('/tasks/:id', taskController.deleteTask);

module.exports = router;
