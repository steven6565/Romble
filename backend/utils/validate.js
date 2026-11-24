// Input validation helpers.

function isValidHttpUrl(url) {
  if (typeof url !== 'string') return false;
  try {
    const u = new URL(url.trim());
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

function requireQueryString(req) {
  const raw = req.query && req.query.url;
  if (typeof raw !== 'string' || raw.trim() === '') {
    return { ok: false, error: 'validation_error', message: 'Missing required parameter: url' };
  }
  return { ok: true, value: raw.trim() };
}

module.exports = { isValidHttpUrl, requireQueryString };
