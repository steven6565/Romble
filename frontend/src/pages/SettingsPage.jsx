// Settings page — persistent dashboard configuration via the backend API.
import { useEffect, useState } from 'react';
import { useToast } from '../components/Toast.jsx';
import api from '../api.js';

export default function SettingsPage() {
  const toast = useToast();
  const [settings, setSettings] = useState(null);
  const [form, setForm] = useState({
    refreshIntervalSec: 3, logRetentionDays: 7, maxHistoryDays: 30, theme: 'dark', platform: 'youtube', autoStart: false
  });

  useEffect(() => {
    api('/settings')
      .then((d) => { setSettings(d.settings || null); setForm((s) => ({ ...s, ...(d.settings || {}) })); })
      .catch((err) => toast(`Could not load settings: ${err.message}`, 'error'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async (e) => {
    e.preventDefault();
    try {
      const d = await api('/settings', { method: 'POST', body: JSON.stringify(form) });
      setSettings(d.settings);
      toast('Settings saved.', 'success');
    } catch (err) {
      toast(err.message || 'Could not save settings.', 'error');
    }
  };

  const row = (label, input) => (
    <div className="settings-row">
      <label className="settings-label" htmlFor={label}>{label}</label>
      {input}
    </div>
  );

  return (
    <section className="page">
      <div className="page-header">
        <h1>Settings</h1>
        <p className="muted">Dashboard configuration. Values are stored on this device.</p>
      </div>
      <form className="settings-form glass" onSubmit={save}>
        {row('Refresh interval (seconds)',
          <input className="input" type="number" min={1} max={60} value={form.refreshIntervalSec}
            onChange={(e) => setForm({ ...form, refreshIntervalSec: Number(e.target.value) })} aria-label="Refresh interval (seconds)" />)}
        {row('Log retention (days)',
          <input className="input" type="number" min={1} max={365} value={form.logRetentionDays}
            onChange={(e) => setForm({ ...form, logRetentionDays: Number(e.target.value) })} aria-label="Log retention (days)" />)}
        {row('Max history days',
          <input className="input" type="number" min={1} max={365} value={form.maxHistoryDays}
            onChange={(e) => setForm({ ...form, maxHistoryDays: Number(e.target.value) })} aria-label="Max history days" />)}
        {row('Theme',
          <select className="input" value={form.theme} onChange={(e) => setForm({ ...form, theme: e.target.value })} aria-label="Theme">
            <option value="dark">Dark</option>
            <option value="light">Light</option>
          </select>)}
        {row('Platform',
          <select className="input" value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })} aria-label="Platform">
            <option value="youtube">YouTube</option>
            <option value="rumble">Rumble</option>
          </select>)}
        {row('', (
          <label className="checkbox-row">
            <input type="checkbox" checked={form.autoStart} onChange={(e) => setForm({ ...form, autoStart: e.target.checked })} />
            Auto start tasks when the dashboard opens
          </label>
        ))}
        <div className="settings-actions">
          <button type="submit" className="btn primary">Save settings</button>
        </div>
      </form>
      {settings && (
        <div className="card glass">
          <h2 className="section-title">Current values</h2>
          <div className="settings-grid">
            <div><strong>Refresh interval:</strong> {settings.refreshIntervalSec}s</div>
            <div><strong>Log retention:</strong> {settings.logRetentionDays} days</div>
            <div><strong>Theme:</strong> {settings.theme}</div>
          </div>
        </div>
      )}
    </section>
  );
}
