// Settings controller — persistent dashboard settings (database/db.json).
const db = require('../services/db');
const { createRateLimiter } = require('../middleware/rateLimit');

const ALLOWED_KEYS = ['refreshIntervalSec', 'autoStart', 'logRetentionDays', 'theme', 'platform', 'maxHistoryDays'];

const DEFAULT_SETTINGS = {
  refreshIntervalSec: 3,
  autoStart: false,
  logRetentionDays: 7,
  maxHistoryDays: 30,
  theme: 'dark',
  platform: 'youtube'
};

const rateLimit = createRateLimiter(120);

function getSettings(req, res) {
  const stored = db.get('settings') || {};
  res.json({ ok: true, settings: Object.assign({}, DEFAULT_SETTINGS, stored) });
}

function updateSettings(req, res) {
  rateLimit(req, res, () => {
    const body = (req.body && typeof req.body === 'object') ? req.body : {};
    const clean = {};
    for (const key of ALLOWED_KEYS) {
      if (body[key] !== undefined) clean[key] = body[key];
    }
    const settings = Object.assign({}, DEFAULT_SETTINGS, db.get('settings') || {}, clean);
    // Sanitize types so a bad request cannot corrupt the dashboard.
    if (typeof settings.refreshIntervalSec !== 'number' || settings.refreshIntervalSec < 0.5) settings.refreshIntervalSec = 3;
    if (typeof settings.logRetentionDays !== 'number') settings.logRetentionDays = 7;
    if (typeof settings.maxHistoryDays !== 'number') settings.maxHistoryDays = 30;
    db.set('settings', settings);
    res.json({ ok: true, settings });
  });
}

module.exports = { getSettings, updateSettings, DEFAULT_SETTINGS };
