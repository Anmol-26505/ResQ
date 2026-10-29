const Device = require('../models/Device');
const SensorReading = require('../models/SensorReading');
const Alert = require('../models/Alert');

// Helper to calculate date cutoff from range string
const getCutoffDate = (range) => {
  const now = new Date();
  switch (range) {
    case '1h':
      return new Date(now.getTime() - 60 * 60 * 1000);
    case '24h':
      return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    case '7d':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case '30d':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    default:
      return new Date(now.getTime() - 24 * 60 * 60 * 1000);
  }
};

// @desc    Get system overview statistics for main dashboard
// @route   GET /api/analytics/overview
// @access  Private
const getOverviewStats = async (req, res, next) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [
      totalDevices,
      onlineDevices,
      offlineDevices,
      maintenanceDevices,
      activeAlerts,
      criticalAlerts,
      readingsToday,
      totalReadings,
      recentAlerts,
    ] = await Promise.all([
      Device.countDocuments(),
      Device.countDocuments({ status: 'online' }),
      Device.countDocuments({ status: 'offline' }),
      Device.countDocuments({ status: 'maintenance' }),
      Alert.countDocuments({ status: 'active' }),
      Alert.countDocuments({ status: 'active', severity: 'critical' }),
      SensorReading.countDocuments({ timestamp: { $gte: todayStart } }),
      SensorReading.countDocuments(),
      Alert.find({ status: 'active' })
        .sort({ timestamp: -1 })
        .limit(5)
        .populate('device', 'name location'),
    ]);

    res.json({
      success: true,
      data: {
        devices: {
          total: totalDevices,
          online: onlineDevices,
          offline: offlineDevices,
          maintenance: maintenanceDevices,
          onlineRate: totalDevices > 0 ? Math.round((onlineDevices / totalDevices) * 100) : 0,
        },
        alerts: {
          active: activeAlerts,
          critical: criticalAlerts,
          warning: activeAlerts - criticalAlerts,
        },
        readings: {
          today: readingsToday,
          total: totalReadings,
        },
        recentAlerts,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get historical sensor telemetry for charts
// @route   GET /api/analytics/readings
// @access  Private
const getHistoricalReadings = async (req, res, next) => {
  try {
    const { range = '24h', deviceId } = req.query;
    const cutoff = getCutoffDate(range);

    const matchQuery = {
      timestamp: { $gte: cutoff },
    };

    if (deviceId && deviceId !== 'ALL') {
      matchQuery.deviceId = deviceId.toUpperCase();
    }

    // Limit to reasonable sample size for smooth chart rendering
    const maxDataPoints = 120;
    const totalCount = await SensorReading.countDocuments(matchQuery);

    let readings;
    if (totalCount <= maxDataPoints) {
      readings = await SensorReading.find(matchQuery)
        .sort({ timestamp: 1 })
        .select('deviceId temperature humidity gas flame timestamp isSimulated');
    } else {
      // Sample evenly
      const skipFactor = Math.ceil(totalCount / maxDataPoints);
      readings = await SensorReading.find(matchQuery)
        .sort({ timestamp: 1 })
        .select('deviceId temperature humidity gas flame timestamp isSimulated');
      
      readings = readings.filter((_, idx) => idx % skipFactor === 0);
    }

    res.json({
      success: true,
      range,
      count: readings.length,
      readings,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get incident breakdown and analytics
// @route   GET /api/analytics/incidents
// @access  Private
const getIncidentStats = async (req, res, next) => {
  try {
    const { range = '7d' } = req.query;
    const cutoff = getCutoffDate(range);

    const [severityBreakdown, statusBreakdown, deviceIncidentCounts, recentHistory] = await Promise.all([
      Alert.aggregate([
        { $match: { timestamp: { $gte: cutoff } } },
        { $group: { _id: '$severity', count: { $sum: 1 } } },
      ]),
      Alert.aggregate([
        { $match: { timestamp: { $gte: cutoff } } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      Alert.aggregate([
        { $match: { timestamp: { $gte: cutoff } } },
        { $group: { _id: '$deviceId', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),
      Alert.find({ timestamp: { $gte: cutoff } })
        .sort({ timestamp: -1 })
        .limit(20),
    ]);

    res.json({
      success: true,
      range,
      severityBreakdown: severityBreakdown.reduce((acc, curr) => {
        acc[curr._id] = curr.count;
        return acc;
      }, { warning: 0, critical: 0 }),
      statusBreakdown: statusBreakdown.reduce((acc, curr) => {
        acc[curr._id] = curr.count;
        return acc;
      }, { active: 0, acknowledged: 0, resolved: 0 }),
      byDevice: deviceIncidentCounts,
      recentHistory,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get device health statistics
// @route   GET /api/analytics/device-health
// @access  Private
const getDeviceHealth = async (req, res, next) => {
  try {
    const devices = await Device.find().sort({ name: 1 });

    const healthData = await Promise.all(
      devices.map(async (dev) => {
        const readingsCount = await SensorReading.countDocuments({ deviceId: dev.deviceId });
        const alertCount = await Alert.countDocuments({ deviceId: dev.deviceId });

        return {
          id: dev._id,
          deviceId: dev.deviceId,
          name: dev.name,
          location: dev.location,
          status: dev.status,
          lastSeenAt: dev.lastSeenAt,
          rssi: dev.metadata?.signalRssi ?? -65,
          firmware: dev.metadata?.firmwareVersion ?? '1.0.4',
          readingsCount,
          alertCount,
          latestReading: dev.latestReading,
        };
      })
    );

    res.json({
      success: true,
      devices: healthData,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Export historical telemetry data to CSV
// @route   GET /api/analytics/export-csv
// @access  Private
const exportCsv = async (req, res, next) => {
  try {
    const { deviceId, range = '7d' } = req.query;
    const cutoff = getCutoffDate(range);

    const filter = { timestamp: { $gte: cutoff } };
    if (deviceId && deviceId !== 'ALL') {
      filter.deviceId = deviceId.toUpperCase();
    }

    const readings = await SensorReading.find(filter)
      .sort({ timestamp: -1 })
      .limit(5000);

    let csv = 'Timestamp,Device ID,Temperature (°C),Humidity (%),Gas (PPM),Flame Detected,Data Type\r\n';

    for (const r of readings) {
      const ts = r.timestamp ? new Date(r.timestamp).toISOString() : '';
      const temp = r.temperature !== null ? r.temperature : '';
      const hum = r.humidity !== null ? r.humidity : '';
      const gas = r.gas !== null ? r.gas : '';
      const flame = r.flame ? 'TRUE' : 'FALSE';
      const type = r.isSimulated ? 'Simulated' : 'Hardware';

      csv += `"${ts}","${r.deviceId}",${temp},${hum},${gas},${flame},"${type}"\r\n`;
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=resq-telemetry-${range}-${Date.now()}.csv`);
    return res.status(200).send(csv);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getOverviewStats,
  getHistoricalReadings,
  getIncidentStats,
  getDeviceHealth,
  exportCsv,
};
