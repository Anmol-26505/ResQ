const mongoose = require('mongoose');
const Device = require('../models/Device');
const SensorReading = require('../models/SensorReading');
const Alert = require('../models/Alert');
const { processReadingAlerts } = require('../services/alertService');
const { broadcastSensorReading, broadcastDeviceStatus } = require('../sockets/socketHandler');
const { evaluateAndNotifyHazards } = require('../services/telegramService');
const { getPublicHazardState } = require('../services/manualHazardService');

// In-memory tilt persistence tracker to eliminate false transient tilt spikes
// Map<deviceId, { consecutiveTiltCount: number, isConfirmedTilt: boolean, lastReadingTime: number }>
const deviceTiltTracker = new Map();

/**
 * Evaluate structural tilt with hysteresis and multi-cycle confirmation.
 * Prevents resting sensor noise or accidental bumps from triggering false alerts.
 */
const evaluateTiltWithHysteresis = (deviceId, tiltAngle, rawTiltFlag) => {
  const devKey = String(deviceId).toUpperCase();
  const tracker = deviceTiltTracker.get(devKey) || {
    consecutiveTiltCount: 0,
    isConfirmedTilt: false,
    lastReadingTime: Date.now(),
  };

  const isAngleExceeded = tiltAngle !== null && !isNaN(tiltAngle) && Math.abs(tiltAngle) >= 10.0;
  const isAngleBelowReset = tiltAngle !== null && !isNaN(tiltAngle) && Math.abs(tiltAngle) <= 7.0;

  if (isAngleExceeded) {
    tracker.consecutiveTiltCount += 1;
    if (tracker.consecutiveTiltCount >= 2) {
      tracker.isConfirmedTilt = true;
    }
  } else if (isAngleBelowReset) {
    tracker.consecutiveTiltCount = 0;
    tracker.isConfirmedTilt = false;
  }

  // If the edge microcontroller firmware explicitly determined tilt (holding angle tilted), honor it
  if (rawTiltFlag === true) {
    tracker.isConfirmedTilt = true;
  } else if (rawTiltFlag === false && !isAngleExceeded) {
    tracker.isConfirmedTilt = false;
  }

  tracker.lastReadingTime = Date.now();
  deviceTiltTracker.set(devKey, tracker);
  return tracker.isConfirmedTilt;
};

