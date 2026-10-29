import React from 'react';
import {
  Cpu,
  Server,
  Database,
  Radio,
  Shield,
  Layers,
  ArrowRight,
  Code2,
  Terminal,
  Activity,
  CheckCircle2,
  Network,
} from 'lucide-react';

const ArchitecturePage = () => {
  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Page Title */}
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">System Architecture & Technical Specifications</h1>
        <p className="text-xs text-slate-500 mt-1">
          Detailed technical documentation of the 7 hardware, communication, persistence, and interface layers powering ResQ.
        </p>
      </div>

      {/* Layer 1: Physical Hardware & Sensors */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-card space-y-4">
        <div className="flex items-center gap-2.5 text-teal-700 font-bold text-sm">
          <Cpu className="w-5 h-5" />
          <span>Layer 1: Physical Hardware & Sensor Interface</span>
        </div>
        <p className="text-xs text-slate-600 leading-relaxed">
          The physical hardware edge consists of the NodeMCU v3 board powered by the Espressif ESP8266 (ESP-12E) SoC. The microcontroller features an integrated 32-bit Tensilica L106 processor operating at 80MHz with 4MB SPI Flash memory and an onboard 2.4GHz Wi-Fi transceiver.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
            <span className="font-bold text-xs text-slate-900 block">DHT11 / DHT22 Sensor</span>
            <span className="font-mono text-[11px] text-teal-700 block mt-0.5">GPIO4 (D2 Pin) • 1-Wire Bus</span>
            <p className="text-[11px] text-slate-500 mt-1">
              Measures temperature (0°C to 50°C ±2°C) and relative humidity (20% to 90% ±5% RH) using custom capacitive sensing.
            </p>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
            <span className="font-bold text-xs text-slate-900 block">MQ-2 Gas / Smoke Sensor</span>
            <span className="font-mono text-[11px] text-teal-700 block mt-0.5">ADC0 (A0 Pin) • 10-Bit ADC</span>
            <p className="text-[11px] text-slate-500 mt-1">
              Measures combustible gases (LPG, propane, methane, hydrogen, smoke) with an analog voltage ranging from 0V to 1.0V (0 to 1023 ADC).
            </p>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
            <span className="font-bold text-xs text-slate-900 block">Optical Flame Detector</span>
            <span className="font-mono text-[11px] text-teal-700 block mt-0.5">GPIO5 (D1 Pin) • Active-Low</span>
            <p className="text-[11px] text-slate-500 mt-1">
              High-sensitivity YG1006 photodiode sensitive to infrared wavelengths (760nm–1100nm). Digital output drops LOW when flame is present.
            </p>
          </div>
        </div>
      </div>

      {/* Layer 2: Ingestion Protocol & Authentication */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-card space-y-4">
        <div className="flex items-center gap-2.5 text-teal-700 font-bold text-sm">
          <Radio className="w-5 h-5" />
          <span>Layer 2: Communication Protocol & Device Authentication</span>
        </div>
        <p className="text-xs text-slate-600 leading-relaxed">
          The ESP8266 connects to the local 802.11 b/g/n Wi-Fi access point and submits HTTP POST telemetry packets every 3000ms using the Arduino ESP8266HTTPClient library. Security and authenticity are enforced via cryptographic device-specific API keys.
        </p>

        <div className="bg-slate-950 p-4 rounded-xl text-slate-200 font-mono text-xs overflow-x-auto border border-slate-800 space-y-1">
          <div className="text-teal-400 font-bold">// HTTP Request Header & Payload Specification</div>
          <div>POST /api/iot/readings HTTP/1.1</div>
          <div>Host: 192.168.1.100:5000</div>
          <div>Content-Type: application/json</div>
          <div className="text-amber-400">x-api-key: resq_dev_node01_alpha_9882a1</div>
          <div className="text-slate-400 mt-2">
            &#123; "deviceId": "RESQ-NODE-01", "temperature": 24.5, "humidity": 48.0, "sensors": &#123; "gas": 72, "flame": false &#125; &#125;
          </div>
        </div>
      </div>

      {/* Layer 3: Backend Gateway & Rules Engine */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-card space-y-4">
        <div className="flex items-center gap-2.5 text-teal-700 font-bold text-sm">
          <Server className="w-5 h-5" />
          <span>Layer 3: Express.js REST Gateway & Autonomous Rules Engine</span>
        </div>
        <p className="text-xs text-slate-600 leading-relaxed">
          The Node.js server validates incoming payloads through verifyDeviceApiKey middleware. Valid packets update the device status to 'online' and refresh its lastSeenAt heartbeat. If a device fails to ping within the configurable 60-second threshold, a background heartbeat monitor automatically transitions the device to 'offline'.
        </p>

        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
          <h4 className="font-bold text-slate-900">Alert Rules Engine & Deduplication Algorithm:</h4>
          <ol className="list-decimal list-inside space-y-1 text-slate-600 text-[11px]">
            <li>Extract sensor values (temperature, humidity, gas, flame) from parsed payload.</li>
            <li>Query enabled AlertRules targeting this device or 'ALL' devices.</li>
            <li>Evaluate operators: &gt;, &gt;=, &lt;, &lt;=, ==, != against threshold parameters.</li>
            <li>Check active alert history against rule cooldown (default: 5 minutes) to prevent notification storms.</li>
            <li>If condition is breached and outside cooldown, create new Alert document in MongoDB and push over Socket.IO.</li>
          </ol>
        </div>
      </div>

      {/* Layer 4: Persistence & Indexing */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-card space-y-4">
        <div className="flex items-center gap-2.5 text-teal-700 font-bold text-sm">
          <Database className="w-5 h-5" />
          <span>Layer 4: MongoDB Atlas Persistence & Time-Series Indexing</span>
        </div>
        <p className="text-xs text-slate-600 leading-relaxed">
          Rather than placing unlimited telemetry arrays inside a single document, ResQ stores each telemetry reading in an isolated SensorReading collection. To guarantee sub-millisecond query execution as data scales to millions of records, compound B-tree indexes are defined:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <span className="font-bold text-teal-700 block">&#123; deviceId: 1, timestamp: -1 &#125;</span>
            <span className="text-[11px] text-slate-500 font-sans mt-1 block">
              Optimizes device-specific historical telemetry charts and pagination.
            </span>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <span className="font-bold text-teal-700 block">&#123; status: 1, severity: 1, timestamp: -1 &#125;</span>
            <span className="text-[11px] text-slate-500 font-sans mt-1 block">
              Accelerates operator incident triage queue and active alerts counter.
            </span>
          </div>
        </div>
      </div>

      {/* Layer 5: Real-Time WebSockets */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-card space-y-4">
        <div className="flex items-center gap-2.5 text-teal-700 font-bold text-sm">
          <Radio className="w-5 h-5" />
          <span>Layer 5: Socket.IO Full-Duplex Real-Time Broadcast Pipeline</span>
        </div>
        <p className="text-xs text-slate-600 leading-relaxed">
          The Socket.IO engine establishes persistent WebSocket connections with browser clients, falling back to HTTP long-polling when proxies require. Dashboards join specific device channels (device:RESQ-NODE-01) or receive global incident broadcasts:
        </p>

        <div className="overflow-x-auto border border-slate-200 rounded-xl text-xs">
          <table className="w-full text-left">
            <thead className="bg-slate-100 text-slate-600 font-semibold text-[11px] uppercase">
              <tr>
                <th className="p-2.5 px-3">Event Name</th>
                <th className="p-2.5 px-3">Payload Structure</th>
                <th className="p-2.5 px-3">Client Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
              <tr>
                <td className="p-2.5 px-3 text-teal-700 font-bold">sensor:reading</td>
                <td className="p-2.5 px-3 text-slate-600">&#123; deviceId, temp, hum, gas, flame, ts &#125;</td>
                <td className="p-2.5 px-3 text-slate-800 font-sans">Updates live gauge widgets and time-series graphs</td>
              </tr>
              <tr>
                <td className="p-2.5 px-3 text-teal-700 font-bold">device:status</td>
                <td className="p-2.5 px-3 text-slate-600">&#123; deviceId, status: "online" | "offline" &#125;</td>
                <td className="p-2.5 px-3 text-slate-800 font-sans">Toggles device connectivity status pills</td>
              </tr>
              <tr>
                <td className="p-2.5 px-3 text-rose-600 font-bold">alert:new</td>
                <td className="p-2.5 px-3 text-slate-600">&#123; id, title, severity, value, threshold &#125;</td>
                <td className="p-2.5 px-3 text-slate-800 font-sans">Renders incident banner and increments bell badge</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ArchitecturePage;
