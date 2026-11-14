const Alert = require('../models/Alert');
const AlertRule = require('../models/AlertRule');
const { broadcastAlert } = require('../sockets/socketHandler');

/**
 * Compare reading value with threshold value based on rule operator.
 */
const evaluateCondition = (readingValue, operator, thresholdValue) => {
  if (readingValue === undefined || readingValue === null) return false;

  const numReading = Number(readingValue);
  const numThreshold = Number(thresholdValue);

  switch (operator) {
    case '>':
      return !isNaN(numReading) && !isNaN(numThreshold) && numReading > numThreshold;
    case '>=':
      return !isNaN(numReading) && !isNaN(numThreshold) && numReading >= numThreshold;
    case '<':
      return !isNaN(numReading) && !isNaN(numThreshold) && numReading < numThreshold;
    case '<=':
      return !isNaN(numReading) && !isNaN(numThreshold) && numReading <= numThreshold;
    case '==':
      return readingValue == thresholdValue || (Boolean(readingValue) === Boolean(thresholdValue));
    case '!=':
      return readingValue != thresholdValue;
    default:
      return false;
  }
};

/**
 * Process a new sensor reading against configured alert rules.
 */
const processReadingAlerts = async (reading, device) => {
  try {
    // Find all enabled rules applicable to ALL devices or this specific device
    const rules = await AlertRule.find({
      isEnabled: true,
      $or: [{ deviceId: 'ALL' }, { deviceId: reading.deviceId.toUpperCase() }],
    });

    if (!rules || rules.length === 0) return [];

    const generatedAlerts = [];

    for (const rule of rules) {
      const sensorVal = reading[rule.sensorType];
      if (sensorVal === undefined || sensorVal === null) continue;

      const conditionMet = evaluateCondition(sensorVal, rule.operator, rule.thresholdValue);

      if (conditionMet) {
        // Check cooldown to avoid flooding alerts
        const cooldownMs = (rule.cooldownMinutes || 5) * 60 * 1000;
        const cutoffTime = new Date(Date.now() - cooldownMs);

        // Check if an active alert for this device, sensor, and rule already exists within cooldown
        const existingAlert = await Alert.findOne({
          deviceId: reading.deviceId.toUpperCase(),
          sensorType: rule.sensorType,
          status: 'active',
          timestamp: { $gte: cutoffTime },
        });

        if (existingAlert) {
          // Still in cooldown, skip creating duplicate
          continue;
        }

        // Generate alert description
        let unit = '';
        if (rule.sensorType === 'temperature') unit = '°C';
        else if (rule.sensorType === 'humidity') unit = '%';
        else if (rule.sensorType === 'gas' || rule.sensorType === 'smoke') unit = ' PPM';
        else if (rule.sensorType === 'vibration') unit = 'g';
        else if (rule.sensorType === 'waterLevel') unit = '%';

        const alertTitle = `${rule.name} [${reading.deviceId}]`;
        const alertMessage = `${rule.description || 'Threshold exceeded'}: ${rule.sensorType} reading is ${sensorVal}${unit} (threshold: ${rule.operator} ${rule.thresholdValue}${unit})`;

        const newAlert = await Alert.create({
          title: alertTitle,
          message: alertMessage,
          severity: rule.severity,
          status: 'active',
          deviceId: reading.deviceId.toUpperCase(),
          device: device ? device._id : null,
          sensorType: rule.sensorType,
          readingValue: sensorVal,
          thresholdValue: rule.thresholdValue,
          rule: rule._id,
          isSimulated: reading.isSimulated || false,
          timestamp: new Date(),
        });

        // Update rule lastTriggeredAt
        rule.lastTriggeredAt = new Date();
        await rule.save();

        // Broadcast alert in real-time
        broadcastAlert(newAlert);
        generatedAlerts.push(newAlert);
      }
    }

    return generatedAlerts;
  } catch (error) {
    console.error('Error processing alerts for reading:', error.message);
    return [];
  }
};

module.exports = {
  processReadingAlerts,
  evaluateCondition,
};
