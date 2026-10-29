import React, { useState } from 'react';
import { X, Copy, Check, Cpu, Radio, Shield, Terminal, ArrowRight } from 'lucide-react';

const HardwareGuideModal = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState('arduino');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const arduinoCode = `/*
 * ResQ IoT Platform — NodeMCU ESP8266 Telemetry Firmware
 * Target: NodeMCU ESP8266 (ESP-12E Module)
 * Libraries: ESP8266WiFi, ESP8266HTTPClient, ArduinoJson (v6+)
 * Connected Sensors:
 *   - DHT11 / DHT22: Temperature & Humidity (GPIO4 / D2)
 *   - MQ-2 / MQ-135: Toxic Gas & Smoke (Analog A0)
 *   - Flame IR Sensor: Digital Active-Low (GPIO5 / D1)
 */

#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClient.h>
#include <ArduinoJson.h>

// Wi-Fi Credentials
const char* WIFI_SSID     = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// ResQ Backend Endpoint Configuration
// Use your server IP or deployed domain (e.g., http://192.168.1.50:5000 or https://resq.yourdomain.com)
const char* RESQ_SERVER_URL = "http://192.168.1.100:5000/api/iot/readings";

// Device Identification and Secure API Key (Generated from ResQ Devices Console)
const char* DEVICE_ID       = "RESQ-NODE-01";
const char* DEVICE_API_KEY  = "resq_dev_node01_alpha_9882a1";

// Sensor Hardware Pin Mapping
const int FLAME_SENSOR_PIN = 5;  // D1 (GPIO5)
const int GAS_ANALOG_PIN   = A0; // ADC0

// Ingestion interval (default: 3000ms = 3 seconds)
const unsigned long SEND_INTERVAL_MS = 3000;
unsigned long lastSendTime = 0;

void setup() {
  Serial.begin(115200);
  pinMode(FLAME_SENSOR_PIN, INPUT);

  Serial.println();
  Serial.println("==========================================");
  Serial.println("ResQ IoT Emergency NodeMCU Starting Up...");
  Serial.printf("Device ID: %s\\n", DEVICE_ID);
  Serial.println("==========================================");

  // Connect to Wi-Fi
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to Wi-Fi");

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println();
  Serial.printf("Connected! IP Address: %s (RSSI: %d dBm)\\n",
                WiFi.localIP().toString().c_str(), WiFi.RSSI());
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
    Serial.println("Wi-Fi disconnected. Reconnecting...");
    return;
  }

  WiFiClient client;
  HTTPClient http;

  // Initialize HTTP POST connection
  http.begin(client, RESQ_SERVER_URL);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-api-key", DEVICE_API_KEY);

  // Read analog & digital sensors
  int gasAdcRaw = analogRead(GAS_ANALOG_PIN);
  bool flameDetected = (digitalRead(FLAME_SENSOR_PIN) == LOW); // Active-low IR sensor

  // Example reading values (Replace with dht.readTemperature() & dht.readHumidity())
  float temperature = 24.5;
  float humidity = 48.0;

  // Build JSON payload
  StaticJsonDocument<256> doc;
  doc["deviceId"]    = DEVICE_ID;
  doc["temperature"] = temperature;
  doc["humidity"]    = humidity;
  
  JsonObject sensors = doc.createNestedObject("sensors");
  sensors["gas"]   = gasAdcRaw;
  sensors["flame"] = flameDetected;

  doc["rssi"] = WiFi.RSSI();
  doc["firmwareVersion"] = "1.2.0-esp8266";

  String requestBody;
  serializeJson(doc, requestBody);

  Serial.print("Posting Telemetry: ");
  Serial.println(requestBody);

  int httpCode = http.POST(requestBody);

  if (httpCode > 0) {
    String response = http.getString();
    Serial.printf("Server Response [HTTP %d]: %s\\n", httpCode, response.c_str());
  } else {
    Serial.printf("HTTP POST Failed, Error: %s\\n", http.errorToString(httpCode).c_str());
  }

  http.end();
}`;

  const jsonPayload = `{
  "deviceId": "RESQ-NODE-01",
  "temperature": 28.5,
  "humidity": 65.0,
  "sensors": {
    "gas": 142,
    "flame": false
  },
  "rssi": -58,
  "firmwareVersion": "1.2.0-esp8266",
  "timestamp": "2026-10-29T09:30:00.000Z"
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
                    <tr>
                      <td className="py-2.5 px-4 font-medium text-slate-900">DHT11 / DHT22</td>
                      <td className="py-2.5 px-4 font-mono">DATA</td>
                      <td className="py-2.5 px-4 font-mono font-bold text-teal-700">D2 (GPIO4)</td>
                      <td className="py-2.5 px-4">Digital 1-Wire temperature & humidity stream</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 font-medium text-slate-900">MQ-2 / MQ-135 Gas</td>
                      <td className="py-2.5 px-4 font-mono">AOUT (Analog)</td>
                      <td className="py-2.5 px-4 font-mono font-bold text-teal-700">A0 (ADC0)</td>
                      <td className="py-2.5 px-4">Analog gas & smoke concentration level (0-1023)</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 font-medium text-slate-900">Flame Optical IR</td>
                      <td className="py-2.5 px-4 font-mono">DOUT (Digital)</td>
                      <td className="py-2.5 px-4 font-mono font-bold text-teal-700">D1 (GPIO5)</td>
                      <td className="py-2.5 px-4">Active-low infrared flame detector (LOW = Fire)</td>
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
