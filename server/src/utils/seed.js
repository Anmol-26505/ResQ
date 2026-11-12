require('dotenv').config();
const mongoose = require('mongoose');
const { connectDB, disconnectDB } = require('../config/db');
const User = require('../models/User');
const Device = require('../models/Device');
const SensorReading = require('../models/SensorReading');
const Alert = require('../models/Alert');
const AlertRule = require('../models/AlertRule');

const seedData = async (isStandalone = false) => {
  try {
    console.log('🌱 Starting ResQ Seed Routine...');
    if (isStandalone) {
      await connectDB();
    }

    // Clear existing collections
    console.log('🧹 Cleaning existing data collections...');
    await Promise.all([
      User.deleteMany({}),
      Device.deleteMany({}),
      SensorReading.deleteMany({}),
      Alert.deleteMany({}),
      AlertRule.deleteMany({}),
    ]);

    // 1. Seed Users
    console.log('👤 Creating default user accounts...');
    const adminUser = await User.create({
      name: 'ResQ System Administrator',
      email: 'admin@resq.internal',
      password: 'adminPassword123!',
      role: 'admin',
      isActive: true,
      lastLogin: new Date(),
    });

    const operatorUser = await User.create({
      name: 'Sarah Chen (Safety Operator)',
      email: 'operator@resq.internal',
      password: 'operatorPassword123!',
      role: 'user',
      isActive: true,
      lastLogin: new Date(),
    });

    console.log(`✅ Users created:
      - Admin: admin@resq.internal (password: adminPassword123!)
      - Operator: operator@resq.internal (password: operatorPassword123!)`);

    // 2. Seed Alert Rules
    console.log('📏 Seeding default alert rules & thresholds...');
    const rules = await AlertRule.insertMany([
      {
        name: 'Critical Fire Detection',
        description: 'Infrared optical flame sensor triggered active fire condition',
        deviceId: 'ALL',
        sensorType: 'flame',
        operator: '==',
        thresholdValue: true,
        severity: 'critical',
        cooldownMinutes: 5,
        isEnabled: true,
      },
      {
        name: 'Earthquake & Structural Tilt Alert',
        description: 'Seismic tilt and vibration sensor detected structural shift or tremor',
        deviceId: 'ALL',
        sensorType: 'earthquake',
        operator: '==',
        thresholdValue: true,
        severity: 'critical',
        cooldownMinutes: 5,
        isEnabled: true,
      },
      {
        name: 'Critical Water Leak / Flood Detection',
        description: 'Water probe sensor detected liquid accumulation on facility floor',
        deviceId: 'ALL',
        sensorType: 'water',
        operator: '==',
        thresholdValue: true,
        severity: 'critical',
        cooldownMinutes: 5,
        isEnabled: true,
      },
      {
        name: 'Room Overcrowding Hazard',
        description: 'Person count exceeded safe room occupancy limit',
        deviceId: 'ALL',
        sensorType: 'personCount',
        operator: '>',
        thresholdValue: 10,
        severity: 'warning',
        cooldownMinutes: 10,
        isEnabled: true,
      },
      {
        name: 'Toxic Smoke & Gas Level',
        description: 'MQ-2 / MQ-135 sensor detected toxic smoke concentration',
        deviceId: 'ALL',
        sensorType: 'smoke',
        operator: '>',
        thresholdValue: 200,
        severity: 'critical',
        cooldownMinutes: 5,
        isEnabled: true,
      },
      {
        name: 'Critical High Temperature',
        description: 'Thermal sensor detected ambient heat exceeding safety thresholds',
        deviceId: 'ALL',
        sensorType: 'temperature',
        operator: '>',
        thresholdValue: 50,
        severity: 'critical',
        cooldownMinutes: 5,
        isEnabled: true,
      },
      {
        name: 'Elevated Heat Warning',
        description: 'Temperature rising above normal operating limits',
        deviceId: 'ALL',
        sensorType: 'temperature',
        operator: '>',
        thresholdValue: 36,
        severity: 'warning',
        cooldownMinutes: 10,
        isEnabled: true,
      },
      {
        name: 'Combustible Gas Leak Warning',
        description: 'Gas level elevated above background baseline',
        deviceId: 'ALL',
        sensorType: 'gas',
        operator: '>',
        thresholdValue: 180,
        severity: 'warning',
        cooldownMinutes: 10,
        isEnabled: true,
      },
      {
        name: 'Low Humidity ESD Hazard',
        description: 'Relative humidity dropped below electrostatic safe range',
        deviceId: 'ALL',
        sensorType: 'humidity',
        operator: '<',
        thresholdValue: 25,
        severity: 'warning',
        cooldownMinutes: 15,
        isEnabled: true,
      },
    ]);

    // 3. Seed IoT Devices
    console.log('📡 Registering hardware and simulated nodes...');
    const now = new Date();
    const devices = await Device.insertMany([
      {
        deviceId: 'RESQ-NODE-01',
        name: 'Server Room Alpha Node',
        location: 'Data Center Bld 4, Rack 12-A',
        deviceType: 'NodeMCU ESP8266',
        supportedSensors: ['temperature', 'humidity', 'gas', 'smoke', 'flame', 'tilt', 'earthquake', 'water', 'personCount'],
        apiKey: 'resq_dev_node01_alpha_9882a1',
        status: 'online',
        lastSeenAt: now,
        latestReading: {
          temperature: 24.2,
          humidity: 46.5,
          gas: 68,
          smoke: 52,
          flame: false,
          tilt: false,
          earthquake: false,
          vibration: 0.04,
          water: false,
          waterLevel: 0,
          personCount: 3,
          timestamp: now,
        },
        metadata: {
          firmwareVersion: '1.2.0-esp8266',
          ipAddress: '192.168.1.101',
          wifiSSID: 'RESQ_IOT_SECURE',
          signalRssi: -54,
          macAddress: 'CC:50:E3:4A:12:01',
        },
        createdBy: adminUser._id,
      },
      {
        deviceId: 'RESQ-NODE-02',
        name: 'Chemical Storage Enclosure',
        location: 'Hazardous Materials Bay 2',
        deviceType: 'NodeMCU ESP8266',
        supportedSensors: ['temperature', 'humidity', 'gas', 'smoke', 'flame', 'tilt', 'earthquake', 'water', 'personCount'],
        apiKey: 'resq_dev_node02_beta_4419b2',
        status: 'online',
        lastSeenAt: new Date(now.getTime() - 20000),
        latestReading: {
          temperature: 21.8,
          humidity: 52.0,
          gas: 85,
          smoke: 60,
          flame: false,
          tilt: false,
          earthquake: false,
          vibration: 0.02,
          water: false,
          waterLevel: 0,
          personCount: 1,
          timestamp: new Date(now.getTime() - 20000),
        },
        metadata: {
          firmwareVersion: '1.2.0-esp8266',
          ipAddress: '192.168.1.102',
          wifiSSID: 'RESQ_IOT_SECURE',
          signalRssi: -62,
          macAddress: 'CC:50:E3:4A:12:02',
        },
        createdBy: adminUser._id,
      },
      {
        deviceId: 'RESQ-NODE-03',
        name: 'HVAC Boiler & Exhaust Unit',
        location: 'Mechanical Penthouse Level 5',
        deviceType: 'ESP8266 Standalone',
        supportedSensors: ['temperature', 'humidity', 'gas'],
        apiKey: 'resq_dev_node03_gamma_7720c3',
        status: 'offline',
        lastSeenAt: new Date(now.getTime() - 3600000 * 4), // 4 hours ago
        latestReading: {
          temperature: 31.4,
          humidity: 38.0,
          gas: 112,
          flame: false,
          timestamp: new Date(now.getTime() - 3600000 * 4),
        },
        metadata: {
          firmwareVersion: '1.1.8-esp8266',
          ipAddress: '192.168.1.103',
          wifiSSID: 'RESQ_IOT_SECURE',
          signalRssi: -78,
          macAddress: 'CC:50:E3:4A:12:03',
        },
        createdBy: adminUser._id,
      },
    ]);

    // 4. Seed Historical Telemetry (Simulated past 7 days)
    console.log('📊 Generating 7 days of realistic historical sensor telemetry...');
    const readings = [];
    const pointsPerHour = 4; // 1 reading every 15 minutes
    const totalHours = 24 * 7;

    for (let h = totalHours; h >= 0; h--) {
      for (let p = 0; p < pointsPerHour; p++) {
        const timeOffset = (h * 60 + p * 15) * 60 * 1000;
        const ts = new Date(now.getTime() - timeOffset);

        // Day/night thermal oscillation
        const hourOfDay = ts.getHours();
        const diurnalEffect = Math.sin((hourOfDay - 6) * (Math.PI / 12)) * 3;

        // Readings for Node 1
        const temp1 = Math.round((23.5 + diurnalEffect + (Math.random() - 0.5) * 1.2) * 10) / 10;
        const hum1 = Math.round((48.0 - diurnalEffect * 1.5 + (Math.random() - 0.5) * 2) * 10) / 10;
        const gas1 = Math.round(65 + Math.random() * 25);
        readings.push({
          deviceId: 'RESQ-NODE-01',
          device: devices[0]._id,
          temperature: temp1,
          humidity: hum1,
          gas: gas1,
          smoke: Math.round(gas1 * 0.8),
          flame: false,
          tilt: false,
          earthquake: false,
          vibration: 0.04,
          water: false,
          waterLevel: 0,
          personCount: 3,
          isSimulated: true,
          signalRssi: -55 + Math.floor((Math.random() - 0.5) * 6),
          batteryLevel: 99,
          timestamp: ts,
        });

        // Readings for Node 2
        const temp2 = Math.round((21.0 + (Math.random() - 0.5) * 1.5) * 10) / 10;
        const hum2 = Math.round((54.0 + (Math.random() - 0.5) * 3) * 10) / 10;
        const gas2 = Math.round(80 + Math.random() * 35);
        readings.push({
          deviceId: 'RESQ-NODE-02',
          device: devices[1]._id,
          temperature: temp2,
          humidity: hum2,
          gas: gas2,
          smoke: Math.round(gas2 * 0.8),
          flame: false,
          tilt: false,
          earthquake: false,
          vibration: 0.03,
          water: false,
          waterLevel: 0,
          personCount: 1,
          isSimulated: true,
          signalRssi: -62 + Math.floor((Math.random() - 0.5) * 8),
          batteryLevel: 95,
          timestamp: ts,
        });
      }
    }

    // Insert telemetry chunks
    await SensorReading.insertMany(readings);
    console.log(`✅ Seeded ${readings.length} historical telemetry readings.`);

    // 5. Seed Historical Incidents / Alerts
    console.log('🚨 Seeding sample alerts across active, acknowledged, and resolved states...');
    await Alert.insertMany([
      {
        title: 'Elevated Heat Warning [RESQ-NODE-01]',
        message: 'Temperature rising above normal HVAC operating limits: temperature reading is 37.8°C (threshold: > 36°C)',
        severity: 'warning',
        status: 'active',
        deviceId: 'RESQ-NODE-01',
        device: devices[0]._id,
        sensorType: 'temperature',
        readingValue: 37.8,
        thresholdValue: 36,
        rule: rules[2]._id,
        isSimulated: true,
        timestamp: new Date(now.getTime() - 15 * 60 * 1000), // 15 mins ago
      },
      {
        title: 'Combustible Gas Leak Warning [RESQ-NODE-02]',
        message: 'Gas level elevated above background baseline: gas reading is 194 PPM (threshold: > 180 PPM)',
        severity: 'warning',
        status: 'acknowledged',
        deviceId: 'RESQ-NODE-02',
        device: devices[1]._id,
        sensorType: 'gas',
        readingValue: 194,
        thresholdValue: 180,
        rule: rules[4]._id,
        isSimulated: true,
        acknowledgedBy: operatorUser._id,
        acknowledgedAt: new Date(now.getTime() - 2 * 3600 * 1000),
        acknowledgeNotes: 'Field team dispatched with handheld sniffer to inspect cylinder valves.',
        timestamp: new Date(now.getTime() - 3 * 3600 * 1000),
      },
      {
        title: 'Critical Fire Detection [RESQ-NODE-02]',
        message: 'Infrared optical flame sensor triggered active fire condition: flame reading is true',
        severity: 'critical',
        status: 'resolved',
        deviceId: 'RESQ-NODE-02',
        device: devices[1]._id,
        sensorType: 'flame',
        readingValue: true,
        thresholdValue: true,
        rule: rules[0]._id,
        isSimulated: true,
        acknowledgedBy: adminUser._id,
        acknowledgedAt: new Date(now.getTime() - 28 * 3600 * 1000),
        acknowledgeNotes: 'Maintenance welding test in Bay 2 caused optical reflection.',
        resolvedBy: adminUser._id,
        resolvedAt: new Date(now.getTime() - 27 * 3600 * 1000),
        resolutionNotes: 'Verified non-emergency hot-work permit; hot work ended and sensor normalized.',
        timestamp: new Date(now.getTime() - 29 * 3600 * 1000),
      },
    ]);

    console.log('✅ Seed completed successfully!');
    console.log('=============================================');
    console.log('Admin login:    admin@resq.internal / adminPassword123!');
    console.log('Operator login: operator@resq.internal / operatorPassword123!');
    console.log('Hardware API keys:');
    console.log('  RESQ-NODE-01: resq_dev_node01_alpha_9882a1');
    console.log('  RESQ-NODE-02: resq_dev_node02_beta_4419b2');
    console.log('  RESQ-NODE-03: resq_dev_node03_gamma_7720c3');
    console.log('=============================================');

    if (isStandalone) {
      await disconnectDB();
      process.exit(0);
    }
    return true;
  } catch (err) {
    console.error('❌ Error during seeding:', err);
    if (isStandalone) {
      process.exit(1);
    }
    throw err;
  }
};

if (require.main === module) {
  seedData(true);
}

module.exports = { seedData };
