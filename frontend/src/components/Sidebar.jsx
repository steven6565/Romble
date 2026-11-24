// Collapsible navigation sidebar.
import { useState } from 'react';

const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'settings', label: 'Settings', icon: '⚙️' }
];

export default function Sidebar({ activePage, onPage }) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState('checking…');

  const toggle = () => setOpen((o) => !o);

  return (
    <aside className={`sidebar ${open ? 'open' : ''}`} aria-label="Sidebar">
      <button className="sidebar-toggle" onClick={toggle} aria-expanded={open}>
        <span>☰</span>
        {open ? 'Close' : 'Open'}
      </button>
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
          <span className="status-dot"></span>
          <span>{status}</span>
        </div>
        <p className="muted">Youtube-Rumble-Termux v4</p>
      </div>
    </aside>
  );
}
