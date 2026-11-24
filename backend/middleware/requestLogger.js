// Timestamped HTTP request logging middleware.
const log = require('../services/logService');

module.exports = function requestLogger(req, res, next) {
  const start = Date.now();
  res.on('finish', () => {
    try {
      log.info(`HTTP ${req.method} ${req.path} -> ${res.statusCode} in ${Date.now() - start}ms`);
    } catch { /* logging must never break responses */ }
  });
  next();
};
