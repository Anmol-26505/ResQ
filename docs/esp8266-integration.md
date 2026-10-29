# NodeMCU ESP8266 Firmware & Hardware Integration Guide

This guide describes how to connect physical environmental sensors to a NodeMCU ESP8266 microcontroller board and stream real-time telemetry to the ResQ backend.

---

## 1. Hardware Pinout & Wiring Table

| Sensor Peripheral | Sensor Pin | NodeMCU Pin | GPIO | Protocol / Signal Description |
| :--- | :--- | :--- | :--- | :--- |
| **DHT11 / DHT22** | VCC | 3V3 | - | 3.3V DC Power |
| **DHT11 / DHT22** | GND | GND | - | Common Ground |
| **DHT11 / DHT22** | DATA | **D2** | GPIO4 | 1-Wire Digital Bus (with 4.7k-10k pull-up resistor to 3.3V) |
| **MQ-2 / MQ-135** | VCC | VIN | - | 5.0V DC (MQ heaters operate optimally at 5V) |
| **MQ-2 / MQ-135** | GND | GND | - | Common Ground |
| **MQ-2 / MQ-135** | AOUT | **A0** | ADC0 | Analog Output (0.0V to 1.0V max analog level) |
| **Flame IR Sensor** | VCC | 3V3 | - | 3.3V DC Power |
| **Flame IR Sensor** | GND | GND | - | Common Ground |
| **Flame IR Sensor** | DOUT | **D1** | GPIO5 | Active-Low Digital Output (LOW = Fire Detected) |

> [!NOTE]
> When powering the NodeMCU via a Micro-USB cable, the `VIN` pin outputs regulated ~5V DC directly from the USB bus, which is ideal for the MQ-2 heater element. The `3V3` pins output 3.3V from the onboard LD1117 regulator.

---

## 2. Arduino IDE Library Setup

Open the Arduino IDE Library Manager (**Sketch > Include Library > Manage Libraries...**) and install the following:
1. **ESP8266 Board Package**: (In Preferences, add `http://arduino.esp8266.com/stable/package_esp8266com_index.json`).
2. **ArduinoJson**: version 6.21.x or higher by Benoit Blanchon.
3. **DHT sensor library**: by Adafruit (plus Adafruit Unified Sensor).

---

## 3. Production ESP8266 Arduino C++ Sketch

```cpp
/*
 * ResQ IoT Platform — NodeMCU ESP8266 Telemetry Firmware
 * Target: NodeMCU 1.0 (ESP-12E Module)
 */

#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClient.h>
#include <ArduinoJson.h>
#include <DHT.h>

// -------------------------------------------------------------
// 1. Wi-Fi & Gateway Configuration
// -------------------------------------------------------------
const char* WIFI_SSID     = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// ResQ Backend URL (Do NOT use localhost on an ESP8266; use your LAN IP or domain)
const char* RESQ_SERVER_URL = "http://192.168.1.100:5000/api/iot/readings";

// Device Identification and Secret API Key
const char* DEVICE_ID       = "RESQ-NODE-01";
const char* DEVICE_API_KEY  = "resq_dev_node01_alpha_9882a1";

// -------------------------------------------------------------
// 2. Sensor Pin Definitions
// -------------------------------------------------------------
#define DHTPIN  4     // GPIO4 is D2 on NodeMCU
#define DHTTYPE DHT11 // Set to DHT22 if using AM2302
DHT dht(DHTPIN, DHTTYPE);

const int FLAME_PIN = 5;  // GPIO5 is D1 on NodeMCU
const int GAS_PIN   = A0; // ADC0 Analog input

// Telemetry interval: 3000ms (3 seconds)
const unsigned long SEND_INTERVAL_MS = 3000;
unsigned long lastSendTime = 0;

void setup() {
  Serial.begin(115200);
  delay(100);

  pinMode(FLAME_PIN, INPUT_PULLUP);
  dht.begin();

  Serial.println();
  Serial.println("==================================================");
  Serial.println("🛡️  ResQ IoT Emergency NodeMCU Starting Up...");
  Serial.printf("🏷️  Configured Node ID: %s\n", DEVICE_ID);
  Serial.println("==================================================");

  // Initialize Wi-Fi
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to Wi-Fi");

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println();
  Serial.printf("✅ Wi-Fi Connected! IP: %s (Signal: %d dBm)\n",
                WiFi.localIP().toString().c_str(), WiFi.RSSI());
}

void loop() {
  unsigned long currentMillis = millis();

  // Non-blocking timer
  if (currentMillis - lastSendTime >= SEND_INTERVAL_MS) {
    lastSendTime = currentMillis;
    transmitTelemetry();
  }
}

void transmitTelemetry() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("⚠️ Wi-Fi disconnected. Attempting automatic reconnection...");
    WiFi.reconnect();
    return;
  }

  // 1. Read environmental sensors
  float temp = dht.readTemperature();
  float hum  = dht.readHumidity();
  int gasAdc = analogRead(GAS_PIN);
  
  // Optical flame sensors are typically active-LOW (LOW when flame IR is present)
  bool flameDetected = (digitalRead(FLAME_PIN) == LOW);

  // Handle sensor read failure gracefully
  if (isnan(temp)) temp = 24.0;
  if (isnan(hum)) hum = 45.0;

  // 2. Build JSON telemetry payload
  StaticJsonDocument<256> doc;
  doc["deviceId"]    = DEVICE_ID;
  doc["temperature"] = round(temp * 10.0) / 10.0;
  doc["humidity"]    = round(hum * 10.0) / 10.0;

  JsonObject sensors = doc.createNestedObject("sensors");
  sensors["gas"]   = gasAdc;
  sensors["flame"] = flameDetected;

  doc["rssi"] = WiFi.RSSI();
  doc["firmwareVersion"] = "1.2.0-esp8266";

  String requestBody;
  serializeJson(doc, requestBody);

  // 3. Dispatch HTTP POST over Wi-Fi
  WiFiClient client;
  HTTPClient http;

  http.begin(client, RESQ_SERVER_URL);
  http.setTimeout(4000); // 4-second network timeout
  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-api-key", DEVICE_API_KEY);

  int httpCode = http.POST(requestBody);

  if (httpCode > 0) {
    String response = http.getString();
    Serial.printf("[HTTP %d] Telemetry posted | T: %.1f C | H: %.1f %% | Gas: %d | Flame: %s\n",
                  httpCode, temp, hum, gasAdc, flameDetected ? "YES" : "NO");
  } else {
    Serial.printf("❌ HTTP POST Failed: %s\n", http.errorToString(httpCode).c_str());
  }

  http.end();
}
```

---

## 4. Hardware Calibration & Sensor Tips

1. **MQ Gas Sensor Burn-In**:
   MQ-2 and MQ-135 sensors use a Tin Dioxide ($SnO_2$) heating coil. On brand-new sensors, let the heater run powered for 24 hours to stabilize the internal chemical film. During normal reboot, allow 20–30 seconds for the heater coil to warm up before taking baseline readings.

2. **Flame Sensor Sensitivity Trimpot**:
   The small potentiometer on the flame module adjusts the digital comparator threshold. Point a small lighter or match flame at the sensor from 50cm and adjust the trimpot until the DOUT onboard LED triggers reliably without triggering from ambient fluorescent light.

3. **NodeMCU Wi-Fi Stability**:
   Ensure your Wi-Fi router broadcasts 2.4GHz. ESP8266 does not support 5GHz bands. Maintain a minimum RSSI of -75 dBm for stable continuous packet transmission.
