const Device = require('../models/Device');

/**
 * Authenticate incoming IoT requests via device API Key.
 * Looks for header 'x-api-key', Bearer token, JSON body 'apiKey', or query param.
 */
const verifyDeviceApiKey = async (req, res, next) => {
  const apiKey =
    req.headers['x-api-key'] ||
    req.headers['x-device-key'] ||
    (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')
      ? req.headers.authorization.split(' ')[1]
      : null) ||
    req.body?.apiKey ||
    req.body?.api_key ||
    req.query?.apiKey ||
    req.query?.api_key;

  const rawDeviceId =
    req.body?.deviceId ||
    req.body?.device_id ||
    req.params?.deviceId ||
    req.query?.deviceId ||
    req.query?.device_id;

  const deviceId = (rawDeviceId || 'RESQ-NODE-01').toUpperCase();

  // If no apiKey provided: allow only for default primary node RESQ-NODE-01 or /api/sensors/update
  if (!apiKey && deviceId !== 'RESQ-NODE-01') {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized: Missing device API key in x-api-key header, Authorization Bearer, or JSON body "apiKey"',
    });
  }

  try {
    let device = await Device.findOne({ deviceId });

    // If default primary device doesn't exist yet (fresh DB), auto-provision it
    if (!device && deviceId === 'RESQ-NODE-01') {
      device = await Device.create({
        deviceId: 'RESQ-NODE-01',
        name: 'NodeMCU ESP8266 Live Node',
        location: 'Primary Monitoring Zone',
        deviceType: 'NodeMCU ESP8266',
        supportedSensors: [
          'temperature',
          'humidity',
          'gas',
          'smoke',
          'flame',
          'tilt',
          'earthquake',
          'water',
          'personCount',
          'distance',
          'mpu6050',
          'ultrasonic',
          'mq2',
        ],
        apiKey: apiKey || 'resq_dev_node01_alpha_9882a1',
        status: 'online',
        lastSeenAt: new Date(),
      });
      console.log('📡 Auto-provisioned primary hardware node: RESQ-NODE-01');
    }

    if (!device) {
      return res.status(404).json({
        success: false,
        message: `Device not found: ${deviceId}`,
      });
    }

    if (!device.isActive) {
      return res.status(403).json({
        success: false,
        message: `Device ${deviceId} is currently deactivated`,
      });
    }

    // If an API key was explicitly supplied, verify it matches
    if (apiKey && device.apiKey !== apiKey) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: Invalid device API key',
      });
    }

    req.device = device;
    next();
  } catch (error) {
    console.error('Error validating device API key:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Internal server error validating device authentication',
    });
  }
};

module.exports = { verifyDeviceApiKey };
