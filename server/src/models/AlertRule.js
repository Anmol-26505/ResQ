const mongoose = require('mongoose');

const alertRuleSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
    },
    deviceId: {
      type: String,
      default: 'ALL', // 'ALL' or specific device ID
      trim: true,
      uppercase: true,
    },
    sensorType: {
      type: String,
      required: true,
      enum: ['temperature', 'gas', 'smoke', 'flame', 'humidity', 'tilt', 'earthquake', 'water', 'personCount'],
    },
    operator: {
      type: String,
      required: true,
      enum: ['>', '>=', '<', '<=', '==', '!='],
      default: '>',
    },
    thresholdValue: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    severity: {
      type: String,
      enum: ['warning', 'critical'],
      default: 'warning',
    },
    cooldownMinutes: {
      type: Number,
      default: 5, // minimum minutes between repeated alerts from same device & rule
    },
    lastTriggeredAt: {
      type: Date,
      default: null,
    },
    isEnabled: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

const AlertRule = mongoose.model('AlertRule', alertRuleSchema);

module.exports = AlertRule;
