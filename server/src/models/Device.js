const mongoose = require('mongoose');
const crypto = require('crypto');

const deviceSchema = new mongoose.Schema(
  {
    deviceId: {
      type: String,
      required: [true, 'Device ID is required'],
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Device name is required'],
      trim: true,
      maxlength: [80, 'Device name cannot exceed 80 characters'],
    },
    location: {
      type: String,
      default: 'Main Facility',
      trim: true,
      maxlength: [120, 'Location label cannot exceed 120 characters'],
    },
    deviceType: {
      type: String,
      default: 'NodeMCU ESP8266',
      trim: true,
    },
    supportedSensors: {
      type: [String],
      default: ['temperature', 'humidity', 'gas', 'smoke', 'flame', 'tilt', 'earthquake', 'water', 'personCount', 'distance', 'mpu6050', 'ultrasonic', 'mq2'],
    },
    apiKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['online', 'offline', 'maintenance'],
      default: 'offline',
      index: true,
    },
    lastSeenAt: {
      type: Date,
      default: null,
      index: true,
    },
    latestReading: {
      temperature: Number,
      humidity: Number,
      gas: Number,
      smoke: Number,
      flame: Boolean,
      tilt: Boolean,
      earthquake: Boolean,
      vibration: Number,
      water: Boolean,
      waterLevel: Number,
      personCount: Number,
      distance: Number,
      tiltAngle: Number,
      mpu6050: {
        ax: Number,
        ay: Number,
        az: Number,
        gx: Number,
        gy: Number,
        gz: Number,
      },
      timestamp: Date,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    metadata: {
      firmwareVersion: { type: String, default: '1.0.4-esp8266' },
      ipAddress: { type: String, default: '' },
      wifiSSID: { type: String, default: '' },
      signalRssi: { type: Number, default: -65 },
      macAddress: { type: String, default: '' },
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

// Helper to generate a secure random API key
deviceSchema.statics.generateApiKey = function () {
  return 'resq_dev_' + crypto.randomBytes(20).toString('hex');
};

const Device = mongoose.model('Device', deviceSchema);

module.exports = Device;
