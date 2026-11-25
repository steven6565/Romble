// Genuine analytics controller — verified platform statistics only.
const analyticsService = require('../services/analyticsService');

async function getAnalytics(req, res) {
  const url = typeof req.query.url === 'string' ? req.query.url.trim() : '';
  if (!url) return res.status(400).json({ ok: false, error: 'validation_error', message: 'Missing required parameter: url' });
  const refresh = req.query.refresh === '1' || req.query.refresh === 'true';
  const result = await analyticsService.getAnalytics(url, { refresh });
  res.status(result.ok ? 200 : 200).json(result);
}

function getHistory(req, res) {
  const url = typeof req.query.url === 'string' ? req.query.url.trim() : '';
  if (!url) return res.status(400).json({ ok: false, error: 'validation_error', message: 'Missing required parameter: url' });
  res.json(analyticsService.getHistory(url));
}

async function getGrowth(req, res) {
  const url = typeof req.query.url === 'string' ? req.query.url.trim() : '';
  if (!url) return res.status(400).json({ ok: false, error: 'validation_error', message: 'Missing required parameter: url' });
  const analysis = await analyticsService.getAnalytics(url, { refresh: false });
  res.json({
    ok: true,
    verified: Boolean(analysis.verified),
    suggestions: analyticsService.growthSuggestions(analysis),
    unavailable: analyticsService.UNAVAILABLE
  });
}

module.exports = { getAnalytics, getHistory, getGrowth };
