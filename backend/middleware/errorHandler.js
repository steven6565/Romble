// Global error handler — never exposes stack traces to clients.
const log = require('../services/logService');

module.exports = function errorHandler(err, req, res, next) {
  log.error(`HTTP ${req.method} ${req.path} error: ${(err && err.message) || err}`);
  const status = Number(err && err.status) >= 400 && Number(err && err.status) < 600 ? Number(err.status) : 500;
  if (!res.headersSent) {
    res.status(status).json({ ok: false, error: 'internal_error', message: (err && err.message) || 'Request failed' });
  } else {
    res.end();
  }
};
