const Device = require('../models/Device');
const SensorReading = require('../models/SensorReading');
const Alert = require('../models/Alert');
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

    const deviceId = (payload.deviceId || payload.device_id || req.device?.deviceId || 'UNKNOWN').toUpperCase();

    // Support both flattened and nested sensor payloads
    const rawSensors = payload.sensors || {};

    // Atmosphere
    const temperature = payload.temperature !== undefined ? Number(payload.temperature) : (rawSensors.temperature !== undefined ? Number(rawSensors.temperature) : null);
    const humidity = payload.humidity !== undefined ? Number(payload.humidity) : (rawSensors.humidity !== undefined ? Number(rawSensors.humidity) : null);

    // MQ-2 Gas & Smoke
    const gas = payload.gas !== undefined ? Number(payload.gas) : (payload.mq2 !== undefined ? Number(payload.mq2) : (rawSensors.gas !== undefined ? Number(rawSensors.gas) : (rawSensors.mq2 !== undefined ? Number(rawSensors.mq2) : null)));
    const smoke = payload.smoke !== undefined ? Number(payload.smoke) : (rawSensors.smoke !== undefined ? Number(rawSensors.smoke) : gas);

    // Flame sensor
    const flame = Boolean(payload.flame !== undefined ? payload.flame : (rawSensors.flame !== undefined ? rawSensors.flame : (payload.fire !== undefined ? payload.fire : (rawSensors.fire !== undefined ? rawSensors.fire : false))));

    // MPU6050 & Tilt / Earthquake
    const rawMpu = payload.mpu6050 || rawSensors.mpu6050 || {};
    const ax = payload.ax !== undefined ? Number(payload.ax) : (rawSensors.ax !== undefined ? Number(rawSensors.ax) : (rawMpu.ax !== undefined ? Number(rawMpu.ax) : null));
    const ay = payload.ay !== undefined ? Number(payload.ay) : (rawSensors.ay !== undefined ? Number(rawSensors.ay) : (rawMpu.ay !== undefined ? Number(rawMpu.ay) : null));
    const az = payload.az !== undefined ? Number(payload.az) : (rawSensors.az !== undefined ? Number(rawSensors.az) : (rawMpu.az !== undefined ? Number(rawMpu.az) : null));
    const gx = payload.gx !== undefined ? Number(payload.gx) : (rawSensors.gx !== undefined ? Number(rawSensors.gx) : (rawMpu.gx !== undefined ? Number(rawMpu.gx) : null));
    const gy = payload.gy !== undefined ? Number(payload.gy) : (rawSensors.gy !== undefined ? Number(rawSensors.gy) : (rawMpu.gy !== undefined ? Number(rawMpu.gy) : null));
    const gz = payload.gz !== undefined ? Number(payload.gz) : (rawSensors.gz !== undefined ? Number(rawSensors.gz) : (rawMpu.gz !== undefined ? Number(rawMpu.gz) : null));
    
    // Tilt angle in degrees
    const tiltAngle = payload.tiltAngle !== undefined ? Number(payload.tiltAngle) : (payload.angle !== undefined ? Number(payload.angle) : (rawSensors.tiltAngle !== undefined ? Number(rawSensors.tiltAngle) : null));

    // Calculate or accept tilt hazard flag
    const tilt = Boolean(payload.tilt !== undefined ? payload.tilt : (rawSensors.tilt !== undefined ? rawSensors.tilt : (tiltAngle !== null && Math.abs(tiltAngle) > 15)));

    // Calculate or accept vibration & earthquake
    let vibration = payload.vibration !== undefined ? Number(payload.vibration) : (rawSensors.vibration !== undefined ? Number(rawSensors.vibration) : 0);
    if (vibration === 0 && ax !== null && ay !== null && az !== null) {
      const accelMagnitude = Math.sqrt(ax * ax + ay * ay + az * az);
      vibration = Number(Math.abs(accelMagnitude - 1.0).toFixed(2));
    }
    const earthquake = Boolean(payload.earthquake !== undefined ? payload.earthquake : (rawSensors.earthquake !== undefined ? rawSensors.earthquake : (vibration > 1.2)));

    // Water & Flood
    const water = Boolean(payload.water !== undefined ? payload.water : (payload.waterLeak !== undefined ? payload.waterLeak : (rawSensors.water !== undefined ? rawSensors.water : false)));
    const waterLevel = payload.waterLevel !== undefined ? Number(payload.waterLevel) : (rawSensors.waterLevel !== undefined ? Number(rawSensors.waterLevel) : (water ? 90 : 0));

    // Ultrasonic sensor distance (cm)
    const distance = payload.distance !== undefined ? Number(payload.distance) : (payload.ultrasonic !== undefined ? Number(payload.ultrasonic) : (payload.distanceCm !== undefined ? Number(payload.distanceCm) : (rawSensors.distance !== undefined ? Number(rawSensors.distance) : null)));

    // Room occupancy / Person count
    const personCount = payload.personCount !== undefined ? Number(payload.personCount) : (payload.people !== undefined ? Number(payload.people) : (rawSensors.personCount !== undefined ? Number(rawSensors.personCount) : 0));

    const isSimulated = Boolean(payload.isSimulated || payload.simulated || false);
    const readingTimestamp = payload.timestamp ? new Date(payload.timestamp) : new Date();

    // Basic validity checks
    if (temperature !== null && isNaN(temperature)) {
      return res.status(400).json({ success: false, message: 'Invalid temperature: must be a number' });
    }
    if (humidity !== null && isNaN(humidity)) {
      return res.status(400).json({ success: false, message: 'Invalid humidity: must be a number' });
    }
    if (gas !== null && isNaN(gas)) {
      return res.status(400).json({ success: false, message: 'Invalid gas value: must be a number' });
    }

    const mpuData = (ax !== null || gx !== null) ? { ax, ay, az, gx, gy, gz } : undefined;

    // Persist sensor reading
    const reading = await SensorReading.create({
      deviceId,
      device: req.device ? req.device._id : null,
      temperature,
      humidity,
      gas,
      smoke,
      flame,
      tilt,
      tiltAngle,
      earthquake,
      vibration,
      water,
      waterLevel,
      distance,
      personCount,
      mpu6050: mpuData,
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
        smoke,
        flame,
        tilt,
        tiltAngle,
        earthquake,
        vibration,
        water,
        waterLevel,
        distance,
        personCount,
        mpu6050: mpuData,
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

// @desc    Get latest sensor readings (all devices or specific device)
// @route   GET /api/iot/latest or GET /api/iot/readings/latest
// @access  Public / Optional Protect
const getLatestReadings = async (req, res, next) => {
  try {
    const { deviceId } = req.query;

    if (deviceId) {
      const devUpper = deviceId.toUpperCase();
      const [latest, device] = await Promise.all([
        SensorReading.findOne({ deviceId: devUpper }).sort({ timestamp: -1 }),
        Device.findOne({ deviceId: devUpper }),
      ]);

      return res.json({
        success: true,
        deviceId: devUpper,
        deviceStatus: device ? device.status : 'offline',
        lastSeenAt: device ? device.lastSeenAt : null,
        reading: latest || device?.latestReading || null,
      });
    }

    // Return latest readings for all known devices, plus the overall latest reading
    const [devices, mostRecent] = await Promise.all([
      Device.find({}).select('deviceId name status lastSeenAt latestReading location supportedSensors'),
      SensorReading.findOne({}).sort({ timestamp: -1 }),
    ]);

    const activeReading = mostRecent || devices[0]?.latestReading || null;

    res.json({
      success: true,
      count: devices.length,
      latestReading: activeReading,
      reading: activeReading,
      timestamp: activeReading?.timestamp || new Date().toISOString(),
      devices: devices.map((d) => ({
        deviceId: d.deviceId,
        name: d.name,
        status: d.status,
        location: d.location,
        lastSeenAt: d.lastSeenAt,
        latestReading: d.latestReading,
        supportedSensors: d.supportedSensors,
      })),
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get current consolidated hazard status across all sensors and devices
// @route   GET /api/iot/hazard-status or GET /api/iot/hazards
// @access  Public / Optional Protect
const getHazardStatus = async (req, res, next) => {
  try {
    const [activeAlerts, devices] = await Promise.all([
      Alert.find({ status: 'active' }).sort({ timestamp: -1 }),
      Device.find({}).select('deviceId name status lastSeenAt latestReading location'),
    ]);

    let hasFire = false;
    let maxSmoke = 0;
    let hasTilt = false;
    let hasEarthquake = false;
    let hasWater = false;
    let totalPersons = 0;
    let maxVibration = 0;

    devices.forEach((d) => {
      const r = d.latestReading;
      if (!r) return;
      if (r.flame) hasFire = true;
      if (r.smoke !== undefined && r.smoke !== null && r.smoke > maxSmoke) maxSmoke = r.smoke;
      if (r.tilt) hasTilt = true;
      if (r.earthquake) hasEarthquake = true;
      if (r.vibration !== undefined && r.vibration !== null && r.vibration > maxVibration) maxVibration = r.vibration;
      if (r.water) hasWater = true;
      if (r.personCount) totalPersons += r.personCount;
    });

    const isCritical = hasFire || hasEarthquake || hasTilt || hasWater || maxSmoke > 400 || activeAlerts.some((a) => a.severity === 'critical');
    const isWarning = !isCritical && (maxSmoke > 250 || activeAlerts.some((a) => a.severity === 'warning'));

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      overallStatus: isCritical ? 'critical' : (isWarning ? 'warning' : 'nominal'),
      activeAlertsCount: activeAlerts.length,
      onlineDevicesCount: devices.filter((d) => d.status === 'online').length,
      hazards: {
        fire: {
          detected: hasFire,
          status: hasFire ? 'CRITICAL_FIRE_DETECTED' : 'SAFE',
        },
        smokeAndGas: {
          ppm: maxSmoke,
          status: maxSmoke > 400 ? 'DANGER_HAZARDOUS_GAS' : (maxSmoke > 250 ? 'WARNING_ELEVATED' : 'SAFE_CLEAN'),
        },
        tilt: {
          detected: hasTilt,
          status: hasTilt ? 'CRITICAL_STRUCTURAL_TILT' : 'STABLE',
        },
        earthquake: {
          detected: hasEarthquake,
          vibrationG: maxVibration,
          status: hasEarthquake ? 'CRITICAL_SEISMIC_SHOCK' : 'NOMINAL',
        },
        waterLeakage: {
          detected: hasWater,
          status: hasWater ? 'CRITICAL_FLOOD_LEAK' : 'DRY',
        },
        occupancy: {
          personCount: totalPersons,
          status: totalPersons > 10 ? 'OVER_CAPACITY' : 'NORMAL',
        },
      },
      recentActiveAlerts: activeAlerts.slice(0, 5).map((a) => ({
        id: a._id,
        deviceId: a.deviceId,
        title: a.title,
        severity: a.severity,
        sensorType: a.sensorType,
        timestamp: a.timestamp,
      })),
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  postReading,
  getDeviceReadings,
  getLatestReadings,
  getHazardStatus,
};
