const Device = require('../models/Device');
const SensorReading = require('../models/SensorReading');
const Alert = require('../models/Alert');
const { broadcastDeviceStatus } = require('../sockets/socketHandler');

// @desc    Get all registered devices
// @route   GET /api/devices
// @access  Private
const getDevices = async (req, res, next) => {
  try {
    const { status, search } = req.query;
    const filter = {};

    if (status && ['online', 'offline', 'maintenance'].includes(status)) {
      filter.status = status;
    }

    if (search) {
      filter.$or = [
        { deviceId: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } },
        { location: { $regex: search, $options: 'i' } },
      ];
    }

    const devices = await Device.find(filter).sort({ createdAt: -1 });

    res.json({
      success: true,
      count: devices.length,
      devices,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single device by ID
// @route   GET /api/devices/:id
// @access  Private
const getDeviceById = async (req, res, next) => {
  try {
    const device = await Device.findOne({
      $or: [{ _id: req.params.id.match(/^[0-9a-fA-F]{24}$/) ? req.params.id : null }, { deviceId: req.params.id.toUpperCase() }],
    });

    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found',
      });
    }

    // Fetch latest 30 readings
    const recentReadings = await SensorReading.find({ deviceId: device.deviceId })
      .sort({ timestamp: -1 })
      .limit(30);

    // Fetch active alerts for this device
    const activeAlerts = await Alert.find({ deviceId: device.deviceId, status: 'active' });

    res.json({
      success: true,
      device,
      recentReadings,
      activeAlertsCount: activeAlerts.length,
      activeAlerts,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Register a new device
// @route   POST /api/devices
// @access  Private
const createDevice = async (req, res, next) => {
  try {
    let { deviceId, name, location, deviceType, supportedSensors } = req.body;

    if (!deviceId || !name) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both deviceId and name',
      });
    }

    deviceId = deviceId.trim().toUpperCase();

    const existingDevice = await Device.findOne({ deviceId });
    if (existingDevice) {
      return res.status(400).json({
        success: false,
        message: `Device with ID ${deviceId} already exists`,
      });
    }

    const apiKey = Device.generateApiKey();

    const device = await Device.create({
      deviceId,
      name: name.trim(),
      location: location ? location.trim() : 'Unassigned Location',
      deviceType: deviceType || 'NodeMCU ESP8266',
      supportedSensors: supportedSensors && Array.isArray(supportedSensors) && supportedSensors.length > 0
        ? supportedSensors
        : ['temperature', 'humidity', 'gas', 'flame'],
      apiKey,
      status: 'offline',
      createdBy: req.user?._id,
    });

    res.status(201).json({
      success: true,
      message: 'Device registered successfully. Keep your API key secure.',
      device,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update device settings
// @route   PATCH /api/devices/:id
// @access  Private
const updateDevice = async (req, res, next) => {
  try {
    const { name, location, deviceType, supportedSensors, isActive, status } = req.body;

    const device = await Device.findOne({
      $or: [{ _id: req.params.id.match(/^[0-9a-fA-F]{24}$/) ? req.params.id : null }, { deviceId: req.params.id.toUpperCase() }],
    });

    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found',
      });
    }

    if (name) device.name = name.trim();
    if (location !== undefined) device.location = location.trim();
    if (deviceType) device.deviceType = deviceType;
    if (supportedSensors && Array.isArray(supportedSensors)) device.supportedSensors = supportedSensors;
    if (isActive !== undefined) device.isActive = isActive;
    if (status && ['online', 'offline', 'maintenance'].includes(status)) {
      device.status = status;
      broadcastDeviceStatus(device);
    }

    await device.save();

    res.json({
      success: true,
      message: 'Device updated successfully',
      device,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Regenerate device API key
// @route   POST /api/devices/:id/regenerate-key
// @access  Private
const regenerateApiKey = async (req, res, next) => {
  try {
    const device = await Device.findOne({
      $or: [{ _id: req.params.id.match(/^[0-9a-fA-F]{24}$/) ? req.params.id : null }, { deviceId: req.params.id.toUpperCase() }],
    });

    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found',
      });
    }

    device.apiKey = Device.generateApiKey();
    await device.save();

    res.json({
      success: true,
      message: 'New API key generated successfully. Update your ESP8266 firmware headers accordingly.',
      apiKey: device.apiKey,
      deviceId: device.deviceId,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a device
// @route   DELETE /api/devices/:id
// @access  Private/Admin
const deleteDevice = async (req, res, next) => {
  try {
    const device = await Device.findOne({
      $or: [{ _id: req.params.id.match(/^[0-9a-fA-F]{24}$/) ? req.params.id : null }, { deviceId: req.params.id.toUpperCase() }],
    });

    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found',
      });
    }

    await device.deleteOne();

    res.json({
      success: true,
      message: `Device ${device.deviceId} deleted successfully`,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get real-time device status (online/offline/unknown) based on lastSeenAt freshness
// @route   GET /api/devices/:id/status
// @access  Public (optionalProtect)
const getDeviceStatus = async (req, res, next) => {
  try {
    const device = await Device.findOne({
      $or: [{ _id: req.params.id.match(/^[0-9a-fA-F]{24}$/) ? req.params.id : null }, { deviceId: req.params.id.toUpperCase() }],
    });

    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found',
      });
    }

    const nowMs = Date.now();
    const lastSeenMs = device.lastSeenAt ? new Date(device.lastSeenAt).getTime() : 0;
    const secondsSinceLastSeen = lastSeenMs > 0 ? Math.floor((nowMs - lastSeenMs) / 1000) : null;

    let status = 'unknown';
    if (device.manualStatusOverride === 'online') {
      status = 'online';
    } else if (device.manualStatusOverride === 'offline') {
      status = 'offline';
    } else if (secondsSinceLastSeen === null) {
      status = 'unknown';
    } else if (secondsSinceLastSeen < 30) {
      status = 'online';
    } else {
      status = 'offline';
    }

    res.json({
      success: true,
      deviceId: device.deviceId,
      name: device.name,
      status,
      isOnline: status === 'online',
      lastSeenAt: device.lastSeenAt,
      secondsSinceLastSeen: device.manualStatusOverride === 'online' ? 0 : secondsSinceLastSeen,
      location: device.location,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDevices,
  getDeviceById,
  getDeviceStatus,
  createDevice,
  updateDevice,
  regenerateApiKey,
  deleteDevice,
};
