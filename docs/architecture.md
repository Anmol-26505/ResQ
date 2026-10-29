# ResQ — Smart IoT Emergency Monitoring and Response Platform
## System Architecture & Technical Specifications

---

## 1. Architectural Overview

ResQ is an end-to-end full-stack IoT emergency monitoring and incident response platform. It captures environmental sensor telemetry directly from edge hardware microcontrollers (NodeMCU ESP8266), transmits measurements over Wi-Fi via authenticated HTTP/REST, evaluates safety threshold rules autonomously, persists historical time-series data in MongoDB, and pushes live updates to web dashboards via Socket.IO.

```
+-----------------------------------------------------------------------------------+
|                              PHYSICAL HARDWARE LAYER                              |
|                                                                                   |
|  +--------------------+    +--------------------+    +-------------------------+  |
|  | DHT11 / DHT22      |    | MQ-2 / MQ-135      |    | Optical Flame Sensor    |  |
|  | Temp & Humidity    |    | Combustible Gas    |    | Infrared Photodiode     |  |
|  | Pin D2 (GPIO4)     |    | Pin A0 (ADC0)      |    | Pin D1 (GPIO5)          |  |
|  +---------+----------+    +---------+----------+    +------------+------------+  |
|            |                         |                            |               |
|            +-------------------------+----------------------------+               |
|                                      |                                            |
|                                      v                                            |
|                  +---------------------------------------+                        |
|                  |     NodeMCU ESP8266 (ESP-12E)         |                        |
|                  |     Tensilica 32-bit Core @ 80MHz     |                        |
|                  |     Wi-Fi 802.11 b/g/n (STA Mode)     |                        |
|                  +-------------------+-------------------+                        |
+--------------------------------------|--------------------------------------------+
                                       |
                                       |  HTTP/1.1 POST /api/iot/readings
                                       |  Header: x-api-key: <DEVICE_SECRET_KEY>
                                       |  Payload: JSON { deviceId, temp, hum, sensors }
                                       v
+-----------------------------------------------------------------------------------+
|                              SERVER & GATEWAY LAYER                               |
|                                                                                   |
|  +-----------------------------------------------------------------------------+  |
|  |                             Express.js Server                               |  |
|  |                                                                             |  |
|  |  +---------------------+  +----------------------+  +--------------------+  |  |
|  |  | Rate Limiter        |  | Device Auth Guard    |  | Payload Validation |  |  |
|  |  | 600 req/min for IoT |  | verifyDeviceApiKey   |  | Bounds & Types     |  |  |
|  |  +----------+----------+  +----------+-----------+  +---------+----------+  |  |
|  |             |                        |                        |             |  |
|  |             +------------------------+------------------------+             |  |
|  |                                      |                                      |  |
|  |                                      v                                      |  |
|  |                    +------------------------------------+                   |  |
|  |                    | Autonomous Alert Rules Engine      |                   |  |
|  |                    | Compares Sensor Values vs Limits   |                   |  |
|  |                    | 5-Min Cooldown & Deduplication     |                   |  |
|  |                    +-----------------+------------------+                   |  |
|  +--------------------------------------|--------------------------------------+  |
+-----------------------------------------|-----------------------------------------+
                    |                     |                     |
                    v                     v                     v
+-----------------------------+ +-------------------+ +-----------------------------+
|      PERSISTENCE LAYER      | | REAL-TIME ENGINE  | |      CLIENT INTERFACE       |
|                             | |                   | |                             |
|  MongoDB Atlas              | | Socket.IO Server  | | React 18 + Vite + Tailwind  |
|  - Users (bcrypt / JWT)     | |                   | |                             |
|  - Devices (API Keys, State)| | Events:           | | - Live Sensor Gauges        |
|  - SensorReadings           | | - sensor:reading  | | - Real-Time Socket Stream   |
|    Index: {deviceId, ts}    | | - device:status   | | - Incident Triage Queue     |
|  - AlertRules               | | - alert:new       | | - Recharts Analytics Graphs |
|  - Alerts (Incident Audits) | | - alert:updated   | | - CSV Telemetry Export      |
+-----------------------------+ +-------------------+ +-----------------------------+
```

---

## 2. Hardware Edge Layer

