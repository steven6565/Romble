import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

/**
 * Real-time WebSocket hook. Receives live stats and activity events from the
 * backend and keeps the connection status visible in the UI.
 */
export function useRealtime() {
  const [stats, setStats] = useState(null);
  const [activity, setActivity] = useState([]);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef(null);

  useEffect(() => {
    const socket = io({
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 5000
    });
    socketRef.current = socket;

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    socket.on('stats', (payload) => {
      setStats(payload);
    });
    socket.on('activity', (entry) => {
      setActivity((prev) => [entry, ...prev].slice(0, 150));
    });
    socket.on('activity_update', (list) => {
      setActivity(Array.isArray(list) ? list : []);
    });

    // Pull current data immediately after connecting.
    socket.on('connect', () => {
      socket.emit('request_stats');
      socket.emit('request_activity', 50);
    });

    return () => socket.disconnect();
  }, []);

  return { stats, activity, connected };
}
