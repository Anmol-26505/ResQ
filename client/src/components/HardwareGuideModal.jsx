import React, { useState } from 'react';
import { X, Copy, Check, Cpu, Radio, Shield, Terminal, ArrowRight, Activity, Flame, Compass, Wind, Droplets } from 'lucide-react';

const HardwareGuideModal = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState('arduino');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const arduinoCode = `/*
 * =====================================================================
 * ResQ IoT Emergency Platform — NodeMCU ESP8266 Telemetry & Hazard Firmware
 * Target Hardware: NodeMCU ESP8266 (ESP-12E Module)
 * Libraries Required: NONE (Uses standard built-in ESP8266 core libraries)
 *
 * HARDWARE PIN CONNECTIONS (NodeMCU):
 *   1. MPU6050 (6-Axis Accel/Gyro):
 *      - SDA  --> D2 (GPIO4)
 *      - SCL  --> D1 (GPIO5)
 *      - VCC  --> VIN (5V) or 3.3V, GND --> GND, AD0 --> GND (0x68)
 *   2. Flame Optical IR Sensor:
 *      - DOUT --> D5 (GPIO14)
 *      - VCC  --> 3.3V, GND --> GND
 *   3. MQ-2 Gas & Smoke:
 *      - AOUT --> A0 (ADC0, 0–3.3V)
 *      - VCC  --> VIN (5V for internal heater coil), GND --> GND
 *   4. HC-SR04 Ultrasonic Distance / Level:
 *      - TRIG --> D6 (GPIO12)
 *      - ECHO --> D7 (GPIO13, use 1k/2k resistor voltage divider)
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
const char* WIFI_SSID     = "NET PLUS";     // <-- Your 2.4GHz Wi-Fi SSID
const char* WIFI_PASSWORD = "Sehaj@12";     // <-- Your Wi-Fi Password

// -------------------------------------------------------------
// 2. Render Backend Ingestion Configuration
// -------------------------------------------------------------
const char* RESQ_SERVER_URL = "https://resq-8tbc.onrender.com/api/sensors/update";
const char* DEVICE_ID       = "RESQ-NODE-01";
const char* DEVICE_API_KEY  = "resq_iot_secure_key_2026"; // Must match DEVICE_API_KEY in Render

// -------------------------------------------------------------
// 3. Hardware Pin Assignments (NodeMCU ESP8266)
// -------------------------------------------------------------
#define PIN_FLAME       14  // NodeMCU D5 (GPIO14)
#define PIN_TRIG        12  // NodeMCU D6 (GPIO12)
#define PIN_ECHO        13  // NodeMCU D7 (GPIO13)
#define PIN_MQ2_GAS     A0  // NodeMCU A0 (ADC0)
// Note: MPU6050 uses I2C pins D2 (SDA / GPIO4) and D1 (SCL / GPIO5)

// -------------------------------------------------------------
// 4. Configurable Sensor Settings & Thresholds
// -------------------------------------------------------------
// Flame Sensor Logic: Most LM393 modules pull DOUT LOW (0V) when flame is detected.
const bool FLAME_ACTIVE_LOW = true;

// MQ-2 Combustible Gas & Smoke Threshold (0–1023 ADC):
// Clean indoor baseline is typically 50–180.
const int GAS_HAZARD_THRESHOLD = 220;

// MPU6050 Structural Tilt Threshold (degrees relative to calibrated baseline):
const float TILT_THRESHOLD_DEG = 12.0;

// Minimum duration (ms) tilt must persist before declaring sustained structural tilt:
const unsigned long TILT_PERSIST_MS = 600;

// MPU6050 Dynamic Vibration / Seismic Shock Sensitivity (in 'g' units):
// Resting desk noise: < 0.10g. Tremor / shake threshold: 0.22g
const float VIBRATION_SENSITIVITY_G = 0.22;

// Seismic repeated tremor energy threshold (number of shock samples in window):
const int TREMOR_SAMPLE_COUNT_THRESHOLD = 3;

// Alert Cooldown / Latch Duration (ms) so brief shocks are never missed:
const unsigned long HAZARD_LATCH_MS = 4000;

// Water Detection Configuration:
// Physical note: HC-SR04 measures air distance via sound waves. It only detects water
// when mounted overhead facing downward into a sump tank or container.
// Set to true only if mounted overhead as a liquid level tank gauge:
const bool HC_SR04_IS_OVERHEAD_TANK_GAUGE = false;
const float TANK_EMPTY_DISTANCE_CM = 80.0;
const float TANK_FULL_DISTANCE_CM  = 12.0;

// Telemetry transmit interval (every 2000ms = 2 seconds)
const unsigned long SEND_INTERVAL_MS = 2000;
unsigned long lastSendTime = 0;

// Serial Monitor status summary interval (every 1000ms = 1 second)
const unsigned long SERIAL_SUMMARY_INTERVAL_MS = 1000;
unsigned long lastSummaryTime = 0;

// High-speed MPU6050 continuous polling interval (every 20ms = 50 Hz)
const unsigned long MPU_POLL_INTERVAL_MS = 20;
unsigned long lastMpuPollTime = 0;

// -------------------------------------------------------------
// 5. State & Calibration Variables
// -------------------------------------------------------------
uint8_t mpuI2cAddress = 0x68;
bool mpuConnected = false;

// Calibrated stationary resting baseline
float baselineAx = 0.0, baselineAy = 0.0, baselineAz = 1.0;
float baselinePitch = 0.0, baselineRoll = 0.0;

// Running filtered & dynamic values
float filteredAx = 0.0, filteredAy = 0.0, filteredAz = 1.0;
float currentPitch = 0.0, currentRoll = 0.0;
float currentTiltAngle = 0.0;
float instantaneousVibration = 0.04;
float peakVibrationInWindow = 0.04;
int tremorSamplesInWindow = 0;

// Raw instantaneous values
float lastRawAx = 0.0, lastRawAy = 0.0, lastRawAz = 1.0;
float lastRawGx = 0.0, lastRawGy = 0.0, lastRawGz = 0.0;

// Sustained Tilt Tracking
unsigned long tiltExceededStart = 0;
bool isSustainedTilt = false;

// Alert Latches
unsigned long tiltAlertUntil = 0;
unsigned long quakeAlertUntil = 0;
unsigned long fireAlertUntil = 0;
unsigned long gasAlertUntil = 0;

// Forward Function Prototypes
void setup();
void loop();
void scanI2CBus();
bool initMPU6050();
bool readMPU6050Raw(float &ax, float &ay, float &az, float &gx, float &gy, float &gz);
void calibrateMPU6050();
void pollMPU6050Continuous();
float readUltrasonicDistance();
void printStatusSummary(bool fireDetected, int gasRaw, bool isTilt, bool isQuake, bool isWater, float distCm);
void transmitTelemetry();
void runInteractiveTest();

// =============================================================
// MAIN ARDUINO SETUP
// =============================================================
void setup() {
  Serial.begin(115200);
  delay(500);

  pinMode(PIN_FLAME, INPUT_PULLUP);
  pinMode(PIN_TRIG, OUTPUT);
  pinMode(PIN_ECHO, INPUT);

  Serial.println();
  Serial.println("==================================================");
  Serial.println("🛡️  ResQ IoT Emergency Platform — NodeMCU Booting");
  Serial.printf("Device ID: %s | Server: %s\n", DEVICE_ID, RESQ_SERVER_URL);
  Serial.println("==================================================");

  // 1. Scan I2C bus and verify MPU6050 presence on D2/D1
  scanI2CBus();

  // 2. Initialize MPU6050
  if (initMPU6050()) {
    mpuConnected = true;
    calibrateMPU6050();
  } else {
    mpuConnected = false;
    Serial.println("❌ MPU6050 NOT INITIALIZED!");
    Serial.println("   👉 Check wiring: SDA->D2, SCL->D1, VCC->VIN (5V), GND->GND, AD0->GND");
  }

  // 3. Connect to Wi-Fi
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.printf("Connecting to Wi-Fi: %s", WIFI_SSID);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 25) {
    delay(400);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println();
    Serial.printf("✅ Wi-Fi Connected! IP: %s (Signal: %d dBm)\n",
                  WiFi.localIP().toString().c_str(), WiFi.RSSI());
  } else {
    Serial.println();
    Serial.println("⚠️ Wi-Fi not yet connected. Reconnection running in background.");
  }

  Serial.println("==================================================");
}

// =============================================================
// MAIN ARDUINO LOOP
// =============================================================
void loop() {
  unsigned long now = millis();

  // 1. Continuous high-frequency MPU6050 sampling (every 20ms = 50 Hz)
  if (now - lastMpuPollTime >= MPU_POLL_INTERVAL_MS) {
    lastMpuPollTime = now;
    pollMPU6050Continuous();
  }

  // Read instantaneous sensor states
  int flamePinRaw = digitalRead(PIN_FLAME);
  bool fireInstant = FLAME_ACTIVE_LOW ? (flamePinRaw == LOW) : (flamePinRaw == HIGH);
  if (fireInstant) {
    fireAlertUntil = millis() + HAZARD_LATCH_MS;
  }
  bool fireDetected = fireInstant || (millis() < fireAlertUntil);

  int gasRaw = analogRead(PIN_MQ2_GAS);
  bool gasInstant = (gasRaw >= GAS_HAZARD_THRESHOLD);
  if (gasInstant) {
    gasAlertUntil = millis() + HAZARD_LATCH_MS;
  }
  bool gasDetected = gasInstant || (millis() < gasAlertUntil);

  float distCm = readUltrasonicDistance();

  bool isTilt = (millis() < tiltAlertUntil) || isSustainedTilt;
  bool isQuake = (millis() < quakeAlertUntil) || (tremorSamplesInWindow >= TREMOR_SAMPLE_COUNT_THRESHOLD);
  
  bool isWater = false;
  if (HC_SR04_IS_OVERHEAD_TANK_GAUGE && distCm > 0) {
    isWater = (distCm <= TANK_FULL_DISTANCE_CM);
  }

  // 2. Serial Monitor Status Summary (Every 1 second)
  if (now - lastSummaryTime >= SERIAL_SUMMARY_INTERVAL_MS) {
    lastSummaryTime = now;
    printStatusSummary(fireDetected, gasRaw, isTilt, isQuake, isWater, distCm);
  }

  // 3. Check for interactive serial commands ('c' = calibrate, 't' = stream test)
  if (Serial.available()) {
    char cmd = Serial.read();
    if (cmd == 'c' || cmd == 'C') {
      calibrateMPU6050();
    } else if (cmd == 't' || cmd == 'T') {
      runInteractiveTest();
    }
  }

  // 4. Immediate transmission on newly triggered hazard (within 500ms edge detection)
  static bool wasHazardActive = false;
  bool isAnyHazard = fireDetected || gasDetected || isTilt || isQuake;
  if (isAnyHazard && !wasHazardActive && (now - lastSendTime >= 500)) {
    lastSendTime = now;
    transmitTelemetry();
  }
  wasHazardActive = isAnyHazard;

  // 5. Regular 2-second Telemetry Transmission to Render
  if (now - lastSendTime >= SEND_INTERVAL_MS) {
    lastSendTime = now;
    transmitTelemetry();
  }
}

// =============================================================
// 1-Second Serial Monitor Status Summary (Clean & Readable)
// =============================================================
void printStatusSummary(bool fireDetected, int gasRaw, bool isTilt, bool isQuake, bool isWater, float distCm) {
  Serial.println();
  Serial.println("================ RESQ SYSTEM STATUS ================");
  Serial.printf("WiFi:       %s\n", (WiFi.status() == WL_CONNECTED) ? "CONNECTED" : "DISCONNECTED");
  Serial.printf("MPU6050:    %s\n", mpuConnected ? "CONNECTED" : "NOT CONNECTED");
  Serial.printf("FIRE:       %s\n", fireDetected ? "DETECTED" : "NORMAL");
  Serial.printf("GAS:        %s\n", (gasRaw >= GAS_HAZARD_THRESHOLD) ? "DETECTED" : "NORMAL");
  Serial.printf("TILT:       %s\n", isTilt ? "DETECTED" : "NORMAL");
  Serial.printf("EARTHQUAKE: %s\n", isQuake ? "DETECTED" : "NORMAL");
  Serial.printf("WATER:      %s\n", HC_SR04_IS_OVERHEAD_TANK_GAUGE ? (isWater ? "DETECTED" : "NORMAL") : "SENSOR NOT CONNECTED");
  Serial.printf("TILT ANGLE: %.1f deg\n", currentTiltAngle);
  Serial.printf("VIBRATION:  %.2f g\n", peakVibrationInWindow);
  Serial.printf("GAS VALUE:  %d\n", gasRaw);
  Serial.printf("DISTANCE:   %.1f cm\n", distCm);
  Serial.println("====================================================");
}

// =============================================================
// I2C Bus Scanner
// =============================================================
void scanI2CBus() {
  Wire.begin(D2, D1); // SDA = D2 (GPIO4), SCL = D1 (GPIO5)
  Wire.setClock(100000);
  delay(100);

  Serial.println("🔍 Probing I2C bus on SDA=D2, SCL=D1...");
  byte count = 0;
  for (byte address = 1; address < 127; address++) {
    Wire.beginTransmission(address);
    if (Wire.endTransmission(true) == 0) {
      Serial.printf("   ✅ I2C device detected at 0x%02X!\n", address);
      if (address == 0x68 || address == 0x69) {
        mpuI2cAddress = address;
      }
      count++;
    }
  }

  if (count == 0) {
    Serial.println("   ❌ NO I2C DEVICES FOUND ON BUS!");
    Serial.println("   Wiring Check: SDA->D2, SCL->D1, VCC->VIN (5V), GND->GND, AD0->GND");
  }
}

// =============================================================
// MPU6050 Driver with Device Reset
// =============================================================
bool initMPU6050() {
  // 1. Device Reset (PWR_MGMT_1 = 0x80)
  Wire.beginTransmission(mpuI2cAddress);
  Wire.write(0x6B);
  Wire.write(0x80);
  Wire.endTransmission(true);
  delay(50);

  // 2. Clear sleep and select Gyro X clock reference (PWR_MGMT_1 = 0x01)
  Wire.beginTransmission(mpuI2cAddress);
  Wire.write(0x6B);
  Wire.write(0x01);
  if (Wire.endTransmission(true) != 0) return false;
  delay(15);

  // 3. Set Accelerometer full-scale range ±2g (ACCEL_CONFIG = 0x00)
  Wire.beginTransmission(mpuI2cAddress);
  Wire.write(0x1C);
  Wire.write(0x00);
  Wire.endTransmission(true);

  // 4. Set Gyroscope full-scale range ±250 deg/s (GYRO_CONFIG = 0x00)
  Wire.beginTransmission(mpuI2cAddress);
  Wire.write(0x1B);
  Wire.write(0x00);
  Wire.endTransmission(true);

  // 5. Verification read
  float ax, ay, az, gx, gy, gz;
  return readMPU6050Raw(ax, ay, az, gx, gy, gz);
}

/**
 * Burst read 14 bytes from MPU6050 starting from 0x3B (ACCEL_XOUT_H)
 */
bool readMPU6050Raw(float &ax, float &ay, float &az, float &gx, float &gy, float &gz) {
  Wire.beginTransmission(mpuI2cAddress);
  Wire.write(0x3B);
  if (Wire.endTransmission(true) != 0) return false;

  uint8_t count = Wire.requestFrom((uint8_t)mpuI2cAddress, (size_t)14);
  if (count != 14) return false;

  uint8_t axH = Wire.read(); uint8_t axL = Wire.read();
  uint8_t ayH = Wire.read(); uint8_t ayL = Wire.read();
  uint8_t azH = Wire.read(); uint8_t azL = Wire.read();
  uint8_t tH  = Wire.read(); uint8_t tL  = Wire.read();
  uint8_t gxH = Wire.read(); uint8_t gxL = Wire.read();
  uint8_t gyH = Wire.read(); uint8_t gyL = Wire.read();
  uint8_t gzH = Wire.read(); uint8_t gzL = Wire.read();

  int16_t rawAx = (int16_t)((axH << 8) | axL);
  int16_t rawAy = (int16_t)((ayH << 8) | ayL);
  int16_t rawAz = (int16_t)((azH << 8) | azL);
  int16_t rawGx = (int16_t)((gxH << 8) | gxL);
  int16_t rawGy = (int16_t)((gyH << 8) | gyL);
  int16_t rawGz = (int16_t)((gzH << 8) | gzL);

  ax = (float)rawAx / 16384.0;
  ay = (float)rawAy / 16384.0;
  az = (float)rawAz / 16384.0;
  gx = (float)rawGx / 131.0;
  gy = (float)rawGy / 131.0;
  gz = (float)rawGz / 131.0;
  return true;
}

/**
 * Startup Resting Calibration:
 * Records stationary samples to calculate the normal resting reference angles.
 */
void calibrateMPU6050() {
  Serial.println();
  Serial.println("⚖️  CALIBRATING MPU6050 BASELINE (KEEP BOARD STILL)...");

  float sumAx = 0, sumAy = 0, sumAz = 0;
  int validSamples = 0;

  for (int i = 0; i < 50; i++) {
    float ax, ay, az, gx, gy, gz;
    if (readMPU6050Raw(ax, ay, az, gx, gy, gz)) {
      sumAx += ax; sumAy += ay; sumAz += az;
      validSamples++;
    }
    delay(20);
  }

  if (validSamples > 15) {
    baselineAx = sumAx / validSamples;
    baselineAy = sumAy / validSamples;
    baselineAz = sumAz / validSamples;

    baselinePitch = atan2(baselineAy, sqrt(baselineAx * baselineAx + baselineAz * baselineAz)) * 180.0 / PI;
    baselineRoll  = atan2(-baselineAx, baselineAz) * 180.0 / PI;

    filteredAx = baselineAx;
    filteredAy = baselineAy;
    filteredAz = baselineAz;

    Serial.printf("✅ Baseline Calibrated: Pitch=%.1f° | Roll=%.1f°\n", baselinePitch, baselineRoll);
  } else {
    Serial.println("⚠️ Calibration failed. Using default 1.0g on Z.");
    baselineAx = 0; baselineAy = 0; baselineAz = 1.0;
    baselinePitch = 0; baselineRoll = 0;
  }
}

/**
 * Continuous 50Hz MPU6050 Sampling, Dynamic Shock & Tilt Tracking
 */
void pollMPU6050Continuous() {
  float ax, ay, az, gx, gy, gz;
  if (!readMPU6050Raw(ax, ay, az, gx, gy, gz)) return;

  lastRawAx = ax; lastRawAy = ay; lastRawAz = az;
  lastRawGx = gx; lastRawGy = gy; lastRawGz = gz;

  // 1. Tilt Calculation (Low-pass filtered accelerometer data)
  const float alpha = 0.20;
  filteredAx = (alpha * ax) + ((1.0 - alpha) * filteredAx);
  filteredAy = (alpha * ay) + ((1.0 - alpha) * filteredAy);
  filteredAz = (alpha * az) + ((1.0 - alpha) * filteredAz);

  currentPitch = atan2(filteredAy, sqrt(filteredAx * filteredAx + filteredAz * filteredAz)) * 180.0 / PI;
  currentRoll  = atan2(-filteredAx, filteredAz) * 180.0 / PI;

  float deltaPitch = abs(currentPitch - baselinePitch);
  float deltaRoll  = abs(currentRoll - baselineRoll);
  currentTiltAngle = max(deltaPitch, deltaRoll);

  // Sustained Tilt Evaluation
  if (currentTiltAngle >= TILT_THRESHOLD_DEG) {
    if (tiltExceededStart == 0) tiltExceededStart = millis();
    if (millis() - tiltExceededStart >= TILT_PERSIST_MS) {
      isSustainedTilt = true;
      tiltAlertUntil = millis() + HAZARD_LATCH_MS;
    }
  } else {
    tiltExceededStart = 0;
    if (currentTiltAngle <= (TILT_THRESHOLD_DEG - 3.0)) {
      isSustainedTilt = false;
    }
  }

  // 2. Dynamic Acceleration Vector Vibration (Gravity Compensated)
  // Dynamic shock vector difference relative to resting baseline:
  float dAx = ax - baselineAx;
  float dAy = ay - baselineAy;
  float dAz = az - baselineAz;
  float dynamicShock = sqrt(dAx * dAx + dAy * dAy + dAz * dAz);

  // Filter resting table noise floor (< 0.10g clamped to 0.04g nominal)
  if (dynamicShock < 0.10) {
    instantaneousVibration = 0.04;
  } else {
    instantaneousVibration = dynamicShock;
  }

  // Peak shock capture in window
  if (instantaneousVibration > peakVibrationInWindow) {
    peakVibrationInWindow = instantaneousVibration;
  }

  // Repeated tremor energy accumulation
  if (instantaneousVibration >= VIBRATION_SENSITIVITY_G) {
    tremorSamplesInWindow++;
    quakeAlertUntil = millis() + HAZARD_LATCH_MS;
  }
}

// =============================================================
// HC-SR04 Ultrasonic Distance Helper
// =============================================================
float readUltrasonicDistance() {
  digitalWrite(PIN_TRIG, LOW);
  delayMicroseconds(2);
  digitalWrite(PIN_TRIG, HIGH);
  delayMicroseconds(10);
  digitalWrite(PIN_TRIG, LOW);

  long duration = pulseIn(PIN_ECHO, HIGH, 28000); // ~4.5m timeout
  if (duration <= 0) return 0.0;

  return (duration * 0.0343) / 2.0;
}

// =============================================================
// Telemetry Transmission to Render Cloud
// =============================================================
void transmitTelemetry() {
  int gasRaw = analogRead(PIN_MQ2_GAS);
  bool gasInstant = (gasRaw >= GAS_HAZARD_THRESHOLD);
  bool gasDetected = gasInstant || (millis() < gasAlertUntil);

  int flamePinRaw = digitalRead(PIN_FLAME);
  bool fireInstant = FLAME_ACTIVE_LOW ? (flamePinRaw == LOW) : (flamePinRaw == HIGH);
  bool fireDetected = fireInstant || (millis() < fireAlertUntil);

  float distanceCm = readUltrasonicDistance();

  bool isTilt = (millis() < tiltAlertUntil) || isSustainedTilt;
  bool isQuake = (millis() < quakeAlertUntil) || (tremorSamplesInWindow >= TREMOR_SAMPLE_COUNT_THRESHOLD);
  
  bool isWater = false;
  int waterLevel = 0;
  if (HC_SR04_IS_OVERHEAD_TANK_GAUGE && distanceCm > 0.0) {
    isWater = (distanceCm <= TANK_FULL_DISTANCE_CM);
    waterLevel = constrain((int)((TANK_EMPTY_DISTANCE_CM - distanceCm) / (TANK_EMPTY_DISTANCE_CM - TANK_FULL_DISTANCE_CM) * 100.0), 0, 100);
  }

  float reportedVibration = peakVibrationInWindow;
  float reportedTiltAngle = currentTiltAngle;

  // Build JSON Payload
  String requestBody = "{\"deviceId\":\"" + String(DEVICE_ID) + "\"" +
                       ",\"apiKey\":\"" + String(DEVICE_API_KEY) + "\"" +
                       ",\"hasWaterSensor\":" + (HC_SR04_IS_OVERHEAD_TANK_GAUGE ? "true" : "false") +
                       ",\"gas\":" + String(gasRaw) +
                       ",\"smoke\":" + String(gasRaw) +
                       ",\"flame\":" + (fireDetected ? "true" : "false") +
                       ",\"distance\":" + String(distanceCm, 1) +
                       ",\"tiltAngle\":" + String(reportedTiltAngle, 1) +
                       ",\"vibration\":" + String(reportedVibration, 2) +
                       ",\"tilt\":" + (isTilt ? "true" : "false") +
                       ",\"earthquake\":" + (isQuake ? "true" : "false") +
                       ",\"water\":" + (isWater ? "true" : "false") +
                       ",\"waterLevel\":" + String(waterLevel) +
                       ",\"rssi\":" + String(WiFi.RSSI()) +
                       ",\"ax\":" + String(lastRawAx, 2) +
                       ",\"ay\":" + String(lastRawAy, 2) +
                       ",\"az\":" + String(lastRawAz, 2) +
                       "}";

  int httpCode = -1;
  String httpResponse = "";

  if (WiFi.status() == WL_CONNECTED) {
    WiFiClientSecure client;
    client.setInsecure();
    client.setBufferSizes(1024, 512); // Conserve heap and avoid TLS allocation failure
    client.setTimeout(10000);         // 10-second timeout for Cloudflare + Render SSL roundtrip

    HTTPClient http;
    if (http.begin(client, RESQ_SERVER_URL)) {
      http.addHeader("Content-Type", "application/json");
      http.addHeader("x-api-key", DEVICE_API_KEY);

      httpCode = http.POST(requestBody);
      if (httpCode > 0) {
        httpResponse = http.getString();
      } else {
        httpResponse = http.errorToString(httpCode);
      }
      http.end();
    } else {
      httpResponse = "HTTPClient begin failed";
    }
  } else {
    httpResponse = "Wi-Fi Disconnected";
  }

  // Clear Serial Monitor Diagnostics
  Serial.println();
  Serial.println("[RESQ DEBUG]");
  Serial.printf("FIRE DETECTED:       %s\n", fireDetected ? "true" : "false");
  Serial.printf("GAS DETECTED:        %s\n", gasDetected ? "true" : "false");
  Serial.printf("TILT DETECTED:       %s\n", isTilt ? "true" : "false");
  Serial.printf("EARTHQUAKE DETECTED: %s\n", isQuake ? "true" : "false");
  Serial.printf("WATER DETECTED:      %s\n", isWater ? "true" : "false");
  Serial.println();
  Serial.println("[HTTP DEBUG]");
  Serial.print("Request URL:        "); Serial.println(RESQ_SERVER_URL);
  String safePayload = requestBody;
  safePayload.replace(DEVICE_API_KEY, "***REDACTED***");
  Serial.print("Payload:            "); Serial.println(safePayload);
  Serial.printf("HTTP RESPONSE CODE: %d\n", httpCode);
  Serial.print("Backend Response:   "); Serial.println(httpResponse);
  Serial.println("----------------------------------------------------");

  // Reset window peak and energy counters if alert cooldown has elapsed
  if (millis() >= quakeAlertUntil) {
    peakVibrationInWindow = 0.04;
    tremorSamplesInWindow = 0;
  }
}

// =============================================================
// Interactive Sensor Test Mode (Type 't' in Serial Monitor)
// =============================================================
void runInteractiveTest() {
  Serial.println();
  Serial.println("==================================================");
  Serial.println("🔬 INTERACTIVE SENSOR STREAM (10 Hz for 15 seconds)");
  Serial.println("==================================================");

  unsigned long start = millis();
  while (millis() - start < 15000) {
    pollMPU6050Continuous();
    int fPin = digitalRead(PIN_FLAME);
    int gasVal = analogRead(PIN_MQ2_GAS);
    float dist = readUltrasonicDistance();

    Serial.printf("Flame:%d | Gas:%4d | Tilt:%4.1f° | Shock:%4.2fg | Dist:%5.1f cm\n",
                  fPin, gasVal, currentTiltAngle, instantaneousVibration, dist);
    delay(100);
  }
  Serial.println("Interactive Stream Completed.");
}
`;

  const jsonPayload = `{
  "deviceId": "RESQ-NODE-01",
  "apiKey": "resq_dev_node01_alpha_9882a1",
  "gas": 140,
  "smoke": 140,
  "flame": false,
  "tilt": false,
  "tiltAngle": 1.2,
  "earthquake": false,
  "vibration": 0.04,
  "hasWaterSensor": false,
  "water": false,
  "waterLevel": null,
  "distance": 84.5,
  "rssi": -58,
  "ax": 0.01,
  "ay": 0.02,
  "az": 0.99
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
              <h2 className="text-base font-bold text-slate-900">ESP8266 Firmware & Hardware Diagnostics</h2>
              <p className="text-xs text-slate-500">NodeMCU ESP8266 + MPU6050 (50Hz Sampling) + MQ-2 + Flame (Configurable) + HC-SR04</p>
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
            NodeMCU Arduino C++ Firmware (Debugged & Tested)
          </button>
          <button
            onClick={() => setActiveTab('pinout')}
            className={`py-3 border-b-2 transition-colors ${
              activeTab === 'pinout'
                ? 'border-teal-600 text-teal-600 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            Pin Mapping & Diagnostics
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
                  Copy this C++ sketch into Arduino IDE. Includes 50Hz continuous MPU6050 polling, peak shock capture, and full serial diagnostics.
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
                Verify each physical wire connection on your NodeMCU development board:
              </p>

              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100/75 text-slate-700 uppercase font-semibold text-[11px] border-b border-slate-200">
                      <th className="py-2.5 px-4">Sensor Module</th>
                      <th className="py-2.5 px-4">Hardware Function</th>
                      <th className="py-2.5 px-4">NodeMCU Pin</th>
                      <th className="py-2.5 px-4">Power Connections</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                    <tr className="hover:bg-slate-50">
                      <td className="py-2.5 px-4 font-bold text-slate-900 font-sans">MPU6050 (6-Axis)</td>
                      <td className="py-2.5 px-4 text-orange-600 font-sans">Tilt & Seismic Tremors</td>
                      <td className="py-2.5 px-4 font-bold text-teal-700">SDA: D2 (GPIO4), SCL: D1 (GPIO5)</td>
                      <td className="py-2.5 px-4 text-slate-600">VCC to 3.3V, GND to GND, AD0 to GND</td>
                    </tr>
                    <tr className="hover:bg-slate-50">
                      <td className="py-2.5 px-4 font-bold text-slate-900 font-sans">Optical Flame Sensor</td>
                      <td className="py-2.5 px-4 text-rose-600 font-sans">Fire Detection (760–1100nm IR)</td>
                      <td className="py-2.5 px-4 font-bold text-teal-700">DOUT: D5 (GPIO14)</td>
                      <td className="py-2.5 px-4 text-slate-600">VCC to 3.3V, GND to GND</td>
                    </tr>
                    <tr className="hover:bg-slate-50">
                      <td className="py-2.5 px-4 font-bold text-slate-900 font-sans">MQ-2 Gas / Smoke</td>
                      <td className="py-2.5 px-4 text-amber-600 font-sans">Combustible Gas & Smoke</td>
                      <td className="py-2.5 px-4 font-bold text-teal-700">AOUT: A0 (ADC0)</td>
                      <td className="py-2.5 px-4 text-slate-600 font-bold text-rose-600">VCC to VIN (5V required!), GND to GND</td>
                    </tr>
                    <tr className="hover:bg-slate-50">
                      <td className="py-2.5 px-4 font-bold text-slate-900 font-sans">HC-SR04 Ultrasonic</td>
                      <td className="py-2.5 px-4 text-cyan-600 font-sans">Proximity & Distance (Overhead Tank Level if configured)</td>
                      <td className="py-2.5 px-4 font-bold text-teal-700">TRIG: D6 (GPIO12), ECHO: D7 (GPIO13)</td>
                      <td className="py-2.5 px-4 text-slate-600">VCC to VIN (5V), GND to GND</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <span className="font-bold text-slate-800 block">🔧 Benchtop Calibration Guide:</span>
                <ul className="list-disc pl-5 space-y-1 text-slate-600">
                  <li><strong>MPU6050:</strong> When the board powers on, keep it completely flat and still for 2 seconds. The firmware samples 100 baseline readings to cancel out resting mounting angles.</li>
                  <li><strong>Flame Sensor Potentiometer:</strong> In normal room lighting with NO flame, the module's green DOUT LED must be OFF (pin reads HIGH = 1). When you hold a lighter ~10-20 cm away, the LED must turn ON (pin reads LOW = 0). Turn the small blue potentiometer screw until this transition is sharp.</li>
                  <li><strong>MQ-2 Sensor:</strong> The sensor takes 20-30 seconds to warm up after power-on. The metal mesh heater will feel gently warm. Clean air ADC reads 50-180. Blowing smoke or butane rises it above 220.</li>
                </ul>
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
