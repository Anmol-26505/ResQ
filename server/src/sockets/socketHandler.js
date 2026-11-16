const { Server } = require('socket.io');
const { getPublicHazardState, setSocketBroadcaster } = require('../services/manualHazardService');

let io = null;

const initSocket = (httpServer) => {
  const parseOrigins = () => {
    const defaults = ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:4173'];
    const fromEnv = [
      ...(process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim()) : []),
      ...(process.env.CLIENT_URL ? process.env.CLIENT_URL.split(',').map((o) => o.trim()) : []),
    ];
    return Array.from(new Set([...defaults, ...fromEnv].filter(Boolean)));
  };

  const allowedOrigins = parseOrigins();

  io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (
          allowedOrigins.includes('*') ||
          allowedOrigins.includes(origin) ||
          origin.endsWith('.onrender.com') ||
          origin.endsWith('.vercel.app') ||
          origin.endsWith('.netlify.app')
        ) {
          return callback(null, true);
        }
        return callback(null, true);
      },
      methods: ['GET', 'POST', 'PATCH', 'DELETE'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  io.on('connection', (socket) => {
    console.log(`🔌 Client connected: ${socket.id} (Total connected: ${io.engine.clientsCount})`);

    // Immediately transmit current active manual hazards state to freshly connected client
    try {
      const currentManualHazards = getPublicHazardState();
      socket.emit('hazard:manual_update', currentManualHazards);
    } catch (err) {
      console.warn('Could not emit initial manual hazard state to socket:', err.message);
    }

    // Allow client to subscribe to specific device updates
    socket.on('join:device', (deviceId) => {
      if (deviceId) {
        socket.join(`device:${deviceId.toUpperCase()}`);
        // console.log(`Client ${socket.id} joined room device:${deviceId}`);
      }
    });

    socket.on('leave:device', (deviceId) => {
      if (deviceId) {
        socket.leave(`device:${deviceId.toUpperCase()}`);
      }
    });

    socket.on('disconnect', (reason) => {
      console.log(`🔌 Client disconnected: ${socket.id} (${reason})`);
    });
  });

  return io;
};

const getIO = () => {
  if (!io) {
    throw new Error('Socket.io has not been initialized yet!');
  }
  return io;
};

const broadcastSensorReading = (reading) => {
  if (!io) return;
  io.emit('sensor:reading', reading);
  if (reading.deviceId) {
    io.to(`device:${reading.deviceId.toUpperCase()}`).emit('sensor:reading:device', reading);
  }
};

const broadcastDeviceStatus = (device) => {
  if (!io) return;
  io.emit('device:status', {
    deviceId: device.deviceId,
    status: device.status,
    lastSeenAt: device.lastSeenAt,
    latestReading: device.latestReading,
  });
};

const broadcastAlert = (alert) => {
  if (!io) return;
  io.emit('alert:new', alert);
};

const broadcastAlertUpdated = (alert) => {
  if (!io) return;
  io.emit('alert:updated', alert);
};

const broadcastSimulationStatus = (status) => {
  if (!io) return;
  io.emit('simulation:status', status);
};

const broadcastManualHazardUpdate = (state) => {
  if (!io) return;
  io.emit('hazard:manual_update', state);
};

// Wire socket broadcaster into manual hazard service
setSocketBroadcaster(broadcastManualHazardUpdate);

module.exports = {
  initSocket,
  getIO,
  broadcastSensorReading,
  broadcastDeviceStatus,
  broadcastAlert,
  broadcastAlertUpdated,
  broadcastSimulationStatus,
  broadcastManualHazardUpdate,
};
