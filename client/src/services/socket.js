import { io } from 'socket.io-client';

let socket = null;

// Centralized Socket URL resolver:
// Uses VITE_SOCKET_URL if set, or derives the root host from VITE_API_BASE_URL / VITE_API_URL
const resolveSocketUrl = () => {
  if (import.meta.env.VITE_SOCKET_URL && import.meta.env.VITE_SOCKET_URL.trim()) {
    return import.meta.env.VITE_SOCKET_URL.trim().replace(/\/+$/, '');
  }
  const apiUrl = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL;
  if (apiUrl && apiUrl.trim()) {
    const clean = apiUrl.trim().replace(/\/+$/, '');
    return clean.replace(/\/api$/, '');
  }
  return import.meta.env.DEV ? 'http://localhost:5000' : window.location.origin;
};

export const getSocket = () => {
  if (!socket) {
    const socketUrl = resolveSocketUrl();

    socket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 25,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socket.on('connect', () => {
      console.log('📡 Connected to ResQ Real-Time Socket Server:', socket.id);
    });

    socket.on('disconnect', (reason) => {
      console.log('📡 Disconnected from ResQ Socket Server:', reason);
    });

    socket.on('connect_error', (error) => {
      console.warn('⚠️ ResQ Socket Connection Error:', error.message);
    });
  }

  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
