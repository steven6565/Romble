// Verified platform analytics — never mixes in local test numbers.
import { useState } from 'react';
import api from '../api.js';
import { useToast } from './Toast.jsx';
import Chart from './Chart.jsx';

function fmt(value) {
  if (value === null || value === undefined) return '—';
  return Number(value).toLocaleString();
}

export default function AnalyticsPanel({ defaultUrl = '' }) {
  const toast = useToast();
  const [url, setUrl] = useState(defaultUrl);
  const [data, setData] = useState(null);
  const [growth, setGrowth] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = async (refresh = false) => {
    const target = url.trim();
    if (!target) { toast('Enter a video URL to load verified analytics.', 'warning'); return; }
    setLoading(true);
    setError(null);
    try {
      const result = await api(`/analytics?url=${encodeURIComponent(target)}${refresh ? '&refresh=1' : ''}`);
      setData(result);
      if (!result.verified) {
        setError({ message: result.message || 'Verified statistics are unavailable.', hint: result.hint || null, code: result.error });
      } else {
        toast('Verified statistics loaded from the platform API.', 'success');
      }
      const g = await api(`/analytics/growth?url=${encodeURIComponent(target)}`);
      setGrowth(g);
    } catch (err) {
      setData(null);
      setError({ message: err.message || 'Could not load analytics.', hint: null });
    } finally {
      setLoading(false);
    }
  };

  const history = Array.isArray(data?.history) ? data.history : [];
  const viewsSeries = history.map((h) => h.views).filter((v) => typeof v === 'number');
  const engagementSeries = history.map((h) => (typeof h.likes === 'number' && typeof h.comments === 'number' ? h.likes + h.comments : NaN)).filter((v) => Number.isFinite(v));

  return (
    <section className="card glass">
      <div className="section-head">
        <h2 className="section-title">Verified platform analytics</h2>
        <span className="badge-verified">platform-reported only</span>
      </div>

      <div className="task-panel">
        <input
          className="input"
          type="url"
          inputMode="url"
          placeholder="https://www.youtube.com/watch?v=…"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && load()}
          aria-label="Video URL for analytics"
        />
        <button className="btn primary" onClick={() => load()} disabled={loading}>{loading ? 'Loading…' : 'Load'}</button>
        <button className="btn" onClick={() => load(true)} disabled={loading || !data?.verified}>Refresh</button>
      </div>

      {error && (
        <div className="notice notice-warning">
          <strong>{error.message}</strong>
          {error.hint && <span className="notice-hint">{error.hint}</span>}
          <span className="notice-note">No numbers are shown because none could be verified.</span>
        </div>
      )}

      {data?.verified && (
        <>
          <div className="analytics-head">
            {data.video?.thumbnail && <img className="analytics-thumb" src={data.video.thumbnail} alt="" loading="lazy" />}
            <div className="analytics-titles">
              <h3>{data.video?.title || 'Untitled video'}</h3>
              <p className="muted">{data.video?.channel || 'Unknown channel'} · {data.platform} · {data.source}</p>
              <p className="muted small-text">Fetched {new Date(data.fetchedAt).toLocaleString()}{data.cached ? ' (cached)' : ''}</p>
            </div>
          </div>

          <div className="analytics-metrics">
            <div className="metric"><span>Views</span><strong>{fmt(data.metrics.views)}</strong></div>
            <div className="metric"><span>Likes</span><strong>{fmt(data.metrics.likes)}</strong></div>
            <div className="metric"><span>Comments</span><strong>{fmt(data.metrics.comments)}</strong></div>
            <div className="metric"><span>Duration</span><strong>{data.video?.durationSec ? `${Math.floor(data.video.durationSec / 60)}m ${data.video.durationSec % 60}s` : '—'}</strong></div>
          </div>

          <div className="analytics-charts">
            <div>
              <span className="chart-caption">Views history</span>
              <Chart series={viewsSeries} color="#3b82f6" height={90} label="Views history" />
            </div>
            <div>
              <span className="chart-caption">Likes + comments history</span>
              <Chart series={engagementSeries} color="#a78bfa" height={90} label="Engagement history" />
            </div>
          </div>

          <div className="unavailable-list">
            <h4>Not available</h4>
            {Object.entries(data.unavailable || {}).map(([key, val]) => (
              <div className="unavailable-row" key={key}>
                <span className="unavailable-key">{key}</span>
                <span className="muted small-text">{val.reason}</span>
              </div>
            ))}
            <p className="muted small-text">Watch time, retention and traffic sources are owner-only. Add OAuth credentials to unlock them in a future version.</p>
          </div>
        </>
      )}

      {growth?.suggestions?.length > 0 && (
        <div className="growth-list">
          <h4>Organic growth suggestions</h4>
          <ul>
            {growth.suggestions.map((s, i) => (
              <li key={i}><span className={`growth-tag growth-${s.type}`}>{s.type}</span>{s.message}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
