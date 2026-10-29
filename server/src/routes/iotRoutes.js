const express = require('express');
const router = express.Router();
const { postReading, getDeviceReadings } = require('../controllers/iotController');
const { verifyDeviceApiKey } = require('../middleware/deviceAuthMiddleware');
const { protect } = require('../middleware/authMiddleware');
const { iotLimiter } = require('../middleware/rateLimiter');

// IoT Ingestion endpoint used by ESP8266 & simulated devices
router.post('/readings', iotLimiter, verifyDeviceApiKey, postReading);

// Dashboard historical telemetry query for a device
router.get('/devices/:deviceId/readings', protect, getDeviceReadings);

module.exports = router;
