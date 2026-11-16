const mongoose = require('mongoose');

const manualHazardSchema = new mongoose.Schema(
  {
    hazard: {
      type: String,
      required: true,
      unique: true,
      enum: ['fire', 'water', 'tilt', 'earthquake', 'gas'],
      index: true,
    },
    isActive: {
      type: Boolean,
      default: false,
      index: true,
    },
    title: {
      type: String,
      default: '',
    },
    message: {
      type: String,
      default: '',
    },
    severity: {
      type: String,
      enum: ['warning', 'critical'],
      default: 'critical',
    },
    activatedBy: {
      type: String,
      default: 'Anmol',
    },
    activatedAt: {
      type: Date,
      default: null,
    },
    deactivatedAt: {
      type: Date,
      default: null,
    },
    lastUpdatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

const ManualHazard = mongoose.model('ManualHazard', manualHazardSchema);

module.exports = ManualHazard;
