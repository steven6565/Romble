// Simple in-memory rate limiter (sliding window per client IP).
function createRateLimiter(maxPerMin) {
  const windowMs = 60 * 1000;
  const hits = new Map();

  function cleanup() {
    const now = Date.now();
    for (const [ip, times] of hits.entries()) {
      const fresh = times.filter((t) => now - t < windowMs);
      if (fresh.length === 0) hits.delete(ip);
      else hits.set(ip, fresh);
    }
  }

  return function rateLimit(req, res, next) {
    const ip = (req.headers['x-forwarded-for'] || req.ip || 'unknown').split(',')[0].trim();
    cleanup();
    const times = hits.get(ip) || [];
    if (times.length >= maxPerMin) {
      res.status(429).json({ ok: false, error: 'rate_limited', message: 'Too many requests — retry later.' });
      return;
    }
    times.push(Date.now());
    hits.set(ip, times);
    next();
  };
}

module.exports = { createRateLimiter };
