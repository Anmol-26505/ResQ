const express = require('express');
const router = express.Router();
const {
  postReading,
  getDeviceReadings,
  getLatestReadings,
  getHazardStatus,
} = require('../controllers/iotController');
const { verifyDeviceApiKey } = require('../middleware/deviceAuthMiddleware');
const { optionalProtect } = require('../middleware/authMiddleware');
const { iotLimiter } = require('../middleware/rateLimiter');

// IoT Telemetry Ingestion endpoint used by NodeMCU ESP8266 & field sensor nodes
router.post('/readings', iotLimiter, verifyDeviceApiKey, postReading);

// Latest sensor readings across devices or filtered by ?deviceId=
router.get('/latest', optionalProtect, getLatestReadings);
router.get('/readings/latest', optionalProtect, getLatestReadings);

// Consolidated Hazard Status (fire, smoke, earthquake, tilt, water, gas, occupancy)
router.get('/hazard-status', optionalProtect, getHazardStatus);
router.get('/hazards', optionalProtect, getHazardStatus);

// Historical sensor telemetry for a specific device
router.get('/devices/:deviceId/readings', optionalProtect, getDeviceReadings);

module.exports = router;
