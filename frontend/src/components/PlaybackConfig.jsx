// Configuration form for the local playback testing engine.
import { useEffect, useState } from 'react';

const QUALITIES = ['auto', '1080p', '720p', '480p', '360p'];

const FIELDS = [
  { key: 'totalSessions', label: 'Total test sessions', min: 1, max: 500, step: 1, hint: 'How many sessions the local engine prepares.' },
  { key: 'visiblePreviews', label: 'Visible preview screens', min: 0, max: 12, step: 1, hint: 'Real embedded players shown on this page.' },
  { key: 'durationSec', label: 'Playback duration (seconds)', min: 5, max: 3600, step: 5, hint: 'How long each session runs.' },
  { key: 'maxConcurrent', label: 'Max concurrent sessions', min: 1, max: 20, step: 1, hint: 'Sessions running at the same time.' },
  { key: 'backgroundSessions', label: 'Background test sessions', min: 0, max: 500, step: 1, hint: 'Simulated local timers (never send requests).' },
  { key: 'sessionTimeoutSec', label: 'Session timeout (seconds)', min: 10, max: 3600, step: 10, hint: 'A session that exceeds this fails safely.' },
  { key: 'maxCpuPercent', label: 'Auto-pause above CPU %', min: 10, max: 100, step: 1, hint: 'Protects the phone from overload.' },
  { key: 'maxMemPercent', label: 'Auto-pause above memory %', min: 10, max: 100, step: 1, hint: 'Protects the phone from overload.' }
];

export default function PlaybackConfig({ config, onChange, disabled }) {
  const [local, setLocal] = useState(config || {});

  useEffect(() => { setLocal(config || {}); }, [config]);

  const set = (key, value) => {
    const next = { ...local, [key]: value };
    setLocal(next);
    onChange(next);
  };

  return (
    <div className="config-grid">
      <div className="config-field config-full">
        <label htmlFor="pb-url">Video URL</label>
        <input
          id="pb-url"
          className="input"
          type="url"
          inputMode="url"
          placeholder="https://www.youtube.com/watch?v=…"
          value={local.videoUrl || ''}
          onChange={(e) => set('videoUrl', e.target.value)}
          disabled={disabled}
        />
      </div>

      <div className="config-field">
        <label htmlFor="pb-platform">Platform</label>
        <select id="pb-platform" className="input" value={local.platform || 'youtube'} onChange={(e) => set('platform', e.target.value)} disabled={disabled}>
          <option value="youtube">YouTube</option>
          <option value="rumble">Rumble</option>
        </select>
      </div>

      <div className="config-field">
        <label htmlFor="pb-quality">Playback quality</label>
        <select id="pb-quality" className="input" value={local.quality || 'auto'} onChange={(e) => set('quality', e.target.value)} disabled={disabled}>
          {QUALITIES.map((q) => <option key={q} value={q}>{q === 'auto' ? 'Auto' : q}</option>)}
        </select>
      </div>

      {FIELDS.map((f) => (
        <div className="config-field" key={f.key}>
          <label htmlFor={`pb-${f.key}`}>{f.label}</label>
          <input
            id={`pb-${f.key}`}
            className="input"
            type="number"
            min={f.min}
            max={f.max}
            step={f.step}
            value={local[f.key] ?? ''}
            onChange={(e) => set(f.key, Number(e.target.value))}
            disabled={disabled}
          />
          <span className="config-hint">{f.hint}</span>
        </div>
      ))}

      <div className="config-field">
        <span className="config-check-label">Audio</span>
        <label className="checkbox-row">
          <input type="checkbox" checked={local.muted !== false} onChange={(e) => set('muted', e.target.checked)} disabled={disabled} />
          Mute preview audio
        </label>
        <label className="checkbox-row">
          <input type="checkbox" checked={local.autoCleanup !== false} onChange={(e) => set('autoCleanup', e.target.checked)} disabled={disabled} />
          Auto-clean completed sessions
        </label>
      </div>
    </div>
  );
}
