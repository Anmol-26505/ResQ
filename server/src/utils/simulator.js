/**
 * Standalone CLI Hardware Simulator
 * Simulates a physical NodeMCU ESP8266 sending HTTP POST telemetry to the ResQ server.
 * Run with: npm run simulate --prefix server
 */
const http = require('http');

const SERVER_HOST = process.env.SERVER_HOST || 'localhost';
const SERVER_PORT = process.env.PORT || 5000;
const DEVICE_ID = process.env.DEVICE_ID || 'RESQ-NODE-01';
const API_KEY = process.env.API_KEY || 'resq_dev_node01_alpha_9882a1';
const INTERVAL_MS = parseInt(process.env.INTERVAL_MS, 10) || 3000;

let currentTemp = 24.0;
let currentHum = 48.0;
let currentGas = 70;
let flame = false;
let packetCount = 0;

console.log('====================================================');
console.log(`🤖 NodeMCU ESP8266 CLI Hardware Simulator Starting`);
console.log(`📡 Target: http://${SERVER_HOST}:${SERVER_PORT}/api/iot/readings`);
console.log(`🏷️ Device ID: ${DEVICE_ID}`);
console.log(`🔑 API Key: ${API_KEY.slice(0, 12)}...`);
console.log(`⏱️ Telemetry Interval: ${INTERVAL_MS}ms`);
console.log('Press Ctrl+C to stop simulation.');
console.log('====================================================');

const sendTelemetry = () => {
  packetCount++;

  // Drift values smoothly
  currentTemp += (Math.random() - 0.49) * 0.4;
  currentHum += (Math.random() - 0.49) * 0.6;
  currentGas += (Math.random() - 0.48) * 3;

  currentTemp = Math.max(18, Math.min(35, currentTemp));
  currentHum = Math.max(30, Math.min(80, currentHum));
  currentGas = Math.max(40, Math.min(160, currentGas));

  // Every 25 packets, simulate a slight heat or gas surge for 3 packets
  if (packetCount % 25 >= 1 && packetCount % 25 <= 3) {
    currentTemp += 3.5;
    currentGas += 40;
  }

  const payload = JSON.stringify({
    deviceId: DEVICE_ID,
    temperature: Math.round(currentTemp * 10) / 10,
    humidity: Math.round(currentHum * 10) / 10,
    sensors: {
      gas: Math.round(currentGas),
      smoke: Math.round(currentGas * 0.85),
      flame: flame,
      tilt: false,
      earthquake: false,
      vibration: 0.04,
      water: false,
      waterLevel: 0,
    },
    rssi: -58 - Math.floor(Math.random() * 8),
    firmwareVersion: '1.2.0-esp8266',
    isSimulated: true,
    timestamp: new Date().toISOString(),
  });

  const options = {
    hostname: SERVER_HOST,
    port: SERVER_PORT,
    path: '/api/iot/readings',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload),
      'x-api-key': API_KEY,
    },
  };

  const req = http.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
      if (res.statusCode === 201) {
        console.log(`[#${packetCount}] 🟢 Sent telemetry | T: ${Math.round(currentTemp*10)/10}°C | H: ${Math.round(currentHum)}% | Gas: ${Math.round(currentGas)} PPM | HTTP ${res.statusCode}`);
      } else {
        console.warn(`[#${packetCount}] ⚠️ Server responded with HTTP ${res.statusCode}: ${data}`);
      }
    });
  });

  req.on('error', (err) => {
    console.error(`[#${packetCount}] ❌ Network error reaching ResQ server: ${err.message}`);
  });

  req.write(payload);
  req.end();
};

sendTelemetry();
setInterval(sendTelemetry, INTERVAL_MS);
