# ResQ REST API Documentation

Base URL: `http://localhost:5000/api` (Development) or your deployed production domain.

---

## 1. Authentication APIs

### Register User
- **Method**: `POST`
- **Route**: `/api/auth/register`
- **Access**: Public
- **Body**:
  ```json
  {
    "name": "Sarah Connor",
    "email": "sarah@resq.internal",
    "password": "securePassword123!",
    "role": "user"
  }
  ```
- **Response**: `201 Created`
  ```json
  {
    "success": true,
    "token": "eyJhbGciOi...",
    "user": {
      "id": "6720abc...",
      "name": "Sarah Connor",
      "email": "sarah@resq.internal",
      "role": "user",
      "createdAt": "2026-10-29T09:00:00.000Z"
    }
  }
  ```

### Login User
- **Method**: `POST`
- **Route**: `/api/auth/login`
- **Access**: Public
- **Body**:
  ```json
  {
    "email": "admin@resq.internal",
    "password": "adminPassword123!"
  }
  ```
- **Response**: `200 OK`

### Get Current User Profile
- **Method**: `GET`
- **Route**: `/api/auth/me`
- **Access**: Private (Requires `Authorization: Bearer <token>`)

### Update Profile
- **Method**: `PATCH`
- **Route**: `/api/auth/profile`
- **Access**: Private
- **Body**:
  ```json
  {
    "name": "Updated Name",
    "currentPassword": "oldPassword",
    "newPassword": "newPassword123!"
  }
  ```

---

## 2. IoT Telemetry Ingestion APIs

### Post Sensor Telemetry (NodeMCU / ESP8266)
- **Method**: `POST`
- **Route**: `/api/iot/readings`
- **Access**: Device Authenticated (Requires Header `x-api-key: <device_key>`)
- **Headers**:
  - `Content-Type: application/json`
  - `x-api-key: resq_dev_node01_alpha_9882a1`
- **Body**:
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
- **Response**: `201 Created`
  ```json
  {
    "success": true,
    "message": "Telemetry reading recorded successfully",
    "readingId": "6720b0f...",
    "alertsTriggered": 0,
    "alerts": []
  }
  ```

### Get Device Historical Telemetry
- **Method**: `GET`
- **Route**: `/api/iot/devices/:deviceId/readings`
- **Access**: Private (Bearer Token)
- **Query Params**:
  - `limit`: Integer (Default 50, Max 500)
  - `page`: Integer (Default 1)
  - `from`: ISO Date String
  - `to`: ISO Date String

---

## 3. Devices Management APIs

### List All Devices
- **Method**: `GET`
- **Route**: `/api/devices`
- **Access**: Private
- **Query Params**: `status` (`online` | `offline`), `search` (text)

### Get Single Device
- **Method**: `GET`
- **Route**: `/api/devices/:id`
- **Access**: Private

### Register Device
- **Method**: `POST`
- **Route**: `/api/devices`
- **Access**: Private
- **Body**:
  ```json
  {
    "deviceId": "RESQ-NODE-04",
    "name": "Lithium Battery Enclosure",
    "location": "North Substation",
    "deviceType": "NodeMCU ESP8266",
    "supportedSensors": ["temperature", "humidity", "gas", "flame"]
  }
  ```

### Regenerate Device API Key
- **Method**: `POST`
- **Route**: `/api/devices/:id/regenerate-key`
- **Access**: Private

### Delete Device
- **Method**: `DELETE`
- **Route**: `/api/devices/:id`
- **Access**: Private (Admin Only)

---

## 4. Alerts & Incidents APIs

### Get Incidents
- **Method**: `GET`
- **Route**: `/api/alerts`
- **Access**: Private
- **Query Params**:
  - `status`: `active` | `acknowledged` | `resolved` | `all`
  - `severity`: `warning` | `critical`
  - `deviceId`: String

### Acknowledge Alert Incident
- **Method**: `PATCH`
- **Route**: `/api/alerts/:id/acknowledge`
- **Access**: Private
- **Body**:
  ```json
  {
    "note": "Operator dispatched to inspect high heat readings."
  }
  ```

### Resolve Alert Incident
- **Method**: `PATCH`
- **Route**: `/api/alerts/:id/resolve`
- **Access**: Private
- **Body**:
  ```json
  {
    "note": "Cooling unit restored. Ambient temperature normalized to 23°C."
  }
  ```

### List Alert Rules
- **Method**: `GET`
- **Route**: `/api/alerts/rules/all`
- **Access**: Private

### Create Alert Rule
- **Method**: `POST`
- **Route**: `/api/alerts/rules`
- **Access**: Private
- **Body**:
  ```json
  {
    "name": "High Heat Hazard",
    "deviceId": "ALL",
    "sensorType": "temperature",
    "operator": ">",
    "thresholdValue": 45,
    "severity": "critical",
    "cooldownMinutes": 5
  }
  ```

---

## 5. Analytics APIs

### Get Overview Statistics
- **Method**: `GET`
- **Route**: `/api/analytics/overview`
- **Access**: Private
- **Returns**: Total devices, online count, active incidents, readings received today.

### Get Historical Sensor Data for Charts
- **Method**: `GET`
- **Route**: `/api/analytics/readings`
- **Access**: Private
- **Query Params**: `range` (`1h`, `24h`, `7d`, `30d`), `deviceId` (`ALL` or ID)

### Export CSV Telemetry
- **Method**: `GET`
- **Route**: `/api/analytics/export-csv`
- **Access**: Private
- **Query Params**: `range`, `deviceId`
- **Returns**: CSV file attachment with RFC 4180 headers.

---

## 6. Simulation & Health APIs

### Health Check
- **Method**: `GET`
- **Route**: `/api/health`
- **Access**: Public
- **Returns**: Status, timestamp, uptime, environment, version.

### Toggle Simulation
- **Method**: `POST`
- **Route**: `/api/simulation/toggle`
- **Access**: Private
- **Body**: `{ "action": "start" | "stop", "interval": 3000 }`

### Trigger Emergency Hazard Scenario
- **Method**: `POST`
- **Route**: `/api/simulation/scenario`
- **Access**: Private
- **Body**: `{ "scenario": "fire_hazard" | "gas_leak" | "high_heat" | "nominal" }`
