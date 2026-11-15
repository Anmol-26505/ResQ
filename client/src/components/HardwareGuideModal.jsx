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
const char* RESQ_SERVER_URL    = "https://resq-8tbc.onrender.com/api/sensors/update";
const char* RESQ_DASHBOARD_URL = "https://resq-8tbc.onrender.com";
const char* RESQ_DATA_API_URL  = "https://resq-8tbc.onrender.com/api/sensors/latest";
const char* DEVICE_ID          = "RESQ-NODE-01";
const char* DEVICE_API_KEY     = "resq_iot_secure_key_2026"; // Must match DEVICE_API_KEY in Render

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

// HTTP Timeout for BearSSL & HTTPClient (25 seconds for Render free tier cold starts)
const unsigned long HTTP_TIMEOUT_MS = 25000;

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

// Sequence & Network Status Tracking
unsigned long telemetrySeq = 1;
int retryCount = 0;
bool lastTxSuccess = false;
unsigned long lastTxDurationMs = 0;
int lastHttpCode = 0;
String lastHttpResponse = "None yet";
String lastHttpRequest = "STANDBY";
String lastBackendStatus = "DISCONNECTED";
String lastDbStatus = "UNKNOWN";
String lastTransmissionResult = "STANDBY";
String transmissionStage = "STANDBY";
String failureReason = "";
String dashboardSyncStatus = "NOT VERIFIED";
String lastJsonPayload = "";

