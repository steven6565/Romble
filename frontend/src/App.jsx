import { useState } from 'react';
import { ToastProvider } from './components/Toast.jsx';
import Sidebar from './components/Sidebar.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import PlaybackPage from './pages/PlaybackPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import { useRealtime } from './hooks/useRealtime.js';

function Shell() {
  const [page, setPage] = useState('dashboard');
  const { stats, playback, activity, connected } = useRealtime();

  return (
    <div className="app">
      <Sidebar activePage={page} onPage={setPage} connected={connected} />
      <main className="main">
        {page === 'dashboard' && <DashboardPage stats={stats} activity={activity} connected={connected} playback={playback} />}
        {page === 'playback' && <PlaybackPage playback={playback} connected={connected} />}
        {page === 'settings' && <SettingsPage />}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <Shell />
    </ToastProvider>
  );
}
