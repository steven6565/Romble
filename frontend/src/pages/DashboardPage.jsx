// Main dashboard: stat cards, charts, video validation, organic task panel, terminal log.
import { useCallback, useEffect, useMemo, useState } from 'react';
import StatCard from '../components/StatsCard.jsx';
import Chart from '../components/Chart.jsx';
import TerminalLog from '../components/TerminalLog.jsx';
import TaskControls from '../components/TaskControls.jsx';
import api from '../api.js';
import { useToast } from '../components/Toast.jsx';

function formatBytes(n) {
  if (!n) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(n || 1) / Math.log(1024)), units.length - 1);
  return `${(n / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export default function DashboardPage({ stats, activity, connected }) {
  const toast = useToast();
  const [history, setHistory] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [url, setUrl] = useState('');
  const [validation, setValidation] = useState(null);
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(false);

  const refreshTasks = useCallback(async () => {
    try { setTasks((await api('/tasks')).tasks || []); } catch { /* keep last known */ }
  }, []);

  const refreshHistory = useCallback(async () => {
    try { setHistory((await api('/stats/history')).history || []); } catch { /* keep last */ }
  }, []);

  useEffect(() => {
    refreshTasks();
    refreshHistory();
    const i = setInterval(() => { refreshTasks(); refreshHistory(); }, 10000);
    return () => clearInterval(i);
  }, [refreshTasks, refreshHistory]);

  const totalRequests = useMemo(() => {
    const arr = (Array.isArray(stats?.recentActivity) ? stats.recentActivity : []).map((a) => a.requestsSent).filter((v) => typeof v === 'number');
    return arr.length ? arr[0] : stats?.totalOrganicRequests ?? 0;
  }, [stats]);

  const requestsSeries = useMemo(() => {
    const pts = history.map((h) => (typeof h.totalOrganicRequests === 'number' ? h.totalOrganicRequests : 0));
    return [...pts, stats?.totalOrganicRequests ?? 0];
  }, [history, stats]);

  const uptimeSeries = useMemo(() => history.map((h) => h.uptimeSec ?? 0).slice(-60), [history]);

  const validate = async () => {
    const t = url.trim();
    if (!t) { toast('Enter a video URL.', 'warning'); return; }
    setLoading(true);
    try {
      const d = await api(`/platform/validate?url=${encodeURIComponent(t)}`);
      if (!d.ok) throw new Error(d.reason || 'Invalid video URL');
      setValidation(d);
      toast('Video URL is valid.', 'success');
    } catch (err) {
      setValidation(null);
      toast(err.message || 'Invalid video URL.', 'error');
    } finally { setLoading(false); }
  };

  const getInfo = async () => {
    const t = url.trim();
    if (!t) { toast('Enter a video URL.', 'warning'); return; }
    try {
      const d = await api(`/platform/video?url=${encodeURIComponent(t)}`);
      setInfo(d);
      toast('Metadata retrieved from platform.', 'success');
    } catch (err) {
      setInfo(null);
      toast(err.message || 'Metadata could not be retrieved.', 'error');
    }
  };

  return (
    <section className="page">
      <div className="page-header">
        <div className="status-row">
          <span className={`status-dot ${connected ? 'on' : 'off'}`} />
          <h1>Dashboard</h1>
          <span className="status-text">{connected ? 'Connected' : 'Reconnecting…'}</span>
        </div>
        <p className="muted">Real-time stats, activity and platform tools for the Termux dashboard.</p>
      </div>

      <div className="grid stat-grid">
        <StatCard title="Uptime" value={stats?.uptimeFormatted || '—'} icon="⏱" color="var(--emerald)" />
        <StatCard title="CPU usage" value={stats?.cpuUsage ?? 0} unit="%" icon="⚙" color="var(--amber)" subtitle={`Server: ${stats?.platform ? 'reachable' : '—'}`} />
        <StatCard title="Memory used" value={stats?.memory?.usedBytes ? formatBytes(stats.memory.usedBytes) : '—'} icon="📦" color="var(--violet)" />
        <StatCard title="Active tasks" value={stats?.activeTasks ?? 0} icon="▶" color="var(--cyan)" />
        <StatCard title="Completed" value={stats?.completedTasks ?? 0} icon="✓" color="var(--emerald)" />
        <StatCard title="Failed" value={stats?.failedTasks ?? 0} icon="✕" color="var(--rose)" />
        <StatCard title="Organic requests" value={totalRequests} icon="↗" color="var(--blue)" />
        <StatCard title="API status" value={stats?.platformStatus ? (stats.platformStatus.youtube ? 'YouTube' : '—') : '—'} icon="🌐" color="var(--emerald)" />
      </div>

      <div className="grid chart-grid">
        <div className="card glass">
          <h2 className="section-title">Organic requests (last minutes)</h2>
          <Chart series={requestsSeries} color="var(--blue)" />
        </div>
        <div className="card glass">
          <h2 className="section-title">Uptime (seconds)</h2>
          <Chart series={uptimeSeries} color="var(--emerald)" />
        </div>
      </div>

      <div className="card glass">
        <h2 className="section-title">Video validation &amp; metadata</h2>
        <div className="task-panel">
          <input
            className="input"
            type="url"
            placeholder="https://www.youtube.com/watch?v=… or https://rumble.com/…"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && validate()}
            aria-label="Video URL"
          />
          <button className="btn" disabled={loading} onClick={validate}>{loading ? 'Checking…' : 'Validate'}</button>
          <button className="btn" onClick={getInfo} disabled={loading}>Metadata</button>
        </div>
        {validation && (
          <div className="validation-result">
            <div className={`tag ${validation.ok ? 'tag-completed' : 'tag-stopped'}`}>{validation.ok ? 'valid' : validation.reason}</div>
            {validation.platform && <span><strong>Platform:</strong> {validation.platform}</span>}
            {validation.videoId && <span><strong>ID:</strong> {validation.videoId}</span>}
          </div>
        )}
        {info && (
          <div className="validation-result">
            <div className="video-title">{info.info?.title || 'No title'}</div>
            <div className="video-meta">
              <span>Source: {info.source}</span>
              <span>Duration: {info.durationMs ? (info.durationMs / 60000).toFixed(2) + ' min' : 'unknown'}</span>
              <span>Views: {info.info?.views?.toLocaleString() ?? '—'}</span>
              <span>Likes: {info.info?.likes?.toLocaleString() ?? '—'}</span>
              <span>Latency: {info.latencyMs} ms</span>
            </div>
          </div>
        )}
      </div>

      <TaskControls tasks={tasks} refresh={refreshTasks} />

      <div className="card glass">
        <h2 className="section-title">Live terminal activity</h2>
        <TerminalLog entries={activity} height={280} />
      </div>
    </section>
  );
}
