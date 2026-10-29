# ResQ — Smart IoT Emergency Monitoring & Response Platform

[![Status](https://img.shields.io/badge/Status-Production%20Ready-teal.svg)](#)
[![Stack](https://img.shields.io/badge/Stack-MERN%20%2B%20ESP8266%20%2B%20Socket.IO-slate.svg)](#)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](#)

ResQ is an enterprise-grade IoT platform built to ingest live sensor streams from physical **NodeMCU/ESP8266** edge microcontrollers, evaluate hazardous environmental conditions (fire, toxic gas, thermal spikes), prevent alert flooding through intelligent cooldowns, and empower safety teams with real-time incident triage and historical analytics.

---

## 🌟 Key Platform Capabilities

1. **Hardware-Authentic Ingestion**: Native REST ingestion endpoint (`POST /api/iot/readings`) secured by device-specific API keys.
2. **Autonomous Alert Rules Engine**: Real-time evaluation of sensor thresholds (e.g. Temperature > 50°C, Gas > 300 PPM, Flame == true) with configurable 5-minute deduplication cooldowns.
3. **Full-Duplex WebSockets**: Sub-second telemetry push powered by Socket.IO without polling or page reloads.
4. **Human-in-the-Loop Incident Triage**: Strict distinction between automated sensor detections and operator-acknowledged incidents with timestamped audit notes.
5. **Interactive Hardware Simulator**: Built-in simulator with scenario controls (Nominal, Fire Emergency, Combustible Gas Leak, Elevated Heat) to demonstrate the platform when physical hardware is not plugged in.
6. **Zero-Setup Local Database Fallback**: Automatically initializes an embedded in-memory MongoDB instance for immediate local testing if no external MongoDB URI is supplied, with out-of-the-box support for remote MongoDB Atlas.

---

## 🏗️ System Architecture & Data Pipeline

```
IoT Sensors (DHT11, MQ-2, Flame IR)
    │
    ▼ (1-Wire, ADC0, GPIO)
NodeMCU ESP8266 Microcontroller
    │
    ▼ (HTTP POST /api/iot/readings with x-api-key)
Express.js Backend Gateway
    │
    ├─► MongoDB Atlas (Time-Series Collections & Compound Indexes)
    ├─► Alert Rules Engine (Thresholds, Cooldown Deduplication)
    └─► Socket.IO Server (Real-Time Broadcast: sensor:reading, alert:new)
            │
            ▼ (WebSocket Push)
React 18 + Vite Operator Dashboard (Live Gauges, Incident Queue, Recharts)
```

---

## 🛠️ Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Edge Hardware** | NodeMCU ESP8266 (ESP-12E), DHT11/22, MQ-2/135, Optical Flame Sensor |
| **Frontend** | React 18, Vite, Tailwind CSS, React Router v6, Recharts, Lucide React, Socket.IO Client |
| **Backend** | Node.js, Express.js, Socket.IO, Helmet, CORS, Express-Rate-Limit, Express-Validator |
| **Persistence** | MongoDB Atlas with Mongoose ORM (plus Embedded In-Memory fallback) |
| **Security** | JWT Authentication, Bcrypt Password Hashing, Device API Keys |

---

## 🚀 Quick Start Guide

### Prerequisites
- **Node.js** v18+ (tested on v24.20.0)
- **npm** v9+

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/your-org/resq.git
cd resq

# Install dependencies for both backend and frontend
npm run install:all
```

### 2. Environment Configuration
The repository includes `.env.example` templates in both `server/` and `client/`:

```bash
# Server configuration (server/.env)
PORT=5000
NODE_ENV=development
MONGODB_URI= # Leave empty to use auto-started embedded MongoDB
JWT_SECRET=resq_emergency_iot_jwt_super_secret_key_2026
CORS_ORIGIN=http://localhost:5173,http://localhost:3000
DEVICE_OFFLINE_THRESHOLD_MS=60000
```

### 3. Seed Development Database
Populate default administrators, safety operators, sample devices, alert rules, and 7 days of historical telemetry:

```bash
npm run seed
```

Default credentials created by the seed routine:
- **System Admin**: `admin@resq.internal` / `adminPassword123!`
- **Safety Operator**: `operator@resq.internal` / `operatorPassword123!`

### 4. Run the Application

In terminal 1 (start backend server):
```bash
npm run server
```
Server starts on `http://localhost:5000` with WebSocket support.

In terminal 2 (start React client):
```bash
npm run client
```
Client runs on `http://localhost:5173` with automated proxying to the server.

---

## 🤖 Running Hardware & Demonstrations

### Option A: Physical NodeMCU ESP8266
1. Open `docs/esp8266-integration.md`.
2. Copy the Arduino C++ sketch into the Arduino IDE.
3. Configure your local Wi-Fi SSID and password.
4. Set `RESQ_SERVER_URL` to `http://<YOUR_LAN_IP>:5000/api/iot/readings`.
5. Flash the sketch to your NodeMCU board.

### Option B: Built-in Interactive Simulator
1. Open the dashboard at `http://localhost:5173/dashboard`.
2. In the top navigation bar, click **"Start Demo Sim"**.
3. Use the dropdown arrow next to the simulator button to trigger real-time emergency hazard scenarios:
   - **Fire & Flame Emergency** (Spikes temperature to 68°C, gas to 450 PPM, flame detected)
   - **Combustible Gas / Smoke Leak** (Spikes gas above 380 PPM)
   - **High Temperature Breach** (Spikes temperature above 54°C)
   - **Nominal Normal Conditions** (Restores baseline readings)

### Option C: Standalone CLI Hardware Simulator
Run the standalone Node.js script that behaves exactly like an external hardware device sending HTTP POST packets every 3 seconds:
```bash
npm run simulate
```

---

## 🧪 Automated Testing

ResQ includes automated unit and integration tests covering the health endpoint, JWT authentication, device registration, API key enforcement, and alert triggering:

```bash
npm test
```

---

## 📚 Project Documentation

Comprehensive documentation is provided in the `docs/` directory:
- [System Architecture & Data Pipeline](docs/architecture.md)
- [REST API Specifications & Schemas](docs/api-documentation.md)
- [ESP8266 Hardware Firmware & Pinout Guide](docs/esp8266-integration.md)

---

## 🌐 Production Deployment

### 1. Database (MongoDB Atlas)
- Create a free M0 cluster on [MongoDB Atlas](https://www.mongodb.com/atlas).
- Set `MONGODB_URI` in `server/.env` to your connection string.

### 2. Backend (Render / Railway)
- Deploy the `server/` directory as a Web Service.
- Set environment variables (`PORT`, `MONGODB_URI`, `JWT_SECRET`, `CORS_ORIGIN`).

### 3. Frontend (Vercel / Netlify)
- Deploy the `client/` directory with build command `npm run build` and output directory `dist`.
- Set `VITE_API_BASE_URL` and `VITE_SOCKET_URL` to your backend production URL.

---

## 📄 License
MIT License. Built for industrial safety and resilient IoT monitoring.
