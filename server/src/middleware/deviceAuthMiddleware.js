const Device = require('../models/Device');

/**
 * Authenticate incoming IoT requests via device API Key.
 * Looks for header 'x-api-key' or Bearer token in 'authorization'.
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

  const deviceId =
    req.body?.deviceId ||
    req.body?.device_id ||
    req.params?.deviceId ||
    req.query?.deviceId ||
    req.query?.device_id;

  if (!apiKey) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized: Missing device API key in x-api-key header, Authorization Bearer, or JSON body "apiKey"',
    });
  }

  if (!deviceId) {
    return res.status(400).json({
      success: false,
      message: 'Bad Request: deviceId is required in JSON payload, query, or route parameters',
    });
  }

  try {
    const device = await Device.findOne({ deviceId: deviceId.toUpperCase() });

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

    if (device.apiKey !== apiKey) {
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
