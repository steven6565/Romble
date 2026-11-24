// Platform controller — video URL validation & metadata retrieval.
const { validateVideoUrl, getVideoMetadata, probePlatformStatus } = require('../services/platformService');
const { requireQueryString } = require('../utils/validate');

async function validate(req, res) {
  const check = requireQueryString(req);
  if (!check.ok) return res.status(400).json({ ok: false, error: 'validation_error', message: check.message });
  const result = validateVideoUrl(check.value);
  if (!result.ok) return res.status(400).json(result);
  res.json(result);
}

async function videoInfo(req, res) {
  const check = requireQueryString(req);
  if (!check.ok) return res.status(400).json({ ok: false, error: 'validation_error', message: check.message });
  const validation = validateVideoUrl(check.value);
  if (!validation.ok) return res.status(400).json(validation);
  const started = Date.now();
  let info;
  try {
    info = await getVideoMetadata(validation.normalized, validation.platform);
  } catch (err) {
    return res.status(502).json({
      ok: false,
      error: 'metadata_unavailable',
      message: err.message || 'Metadata could not be retrieved from the platform',
      platform: validation.platform,
      videoId: validation.videoId
    });
  }
  res.json({
    ok: true,
    platform: validation.platform,
    videoId: validation.videoId,
    info,
    durationMs: info.durationSec * 1000,
    source: info.source,
    latencyMs: Date.now() - started
  });
}

async function status(req, res) {
  const result = await probePlatformStatus();
  res.json({ ok: true, ...result });
}

module.exports = { validate, videoInfo, status };
