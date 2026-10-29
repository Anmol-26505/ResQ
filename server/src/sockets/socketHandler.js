const { Server } = require('socket.io');

let io = null;

const initSocket = (httpServer) => {
  const allowedOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
    : ['http://localhost:5173', 'http://localhost:3000'];

  io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins,
      methods: ['GET', 'POST', 'PATCH', 'DELETE'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  io.on('connection', (socket) => {
    console.log(`🔌 Client connected: ${socket.id} (Total connected: ${io.engine.clientsCount})`);

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

module.exports = {
  initSocket,
  getIO,
  broadcastSensorReading,
  broadcastDeviceStatus,
  broadcastAlert,
  broadcastAlertUpdated,
  broadcastSimulationStatus,
};
