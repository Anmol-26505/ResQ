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
 * Libraries: ESP8266WiFi, ESP8266HTTPClient, WiFiClientSecure, Wire, ArduinoJson (v6+)
 * 
 * Hardware Pin Connections:
 *   1. MPU6050 (Earthquake & Tilt):
 *      - SDA  --> D2 (GPIO4)
 *      - SCL  --> D1 (GPIO5)
 *      - VCC  --> 3.3V / 5V, GND --> GND
 *   2. MQ-2 Gas & Smoke:
 *      - AOUT --> A0 (ADC0)
 *      - VCC  --> VIN (5V), GND --> GND
 *   3. Flame IR Sensor (Fire Detection):
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
#include <ArduinoJson.h>

// -------------------------------------------------------------
// 1. Wi-Fi Configuration
// -------------------------------------------------------------
const char* WIFI_SSID     = "YOUR_WIFI_NAME";      // Replace with your 2.4GHz Wi-Fi SSID
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";  // Replace with your Wi-Fi Password

// -------------------------------------------------------------
// 2. Render Backend Endpoint Configuration
// -------------------------------------------------------------
// Replace with your deployed Render backend URL (e.g. https://resq-backend.onrender.com)
// Both /api/sensors/update and /api/iot/readings are supported
const char* RESQ_SERVER_URL = "https://YOUR_BACKEND_NAME.onrender.com/api/sensors/update";

// Device Identification and Device API Key
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
// MPU6050 I2C Helper Functions (No external MPU library needed!)
// -------------------------------------------------------------
bool initMPU6050() {
  Wire.begin(4, 5); // SDA = D2 (GPIO4), SCL = D1 (GPIO5)
  Wire.beginTransmission(MPU6050_ADDR);
  Wire.write(0x6B); // PWR_MGMT_1 register
  Wire.write(0);    // Wake up MPU6050
  byte error = Wire.endTransmission();
  return (error == 0);
}