### Microcontroller: NodeMCU ESP8266 (ESP-12E)
- **Core Processor**: Tensilica Xtensa L106 32-bit RISC running at 80MHz.
- **Operating Voltage**: 3.3V logic (powered via USB 5V VIN with onboard LD1117 regulator).
- **Wi-Fi Transceiver**: 802.11 b/g/n supporting WPA/WPA2 Personal encryption.
- **Transceiver Mode**: Station (STA) mode connecting to facility Wi-Fi.

### Connected Peripherals & Pinouts
| Peripheral Module | Physical Pin | ESP8266 Pin | Interface Type | Electrical Specification |
| :--- | :--- | :--- | :--- | :--- |
| **DHT11 / DHT22** | DATA | **D2 (GPIO4)** | 1-Wire Digital Bus | 3.3V pull-up; samples 0–50°C and 20–90% RH |
| **MQ-2 / MQ-135** | AOUT | **A0 (ADC0)** | Analog Voltage | 0–1.0V max ADC range; 10-bit resolution (0–1023) |
| **Flame IR Sensor**| DOUT | **D1 (GPIO5)** | Digital Active-Low | Pull-up; drops to 0V (LOW) when 760–1100nm IR flame detected |
| **Power Supply** | VIN / GND | **VIN / GND** | DC Power Rail | 5V regulated DC input from micro-USB |

---

## 3. Communication & Ingestion Protocol

Edge nodes submit sensor telemetry over standard HTTP/1.1 REST using JSON:

- **Endpoint**: `POST /api/iot/readings`
- **Required Header**: `x-api-key: <DEVICE_SECRET_KEY>`
- **Content-Type**: `application/json`

### Payload Schema
```json
{
  "deviceId": "RESQ-NODE-01",
  "temperature": 24.5,
  "humidity": 48.0,
  "sensors": {
    "gas": 72,
    "flame": false
  },
  "rssi": -58,
  "firmwareVersion": "1.2.0-esp8266",
  "timestamp": "2026-10-29T09:30:00.000Z"
}
```

### Device Authentication & Heartbeat Lifecycle
1. The `verifyDeviceApiKey` middleware inspects `x-api-key`.
2. The database checks if `Device.findOne({ deviceId })` exists, is active (`isActive: true`), and has a matching cryptographic key.
3. Upon validation, the device's `lastSeenAt` timestamp is updated to the current time and its `status` is marked `'online'`.
4. A background server job scans devices every 15 seconds. Any device whose `lastSeenAt` is older than `DEVICE_OFFLINE_THRESHOLD_MS` (default: 60 seconds) is automatically marked `'offline'` and a `device:status` broadcast is emitted to all dashboards.

---

## 4. Alert Evaluation & Incident Triage Engine

ResQ implements an autonomous server-side rules engine (`alertService.js`):

1. **Threshold Comparison**: The engine queries active rules for the device or wildcard `'ALL'`. Supported operators include `>`, `>=`, `<`, `<=`, `==`, `!=`.
2. **Alert Flooding Prevention (Cooldown)**: To prevent an ongoing hazard (e.g. fire burning for 10 minutes) from generating thousands of duplicate notifications, the rule engine checks `cooldownMinutes` (default: 5 minutes). If an active alert for the same device and sensor condition is already open within the cooldown window, duplicate generation is suppressed.
3. **Audit Trail**: Every incident records the triggering reading value, the rule threshold, and user IDs for acknowledgment (`acknowledgedBy`) and resolution (`resolvedBy`).

---

## 5. Persistence Strategy & MongoDB Indexes

All sensor telemetry is written to an independent `SensorReading` collection rather than embedded arrays:

```javascript
// Compound Indexes
sensorReadingSchema.index({ deviceId: 1, timestamp: -1 });
sensorReadingSchema.index({ timestamp: -1 });
sensorReadingSchema.index({ isSimulated: 1, timestamp: -1 });

// Alert Indexes
alertSchema.index({ status: 1, severity: 1, timestamp: -1 });
alertSchema.index({ deviceId: 1, timestamp: -1 });
```

---

## 6. Real-Time WebSocket Pipeline

The Socket.IO engine maintains persistent bidirectional channels:
- `sensor:reading`: Broadcasts whenever telemetry is saved. Clients subscribed to specific rooms (`device:<DEVICE_ID>`) receive targeted packets.
- `device:status`: Broadcasts when a device transitions between online and offline.
- `alert:new`: Broadcasts when a safety threshold is breached.
- `alert:updated`: Broadcasts when an operator acknowledges or resolves an incident.
- `simulation:status`: Broadcasts when demo simulation is enabled or when an emergency hazard scenario is triggered.
