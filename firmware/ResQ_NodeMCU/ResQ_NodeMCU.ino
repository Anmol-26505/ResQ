/*
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
  bool fireDetected = FLAME_ACTIVE_LOW ? (flamePinRaw == LOW) : (flamePinRaw == HIGH);
  int gasRaw = analogRead(PIN_MQ2_GAS);
  bool gasDetected = (gasRaw >= GAS_HAZARD_THRESHOLD);
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

  // 4. Regular 2-second Telemetry Transmission to Render
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
  int flamePinRaw = digitalRead(PIN_FLAME);
  bool fireDetected = FLAME_ACTIVE_LOW ? (flamePinRaw == LOW) : (flamePinRaw == HIGH);
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
    client.setTimeout(4000);

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
      httpResponse = "Connection failed";
    }
  } else {
    httpResponse = "Wi-Fi Disconnected";
  }

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