// @desc    Ingest telemetry data from ESP8266 or simulated node
// @route   POST /api/iot/readings or POST /api/sensors/update
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
    
    // Tilt angle in degrees (calculated relative to calibrated baseline)
    const tiltAngle = payload.tiltAngle !== undefined ? Number(payload.tiltAngle) : (payload.angle !== undefined ? Number(payload.angle) : (rawSensors.tiltAngle !== undefined ? Number(rawSensors.tiltAngle) : null));

    // Calculate structural tilt with persistence & hysteresis
    const rawTiltInput = payload.tilt !== undefined ? payload.tilt : rawSensors.tilt;
    const tilt = evaluateTiltWithHysteresis(deviceId, tiltAngle, rawTiltInput);

    // Calculate vibration & earthquake with noise floor filtering
    let vibration = payload.vibration !== undefined ? Number(payload.vibration) : (rawSensors.vibration !== undefined ? Number(rawSensors.vibration) : 0);
    if (vibration === 0 && ax !== null && ay !== null && az !== null) {
      const accelMagnitude = Math.sqrt(ax * ax + ay * ay + az * az);
      vibration = Number(Math.abs(accelMagnitude - 1.0).toFixed(2));
    }

    // Filter resting stationary noise floor (ignore < 0.12g baseline jitter)
    if (vibration < 0.12) {
      vibration = 0.04;
    }

    // Seismic shock triggers when dynamic vibration exceeds 0.25g threshold OR explicit edge confirmation
    const isVibrationCritical = vibration >= 0.25;
    const earthquake = Boolean(payload.earthquake || rawSensors.earthquake || isVibrationCritical);

    const isSimulated = Boolean(payload.isSimulated || payload.simulated || false);
    const seq = payload.seq !== undefined && !isNaN(Number(payload.seq)) ? Number(payload.seq) : 0;

    // Water & Moisture Sensor:
    // Only evaluate water if a dedicated sensor is explicitly indicated or simulated scenario is running
    const hasWaterSensor = Boolean(
      payload.hasWaterSensor === true ||
      rawSensors.hasWaterSensor === true ||
      (isSimulated && (payload.water === true || (payload.waterLevel !== undefined && Number(payload.waterLevel) > 0)))
    );

    const water = hasWaterSensor
      ? Boolean(payload.water !== undefined ? payload.water : (payload.waterLeak !== undefined ? payload.waterLeak : (rawSensors.water !== undefined ? rawSensors.water : false)))
      : false;

    const waterLevel = hasWaterSensor
      ? (payload.waterLevel !== undefined && payload.waterLevel !== null ? Number(payload.waterLevel) : (rawSensors.waterLevel !== undefined ? Number(rawSensors.waterLevel) : (water ? 90 : 0)))
      : null;

    // Ultrasonic sensor distance (cm) - physical distance only, NEVER used to trigger false floor water alerts
    const rawDistance = payload.distance !== undefined ? Number(payload.distance) : (payload.ultrasonic !== undefined ? Number(payload.ultrasonic) : (payload.distanceCm !== undefined ? Number(payload.distanceCm) : (rawSensors.distance !== undefined ? Number(rawSensors.distance) : null)));
    const distance = (rawDistance !== null && !isNaN(rawDistance) && rawDistance > 0) ? rawDistance : null;
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

    // Check MongoDB database connectivity state before attempting operations
    if (mongoose.connection.readyState !== 1) {
      console.error('[INGEST DIAGNOSTIC] ❌ Database unavailable. mongoose.connection.readyState =', mongoose.connection.readyState);
      return res.status(503).json({
        success: false,
        message: 'Database is currently unavailable',
        deviceId,
        sequenceNumber: seq,
        seq,
        databaseSaved: false,
        saved: false,
      });
    }

    // Idempotency: Check if this exact sequence packet was already saved (avoids duplicate records on HTTP retries)
    if (seq > 0) {
      const existingDoc = await SensorReading.findOne({
        deviceId,
        seq,
      }).sort({ timestamp: -1 });

      if (existingDoc) {
        console.log(`[INGEST DIAGNOSTIC] ℹ️ Idempotent retry detected for ${deviceId} (seq: ${seq}). Returning confirmed save.`);
        return res.status(200).json({
          success: true,
          message: 'Sensor data saved successfully',
          deviceId,
          sequenceNumber: seq,
          seq,
          databaseSaved: true,
          saved: true,
          isDuplicate: true,
          readingId: existingDoc._id,
          receivedAt: existingDoc.timestamp ? existingDoc.timestamp.toISOString() : new Date().toISOString(),
          alertsTriggered: 0,
          alerts: [],
        });
      }
    }

    const mpuData = (ax !== null || gx !== null) ? { ax, ay, az, gx, gy, gz } : undefined;

    console.log(`[INGEST DIAGNOSTIC] Telemetry received from ${deviceId} (seq: ${seq}): flame=${flame}, gas=${gas}, smoke=${smoke}, tilt=${tilt} (${tiltAngle}°), quake=${earthquake} (${vibration}g), dist=${distance}cm, water=${water}`);

    // Persist sensor reading
    const reading = await SensorReading.create({
      deviceId,
      device: req.device ? req.device._id : null,
      seq,
      temperature,
      humidity,
      gas,
      smoke,
      flame,
      tilt,
      tiltAngle,
      earthquake,
      vibration,
      hasWaterSensor,
      water,
      waterLevel,
      distance,
      mpu6050: mpuData,
      rawSensors,
      isSimulated,
      signalRssi: payload.rssi !== undefined ? Number(payload.rssi) : -60,
      timestamp: isNaN(readingTimestamp.getTime()) ? new Date() : readingTimestamp,
    });

    // Update Device status & latestReading
    if (req.device) {
      req.device.status = 'online';
      req.device.lastSeenAt = new Date();
      req.device.latestReading = {
        seq,
        temperature,
        humidity,
        gas,
        smoke,
        flame,
        tilt,
        tiltAngle,
        earthquake,
        vibration,
        hasWaterSensor,
        water,
        waterLevel,
        distance,
        mpu6050: mpuData,
        isSimulated,
        timestamp: reading.timestamp,
      };

      if (payload.rssi) req.device.metadata.signalRssi = Number(payload.rssi);
      if (payload.firmwareVersion) req.device.metadata.firmwareVersion = String(payload.firmwareVersion);

      await req.device.save();
      broadcastDeviceStatus(req.device);
    }

    console.log(`[INGEST DIAGNOSTIC] ✅ MongoDB save successful: readingId=${reading._id}, seq=${seq}, device=${deviceId}, status=${req.device?.status}`);

    // Broadcast reading to all subscribed dashboards
    broadcastSensorReading(reading);

    // Evaluate Alert Rules & trigger real-time alerts if thresholds breached
    const triggeredAlerts = await processReadingAlerts(reading, req.device);

    // Only send Telegram emergency notifications for genuine non-simulated hardware telemetry
    if (!isSimulated) {
      const gasOrSmoke = (smoke !== null && smoke > gas) ? smoke : (gas || 0);
      evaluateAndNotifyHazards(
        deviceId,
        {
          fire: flame || (temperature !== null && temperature > 50),
          gas: gasOrSmoke > 200,
          tilt,
          earthquake,
        },
        {
          gasPpm: gasOrSmoke,
          flame,
          tiltAngle,
          vibration,
          distance,
          temperature,
        }
      );
    }

    res.status(201).json({
      success: true,
      message: 'Sensor data saved successfully',
      deviceId,
      sequenceNumber: seq,
      seq,
      databaseSaved: true,
      saved: true,
      receivedAt: reading.timestamp.toISOString(),
      readingId: reading._id,
      alertsTriggered: triggeredAlerts.length,
      alerts: triggeredAlerts.map(a => ({ id: a._id, title: a.title, severity: a.severity })),
    });
  } catch (error) {
    console.error('[INGEST DIAGNOSTIC] ❌ Error saving reading:', error.message);
    res.status(500).json({
      success: false,
      message: 'Database persistence error: ' + error.message,
      deviceId: req.body?.deviceId || 'UNKNOWN',
      sequenceNumber: req.body?.seq || 0,
      seq: req.body?.seq || 0,
      databaseSaved: false,
      saved: false,
      error: error.message,
    });
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
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        success: false,
        message: 'Database is currently unavailable',
        databaseSaved: false,
        reading: null,
        latestReading: null,
      });
    }

    const { deviceId } = req.query;

    const devices = await Device.find({}).select('deviceId name status lastSeenAt latestReading location supportedSensors');

    if (deviceId) {
      const devUpper = deviceId.toUpperCase();
      const [latest, device] = await Promise.all([
        SensorReading.findOne({ deviceId: devUpper }).sort({ timestamp: -1, _id: -1 }),
        Device.findOne({ deviceId: devUpper }),
      ]);

      const activeReading = latest || device?.latestReading || null;

      if (!activeReading) {
        const nowMsNR = Date.now();
        const lsNR = device?.lastSeenAt ? new Date(device.lastSeenAt).getTime() : 0;
        const secsNR = lsNR > 0 ? Math.floor((nowMsNR - lsNR) / 1000) : null;
        const statusNR = secsNR === null ? 'unknown' : (secsNR < 30 ? 'online' : 'offline');
        return res.json({
          success: true,
          message: 'No sensor readings found in database',
          deviceId: devUpper,
          deviceStatus: statusNR,
          lastSeenAt: device ? device.lastSeenAt : null,
          secondsSinceLastSeen: secsNR,
          isOnline: statusNR === 'online',
          latestReading: null,
          reading: null,
          sequenceNumber: 0,
          seq: 0,
          databaseSaved: false,
          lastSavedAt: null,
          timestamp: null,
          devices: devices.map((d) => {
            const dLsMs = d.lastSeenAt ? new Date(d.lastSeenAt).getTime() : 0;
            const dSecs = dLsMs > 0 ? Math.floor((nowMsNR - dLsMs) / 1000) : null;
            const dStat = dSecs === null ? 'unknown' : (dSecs < 30 ? 'online' : 'offline');
            return {
              deviceId: d.deviceId,
              name: d.name,
              status: dStat,
              location: d.location,
              lastSeenAt: d.lastSeenAt,
              secondsSinceLastSeen: dSecs,
              isOnline: dStat === 'online',
              latestReading: d.latestReading,
              supportedSensors: d.supportedSensors,
            };
          }),
          count: devices.length,
        });
      }

      // Compute live device status from lastSeenAt freshness (do NOT trust stale DB status field)
      const nowMs = Date.now();
      const lastSeenMs = device?.lastSeenAt ? new Date(device.lastSeenAt).getTime() : 0;
      const secondsSinceLastSeen = lastSeenMs > 0 ? Math.floor((nowMs - lastSeenMs) / 1000) : null;
      let liveDeviceStatus = 'unknown';
      if (secondsSinceLastSeen === null) {
        liveDeviceStatus = 'unknown';
      } else if (secondsSinceLastSeen < 30) {
        liveDeviceStatus = 'online';
      } else {
        liveDeviceStatus = 'offline';
      }

      return res.json({
        success: true,
        deviceId: devUpper,
        deviceStatus: liveDeviceStatus,
        lastSeenAt: device ? device.lastSeenAt : null,
        secondsSinceLastSeen,
        isOnline: liveDeviceStatus === 'online',
        latestReading: activeReading,
        reading: activeReading,
        sequenceNumber: activeReading?.seq || activeReading?.sequenceNumber || 0,
        seq: activeReading?.seq || 0,
        databaseSaved: true,
        lastSavedAt: activeReading?.createdAt || activeReading?.timestamp || null,
        timestamp: activeReading?.timestamp || new Date().toISOString(),
        devices: devices.map((d) => {
          const dLastSeenMs = d.lastSeenAt ? new Date(d.lastSeenAt).getTime() : 0;
          const dSecsSince = dLastSeenMs > 0 ? Math.floor((nowMs - dLastSeenMs) / 1000) : null;
          const dLiveStatus = dSecsSince === null ? 'unknown' : (dSecsSince < 30 ? 'online' : 'offline');
          return {
            deviceId: d.deviceId,
            name: d.name,
            status: dLiveStatus,
            location: d.location,
            lastSeenAt: d.lastSeenAt,
            secondsSinceLastSeen: dSecsSince,
            isOnline: dLiveStatus === 'online',
            latestReading: d.latestReading,
            supportedSensors: d.supportedSensors,
          };
        }),
        count: devices.length,
      });
    }

    // Return latest readings for all known devices, plus the overall latest reading
    // Prioritize non-simulated real hardware telemetry over background simulation
    let mostRecent = await SensorReading.findOne({ isSimulated: false }).sort({ timestamp: -1, _id: -1 });
    if (!mostRecent) {
      mostRecent = await SensorReading.findOne({}).sort({ timestamp: -1, _id: -1 });
    }

    const primaryDevice = devices.find((d) => d.deviceId === 'RESQ-NODE-01') || devices[0];
    const activeReading = mostRecent || primaryDevice?.latestReading || null;

    // Compute live status for all devices from lastSeenAt freshness
    const nowMsAll = Date.now();

    res.json({
      success: true,
      count: devices.length,
      latestReading: activeReading,
      reading: activeReading,
      sequenceNumber: activeReading?.seq || activeReading?.sequenceNumber || 0,
      seq: activeReading?.seq || 0,
      databaseSaved: Boolean(activeReading),
      lastSavedAt: activeReading?.createdAt || activeReading?.timestamp || null,
      timestamp: activeReading?.timestamp || new Date().toISOString(),
      devices: devices.map((d) => {
        const dLsMs = d.lastSeenAt ? new Date(d.lastSeenAt).getTime() : 0;
        const dSecs = dLsMs > 0 ? Math.floor((nowMsAll - dLsMs) / 1000) : null;
        const dStat = dSecs === null ? 'unknown' : (dSecs < 30 ? 'online' : 'offline');
        return {
          deviceId: d.deviceId,
          name: d.name,
          status: dStat,
          location: d.location,
          lastSeenAt: d.lastSeenAt,
          secondsSinceLastSeen: dSecs,
          isOnline: dStat === 'online',
          latestReading: d.latestReading,
          supportedSensors: d.supportedSensors,
        };
      }),
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
    let maxVibration = 0;

    devices.forEach((d) => {
      const r = d.latestReading;
      if (!r) return;
      if (r.flame) hasFire = true;
      if (r.smoke !== undefined && r.smoke !== null && r.smoke > maxSmoke) maxSmoke = r.smoke;
      if (r.tilt) hasTilt = true;
      if (r.earthquake) hasEarthquake = true;
      if (r.vibration !== undefined && r.vibration !== null && r.vibration > maxVibration) maxVibration = r.vibration;
      if (r.hasWaterSensor && r.water) hasWater = true;
    });

    const hasWaterHardware = devices.some((d) => d.latestReading?.hasWaterSensor);

    // Integrate remote manual controller hazard states
    const manualState = getPublicHazardState();
    const manualH = manualState.hazards || {};

    if (manualH.fire?.isActive) hasFire = true;
    if (manualH.gas?.isActive && maxSmoke < 450) maxSmoke = 450;
    if (manualH.tilt?.isActive) hasTilt = true;
    if (manualH.earthquake?.isActive) {
      hasEarthquake = true;
      if (maxVibration < 2.5) maxVibration = 2.5;
    }
    if (manualH.water?.isActive) hasWater = true;

    const isCritical = hasFire || hasEarthquake || hasTilt || hasWater || maxSmoke > 400 || activeAlerts.some((a) => a.severity === 'critical');
    const isWarning = !isCritical && (maxSmoke > 250 || activeAlerts.some((a) => a.severity === 'warning'));

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      overallStatus: isCritical ? 'critical' : (isWarning ? 'warning' : 'nominal'),
      activeAlertsCount: activeAlerts.length,
      onlineDevicesCount: devices.filter((d) => d.status === 'online').length,
      manualHazards: manualState,
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
          hasSensor: hasWaterHardware,
          status: hasWater ? 'CRITICAL_FLOOD_LEAK' : (hasWaterHardware ? 'DRY' : 'NOT_CONNECTED'),
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