void readMPU6050(float &ax, float &ay, float &az, float &tiltAngle, float &vibration) {
  Wire.beginTransmission(MPU6050_ADDR);
  Wire.write(0x3B); // Starting from register 0x3B (ACCEL_XOUT_H)
  if (Wire.endTransmission(false) != 0) {
    ax = 0; ay = 0; az = 1.0;
    tiltAngle = 0; vibration = 0.04;
    return;
  }
  
  Wire.requestFrom(MPU6050_ADDR, 6, true);
  if (Wire.available() >= 6) {
    int16_t rawX = Wire.read() << 8 | Wire.read();
    int16_t rawY = Wire.read() << 8 | Wire.read();
    int16_t rawZ = Wire.read() << 8 | Wire.read();

    // Scale raw values (±2g range -> 16384 LSB/g)
    ax = (float)rawX / 16384.0;
    ay = (float)rawY / 16384.0;
    az = (float)rawZ / 16384.0;

    // Calculate structural tilt angle in degrees
    float pitch = atan2(ay, sqrt(ax * ax + az * az)) * 180.0 / PI;
    float roll  = atan2(-ax, az) * 180.0 / PI;
    tiltAngle = max(abs(pitch), abs(roll));

    // Calculate seismic acceleration vector magnitude deviation
    float totalAccel = sqrt(ax * ax + ay * ay + az * az);
    vibration = abs(totalAccel - 1.0); // Deviation from resting 1.0g gravity
  } else {
    ax = 0; ay = 0; az = 1.0;
    tiltAngle = 0; vibration = 0.04;
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

  // Measure echo pulse width (timeout 30ms = ~5 meters maximum range)
  long duration = pulseIn(PIN_ECHO, HIGH, 30000);
  if (duration <= 0) return 0.0;

  // Speed of sound: 343 m/s = 0.0343 cm/microsecond (two-way trip)
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

  // Initialize MPU6050
  if (initMPU6050()) {
    Serial.println("✅ MPU6050 Accelerometer/Gyroscope initialized (I2C: D2/D1)");
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

  // 4. Read MPU6050 Accelerometer & Tilt Angle
  float ax = 0, ay = 0, az = 1.0, tiltAngle = 0, vibration = 0;
  readMPU6050(ax, ay, az, tiltAngle, vibration);

  // 5. Calculate Hazard Flags
  bool earthquakeDetected = (vibration > 0.35); // Tremor > 0.35g deviation
  bool tiltHazard = (tiltAngle > 15.0);          // Tilt > 15 degrees
  bool waterLeakHazard = (distanceCm > 0.0 && distanceCm < 12.0); // Water risen within 12cm

  // Print to Serial Monitor
  Serial.println("--------------------------------------------------");
  Serial.printf("🔥 Flame: %s | 💨 Gas: %d PPM | 📐 Tilt: %.1f deg\\n",
                flameDetected ? "ACTIVE FIRE!" : "Safe", gasRaw, tiltAngle);
  Serial.printf("⚠️  Vibration: %.2f g (%s) | 📏 Distance: %.1f cm\\n",
                vibration, earthquakeDetected ? "QUAKE DETECTED!" : "Stable", distanceCm);

  // 6. Build JSON Payload
  StaticJsonDocument<512> doc;
  doc["deviceId"]    = DEVICE_ID;
  doc["apiKey"]      = DEVICE_API_KEY;
  doc["gas"]         = gasRaw;
  doc["smoke"]       = gasRaw;
  doc["flame"]       = flameDetected;
  doc["distance"]    = (distanceCm > 0.0) ? distanceCm : 0.0;
  doc["tiltAngle"]   = tiltAngle;
  doc["vibration"]   = vibration;
  doc["tilt"]        = tiltHazard;
  doc["earthquake"]  = earthquakeDetected;
  doc["water"]       = waterLeakHazard;
  doc["waterLevel"]  = (distanceCm > 0.0 && distanceCm < 50.0) ? (int)(100.0 - (distanceCm * 2.0)) : 0;
  doc["rssi"]        = WiFi.RSSI();

  // MPU6050 3-axis sub-object
  JsonObject mpu = doc.createNestedObject("mpu6050");
  mpu["ax"] = ax;
  mpu["ay"] = ay;
  mpu["az"] = az;

  String requestBody;
  serializeJson(doc, requestBody);

  // 7. Send HTTPS POST to Render Backend
  WiFiClientSecure client;
  client.setInsecure(); // Allows SSL without hardcoding root CA certificates
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
    Serial.println("❌ Unable to connect to Render server.");
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
  "tiltAngle": 3.2,
  "earthquake": false,
  "vibration": 0.08,
  "water": false,
  "waterLevel": 0,
  "distance": 84.5,
  "personCount": 3,
  "mpu6050": {
    "ax": 0.02,
    "ay": 0.05,
    "az": 0.99,
    "gx": 0.4,
    "gy": 0.2,
    "gz": -0.1
  },
  "rssi": -58,
  "firmwareVersion": "1.3.0-esp8266",
  "timestamp": "2026-11-12T09:30:00.000Z"
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
              <h2 className="text-base font-bold text-slate-900">ESP8266 Hardware Integration Guide</h2>
              <p className="text-xs text-slate-500">Firmware, REST Ingestion Protocol & Pinout Schematics</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 px-6 gap-4 text-xs font-semibold text-slate-600">
          <button
            onClick={() => setActiveTab('arduino')}
            className={`py-3 border-b-2 transition-colors ${
              activeTab === 'arduino'
                ? 'border-teal-600 text-teal-700'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            Arduino C++ Sketch
          </button>
          <button
            onClick={() => setActiveTab('json')}
            className={`py-3 border-b-2 transition-colors ${
              activeTab === 'json'
                ? 'border-teal-600 text-teal-700'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            HTTP API & Payload Spec
          </button>
          <button
            onClick={() => setActiveTab('wiring')}
            className={`py-3 border-b-2 transition-colors ${
              activeTab === 'wiring'
                ? 'border-teal-600 text-teal-700'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            Hardware Pinout & Wiring
          </button>
        </div>

        {/* Content body */}
        <div className="p-6 overflow-y-auto flex-1 text-xs">
          {activeTab === 'arduino' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Ready-to-flash Arduino IDE sketch with HTTPClient:</span>
                <button
                  onClick={() => handleCopy(arduinoCode)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied to Clipboard' : 'Copy Arduino Sketch'}</span>
                </button>
              </div>
              <pre className="p-4 bg-slate-950 text-slate-200 rounded-xl font-mono text-[11px] leading-relaxed overflow-x-auto border border-slate-800">
                <code>{arduinoCode}</code>
              </pre>
            </div>
          )}

          {activeTab === 'json' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                <div>
                  <span className="text-slate-400 font-semibold uppercase text-[10px] block">Ingestion Endpoint</span>
                  <span className="font-mono text-xs font-bold text-slate-800">POST /api/iot/readings</span>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold uppercase text-[10px] block">Authentication Header</span>
                  <span className="font-mono text-xs font-bold text-teal-700">x-api-key: &lt;DEVICE_API_KEY&gt;</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="text-slate-600">Sample JSON Payload structure:</span>
                <button
                  onClick={() => handleCopy(jsonPayload)}
                  className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md font-medium"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>Copy JSON</span>
                </button>
              </div>

              <pre className="p-4 bg-slate-950 text-slate-200 rounded-xl font-mono text-xs border border-slate-800">
                <code>{jsonPayload}</code>
              </pre>
            </div>
          )}

          {activeTab === 'wiring' && (
            <div className="space-y-4">
              <div className="p-4 bg-teal-50 border border-teal-200 rounded-xl text-teal-900 leading-relaxed">
                <h4 className="font-bold text-sm mb-1">NodeMCU ESP8266 Hardware Connections</h4>
                <p className="text-xs text-teal-800">
                  Connect sensors to the 3.3V or 5V rail (VIN pin when powered via Micro-USB). Use common GND ground across all modules.
                </p>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 text-[11px] uppercase tracking-wider">
                      <th className="py-2.5 px-4 font-semibold">Sensor Module</th>
                      <th className="py-2.5 px-4 font-semibold">Sensor Pin</th>
                      <th className="py-2.5 px-4 font-semibold">NodeMCU ESP Pin</th>
                      <th className="py-2.5 px-4 font-semibold">Function</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-slate-600">
                    <tr className="bg-teal-50/40">
                      <td className="py-2.5 px-4 font-bold text-slate-900">MPU6050 Accel & Gyro</td>
                      <td className="py-2.5 px-4 font-mono">SDA / SCL (I2C)</td>
                      <td className="py-2.5 px-4 font-mono font-bold text-teal-700">D2 / D1 (GPIO4/5)</td>
                      <td className="py-2.5 px-4">Earthquake vibration intensity & building tilt angle (deg)</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 font-bold text-slate-900">MQ-2 Gas & Smoke</td>
                      <td className="py-2.5 px-4 font-mono">AOUT (Analog)</td>
                      <td className="py-2.5 px-4 font-mono font-bold text-teal-700">A0 (ADC0)</td>
                      <td className="py-2.5 px-4">Hazardous flammable gas & toxic smoke concentration (PPM)</td>
                    </tr>
                    <tr className="bg-rose-50/40">
                      <td className="py-2.5 px-4 font-bold text-slate-900">Flame Optical IR</td>
                      <td className="py-2.5 px-4 font-mono">DOUT (Digital)</td>
                      <td className="py-2.5 px-4 font-mono font-bold text-rose-700">D5 (GPIO14)</td>
                      <td className="py-2.5 px-4">Active-LOW optical fire detector (LOW = Fire Detected)</td>
                    </tr>
                    <tr className="bg-cyan-50/40">
                      <td className="py-2.5 px-4 font-bold text-slate-900">HC-SR04 Ultrasonic</td>
                      <td className="py-2.5 px-4 font-mono">TRIG / ECHO</td>
                      <td className="py-2.5 px-4 font-mono font-bold text-cyan-700">D6 / D7 (GPIO12/13)</td>
                      <td className="py-2.5 px-4">Surface distance measurement (cm) & water-level monitoring</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 font-bold text-slate-900">Power & Common GND</td>
                      <td className="py-2.5 px-4 font-mono">VCC / GND</td>
                      <td className="py-2.5 px-4 font-mono font-bold text-slate-700">3.3V, VIN (5V) & GND</td>
                      <td className="py-2.5 px-4">Common power rails (MQ2 & HC-SR04 on 5V; Flame & MPU on 3.3V)</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">
            NodeMCU ESP8266 • 802.11 b/g/n • 3.3V Logic Level
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default HardwareGuideModal;
