import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

/**
 * Real-time WebSocket hook. Receives live stats, playback state and activity.
 */
export function useRealtime() {
  const [stats, setStats] = useState(null);
  const [playback, setPlayback] = useState(null);
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

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('request_stats');
      socket.emit('request_activity', 50);
      socket.emit('request_playback');
    });
    socket.on('disconnect', () => setConnected(false));

    socket.on('stats', (payload) => setStats(payload));
    socket.on('playback', (payload) => setPlayback(payload));
    socket.on('activity', (entry) => {
      setActivity((prev) => [entry, ...prev].slice(0, 150));
    });
    socket.on('activity_update', (list) => {
      setActivity(Array.isArray(list) ? list : []);
    });

    return () => socket.disconnect();
  }, []);

  return { stats, playback, activity, connected };
}
