const mongoose = require('mongoose');

const sensorReadingSchema = new mongoose.Schema(
  {
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
    temperature: {
      type: Number,
      default: null,
    },
    humidity: {
      type: Number,
      default: null,
    },
    gas: {
      type: Number,
      default: null,
    },
    flame: {
      type: Boolean,
      default: false,
    },
    rawSensors: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: {},
    },
    batteryLevel: {
      type: Number,
      default: 100,
    },
    signalRssi: {
      type: Number,
      default: -60,
    },
    isSimulated: {
      type: Boolean,
      default: false,
      index: true,
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

// Compound indexes for fast time-range querying and aggregation
sensorReadingSchema.index({ deviceId: 1, timestamp: -1 });
sensorReadingSchema.index({ timestamp: -1 });
sensorReadingSchema.index({ isSimulated: 1, timestamp: -1 });

const SensorReading = mongoose.model('SensorReading', sensorReadingSchema);

module.exports = SensorReading;
