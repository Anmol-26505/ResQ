import React, { useState } from 'react';
import { X, Copy, Check, Cpu, Radio, Shield, Terminal, ArrowRight } from 'lucide-react';

const HardwareGuideModal = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState('arduino');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const arduinoCode = `/*
 * =====================================================================
 * ResQ IoT Emergency Platform — NodeMCU ESP8266 Telemetry Firmware
 * Target: NodeMCU ESP8266 (ESP-12E Module)
 * Libraries Required: NONE (Uses only built-in ESP8266 core libraries)
 *
 * Hardware Pin Connections:
 *   1. MPU6050 (Earthquake & Tilt):
 *      - SDA  --> D2 (GPIO4)
 *      - SCL  --> D1 (GPIO5)
 *      - VCC  --> 3.3V / 5V, GND --> GND
 *   2. MQ-2 Gas & Smoke:
 *      - AOUT --> A0 (ADC0)
 *      - VCC  --> VIN (5V), GND --> GND
 *   3. Flame Optical IR (Fire Detection):
 *      - DOUT --> D5 (GPIO14) [Active-LOW: LOW = Flame Detected]
 *      - VCC  --> 3.3V, GND --> GND
 *   4. Ultrasonic HC-SR04 (Distance / Water-Level):
 *      - TRIG --> D6 (GPIO12)
 *      - ECHO --> D7 (GPIO13)
 *      - VCC  --> VIN (5V), GND --> GND
 * =====================================================================
 */

#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClientSecure.h>
#include <Wire.h>

// -------------------------------------------------------------
// 1. Wi-Fi Configuration (2.4 GHz only)
// -------------------------------------------------------------
const char* WIFI_SSID     = "YOUR_WIFI_NAME";      // <-- Enter your 2.4GHz Wi-Fi SSID
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";  // <-- Enter your Wi-Fi Password

// -------------------------------------------------------------
// 2. Render Backend Endpoint Configuration
// -------------------------------------------------------------
const char* RESQ_SERVER_URL = "https://resq-8tbc.onrender.com/api/sensors/update";

// Device Identification & API Key
const char* DEVICE_ID       = "RESQ-NODE-01";
const char* DEVICE_API_KEY  = "resq_dev_node01_alpha_9882a1";

// -------------------------------------------------------------
// 3. Sensor Pin Mapping
// -------------------------------------------------------------
const int PIN_MQ2_GAS    = A0; // ADC0 (Analog input)
const int PIN_FLAME      = 14; // D5 (GPIO14, Digital input)
const int PIN_TRIG       = 12; // D6 (GPIO12, Ultrasonic Trigger output)
const int PIN_ECHO       = 13; // D7 (GPIO13, Ultrasonic Echo input)
// Note: MPU6050 uses I2C pins D2 (SDA, GPIO4) and D1 (SCL, GPIO5)

const int MPU6050_ADDR   = 0x68;

// Telemetry transmit interval (2000ms = 2 seconds)
const unsigned long SEND_INTERVAL_MS = 2000;
unsigned long lastSendTime = 0;

// -------------------------------------------------------------
// 4. MPU6050 Calibration & Digital Noise Filter Variables
// -------------------------------------------------------------
float baselineAx = 0.0, baselineAy = 0.0, baselineAz = 1.0;
float baselinePitch = 0.0, baselineRoll = 0.0;
float baselineMagnitude = 1.0;
float filteredAx = 0.0, filteredAy = 0.0, filteredAz = 1.0;
const float EMA_ALPHA = 0.25; // Low-pass filter smoothing coefficient (0.0 - 1.0)
bool mpuCalibrated = false;

// -------------------------------------------------------------
// MPU6050 Low-Level I2C Helper Functions
// -------------------------------------------------------------
bool initMPU6050() {
  Wire.begin(4, 5); // SDA = D2 (GPIO4), SCL = D1 (GPIO5)
  Wire.beginTransmission(MPU6050_ADDR);
  Wire.write(0x6B); // PWR_MGMT_1 register
  Wire.write(0);    // Wake up MPU6050
  byte error = Wire.endTransmission();
  return (error == 0);
}

bool readRawMPU(float &ax, float &ay, float &az) {
  Wire.beginTransmission(MPU6050_ADDR);
  Wire.write(0x3B); // Starting register (ACCEL_XOUT_H)
  if (Wire.endTransmission(false) != 0) {
    return false;
  }

  Wire.requestFrom(MPU6050_ADDR, 6, true);
  if (Wire.available() >= 6) {
    int16_t rawX = Wire.read() << 8 | Wire.read();
    int16_t rawY = Wire.read() << 8 | Wire.read();
    int16_t rawZ = Wire.read() << 8 | Wire.read();

    // Scale to ±2g range (16384 LSB/g)
    ax = (float)rawX / 16384.0;
    ay = (float)rawY / 16384.0;
    az = (float)rawZ / 16384.0;
    return true;
  }
  return false;
}

/**
 * Startup Calibration Routine:
 * Samples 100 stationary readings to measure mounting offsets.
 * Eliminates false tilt and vibration alarms caused by resting desk angle.
 */
void calibrateMPU6050() {
  Serial.println("⚖️ Calibrating MPU6050 stationary baseline... (KEEP BOARD FLAT & STILL)");
  float sumAx = 0, sumAy = 0, sumAz = 0;
  int validSamples = 0;

  for (int i = 0; i < 100; i++) {
    float rawAx, rawAy, rawAz;
    if (readRawMPU(rawAx, rawAy, rawAz)) {
      sumAx += rawAx;
      sumAy += rawAy;
      sumAz += rawAz;
      validSamples++;
    }
    delay(15);
  }

  if (validSamples > 0) {
    baselineAx = sumAx / validSamples;
    baselineAy = sumAy / validSamples;
    baselineAz = sumAz / validSamples;
    baselinePitch = atan2(baselineAy, sqrt(baselineAx * baselineAx + baselineAz * baselineAz)) * 180.0 / PI;
    baselineRoll  = atan2(-baselineAx, baselineAz) * 180.0 / PI;
    baselineMagnitude = sqrt(baselineAx * baselineAx + baselineAy * baselineAy + baselineAz * baselineAz);
    filteredAx = baselineAx;
    filteredAy = baselineAy;
    filteredAz = baselineAz;
    mpuCalibrated = true;
    Serial.printf("✅ Baseline Calibrated: Ax=%.2f, Ay=%.2f, Az=%.2f | Baseline Pitch=%.1f deg, Roll=%.1f deg\\n",
                  baselineAx, baselineAy, baselineAz, baselinePitch, baselineRoll);
  } else {
    Serial.println("⚠️ MPU6050 calibration failed to read I2C samples. Using standard 1.0g on Z.");
    baselineAx = 0; baselineAy = 0; baselineAz = 1.0;
  }
}

/**
 * Filtered MPU6050 Reader:
 * Applies Exponential Moving Average (EMA) low-pass filter and
 * calculates tilt and vibration relative to calibrated resting baseline.
 */
void readMPU6050Filtered(float &ax, float &ay, float &az, float &tiltAngle, float &vibration) {
  float rawAx, rawAy, rawAz;
  if (!readRawMPU(rawAx, rawAy, rawAz)) {
    ax = 0; ay = 0; az = 1.0;
    tiltAngle = 0.0; vibration = 0.04;
    return;
  }

  // 1. Exponential Moving Average (EMA) low-pass noise filter
  filteredAx = (EMA_ALPHA * rawAx) + ((1.0 - EMA_ALPHA) * filteredAx);
  filteredAy = (EMA_ALPHA * rawAy) + ((1.0 - EMA_ALPHA) * filteredAy);
  filteredAz = (EMA_ALPHA * rawAz) + ((1.0 - EMA_ALPHA) * filteredAz);

  ax = filteredAx;
  ay = filteredAy;
  az = filteredAz;

  // 2. Relative pitch and roll relative to calibrated resting baseline
  float currentPitch = atan2(filteredAy, sqrt(filteredAx * filteredAx + filteredAz * filteredAz)) * 180.0 / PI;
  float currentRoll  = atan2(-filteredAx, filteredAz) * 180.0 / PI;

  float deltaPitch = abs(currentPitch - baselinePitch);
  float deltaRoll  = abs(currentRoll - baselineRoll);
  tiltAngle = max(deltaPitch, deltaRoll);

  // 3. Dynamic seismic vibration magnitude deviation above resting noise floor
  float currentMagnitude = sqrt(filteredAx * filteredAx + filteredAy * filteredAy + filteredAz * filteredAz);
  float rawDeviation = abs(currentMagnitude - baselineMagnitude);

  // Reject resting sensor noise floor (< 0.12g is clamped to 0.04g nominal baseline)
  if (rawDeviation < 0.12) {
    vibration = 0.04;
  } else {
    vibration = rawDeviation;
  }
}

// -------------------------------------------------------------
// HC-SR04 Ultrasonic Distance Helper
// -------------------------------------------------------------
float readUltrasonicDistance() {
  digitalWrite(PIN_TRIG, LOW);
  delayMicroseconds(2);
  digitalWrite(PIN_TRIG, HIGH);
  delayMicroseconds(10);
  digitalWrite(PIN_TRIG, LOW);

  long duration = pulseIn(PIN_ECHO, HIGH, 30000); // 30ms timeout (~5m max)
  if (duration <= 0) return 0.0;

  float distanceCm = (duration * 0.0343) / 2.0;
  return distanceCm;
}

void setup() {
  Serial.begin(115200);
  delay(500);

  pinMode(PIN_FLAME, INPUT);
  pinMode(PIN_TRIG, OUTPUT);
  pinMode(PIN_ECHO, INPUT);

  Serial.println();
  Serial.println("==================================================");
  Serial.println("🛡️  ResQ IoT Emergency NodeMCU Starting Up...");
  Serial.printf("Device ID: %s\\n", DEVICE_ID);
  Serial.println("==================================================");

  // Initialize and calibrate MPU6050
  if (initMPU6050()) {
    Serial.println("✅ MPU6050 Initialized (I2C: D2=SDA, D1=SCL)");
    calibrateMPU6050();
  } else {
    Serial.println("⚠️  MPU6050 not detected at 0x68. Check wiring (D2=SDA, D1=SCL).");
  }

  // Connect to Wi-Fi
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.printf("Connecting to Wi-Fi: %s", WIFI_SSID);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println();
    Serial.printf("✅ Wi-Fi Connected! IP: %s (Signal: %d dBm)\\n",
                  WiFi.localIP().toString().c_str(), WiFi.RSSI());
  } else {
    Serial.println();
    Serial.println("❌ Wi-Fi Connection Failed. Will retry in loop.");
  }
}

void loop() {
  unsigned long now = millis();
  if (now - lastSendTime >= SEND_INTERVAL_MS) {
    lastSendTime = now;
    transmitTelemetry();
  }
}

void transmitTelemetry() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("⚠️  Wi-Fi disconnected. Reconnecting...");
    WiFi.reconnect();
    return;
  }

  // 1. Read MQ-2 Gas & Smoke (Analog 0-1023)
  int gasRaw = analogRead(PIN_MQ2_GAS);

  // 2. Read Flame Sensor (Active-LOW: LOW = Fire detected)
  bool flameDetected = (digitalRead(PIN_FLAME) == LOW);

  // 3. Read Ultrasonic Distance (cm)
  float distanceCm = readUltrasonicDistance();

  // 4. Read Calibrated MPU6050
  float ax = 0, ay = 0, az = 1.0, tiltAngle = 0, vibration = 0.04;
  readMPU6050Filtered(ax, ay, az, tiltAngle, vibration);

  // 5. Evaluate Calibrated Hazard Flags
  bool earthquakeDetected = (vibration > 0.40);                    // Quake > 0.40g dynamic deviation
  bool tiltHazard = (tiltAngle > 15.0);                             // Sustained tilt > 15° relative to baseline
  bool waterLeakHazard = (distanceCm > 0.0 && distanceCm < 12.0);  // Water level risen within 12cm
  int waterLevel = (distanceCm > 0.0 && distanceCm < 50.0) ? (int)(100.0 - (distanceCm * 2.0)) : 0;

  // Print Telemetry to Serial Monitor
  Serial.println("--------------------------------------------------");
  Serial.printf("🔥 Flame: %s | 💨 Gas: %d PPM | 📐 Relative Tilt: %.1f deg (%s)\\n",
                flameDetected ? "ACTIVE FIRE!" : "Safe", gasRaw, tiltAngle,
                tiltHazard ? "TILT WARNING!" : "Stable");
  Serial.printf("⚠️  Vibration: %.2f g (%s) | 📏 Distance: %.1f cm\\n",
                vibration, earthquakeDetected ? "SEISMIC QUAKE!" : "Nominal", distanceCm);

  // 6. Build Clean JSON Payload (Zero Library Dependency)
  String requestBody = "{\"deviceId\":\"" + String(DEVICE_ID) + "\"" +
                       ",\"apiKey\":\"" + String(DEVICE_API_KEY) + "\"" +
                       ",\"gas\":" + String(gasRaw) +
                       ",\"smoke\":" + String(gasRaw) +
                       ",\"flame\":" + (flameDetected ? "true" : "false") +
                       ",\"distance\":" + String(distanceCm, 1) +
                       ",\"tiltAngle\":" + String(tiltAngle, 1) +
                       ",\"vibration\":" + String(vibration, 2) +
                       ",\"tilt\":" + (tiltHazard ? "true" : "false") +
                       ",\"earthquake\":" + (earthquakeDetected ? "true" : "false") +
                       ",\"water\":" + (waterLeakHazard ? "true" : "false") +
                       ",\"waterLevel\":" + String(waterLevel) +
                       ",\"rssi\":" + String(WiFi.RSSI()) +
                       ",\"ax\":" + String(ax, 2) +
                       ",\"ay\":" + String(ay, 2) +
                       ",\"az\":" + String(az, 2) +
                       "}";

  // 7. Send HTTPS POST to Render Backend
  WiFiClientSecure client;
  client.setInsecure(); // Allows SSL connection without certificate pinning
  client.setTimeout(10000);

  HTTPClient http;
  if (http.begin(client, RESQ_SERVER_URL)) {
    http.addHeader("Content-Type", "application/json");
    http.addHeader("x-api-key", DEVICE_API_KEY);

    int httpCode = http.POST(requestBody);
    if (httpCode > 0) {
      String response = http.getString();
      Serial.printf("📡 Telemetry Sent [HTTP %d]: %s\\n", httpCode, response.c_str());
    } else {
      Serial.printf("❌ HTTP POST Failed: %s (Code %d)\\n", http.errorToString(httpCode).c_str(), httpCode);
    }
    http.end();
  } else {
    Serial.println("❌ Unable to initiate connection to Render backend.");
  }
}
`;

  const jsonPayload = `{
  "deviceId": "RESQ-NODE-01",
  "temperature": 26.5,
  "humidity": 52.0,
  "gas": 140,
  "smoke": 140,
  "flame": false,
  "tilt": false,
  "tiltAngle": 1.2,
  "earthquake": false,
  "vibration": 0.04,
  "water": false,
  "waterLevel": 0,
  "distance": 84.5,
  "mpu6050": {
    "ax": 0.01,
    "ay": 0.02,
    "az": 0.99
  },
  "rssi": -58,
  "firmwareVersion": "1.4.0-esp8266",
  "timestamp": "2026-11-14T10:00:00.000Z"
}`;

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-teal-600 text-white flex items-center justify-center">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">ESP8266 Firmware & Hardware Wiring</h2>
              <p className="text-xs text-slate-500">NodeMCU ESP8266 + MPU6050 (Calibrated) + MQ-2 + Flame + HC-SR04</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab navigation */}
        <div className="px-6 border-b border-slate-200 flex gap-4 text-xs font-semibold bg-white">
          <button
            onClick={() => setActiveTab('arduino')}
            className={`py-3 border-b-2 transition-colors ${
              activeTab === 'arduino'
                ? 'border-teal-600 text-teal-600 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            NodeMCU Arduino C++ Firmware (Zero Dependencies)
          </button>
          <button
            onClick={() => setActiveTab('pinout')}
            className={`py-3 border-b-2 transition-colors ${
              activeTab === 'pinout'
                ? 'border-teal-600 text-teal-600 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            Pin Mapping Table
          </button>
          <button
            onClick={() => setActiveTab('json')}
            className={`py-3 border-b-2 transition-colors ${
              activeTab === 'json'
                ? 'border-teal-600 text-teal-600 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            Sample JSON Payload
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {activeTab === 'arduino' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-600 font-medium">
                  Copy this C++ sketch into Arduino IDE. Built-in stationary MPU6050 calibration & noise filtering included.
                </span>
                <button
                  onClick={() => handleCopy(arduinoCode)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied!' : 'Copy Sketch'}</span>
                </button>
              </div>

              <div className="relative rounded-xl overflow-hidden bg-slate-950 border border-slate-800">
                <pre className="p-4 text-xs font-mono text-slate-200 overflow-x-auto max-h-[50vh] leading-relaxed">
                  <code>{arduinoCode}</code>
                </pre>
              </div>
            </div>
          )}

          {activeTab === 'pinout' && (
            <div className="space-y-4 text-xs">
              <p className="text-slate-600">
                Connect your 4 physical sensor modules to the NodeMCU ESP8266 development board according to this table:
              </p>

              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100/75 text-slate-700 uppercase font-semibold text-[11px] border-b border-slate-200">
                      <th className="py-2.5 px-4">Sensor Module</th>
                      <th className="py-2.5 px-4">Hazard Monitored</th>
                      <th className="py-2.5 px-4">NodeMCU Pin</th>
                      <th className="py-2.5 px-4">Power (VCC / GND)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                    <tr className="hover:bg-slate-50">
                      <td className="py-2.5 px-4 font-bold text-slate-900 font-sans">MPU6050 6-Axis</td>
                      <td className="py-2.5 px-4 text-orange-600 font-sans">Building Tilt & Earthquake</td>
                      <td className="py-2.5 px-4 font-bold text-teal-700">SDA: D2 (GPIO4), SCL: D1 (GPIO5)</td>
                      <td className="py-2.5 px-4 text-slate-600">3.3V / GND</td>
                    </tr>
                    <tr className="hover:bg-slate-50">
                      <td className="py-2.5 px-4 font-bold text-slate-900 font-sans">MQ-2 Gas / Smoke</td>
                      <td className="py-2.5 px-4 text-amber-600 font-sans">Combustible Gas, LPG, Smoke</td>
                      <td className="py-2.5 px-4 font-bold text-teal-700">AOUT: A0 (ADC0)</td>
                      <td className="py-2.5 px-4 text-slate-600">VIN (5V) / GND</td>
                    </tr>
                    <tr className="hover:bg-slate-50">
                      <td className="py-2.5 px-4 font-bold text-slate-900 font-sans">Optical Flame Sensor</td>
                      <td className="py-2.5 px-4 text-rose-600 font-sans">Fire Detection (760–1100nm IR)</td>
                      <td className="py-2.5 px-4 font-bold text-teal-700">DOUT: D5 (GPIO14)</td>
                      <td className="py-2.5 px-4 text-slate-600">3.3V / GND</td>
                    </tr>
                    <tr className="hover:bg-slate-50">
                      <td className="py-2.5 px-4 font-bold text-slate-900 font-sans">HC-SR04 Ultrasonic</td>
                      <td className="py-2.5 px-4 text-cyan-600 font-sans">Distance & Water Leakage</td>
                      <td className="py-2.5 px-4 font-bold text-teal-700">TRIG: D6 (GPIO12), ECHO: D7 (GPIO13)</td>
                      <td className="py-2.5 px-4 text-slate-600">VIN (5V) / GND</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="p-3.5 bg-teal-50 border border-teal-200 rounded-xl text-teal-900 space-y-1">
                <span className="font-bold block">💡 Calibration Tip:</span>
                <span className="text-[11px] block">
                  When powering on the NodeMCU, keep the board stationary on a flat surface for 2 seconds. The startup routine records 100 resting baseline samples so that table angle and sensor mounting offsets do not cause false alarms.
                </span>
              </div>
            </div>
          )}

          {activeTab === 'json' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-600 font-medium">
                  HTTP POST JSON format transmitted to <code>POST /api/sensors/update</code>:
                </span>
                <button
                  onClick={() => handleCopy(jsonPayload)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied!' : 'Copy JSON'}</span>
                </button>
              </div>

              <div className="relative rounded-xl overflow-hidden bg-slate-950 border border-slate-800">
                <pre className="p-4 text-xs font-mono text-teal-300 overflow-x-auto max-h-[50vh]">
                  <code>{jsonPayload}</code>
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs">
          <span className="text-slate-500 font-mono">Backend: https://resq-8tbc.onrender.com</span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-semibold transition-colors"
          >
            Close Guide
          </button>
        </div>
      </div>
    </div>
  );
};

export default HardwareGuideModal;