// Forward Function Prototypes
void setup();
void loop();
void scanI2CBus();
bool initMPU6050();
bool readMPU6050Raw(float &ax, float &ay, float &az, float &gx, float &gy, float &gz);
void calibrateMPU6050();
void pollMPU6050Continuous();
float readUltrasonicDistance();
void printStatusSummary(int flamePinRaw, bool fireDetected, int gasRaw, bool gasDetected, bool isTilt, bool isQuake, float distCm);
void transmitTelemetry();
void verifyDashboardSync();
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
  Serial.printf("Device ID: %s | Server: %s\\n", DEVICE_ID, RESQ_SERVER_URL);
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

  // 3. Connect to Wi-Fi with automatic persistence and background reconnection
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.persistent(true);
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
    Serial.printf("✅ Wi-Fi Connected! IP: %s (Signal: %d dBm)\\n",
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
    printStatusSummary(flamePinRaw, fireDetected, gasRaw, gasDetected, isTilt, isQuake, distCm);
  }

  // 3. Check for interactive serial commands:
  // 'c' = calibrate, 't' = stream test, 'v' = verify latest data API
  if (Serial.available()) {
    char cmd = Serial.read();
    if (cmd == 'c' || cmd == 'C') {
      calibrateMPU6050();
    } else if (cmd == 't' || cmd == 'T') {
      runInteractiveTest();
    } else if (cmd == 'v' || cmd == 'V') {
      verifyDashboardSync();
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

  // 5. Controlled Telemetry Transmission with Backoff Retry
  unsigned long requiredInterval = lastTxSuccess ? SEND_INTERVAL_MS : (SEND_INTERVAL_MS + (retryCount > 2 ? 8000 : 4000));
  if (now - lastSendTime >= requiredInterval) {
    lastSendTime = now;
    transmitTelemetry();
  }
}

// =============================================================
// 1-Second Serial Monitor Live Report (Clean & Standardized)
// =============================================================
void printStatusSummary(int flamePinRaw, bool fireDetected, int gasRaw, bool gasDetected, bool isTilt, bool isQuake, float distCm) {
  bool distValid = (distCm > 0.0 && distCm < 450.0);

  Serial.println();
  Serial.println("================================================================================");
  Serial.println("              RESQ LIVE TELEMETRY & TRANSMISSION MONITOR                        ");
  Serial.println("================================================================================");
  Serial.println();
  Serial.println("DEVICE INFORMATION:");
  Serial.printf("  Device ID              : %s\\n", DEVICE_ID);
  Serial.printf("  WiFi Status            : %s\\n", (WiFi.status() == WL_CONNECTED) ? "CONNECTED" : "DISCONNECTED");
  Serial.printf("  IP Address             : %s\\n", (WiFi.status() == WL_CONNECTED) ? WiFi.localIP().toString().c_str() : "0.0.0.0");
  Serial.printf("  WiFi Signal Strength   : %d dBm\\n", WiFi.RSSI());
  Serial.printf("  Sequence Number        : #%lu (Retries: %d)\\n", telemetrySeq, retryCount);
  Serial.printf("  Device Timestamp       : %lu ms (Uptime: %lu s)\\n", millis(), millis() / 1000);
  Serial.println();
  Serial.println("SENSOR READINGS:");
  Serial.printf("  Flame Sensor (D5)      : %s (Raw DOUT: %s)\\n", fireDetected ? "CRITICAL: FLAME DETECTED" : "SAFE", (flamePinRaw == HIGH) ? "HIGH" : "LOW");
  Serial.printf("  MQ-2 Gas / Smoke (A0)  : %d ADC (Status: %s, Threshold: %d)\\n", gasRaw, gasDetected ? "CRITICAL: GAS DETECTED" : "NORMAL", GAS_HAZARD_THRESHOLD);
  Serial.printf("  MPU6050 Motion (D2/D1) : Tilt: %.1f deg (Status: %s)\\n", currentTiltAngle, isTilt ? "CRITICAL: TILT DETECTED" : "NORMAL");
  Serial.printf("                           Vibration: %.2f g (Status: %s)\\n", peakVibrationInWindow, isQuake ? "CRITICAL: QUAKE DETECTED" : "NORMAL");
  Serial.printf("                           Accel [X: %.2f g, Y: %.2f g, Z: %.2f g]\\n", lastRawAx, lastRawAy, lastRawAz);
  Serial.printf("                           Gyro  [X: %.1f deg/s, Y: %.1f deg/s, Z: %.1f deg/s]\\n", lastRawGx, lastRawGy, lastRawGz);
  if (distValid) {
    Serial.printf("  Ultrasonic Dist (D6/D7): %.1f cm (Status: VALID ECHO)\\n", distCm);
  } else {
    Serial.println("  Ultrasonic Dist (D6/D7): TIMEOUT / NO ECHO (Status: OUT OF RANGE)");
  }
  Serial.println("  Water Sensor           : NOT CONNECTED (Moisture: N/A)");
  Serial.println();
  Serial.println("HAZARDS EVALUATION:");
  Serial.printf("  Fire: %s | Gas: %s | Tilt: %s | Earthquake: %s | Overall: %s\\n",
                fireDetected ? "DETECTED" : "SAFE",
                gasDetected ? "DETECTED" : "SAFE",
                isTilt ? "DETECTED" : "SAFE",
                isQuake ? "DETECTED" : "SAFE",
                (fireDetected || gasDetected || isTilt || isQuake) ? "CRITICAL HAZARD ACTIVE" : "ALL SYSTEMS NORMAL");
  Serial.println();
  Serial.println("DATA TRANSMISSION STATUS:");
  Serial.printf("  POST Destination URL   : %s\\n", RESQ_SERVER_URL);
  Serial.printf("  Latest Data API URL    : %s\\n", RESQ_DATA_API_URL);
  Serial.printf("  Transmission Stage     : %s\\n", transmissionStage.c_str());
  if (failureReason.length() > 0) {
    Serial.printf("  Failure Reason         : %s\\n", failureReason.c_str());
  }
  Serial.printf("  Transmission Duration  : %lu ms\\n", lastTxDurationMs);
  Serial.printf("  HTTP Status Code       : %d\\n", lastHttpCode);
  Serial.printf("  Backend Response Body  : %s\\n", lastHttpResponse.c_str());
  Serial.printf("  Database Save Status   : %s\\n", lastDbStatus.c_str());
  Serial.printf("  Transmission Result    : %s\\n", lastTransmissionResult.c_str());
  Serial.printf("  Dashboard Sync Status  : %s (Type 'v' in Serial Monitor to query)\\n", dashboardSyncStatus.c_str());
  Serial.println();
  Serial.println("JSON PAYLOAD (API KEYS MASKED):");
  if (lastJsonPayload.length() > 0) {
    Serial.println(lastJsonPayload);
  } else {
    Serial.println("[Awaiting initial telemetry sample]");
  }
  Serial.println("================================================================================");
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
      Serial.printf("   ✅ I2C device detected at 0x%02X!\\n", address);
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

    Serial.printf("✅ Baseline Calibrated: Pitch=%.1f° | Roll=%.1f°\\n", baselinePitch, baselineRoll);
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
  unsigned long txStart = millis();
  transmissionStage = "1. REQUEST CREATED";
  failureReason = "";

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
  String requestBody = "{\\"deviceId\\":\\"" + String(DEVICE_ID) + "\\"" +
                       ",\\"apiKey\\":\\"" + String(DEVICE_API_KEY) + "\\"" +
                       ",\\"seq\\":" + String(telemetrySeq) +
                       ",\\"sequenceNumber\\":" + String(telemetrySeq) +
                       ",\\"hasWaterSensor\\":" + (HC_SR04_IS_OVERHEAD_TANK_GAUGE ? "true" : "false") +
                       ",\\"gas\\":" + String(gasRaw) +
                       ",\\"smoke\\":" + String(gasRaw) +
                       ",\\"flame\\":" + (fireDetected ? "true" : "false") +
                       ",\\"distance\\":" + String(distanceCm, 1) +
                       ",\\"tiltAngle\\":" + String(reportedTiltAngle, 1) +
                       ",\\"vibration\\":" + String(reportedVibration, 2) +
                       ",\\"tilt\\":" + (isTilt ? "true" : "false") +
                       ",\\"earthquake\\":" + (isQuake ? "true" : "false") +
                       ",\\"water\\":" + (isWater ? "true" : "false") +
                       ",\\"waterLevel\\":" + String(waterLevel) +
                       ",\\"rssi\\":" + String(WiFi.RSSI()) +
                       ",\\"ax\\":" + String(lastRawAx, 2) +
                       ",\\"ay\\":" + String(lastRawAy, 2) +
                       ",\\"az\\":" + String(lastRawAz, 2) +
                       ",\\"gx\\":" + String(lastRawGx, 2) +
                       ",\\"gy\\":" + String(lastRawGy, 2) +
                       ",\\"gz\\":" + String(lastRawGz, 2) +
                       "}";

  lastJsonPayload = requestBody;
  lastJsonPayload.replace(DEVICE_API_KEY, "***REDACTED***");

  if (WiFi.status() != WL_CONNECTED) {
    lastHttpCode = -4;
    lastHttpResponse = "Wi-Fi Disconnected";
    lastBackendStatus = "DISCONNECTED";
    lastDbStatus = "UNKNOWN";
    transmissionStage = "FAILED AT STAGE 1 (REQUEST CREATED)";
    failureReason = "Wi-Fi is disconnected (WL_DISCONNECTED)";
    lastTransmissionResult = "FAILED: Wi-Fi Disconnected";
    lastTxSuccess = false;
    lastTxDurationMs = millis() - txStart;
    return;
  }

  WiFiClientSecure client;
  client.setInsecure();
  client.setBufferSizes(1024, 512); // Conserve heap and avoid TLS allocation failure
  client.setTimeout(HTTP_TIMEOUT_MS); // 25-second timeout for Cloudflare + Render SSL roundtrip

  HTTPClient http;
  transmissionStage = "2. REQUEST SENT";

  if (!http.begin(client, RESQ_SERVER_URL)) {
    lastHttpCode = -1;
    lastHttpResponse = "HTTPClient begin failed";
    lastBackendStatus = "BEGIN FAILED";
    lastDbStatus = "UNKNOWN";
    transmissionStage = "FAILED AT STAGE 2 (REQUEST SENT)";
    failureReason = "HTTPClient failed to initialize connection to endpoint";
    lastTransmissionResult = "FAILED: Connection initiation error";
    lastTxSuccess = false;
    lastTxDurationMs = millis() - txStart;
    return;
  }

  http.setTimeout(HTTP_TIMEOUT_MS); // CRITICAL: Overrides HTTPClient default 5000ms read timeout!
  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-api-key", DEVICE_API_KEY);

  int httpCode = http.POST(requestBody);
  lastTxDurationMs = millis() - txStart;
  lastHttpCode = httpCode;

  String httpResponse = "";
  if (httpCode > 0) {
    httpResponse = http.getString();
  } else {
    httpResponse = http.errorToString(httpCode);
  }
  http.end();
  lastHttpResponse = httpResponse;

  if (httpCode < 0) {
    lastBackendStatus = "FAILED (HTTP " + String(httpCode) + ")";
    lastDbStatus = "UNKNOWN";
    transmissionStage = "FAILED AT STAGE 3 (BACKEND RESPONSE RECEIVED)";
    if (httpCode == -11) {
      failureReason = "HTTP -11 (Read Timeout: Server exceeded 25s response window during cold start or slow DB)";
    } else if (httpCode == -1) {
      failureReason = "HTTP -1 (Connection Refused)";
    } else {
      failureReason = "HTTP " + String(httpCode) + " (" + httpResponse + ")";
    }
    lastTransmissionResult = "FAILED: " + failureReason;
    lastTxSuccess = false;
  } else if (httpCode >= 400) {
    lastBackendStatus = "HTTP " + String(httpCode);
    lastDbStatus = "NOT CONFIRMED";
    transmissionStage = "FAILED AT STAGE 3 (BACKEND RESPONSE RECEIVED)";
    failureReason = "HTTP " + String(httpCode) + " Error (" + httpResponse + ")";
    lastTransmissionResult = "FAILED: HTTP " + String(httpCode);
    lastTxSuccess = false;
  } else if (httpCode == 200 || httpCode == 201) {
    lastBackendStatus = "CONNECTED (HTTP " + String(httpCode) + ")";
    transmissionStage = "3. BACKEND RESPONSE RECEIVED";

    // Verify explicit database save confirmation
    bool isDbSaved = (httpResponse.indexOf("\\"databaseSaved\\":true") >= 0) ||
                     (httpResponse.indexOf("\\"saved\\":true") >= 0);

    if (isDbSaved) {
      transmissionStage = "4. DATABASE SAVE CONFIRMED";
      lastDbStatus = "CONFIRMED (databaseSaved: true)";
      transmissionStage = "5. TRANSMISSION SUCCESSFUL";
      lastTransmissionResult = "SUCCESS: Sequence #" + String(telemetrySeq) + " Saved to MongoDB in " + String(lastTxDurationMs) + "ms";
      lastTxSuccess = true;
    } else {
      lastDbStatus = "NOT CONFIRMED";
      transmissionStage = "FAILED AT STAGE 4 (DATABASE SAVE CONFIRMED)";
      failureReason = "Server responded with HTTP " + String(httpCode) + " but databaseSaved was not true";
      lastTransmissionResult = "FAILED: Database save not confirmed by server";
      lastTxSuccess = false;
    }
  }

  // Controlled retry & sequence management
  if (lastTxSuccess) {
    retryCount = 0;
    telemetrySeq++; // Increment sequence ONLY after confirmed database persistence!
  } else {
    retryCount++;
    // Keep telemetrySeq unchanged so packet is retried idempotently
  }

  // Reset window peak and energy counters if alert cooldown has elapsed
  if (millis() >= quakeAlertUntil) {
    peakVibrationInWindow = 0.04;
    tremorSamplesInWindow = 0;
  }
}

// =============================================================
// Dashboard API Verification (Query GET /api/sensors/latest)
// =============================================================
void verifyDashboardSync() {
  if (WiFi.status() != WL_CONNECTED) {
    dashboardSyncStatus = "WIFI DISCONNECTED";
    Serial.println("❌ Cannot verify dashboard sync: Wi-Fi Disconnected");
    return;
  }

  Serial.println();
  Serial.println("🔍 Querying GET /api/sensors/latest to verify sequence sync...");
  WiFiClientSecure client;
  client.setInsecure();
  client.setBufferSizes(1024, 512);
  client.setTimeout(15000);

  HTTPClient http;
  String verifyUrl = String(RESQ_DATA_API_URL) + "?deviceId=" + String(DEVICE_ID);
  if (http.begin(client, verifyUrl)) {
    http.setTimeout(15000);
    int code = http.GET();
    if (code == 200) {
      String body = http.getString();
      unsigned long targetSeq = (lastTxSuccess ? (telemetrySeq - 1) : telemetrySeq);
      String searchKey = "\\"sequenceNumber\\":" + String(targetSeq);
      String searchKey2 = "\\"seq\\":" + String(targetSeq);
      if (body.indexOf(searchKey) >= 0 || body.indexOf(searchKey2) >= 0) {
        dashboardSyncStatus = "VERIFIED (Seq #" + String(targetSeq) + " Active)";
        Serial.printf("✅ DASHBOARD SYNC CONFIRMED: Server returned Seq #%lu!\\n", targetSeq);
      } else {
        dashboardSyncStatus = "PENDING / OUT OF SYNC";
        Serial.printf("⚠️ Dashboard API responded (HTTP 200) but sequence #%lu not active yet.\\n", targetSeq);
      }
    } else {
      dashboardSyncStatus = "QUERY FAILED (HTTP " + String(code) + ")";
      Serial.printf("❌ Verification GET failed with HTTP %d\\n", code);
    }
    http.end();
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

    Serial.printf("Flame:%d | Gas:%4d | Tilt:%4.1f° | Shock:%4.2fg | Dist:%5.1f cm\\n",
                  fPin, gasVal, currentTiltAngle, instantaneousVibration, dist);
    delay(100);
  }
  Serial.println("Interactive Stream Completed.");
}
`;

  const jsonPayload = `{
  "deviceId": "RESQ-NODE-01",
  "apiKey": "resq_iot_secure_key_2026",
  "seq": 142,
  "sequenceNumber": 142,
  "hasWaterSensor": false,
  "gas": 140,
  "smoke": 140,
  "flame": false,
  "distance": 84.5,
  "tiltAngle": 1.2,
  "vibration": 0.04,
  "tilt": false,
  "earthquake": false,
  "water": false,
  "waterLevel": 0,
  "rssi": -58,
  "ax": 0.01,
  "ay": 0.02,
  "az": 0.99,
  "gx": 0.1,
  "gy": -0.2,
  "gz": 0
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
