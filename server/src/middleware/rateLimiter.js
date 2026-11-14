const rateLimit = require('express-rate-limit');

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5000, // Accommodate real-time IoT monitoring and dashboard polling
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Exempt IoT sensor ingestion, device authentication, and telemetry polling
    return (
      req.baseUrl === '/api/sensors' ||
      req.baseUrl === '/api/iot' ||
      req.path.startsWith('/sensors') ||
      req.path.startsWith('/iot') ||
      Boolean(req.headers['x-api-key'] || req.headers['x-device-key'])
    );
  },
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again after 15 minutes',
  },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30, // 30 attempts per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many login/registration attempts, please try again later',
  },
});

const iotLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 600, // Support high frequency sensor ingestion
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many IoT telemetry submissions from this client',
  },
});

module.exports = { apiLimiter, authLimiter, iotLimiter };
