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
  'RESQ-NODE-01': { temp: 24.5, hum: 48, gas: 75, smoke: 55, flame: false, tilt: false, earthquake: false, vibration: 0.04, water: false, waterLevel: 0, personCount: 3 },
  'RESQ-NODE-02': { temp: 21.0, hum: 55, gas: 60, smoke: 42, flame: false, tilt: false, earthquake: false, vibration: 0.03, water: false, waterLevel: 0, personCount: 1 },
  'RESQ-NODE-03': { temp: 29.2, hum: 38, gas: 110, smoke: 85, flame: false, tilt: false, earthquake: false, vibration: 0.05, water: false, waterLevel: 0, personCount: 4 },
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
          smoke: 40 + (Math.random() * 30),
          flame: false,
          tilt: false,
          earthquake: false,
          vibration: 0.03,
          water: false,
          waterLevel: 0,
          personCount: Math.floor(1 + Math.random() * 4),
        };
      }

      const state = deviceStates[device.deviceId];

      // Natural random walk in nominal mode
      state.temp += (Math.random() - 0.49) * 0.4;
      state.hum += (Math.random() - 0.49) * 0.8;
      state.gas += (Math.random() - 0.49) * 4;
      state.smoke = Math.round(state.gas * 0.85);

      // Keep within realistic normal bounds
      state.temp = Math.max(18, Math.min(32, state.temp));
      state.hum = Math.max(30, Math.min(75, state.hum));
      state.gas = Math.max(30, Math.min(120, state.gas));
      state.smoke = Math.max(25, Math.min(95, state.smoke));
      state.flame = false;
      state.tilt = false;
      state.earthquake = false;
      state.vibration = Math.round((0.02 + Math.random() * 0.06) * 100) / 100;
      state.water = false;
      state.waterLevel = 0;
      // Slight person count drift
      if (Math.random() < 0.2) {
        state.personCount = Math.max(1, Math.min(6, state.personCount + (Math.random() > 0.5 ? 1 : -1)));
      }

      // Apply active hazard scenario to the primary node (or all if specified)
      if (device.deviceId === 'RESQ-NODE-01' || devices.length === 1) {
        if (currentScenario === 'fire_hazard' || currentScenario === 'fire') {
          state.temp = 68.5 + (Math.random() * 8);
          state.gas = 450 + (Math.random() * 80);
          state.smoke = 410 + (Math.random() * 70);
          state.flame = true;
        } else if (currentScenario === 'smoke_leak' || currentScenario === 'smoke' || currentScenario === 'gas_leak') {
          state.smoke = 430 + (Math.random() * 70);
          state.gas = 390 + (Math.random() * 60);
          state.temp = 26.2;
          state.flame = false;
        } else if (currentScenario === 'earthquake' || currentScenario === 'tilt') {
          state.tilt = true;
          state.earthquake = true;
          state.vibration = Math.round((3.8 + Math.random() * 2.2) * 10) / 10;
        } else if (currentScenario === 'water_leak' || currentScenario === 'water') {
          state.water = true;
          state.waterLevel = Math.round(75 + Math.random() * 20);
        } else if (currentScenario === 'crowded_room' || currentScenario === 'person_count') {
          state.personCount = Math.round(14 + Math.random() * 5);
        } else if (currentScenario === 'high_heat') {
          state.temp = 54.0 + (Math.random() * 5);
          state.gas = 130;
          state.flame = false;
        } else if (currentScenario === 'all_hazards') {
          state.flame = true;
          state.temp = 71.0;
          state.smoke = 460;
          state.gas = 410;
          state.tilt = true;
          state.earthquake = true;
          state.vibration = 4.2;
          state.water = true;
          state.waterLevel = 85;
          state.personCount = 12;
        }
      }

      const roundedTemp = Math.round(state.temp * 10) / 10;
      const roundedHum = Math.round(state.hum * 10) / 10;
      const roundedGas = Math.round(state.gas);
      const roundedSmoke = Math.round(state.smoke);

      // Create simulated reading
      const reading = await SensorReading.create({
        deviceId: device.deviceId,
        device: device._id,
        temperature: roundedTemp,
        humidity: roundedHum,
        gas: roundedGas,
        smoke: roundedSmoke,
        flame: state.flame,
        tilt: state.tilt,
        earthquake: state.earthquake,
        vibration: state.vibration,
        water: state.water,
        waterLevel: state.waterLevel,
        personCount: state.personCount,
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
        smoke: roundedSmoke,
        flame: state.flame,
        tilt: state.tilt,
        earthquake: state.earthquake,
        vibration: state.vibration,
        water: state.water,
        waterLevel: state.waterLevel,
        personCount: state.personCount,
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
