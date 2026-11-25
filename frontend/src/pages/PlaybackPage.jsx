// Playback testing page: config → start → previews → controls.
import { useCallback, useEffect, useState } from 'react';
import api, { apiPost, apiDelete } from '../api.js';
import PlaybackConfig from '../components/PlaybackConfig.jsx';
import PreviewGrid from '../components/PreviewGrid.jsx';
import AnalyticsPanel from '../components/AnalyticsPanel.jsx';
import { useToast } from '../components/Toast.jsx';

export default function PlaybackPage({ playback, connected }) {
  const toast = useToast();
  const [config, setConfig] = useState(null);
  const [info, setInfo] = useState(null);
  const [busy, setBusy] = useState(false);

  const run = playback?.run || null;
  const active = Boolean(run && ['running', 'paused', 'resource_paused'].includes(run.status));

  useEffect(() => {
    api('/playback/config')
      .then((d) => setConfig(d.config))
      .catch(() => toast('Could not load playback configuration.', 'error'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load metadata once a URL is available so previews can show thumbnails.
  useEffect(() => {
    const url = (run?.config?.videoUrl) || (config?.videoUrl);
    if (!url || !/^https?:\/\//i.test(url)) return;
    let cancelled = false;
    api(`/platform/video?url=${encodeURIComponent(url)}`)
      .then((d) => { if (!cancelled) setInfo(d.info || null); })
      .catch(() => { if (!cancelled) setInfo(null); });
    return () => { cancelled = true; };
  }, [run?.config?.videoUrl, config?.videoUrl]);

  const saveConfig = useCallback((next) => {
    setConfig(next);
    apiPost('/playback/config', next).catch(() => { /* saved on start anyway */ });
  }, []);

  const start = async () => {
    setBusy(true);
    try {
      await apiPost('/playback/start', config || {});
      toast('Playback test started — preview players use the official embed.', 'success');
    } catch (err) {
      toast(err.message || 'Could not start the playback test.', 'error');
    } finally { setBusy(false); }
  };

  const control = async (path, message) => {
    setBusy(true);
    try {
      await apiPost(path);
      toast(message, 'success');
    } catch (err) {
      toast(err.message || 'Action failed.', 'error');
    } finally { setBusy(false); }
  };

  const sessionAction = async (session, action) => {
    try {
      await apiPost(`/playback/sessions/${session.id}/${action}`);
    } catch (err) {
      toast(err.message || 'Session action failed.', 'error');
    }
  };

  const clear = async () => {
    try {
      await apiDelete('/playback');
      toast('Playback test cleared.', 'success');
    } catch (err) {
      toast(err.message || 'Could not clear the test.', 'error');
    }
  };

  const summary = run?.summary;

  return (
    <section className="page">
      <div className="page-header">
        <div className="status-row">
          <span className={`status-dot ${connected ? 'on' : 'off'}`} />
          <h1>Playback Testing</h1>
          <span className="status-text">{connected ? 'Live' : 'Reconnecting…'}</span>
        </div>
        <p className="muted">Local playback tests for authorized media. Preview screens use the official platform player; background sessions are simulated timers.</p>
      </div>

      <div className="card glass">
        <div className="section-head">
          <h2 className="section-title">Test configuration</h2>
          <span className="badge-neutral">resource-aware</span>
        </div>
        {config ? (
          <PlaybackConfig config={config} onChange={saveConfig} disabled={active || busy} />
        ) : (
          <div className="skeleton-block" />
        )}
        <div className="form-actions">
          <button className="btn primary" onClick={start} disabled={busy || active}>Start test</button>
          <button className="btn" onClick={() => control('/playback/pause', 'Playback test paused.')} disabled={busy || run?.status !== 'running'}>Pause</button>
          <button className="btn" onClick={() => control('/playback/resume', 'Playback test resumed.')} disabled={busy || !['paused', 'resource_paused'].includes(run?.status)}>Resume</button>
          <button className="btn danger" onClick={() => control('/playback/stop', 'Playback test stopped.')} disabled={busy || !active}>Stop</button>
          <button className="btn" onClick={clear} disabled={busy || active}>Clear</button>
        </div>
        {run?.pausedReason === 'resource_limit' && (
          <div className="notice notice-warning" style={{ marginTop: 12 }}>
            <strong>Auto-paused to protect the device.</strong>
            <span className="notice-hint">CPU or memory exceeded your configured limits. Lower the session count or concurrency, then resume.</span>
          </div>
        )}
      </div>

      {summary && (
        <div className="card glass">
          <div className="section-head">
            <h2 className="section-title">Run status</h2>
            <span className={`tag tag-${run.status}`}>{run.status}</span>
          </div>
          <div className="summary-grid">
            <div className="metric"><span>Total</span><strong>{summary.total}</strong></div>
            <div className="metric"><span>Running</span><strong>{summary.running}</strong></div>
            <div className="metric"><span>Queued</span><strong>{summary.queued}</strong></div>
            <div className="metric"><span>Completed</span><strong>{summary.completed}</strong></div>
            <div className="metric"><span>Failed</span><strong>{summary.failed}</strong></div>
            <div className="metric"><span>Stopped</span><strong>{summary.stopped}</strong></div>
          </div>
        </div>
      )}

      <PreviewGrid
        run={run}
        info={info}
        controls={{
          play: (s) => sessionAction(s, 'resume'),
          pause: (s) => sessionAction(s, 'pause'),
          stop: (s) => sessionAction(s, 'stop')
        }}
      />

      {playback?.history?.length > 0 && (
        <div className="card glass">
          <h2 className="section-title">Previous tests</h2>
          <div className="history-list">
            {playback.history.slice().reverse().map((h) => (
              <div className="history-row" key={h.id}>
                <span className={`tag tag-${h.status}`}>{h.status}</span>
                <span className="history-date">{new Date(h.startedAt).toLocaleString()}</span>
                <span className="muted small-text">{h.summary?.total || 0} sessions · {h.summary?.completed || 0} completed</span>
                <span className="muted small-text">{h.config?.platform}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <AnalyticsPanel defaultUrl={config?.videoUrl || ''} />
    </section>
  );
}
