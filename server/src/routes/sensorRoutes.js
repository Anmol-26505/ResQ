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

// Ingestion endpoint used by physical NodeMCU ESP8266: POST /api/sensors/update
router.post('/update', iotLimiter, verifyDeviceApiKey, postReading);

// Ingestion endpoint alias: POST /api/sensors/readings
router.post('/readings', iotLimiter, verifyDeviceApiKey, postReading);

// Real-time sensor retrieval endpoint: GET /api/sensors/latest
router.get('/latest', optionalProtect, getLatestReadings);

// Consolidated hazard status across all sensors: GET /api/sensors/hazards or /api/sensors/hazard-status
router.get('/hazards', optionalProtect, getHazardStatus);
router.get('/hazard-status', optionalProtect, getHazardStatus);

// Historical readings for a specific device: GET /api/sensors/:deviceId/history
router.get('/:deviceId/history', optionalProtect, getDeviceReadings);

module.exports = router;
