import { createContext, useContext, useState } from 'react';

const ToastContext = createContext(null);

let toastId = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const show = (message, type = 'info', duration = 4200) => {
    const id = ++toastId + Date.now();
    setToasts((prev) => [...prev, { id, message, type, at: Date.now() }]);
    if (duration > 0) setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), duration);
  };

  const hide = (id) => setToasts((prev) => prev.filter((t) => t.id !== id));

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="toast-container" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            <span className="toast-icon">{toastIcon(t.type)}</span>
            <span className="toast-msg">{t.message}</span>
            <button className="toast-close" onClick={() => hide(t.id)} aria-label="Dismiss">×</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function toastIcon(type) {
  const map = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };
  return map[type] || map.info;
}

export const useToast = () => useContext(ToastContext);
