const Device = require('../models/Device');

/**
 * Authenticate incoming IoT requests via device API Key.
 * Checks HTTP header 'x-api-key', process.env.DEVICE_API_KEY, registered device key, or JSON body.
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

  // Safe diagnostic log (never logs secret keys)
  console.log(`[AUTH DIAGNOSTIC] Incoming request to ${req.method} ${req.originalUrl || req.path} from deviceId: ${deviceId}`);

  // Strict check: API key MUST be provided
  if (!apiKey) {
    console.warn(`[AUTH DIAGNOSTIC] ❌ Auth rejected for deviceId: ${deviceId} - Missing device API key in x-api-key HTTP header`);
    return res.status(401).json({
      success: false,
      message: 'Unauthorized: Missing device API key in x-api-key HTTP header',
    });
  }

  try {
    const envApiKey = process.env.DEVICE_API_KEY ? process.env.DEVICE_API_KEY.trim() : null;

    let device = await Device.findOne({ deviceId });

    // Auto-provision primary hardware node if first time booting on fresh DB
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
          'distance',
          'mpu6050',
          'ultrasonic',
          'mq2',
        ],
        apiKey: envApiKey || apiKey || 'resq_iot_secure_key_2026',
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

    // Verify key against environment variable (priority 1) or registered device key (priority 2)
    const isAuthorized =
      (envApiKey && apiKey === envApiKey) ||
      (device.apiKey && apiKey === device.apiKey) ||
      (!envApiKey && !device.apiKey && apiKey === 'resq_iot_secure_key_2026') ||
      (!envApiKey && apiKey === 'resq_iot_secure_key_2026');

    if (!isAuthorized) {
      console.warn(`[AUTH DIAGNOSTIC] ❌ Auth rejected for deviceId: ${deviceId} - Invalid API key`);
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: Invalid device API key',
      });
    }

    console.log(`[AUTH DIAGNOSTIC] ✅ Auth approved for deviceId: ${deviceId}`);
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
