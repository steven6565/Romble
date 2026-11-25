// Playback test controller — configurable local playback testing.
const playbackService = require('../services/playbackService');

function getState(req, res) {
  res.json({ ok: true, ...playbackService.getState() });
}

function getConfig(req, res) {
  res.json({ ok: true, config: playbackService.getConfig() });
}

function updateConfig(req, res) {
  const config = playbackService.updateConfig(req.body || {});
  res.json({ ok: true, config });
}

function start(req, res) {
  const run = playbackService.startRun(req.body || {});
  res.status(201).json({ ok: true, run });
}

function control(action) {
  return (req, res) => {
    const run = action();
    if (!run) return res.status(404).json({ ok: false, error: 'not_found', message: 'No playback test is active.' });
    res.json({ ok: true, run });
  };
}

function sessionAction(req, res) {
  const run = playbackService.controlSession(req.params.sessionId, req.params.action);
  if (!run) return res.status(404).json({ ok: false, error: 'not_found', message: 'Playback test not found.' });
  const session = run.sessions.find((s) => s.id === req.params.sessionId);
  if (!session) return res.status(404).json({ ok: false, error: 'not_found', message: 'Session not found.' });
  res.json({ ok: true, run, session });
}

function clear(req, res) {
  playbackService.clearRun();
  res.json({ ok: true });
}

function clearHistory(req, res) {
  playbackService.clearHistory();
  res.json({ ok: true });
}

module.exports = {
  getState, getConfig, updateConfig, start,
  pause: control(playbackService.pauseRun),
  resume: control(playbackService.resumeRun),
  stop: control(playbackService.stopRun),
  sessionAction, clear, clearHistory
};
