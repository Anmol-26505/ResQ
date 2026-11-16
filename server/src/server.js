const http = require('http');
const app = require('./app');
const { connectDB, disconnectDB } = require('./config/db');
const { initSocket, broadcastDeviceStatus } = require('./sockets/socketHandler');
const { initManualHazards } = require('./services/manualHazardService');
const Device = require('./models/Device');
const { startSimulation } = require('./services/simulationService');
const { seedData } = require('./utils/seed');

const PORT = process.env.PORT || 5000;
const server = http.createServer(app);

// Initialize Socket.io
initSocket(server);

// Background job: Monitor device heartbeat and transition stale devices to offline
const OFFLINE_THRESHOLD_MS = parseInt(process.env.DEVICE_OFFLINE_THRESHOLD_MS, 10) || 60000;

const startDeviceHeartbeatMonitor = () => {
  setInterval(async () => {
    try {
      const cutoffTime = new Date(Date.now() - OFFLINE_THRESHOLD_MS);

      // Find online devices that haven't sent a telemetry ping since cutoff
      const staleDevices = await Device.find({
        status: 'online',
        lastSeenAt: { $lt: cutoffTime },
      });

      for (const dev of staleDevices) {
        dev.status = 'offline';
        await dev.save();
        // console.log(`Device ${dev.deviceId} timed out -> marked offline`);
        broadcastDeviceStatus(dev);
      }
    } catch (err) {
      console.error('Error in device heartbeat monitor:', err.message);
    }
  }, 15000); // Check every 15 seconds
};

// Start Server
const startServer = async () => {
  try {
    await connectDB();

    // Initialize remote manual hazards state from MongoDB
    await initManualHazards();

    // Auto-seed if database is empty
    const deviceCount = await Device.countDocuments();
    if (deviceCount === 0) {
      console.log('📦 Empty database detected. Auto-seeding initial development data...');
      await seedData(false);
    }

    // Auto-resolve any legacy false water alerts where water sensor was unavailable or 0%
    const Alert = require('./models/Alert');
    await Alert.updateMany(
      {
        sensorType: { $in: ['water', 'waterLevel'] },
        status: 'active',
        $or: [
          { readingValue: false },
          { readingValue: 0 },
          { readingValue: null },
          { isSimulated: false, readingValue: { $lte: 0 } },
        ],
      },
      {
        status: 'resolved',
        resolvedAt: new Date(),
        resolutionNotes: 'Auto-resolved: No physical water/moisture sensor installed on hardware',
      }
    );

    server.listen(PORT, '0.0.0.0', () => {
      console.log(`=================================================`);
      console.log(`🛡️  ResQ IoT Emergency Monitoring Platform Backend`);
      console.log(`🚀 Server running on port: ${PORT} (0.0.0.0)`);
      console.log(`📡 Real-time Socket.IO initialized`);
      console.log(`🌐 Health check: http://0.0.0.0:${PORT}/health`);
      console.log(`=================================================`);

      // Start device heartbeat watcher
      startDeviceHeartbeatMonitor();

      // Start automatic simulation only if explicitly enabled
      if (process.env.AUTO_SIMULATION === 'true') {
        console.log('🤖 Auto-simulation active (AUTO_SIMULATION=true)');
        startSimulation(3000);
      } else {
        console.log('📡 Hardware Ingestion Mode: waiting for live telemetry from NodeMCU / ESP8266 devices');
      }
    });
  } catch (error) {
    console.error('Fatal startup error:', error.message);
    process.exit(1);
  }
};

// Handle process termination gracefully
process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received: closing HTTP server...');
  server.close(async () => {
    await disconnectDB();
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('SIGINT signal received: closing HTTP server...');
  server.close(async () => {
    await disconnectDB();
    process.exit(0);
  });
});

if (process.env.NODE_ENV !== 'test') {
  startServer();
}

module.exports = { app, server };
