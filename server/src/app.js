const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

const { notFound, errorHandler } = require('./middleware/errorMiddleware');
const { apiLimiter } = require('./middleware/rateLimiter');

// Import routes
const authRoutes = require('./routes/authRoutes');
const deviceRoutes = require('./routes/deviceRoutes');
const iotRoutes = require('./routes/iotRoutes');
const sensorRoutes = require('./routes/sensorRoutes');
const alertRoutes = require('./routes/alertRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const simulationRoutes = require('./routes/simulationRoutes');
const controllerRoutes = require('./routes/controllerRoutes');

const app = express();

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// CORS configuration
const parseOrigins = () => {
  const defaults = ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:4173'];
  const fromEnv = [
    ...(process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim()) : []),
    ...(process.env.CLIENT_URL ? process.env.CLIENT_URL.split(',').map((o) => o.trim()) : []),
  ];
  return Array.from(new Set([...defaults, ...fromEnv].filter(Boolean)));
};

const allowedOrigins = parseOrigins();

app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser requests (NodeMCU / ESP8266, curl, mobile apps, Postman)
    if (!origin) {
      return callback(null, true);
    }
    // Allow wildcard, explicit allowed origins, or Render/Vercel/Netlify preview domains
    if (
      allowedOrigins.includes('*') ||
      allowedOrigins.includes(origin) ||
      origin.endsWith('.onrender.com') ||
      origin.endsWith('.vercel.app') ||
      origin.endsWith('.netlify.app')
    ) {
      return callback(null, true);
    }
    // Permissive fallback so production frontend is not blocked on initial setup
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key', 'x-device-key'],
}));

// Request body parsers
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// Logging
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Health check endpoints (Public - for Render, AWS, uptime monitors)
const healthHandler = (req, res) => {
  res.status(200).json({
    status: 'healthy',
    system: 'ResQ IoT Emergency Platform',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0',
  });
};

app.get('/health', healthHandler);
app.get('/api/health', healthHandler);

// Apply rate limiter to general api endpoints
app.use('/api', apiLimiter);

// Mount API routes
app.use('/api/auth', authRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/iot', iotRoutes);
app.use('/api/sensors', sensorRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/simulation', simulationRoutes);
app.use('/api/controller', controllerRoutes);

// Serve static frontend assets in production if client/dist exists
const clientDistPath = path.resolve(__dirname, '../../client/dist');
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  app.get('*', (req, res, next) => {
    // Let API routes and health endpoints pass to their respective handlers
    if (req.path.startsWith('/api') || req.path === '/health') {
      return next();
    }
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

// Error handlers
app.use(notFound);
app.use(errorHandler);

module.exports = app;
