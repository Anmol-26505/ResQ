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
    seq: {
      type: Number,
      default: 0,
      index: true,
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
    smoke: {
      type: Number,
      default: null,
    },
    flame: {
      type: Boolean,
      default: false,
    },
    tilt: {
      type: Boolean,
      default: false,
    },
    earthquake: {
      type: Boolean,
      default: false,
    },
    vibration: {
      type: Number,
      default: 0,
    },
    water: {
      type: Boolean,
      default: false,
    },
    waterLevel: {
      type: Number,
      default: null,
    },
    hasWaterSensor: {
      type: Boolean,
      default: false,
    },
    distance: {
      type: Number,
      default: null, // Ultrasonic distance in cm
    },
    tiltAngle: {
      type: Number,
      default: null, // Tilt angle in degrees
    },
    mpu6050: {
      ax: { type: Number, default: null },
      ay: { type: Number, default: null },
      az: { type: Number, default: null },
      gx: { type: Number, default: null },
      gy: { type: Number, default: null },
      gz: { type: Number, default: null },
      pitch: { type: Number, default: null },
      roll: { type: Number, default: null },
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
