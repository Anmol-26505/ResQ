const Device = require('../models/Device');
const SensorReading = require('../models/SensorReading');
const { processReadingAlerts } = require('./alertService');
const { broadcastSensorReading, broadcastDeviceStatus, broadcastSimulationStatus } = require('../sockets/socketHandler');

let simulationInterval = null;
let isSimulationRunning = false;
let currentScenario = 'nominal'; // 'nominal', 'gas_leak', 'fire_hazard', 'high_heat'
let simulationTickCount = 0;

// Device simulation state tracking (to create realistic continuous sensor data)
const deviceStates = {
  'RESQ-NODE-01': { temp: 24.5, hum: 48, gas: 75, flame: false },
  'RESQ-NODE-02': { temp: 21.0, hum: 55, gas: 60, flame: false },
  'RESQ-NODE-03': { temp: 29.2, hum: 38, gas: 110, flame: false },
};

/**
 * Perform one simulation tick across active devices
 */
const runSimulationTick = async () => {
  try {
    const devices = await Device.find({ isActive: true });
    if (devices.length === 0) return;

    simulationTickCount++;

    for (const device of devices) {
      if (!deviceStates[device.deviceId]) {
        deviceStates[device.deviceId] = {
          temp: 22 + (Math.random() * 5),
          hum: 45 + (Math.random() * 15),
          gas: 60 + (Math.random() * 40),
          flame: false,
        };
      }

      const state = deviceStates[device.deviceId];

      // Natural random walk
      state.temp += (Math.random() - 0.49) * 0.4;
      state.hum += (Math.random() - 0.49) * 0.8;
      state.gas += (Math.random() - 0.49) * 4;

      // Keep within realistic normal bounds
      state.temp = Math.max(16, Math.min(36, state.temp));
      state.hum = Math.max(25, Math.min(85, state.hum));
      state.gas = Math.max(30, Math.min(180, state.gas));
      state.flame = false;

      // Apply active hazard scenario to RESQ-NODE-01 or target device
      if (device.deviceId === 'RESQ-NODE-01' || devices.length === 1) {
        if (currentScenario === 'fire_hazard') {
          state.temp = 68.5 + (Math.random() * 8);
          state.gas = 450 + (Math.random() * 100);
          state.flame = true;
        } else if (currentScenario === 'gas_leak') {
          state.gas = 380 + (Math.random() * 60);
          state.temp = 25.2;
          state.flame = false;
        } else if (currentScenario === 'high_heat') {
          state.temp = 54.0 + (Math.random() * 5);
          state.gas = 130;
          state.flame = false;
        }
      }

      const roundedTemp = Math.round(state.temp * 10) / 10;
      const roundedHum = Math.round(state.hum * 10) / 10;
      const roundedGas = Math.round(state.gas);

      // Create simulated reading
      const reading = await SensorReading.create({
        deviceId: device.deviceId,
        device: device._id,
        temperature: roundedTemp,
        humidity: roundedHum,
        gas: roundedGas,
        flame: state.flame,
        isSimulated: true,
        batteryLevel: 98,
        signalRssi: -58 - Math.floor(Math.random() * 10),
        timestamp: new Date(),
      });

      // Update device
      device.status = 'online';
      device.lastSeenAt = new Date();
      device.latestReading = {
        temperature: roundedTemp,
        humidity: roundedHum,
        gas: roundedGas,
        flame: state.flame,
        timestamp: reading.timestamp,
      };
      await device.save();

      // Broadcast
      broadcastSensorReading(reading);
      broadcastDeviceStatus(device);

      // Check alerts
      await processReadingAlerts(reading, device);
    }
  } catch (err) {
    console.error('Error in simulation tick:', err.message);
  }
};

const startSimulation = (intervalMs = 3000) => {
  if (isSimulationRunning) return;
  isSimulationRunning = true;
  console.log(`🚀 IoT Sensor Simulator started (interval: ${intervalMs}ms)`);
  runSimulationTick();
  simulationInterval = setInterval(runSimulationTick, intervalMs);
  broadcastSimulationStatus({ isRunning: true, scenario: currentScenario });
};

const stopSimulation = () => {
  if (!isSimulationRunning) return;
  clearInterval(simulationInterval);
  simulationInterval = null;
  isSimulationRunning = false;
  currentScenario = 'nominal';
  console.log('⏹️ IoT Sensor Simulator stopped');
  broadcastSimulationStatus({ isRunning: false, scenario: 'nominal' });
};

const setScenario = (scenario) => {
  currentScenario = scenario;
  console.log(`⚡ Simulation scenario changed to: ${scenario}`);
  broadcastSimulationStatus({ isRunning: isSimulationRunning, scenario: currentScenario });
};

const getStatus = () => {
  return {
    isRunning: isSimulationRunning,
    scenario: currentScenario,
    ticks: simulationTickCount,
  };
};

module.exports = {
  startSimulation,
  stopSimulation,
  setScenario,
  getStatus,
  runSimulationTick,
};
