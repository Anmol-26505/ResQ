const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
    },
    severity: {
      type: String,
      enum: ['warning', 'critical'],
      default: 'warning',
      index: true,
    },
    status: {
      type: String,
      enum: ['active', 'acknowledged', 'resolved'],
      default: 'active',
      index: true,
    },
    deviceId: {
      type: String,
      required: true,
      index: true,
      trim: true,
      uppercase: true,
    },
    device: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Device',
    },
    sensorType: {
      type: String,
      required: true,
    },
    readingValue: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    thresholdValue: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    rule: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AlertRule',
    },
    isSimulated: {
      type: Boolean,
      default: false,
    },
    acknowledgedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    acknowledgedAt: {
      type: Date,
      default: null,
    },
    acknowledgeNotes: {
      type: String,
      default: '',
    },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
    resolutionNotes: {
      type: String,
      default: '',
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

alertSchema.index({ status: 1, severity: 1, timestamp: -1 });
alertSchema.index({ deviceId: 1, timestamp: -1 });

const Alert = mongoose.model('Alert', alertSchema);

module.exports = Alert;
