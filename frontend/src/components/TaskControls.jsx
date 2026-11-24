// Task panel: start a new organic task + list of tasks with per-task controls.
import { useState } from 'react';
import api, { apiPost, apiDelete } from '../api.js';
import { useToast } from './Toast.jsx';

const STATUS_STYLE = {
  running: 'tag-running',
  paused: 'tag-paused',
  stopped: 'tag-stopped',
  completed: 'tag-completed',
  failed: 'tag-failed'
};

export default function TaskControls({ tasks, refresh }) {
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const start = async () => {
    const trimmed = url.trim();
    if (!trimmed) { toast('Enter a video URL first.', 'warning'); return; }
    setBusy(true);
    try {
      await apiPost('/tasks', { url: trimmed });
      toast('Task started — requests are being sent.', 'success');
      setUrl('');
      await refresh();
    } catch (err) {
      toast(err.message || 'Could not start the task.', 'error');
    } finally { setBusy(false); }
  };

  const act = async (id, endpoint) => {
    setBusy(true);
    try {
      await apiPost(`/tasks/${id}${endpoint}`);
      toast(`Task #${id} updated.`, 'success');
      await refresh();
    } catch (err) {
      toast(err.message || 'Could not update the task.', 'error');
    } finally { setBusy(false); }
  };

  const del = async (id) => {
    setBusy(true);
    try {
      await apiDelete(`/tasks/${id}`);
      toast(`Task #${id} deleted.`, 'success');
      await refresh();
    } catch (err) {
      toast(err.message || 'Could not delete the task.', 'error');
    } finally { setBusy(false); }
  };

  const list = Array.isArray(tasks) ? tasks : [];

  return (
    <section className="card glass">
      <h2 className="section-title">Organic viewer tasks</h2>
      <div className="task-panel">
        <input
          className="input"
          type="url"
          placeholder="https://www.youtube.com/watch?v=…"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && start()}
          aria-label="Video URL"
        />
        <button className="btn primary" disabled={busy} onClick={start}>
          {busy ? <span className="spinner" /> : 'Start task'}
        </button>
      </div>

      {list.length === 0 && (
        <p className="muted" style={{ fontSize: 13 }}>No tasks yet. Start one to send organic requests to your platform video.</p>
      )}

      {list.length > 0 && (
        <div className="task-list">
          {list.map((t) => (
            <div className="task-row glass" key={t.id}>
              <div className="task-info">
                <div className="task-top">
                  <span className={`tag ${STATUS_STYLE[t.status] || 'tag-stopped'}`}>{t.status}</span>
                  <span className="task-id">#{t.id}</span>
                  <span className="task-platform">{t.platform}</span>
                  {t.videoId && <span className="task-id">{t.videoId}</span>}
                </div>
                <div className="task-url">{t.url}</div>
                <div className="task-meta">
                  <span>Requests sent: <strong>{(t.requestsSent || 0).toLocaleString()}</strong></span>
                  <span>Errors: <strong>{t.errors || 0}</strong></span>
                  <span>Started: {new Date(t.startedAt).toLocaleTimeString([], { hour12: false })}</span>
                  {t.finishedAt && <span>Finished: {new Date(t.finishedAt).toLocaleTimeString([], { hour12: false })}</span>}
                </div>
              </div>
              <div className="task-controls-row">
                <button className="btn" disabled={busy || t.status === 'paused'} onClick={() => act(t.id, '/pause')}>Pause</button>
                <button className="btn" disabled={busy || t.status !== 'paused'} onClick={() => act(t.id, '/resume')}>Resume</button>
                <button className="btn danger" disabled={busy || t.status !== 'running'} onClick={() => act(t.id, '/stop')}>Stop</button>
                <button className="btn danger" disabled={busy} onClick={() => del(t.id)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
