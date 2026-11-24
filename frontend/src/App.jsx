import { useState } from 'react';
import { ToastProvider } from './components/Toast.jsx';
import Sidebar from './components/Sidebar.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import { useRealtime } from './hooks/useRealtime.js';

function Shell() {
  const [page, setPage] = useState('dashboard');
  const { stats, activity, connected } = useRealtime();

  return (
    <div className="app">
      <Sidebar activePage={page} onPage={setPage} />
      <main className="main">
        {page === 'dashboard'
          ? <DashboardPage stats={stats} activity={activity} connected={connected} />
          : <SettingsPage />}
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
