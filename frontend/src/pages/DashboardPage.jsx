// Main dashboard: real stats, verified platform status, live activity.
import { useEffect, useMemo, useState } from 'react';
import StatCard from '../components/StatsCard.jsx';
import Chart from '../components/Chart.jsx';
import TerminalLog from '../components/TerminalLog.jsx';
import api from '../api.js';

function formatBytes(n) {
  if (!n) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(n || 1) / Math.log(1024)), units.length - 1);
  return `${(n / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export default function DashboardPage({ stats, activity, connected, playback }) {
  const [history, setHistory] = useState([]);

  useEffect(() => {
    const load = () => api('/stats/history')
      .then((d) => setHistory(Array.isArray(d.history) ? d.history : []))
      .catch(() => { /* keep last known history */ });
    load();
    const timer = setInterval(load, 15000);
    return () => clearInterval(timer);
  }, []);

  // History comes back newest-first; charts want oldest-first.
  const ordered = useMemo(() => history.slice().reverse(), [history]);

  const cpuSeries = useMemo(() => ordered.map((h) => h.cpuUsage ?? 0), [ordered]);
  const memSeries = useMemo(() => ordered.map((h) => h.memoryPercent ?? 0), [ordered]);
  const sessionSeries = useMemo(() => ordered.map((h) => h.runningSessions ?? 0), [ordered]);

  const platformStatus = stats?.platformStatus;
  const platformLabel = !platformStatus
    ? '—'
    : [platformStatus.youtube ? 'YouTube' : null, platformStatus.rumble ? 'Rumble' : null].filter(Boolean).join(' · ') || 'Offline';

  return (
    <section className="page">
      <div className="page-header">
        <div className="status-row">
          <span className={`status-dot ${connected ? 'on' : 'off'}`} />
          <h1>Dashboard</h1>
          <span className="status-text">{connected ? 'Connected' : 'Reconnecting…'}</span>
        </div>
        <p className="muted">Real device statistics, local playback engine state and verified platform connectivity.</p>
      </div>

      <div className="stat-grid">
        <StatCard title="Uptime" value={stats?.uptimeFormatted || '—'} icon="⏱" color="var(--emerald)" />
        <StatCard title="CPU usage" value={stats?.cpuUsage ?? 0} unit="%" icon="⚙" color="var(--amber)" subtitle="sampled from /proc/stat" />
        <StatCard title="Memory used" value={stats?.memory?.usedBytes ? formatBytes(stats.memory.usedBytes) : '—'} icon="📦" color="var(--violet)" subtitle={stats?.memory ? `${stats.memory.usedPercent}% of device RAM` : ''} />
        <StatCard title="Platform APIs" value={platformLabel} icon="🌐" color="var(--cyan)" subtitle="reachability, not views" />
        <StatCard title="Test sessions" value={stats?.playback?.totalSessions ?? 0} icon="▶" color="var(--blue)" subtitle="local tests only" />
        <StatCard title="Running now" value={stats?.playback?.runningSessions ?? 0} icon="◉" color="var(--emerald)" subtitle="local, not viewers" />
        <StatCard title="Completed" value={stats?.playback?.completedSessions ?? 0} icon="✓" color="var(--violet)" subtitle="test sessions" />
        <StatCard title="Engine state" value={stats?.playback?.status || 'idle'} icon="⌁" color="var(--amber)" />
      </div>

      <div className="notice notice-info">
        <strong>Local tests are never platform engagement.</strong>
        <span className="notice-note">Simulated sessions and preview players run on this device only. Verified views, likes and comments appear solely in the analytics panel, read from the platform’s own API.</span>
      </div>

      <div className="chart-grid">
        <div className="card glass">
          <span className="chart-caption">CPU usage (%)</span>
          <Chart series={cpuSeries} color="#fbbf24" label="CPU usage history" />
        </div>
        <div className="card glass">
          <span className="chart-caption">Memory usage (%)</span>
          <Chart series={memSeries} color="#a78bfa" label="Memory usage history" />
        </div>
        <div className="card glass">
          <span className="chart-caption">Running test sessions</span>
          <Chart series={sessionSeries} color="#3b82f6" label="Running test sessions history" />
        </div>
      </div>

      {playback?.run && (
        <div className="card glass">
          <div className="section-head">
            <h2 className="section-title">Active playback test</h2>
            <span className={`tag tag-${playback.run.status}`}>{playback.run.status}</span>
          </div>
          <div className="summary-grid">
            <div className="metric"><span>Preview screens</span><strong>{playback.run.sessions.filter((s) => s.kind === 'preview').length}</strong></div>
            <div className="metric"><span>Simulated</span><strong>{playback.run.sessions.filter((s) => s.kind === 'background').length}</strong></div>
            <div className="metric"><span>Duration</span><strong>{playback.run.config?.durationSec}s</strong></div>
            <div className="metric"><span>Progress</span><strong>{progressOf(playback.run)}%</strong></div>
          </div>
        </div>
      )}

      <div className="card glass">
        <h2 className="section-title">Live terminal activity</h2>
        <TerminalLog entries={activity} height={260} />
      </div>
    </section>
  );
}

function progressOf(run) {
  const sessions = run.sessions || [];
  if (sessions.length === 0) return 0;
  const total = sessions.reduce((sum, s) => sum + (s.progress || 0), 0);
  return Math.round(total / sessions.length);
}
