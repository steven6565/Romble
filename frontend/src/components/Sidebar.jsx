// Collapsible navigation sidebar — closes automatically on mobile.
import { useEffect, useState } from 'react';

const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'playback', label: 'Playback Testing', icon: '▶' },
  { id: 'settings', label: 'Settings', icon: '⚙' }
];

export default function Sidebar({ activePage, onPage, connected }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.body.classList.toggle('nav-open', open);
    return () => document.body.classList.remove('nav-open');
  }, [open]);

  // Close on Escape for keyboard users.
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <>
      <button className="sidebar-toggle" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label="Toggle navigation">
        <span>{open ? '✕' : '☰'}</span>
      </button>

      {open && <div className="sidebar-scrim" onClick={() => setOpen(false)} />}

      <aside className={`sidebar ${open ? 'open' : ''}`} aria-label="Sidebar">
        <div className="brand">
          <span className="brand-mark">R</span>
          <div className="brand-text">
            <strong>Romble</strong>
            <em>v5 dashboard</em>
          </div>
        </div>

        <nav className="sidebar-nav">
          <ul>
            {NAV.map((item) => (
              <li key={item.id}>
                <button
                  className={`nav-item ${activePage === item.id ? 'active' : ''}`}
                  onClick={() => { onPage(item.id); setOpen(false); }}
                >
                  <span className="nav-icon">{item.icon}</span>
                  <span className="nav-label">{item.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="sidebar-footer">
          <div className="status-chip">
            <span className={`status-dot ${connected ? 'on' : 'off'}`} />
            <span>{connected ? 'Connected' : 'Reconnecting…'}</span>
          </div>
          <p className="muted">Termux · localhost</p>
        </div>
      </aside>
    </>
  );
}
