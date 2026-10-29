import { io } from 'socket.io-client';

let socket = null;

export const getSocket = () => {
  if (!socket) {
    const socketUrl = import.meta.env.VITE_SOCKET_URL || (
      import.meta.env.DEV ? 'http://localhost:5000' : window.location.origin
    );

    socket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 20,
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
