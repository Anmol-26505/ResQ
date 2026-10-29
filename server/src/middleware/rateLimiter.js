const rateLimit = require('express-rate-limit');

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // Limit each IP to 300 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
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
