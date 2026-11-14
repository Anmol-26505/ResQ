const Alert = require('../models/Alert');
const AlertRule = require('../models/AlertRule');
const Device = require('../models/Device');
const { broadcastAlert, broadcastAlertUpdated } = require('../sockets/socketHandler');
const { sendTestNotification, getTelegramConfig } = require('../services/telegramService');

// @desc    Get all alerts with filtering & pagination
// @route   GET /api/alerts
// @access  Private
const getAlerts = async (req, res, next) => {
  try {
    const { status, severity, deviceId, limit = 50, page = 1 } = req.query;
    const filter = {};

    if (status && status !== 'all') {
      filter.status = status;
    }
    if (severity && ['warning', 'critical'].includes(severity)) {
      filter.severity = severity;
    }
    if (deviceId) {
      filter.deviceId = deviceId.toUpperCase();
    }

    // Filter out false-positive water alerts where reading value was false, 0, or null
    if (filter.status === 'active') {
      filter.$nor = [
        { sensorType: { $in: ['water', 'waterLevel'] }, readingValue: { $in: [false, 0, '0', null] } },
      ];
    }

    const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
    const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
    const skip = (parsedPage - 1) * parsedLimit;

    const [alerts, total, activeCount, unreadCount] = await Promise.all([
      Alert.find(filter)
        .populate('acknowledgedBy', 'name email')
        .populate('resolvedBy', 'name email')
        .populate('rule', 'name operator thresholdValue')
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(parsedLimit),
      Alert.countDocuments(filter),
      Alert.countDocuments({ status: 'active' }),
      Alert.countDocuments({ status: { $in: ['active', 'acknowledged'] } }),
    ]);

    res.json({
      success: true,
      total,
      page: parsedPage,
      limit: parsedLimit,
      totalPages: Math.ceil(total / parsedLimit),
      activeCount,
      unreadCount,
      alerts,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single alert by ID
// @route   GET /api/alerts/:id
// @access  Private
const getAlertById = async (req, res, next) => {
  try {
    const alert = await Alert.findById(req.params.id)
      .populate('acknowledgedBy', 'name email')
      .populate('resolvedBy', 'name email')
      .populate('rule');

    if (!alert) {
      return res.status(404).json({
        success: false,
        message: 'Alert not found',
      });
    }

    res.json({
      success: true,
      alert,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Acknowledge an incident
// @route   PATCH /api/alerts/:id/acknowledge
// @access  Private
const acknowledgeAlert = async (req, res, next) => {
  try {
    const { note } = req.body;
    const alert = await Alert.findById(req.params.id);

    if (!alert) {
      return res.status(404).json({
        success: false,
        message: 'Alert not found',
      });
    }

    if (alert.status === 'resolved') {
      return res.status(400).json({
        success: false,
        message: 'Alert is already resolved',
      });
    }

    alert.status = 'acknowledged';
    alert.acknowledgedBy = req.user ? req.user._id : null;
    alert.acknowledgedAt = new Date();
    if (note) alert.acknowledgeNotes = note.trim();

    await alert.save();
    if (alert.acknowledgedBy) {
      await alert.populate('acknowledgedBy', 'name email');
    }

    broadcastAlertUpdated(alert);

    res.json({
      success: true,
      message: 'Alert incident acknowledged by operator',
      alert,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Resolve an incident
// @route   PATCH /api/alerts/:id/resolve
// @access  Private
const resolveAlert = async (req, res, next) => {
  try {
    const { note } = req.body;
    const alert = await Alert.findById(req.params.id);

    if (!alert) {
      return res.status(404).json({
        success: false,
        message: 'Alert not found',
      });
    }

    alert.status = 'resolved';
    alert.resolvedBy = req.user._id;
    alert.resolvedAt = new Date();
    if (note) alert.resolutionNotes = note.trim();

    await alert.save();
    await alert.populate('resolvedBy', 'name email');

    broadcastAlertUpdated(alert);

    res.json({
      success: true,
      message: 'Alert marked as resolved',
      alert,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get configured alert rules
// @route   GET /api/alerts/rules
// @access  Private
const getAlertRules = async (req, res, next) => {
  try {
    const rules = await AlertRule.find().sort({ createdAt: -1 });
    res.json({
      success: true,
      rules,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new alert rule
// @route   POST /api/alerts/rules
// @access  Private
const createAlertRule = async (req, res, next) => {
  try {
    const { name, description, deviceId, sensorType, operator, thresholdValue, severity, cooldownMinutes } = req.body;

    if (!name || !sensorType || !operator || thresholdValue === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Please provide name, sensorType, operator, and thresholdValue',
      });
    }

    const rule = await AlertRule.create({
      name: name.trim(),
      description: description ? description.trim() : '',
      deviceId: deviceId ? deviceId.trim().toUpperCase() : 'ALL',
      sensorType,
      operator,
      thresholdValue,
      severity: severity || 'warning',
      cooldownMinutes: cooldownMinutes || 5,
    });

    res.status(201).json({
      success: true,
      message: 'Alert rule created successfully',
      rule,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update alert rule
// @route   PATCH /api/alerts/rules/:id
// @access  Private
const updateAlertRule = async (req, res, next) => {
  try {
    const rule = await AlertRule.findById(req.params.id);

    if (!rule) {
      return res.status(404).json({
        success: false,
        message: 'Alert rule not found',
      });
    }

    const { name, description, deviceId, sensorType, operator, thresholdValue, severity, cooldownMinutes, isEnabled } = req.body;

    if (name) rule.name = name.trim();
    if (description !== undefined) rule.description = description.trim();
    if (deviceId) rule.deviceId = deviceId.trim().toUpperCase();
    if (sensorType) rule.sensorType = sensorType;
    if (operator) rule.operator = operator;
    if (thresholdValue !== undefined) rule.thresholdValue = thresholdValue;
    if (severity) rule.severity = severity;
    if (cooldownMinutes !== undefined) rule.cooldownMinutes = cooldownMinutes;
    if (isEnabled !== undefined) rule.isEnabled = isEnabled;

    await rule.save();

    res.json({
      success: true,
      message: 'Alert rule updated successfully',
      rule,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete alert rule
// @route   DELETE /api/alerts/rules/:id
// @access  Private
const deleteAlertRule = async (req, res, next) => {
  try {
    const rule = await AlertRule.findById(req.params.id);

    if (!rule) {
      return res.status(404).json({
        success: false,
        message: 'Alert rule not found',
      });
    }

    await rule.deleteOne();

    res.json({
      success: true,
      message: 'Alert rule deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Receive and process an alert (e.g. from edge NodeMCU or operator)
// @route   POST /api/alerts
// @access  Public / Optional Protect
const createManualAlert = async (req, res, next) => {
  try {
    const {
      deviceId = 'RESQ-NODE-01',
      title,
      message,
      severity = 'warning',
      sensorType = 'general',
      readingValue,
      thresholdValue,
    } = req.body;

    if (!title && !sensorType) {
      return res.status(400).json({
        success: false,
        message: 'Title or sensorType is required to trigger an alert',
      });
    }

    const devUpper = String(deviceId).toUpperCase();
    const device = await Device.findOne({ deviceId: devUpper });

    const alertTitle = title || `Emergency Alert: ${sensorType.toUpperCase()} Detected`;
    const alertMessage = message || `Hazard threshold triggered for ${sensorType} on device ${devUpper}`;

    const alert = await Alert.create({
      deviceId: devUpper,
      device: device ? device._id : null,
      title: alertTitle,
      message: alertMessage,
      severity: ['warning', 'critical'].includes(severity) ? severity : 'warning',
      status: 'active',
      sensorType: String(sensorType).toLowerCase(),
      readingValue: readingValue !== undefined ? readingValue : 'HAZARD_TRIGGERED',
      thresholdValue: thresholdValue !== undefined ? thresholdValue : 'SAFETY_LIMIT',
      timestamp: new Date(),
    });

    // Broadcast in real-time to all connected dashboards via Socket.IO
    broadcastAlert(alert);

    res.status(201).json({
      success: true,
      message: 'Alert received, recorded, and broadcast in real-time',
      alert,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Send test Telegram notification to verify bot setup
// @route   POST /api/alerts/test-telegram
// @access  Private (Authorized Operator / Administrator)
const testTelegramAlert = async (req, res, next) => {
  try {
    const config = getTelegramConfig();
    if (!config.isConfigured) {
      return res.status(400).json({
        success: false,
        message: 'Telegram is not configured. Please ensure TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID are set in environment variables.',
      });
    }

    const operatorName = req.user?.name || req.user?.email || 'Authorized Administrator';
    const result = await sendTestNotification(operatorName);

    if (result.success) {
      return res.json({
        success: true,
        message: 'Telegram test alert delivered successfully to configured chat.',
      });
    } else {
      return res.status(502).json({
        success: false,
        message: `Telegram delivery failed: ${result.reason || 'Check bot permissions or Chat ID'}`,
      });
    }
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAlerts,
  getAlertById,
  acknowledgeAlert,
  resolveAlert,
  createManualAlert,
  getAlertRules,
  createAlertRule,
  updateAlertRule,
  deleteAlertRule,
  testTelegramAlert,
};
