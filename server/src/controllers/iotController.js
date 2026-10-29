const Device = require('../models/Device');
const SensorReading = require('../models/SensorReading');
const { processReadingAlerts } = require('../services/alertService');
const { broadcastSensorReading, broadcastDeviceStatus } = require('../sockets/socketHandler');

// @desc    Ingest telemetry data from ESP8266 or simulated node
// @route   POST /api/iot/readings
// @access  Device API Key authenticated
const postReading = async (req, res, next) => {
  try {
    const payload = req.body;

    if (!payload || typeof payload !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'Invalid payload: JSON body is required',
      });
    }

    const deviceId = (payload.deviceId || payload.device_id || req.device.deviceId).toUpperCase();

    // Support both flattened and nested sensor payloads
    const rawSensors = payload.sensors || {};
    const temperature = payload.temperature !== undefined ? Number(payload.temperature) : (rawSensors.temperature !== undefined ? Number(rawSensors.temperature) : null);
    const humidity = payload.humidity !== undefined ? Number(payload.humidity) : (rawSensors.humidity !== undefined ? Number(rawSensors.humidity) : null);
    const gas = payload.gas !== undefined ? Number(payload.gas) : (rawSensors.gas !== undefined ? Number(rawSensors.gas) : null);
    const flame = payload.flame !== undefined ? Boolean(payload.flame) : (rawSensors.flame !== undefined ? Boolean(rawSensors.flame) : false);
    const isSimulated = Boolean(payload.isSimulated || payload.simulated || false);
    const readingTimestamp = payload.timestamp ? new Date(payload.timestamp) : new Date();

    // Basic validity check
    if (temperature !== null && isNaN(temperature)) {
      return res.status(400).json({ success: false, message: 'Invalid temperature: must be a number' });
    }
    if (humidity !== null && isNaN(humidity)) {
      return res.status(400).json({ success: false, message: 'Invalid humidity: must be a number' });
    }
    if (gas !== null && isNaN(gas)) {
      return res.status(400).json({ success: false, message: 'Invalid gas value: must be a number' });
    }

    // Persist sensor reading
    const reading = await SensorReading.create({
      deviceId,
      device: req.device ? req.device._id : null,
      temperature,
      humidity,
      gas,
      flame,
      rawSensors,
      isSimulated,
      timestamp: isNaN(readingTimestamp.getTime()) ? new Date() : readingTimestamp,
    });

    // Update Device status & latestReading
    if (req.device) {
      req.device.status = 'online';
      req.device.lastSeenAt = new Date();
      req.device.latestReading = {
        temperature,
        humidity,
        gas,
        flame,
        timestamp: reading.timestamp,
      };

      if (payload.rssi) req.device.metadata.signalRssi = Number(payload.rssi);
      if (payload.firmwareVersion) req.device.metadata.firmwareVersion = String(payload.firmwareVersion);

      await req.device.save();
      broadcastDeviceStatus(req.device);
    }

    // Broadcast reading to all subscribed dashboards
    broadcastSensorReading(reading);

    // Evaluate Alert Rules & trigger real-time alerts if thresholds breached
    const triggeredAlerts = await processReadingAlerts(reading, req.device);

    res.status(201).json({
      success: true,
      message: 'Telemetry reading recorded successfully',
      readingId: reading._id,
      alertsTriggered: triggeredAlerts.length,
      alerts: triggeredAlerts.map(a => ({ id: a._id, title: a.title, severity: a.severity })),
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get historical readings for a specific device
// @route   GET /api/iot/devices/:deviceId/readings
// @access  Private
const getDeviceReadings = async (req, res, next) => {
  try {
    const { deviceId } = req.params;
    const { limit = 100, page = 1, from, to, simulated } = req.query;

    const query = { deviceId: deviceId.toUpperCase() };

    if (from || to) {
      query.timestamp = {};
      if (from) query.timestamp.$gte = new Date(from);
      if (to) query.timestamp.$lte = new Date(to);
    }

    if (simulated !== undefined && simulated !== 'all') {
      query.isSimulated = simulated === 'true';
    }

    const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 500);
    const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
    const skip = (parsedPage - 1) * parsedLimit;

    const [readings, total] = await Promise.all([
      SensorReading.find(query)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(parsedLimit),
      SensorReading.countDocuments(query),
    ]);

    res.json({
      success: true,
      deviceId: deviceId.toUpperCase(),
      page: parsedPage,
      limit: parsedLimit,
      total,
      totalPages: Math.ceil(total / parsedLimit),
      readings,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  postReading,
  getDeviceReadings,
};
