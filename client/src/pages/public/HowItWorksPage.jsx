import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  Cpu,
  Server,
  Database,
  Radio,
  Bell,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  Code2,
  ExternalLink,
} from 'lucide-react';

const HowItWorksPage = () => {
  const [activeStep, setActiveStep] = useState(0);

  const steps = [
    {
      step: 1,
      name: 'Sensors Collect Measurements',
      summary: 'Analog & digital sensing of environmental conditions',
      details: 'Sensors wired to the microcontroller sample the immediate physical environment continuously. The DHT11/22 reads temperature in °C and relative humidity in %. The MQ-2/135 reads analog gas voltage on pin A0. The flame sensor photodiode evaluates optical IR emissions.',
      protocol: 'Analog ADC & 1-Wire Digital Bus',
      badge: 'Hardware Layer',
    },
    {
      step: 2,
      name: 'NodeMCU/ESP8266 Processes & Transmits',
      summary: 'JSON serialization & HTTP POST with device API key',
      details: 'The ESP8266 converts analog and digital readings into standard JSON. It attaches the unique hardware deviceId, firmware version, and RSSI signal strength, and delivers an HTTP POST request to /api/iot/readings with a secure x-api-key header.',
      protocol: 'HTTP/1.1 REST over 802.11 b/g/n Wi-Fi',
      badge: 'Edge Layer',
    },
    {
      step: 3,
      name: 'Express Backend Validates Data',
      summary: 'Device authentication, schema validation & rate limiting',
      details: 'The Node.js/Express gateway intercepts the packet. The verifyDeviceApiKey middleware checks the x-api-key against registered devices in MongoDB. If valid, payload bounds are checked and the device lastSeenAt timestamp is refreshed.',
      protocol: 'Node.js Express Middleware & Crypto Verification',
      badge: 'Gateway Layer',
    },
    {
      step: 4,
      name: 'MongoDB Stores Historical Telemetry',
      summary: 'Persisted in time-series collection with compound indexing',
      details: 'The reading is written to the SensorReading collection with fields for temperature, humidity, gas, flame, and timestamp. Compound indexes ensure sub-millisecond retrieval for dashboard charts and analytics queries.',
      protocol: 'MongoDB Atlas Wire Protocol with Mongoose ORM',
      badge: 'Persistence Layer',
    },
    {
      step: 5,
      name: 'Socket.IO Broadcasts Real-Time Updates',
      summary: 'Instant WebSocket push to all connected operators',
      details: 'Immediately upon saving, the server emits a sensor:reading event to connected browser clients and targeted device rooms. The client monitoring dashboard updates live gauges and telemetry graphs instantaneously without reloading.',
      protocol: 'WebSocket Bidirectional Transport (Socket.IO)',
      badge: 'Real-Time Layer',
    },
    {
      step: 6,
      name: 'Threshold Rules Trigger Incident Alerts',
      summary: 'Autonomous evaluation of safety limits & deduplication',
      details: 'The backend evaluates the reading against all enabled AlertRules (e.g. Flame == true, Temp > 50°C, Gas > 300 PPM). If violated, an Alert record is created and broadcast over WebSocket with a 5-minute cooldown to prevent flooding.',
      protocol: 'Server-side Rules Engine & Alert Cooldown Filter',
      badge: 'Alerting Layer',
    },
    {
      step: 7,
      name: 'Authorized Operators Review & Acknowledge',
      summary: 'Human-in-the-loop verification, notes & resolution',
      details: 'Safety officers receive instant audible and visual notifications. Operators review the reading, dispatch inspections, acknowledge the incident with response notes, and mark it resolved once physical safety is confirmed.',
      protocol: 'Authenticated REST PATCH /api/alerts/:id/resolve',
      badge: 'Incident Response',
    },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
      {/* Page Title */}
      <div className="border-b border-slate-200 pb-8 text-center max-w-3xl mx-auto">
        <span className="text-xs font-bold text-teal-700 uppercase tracking-widest bg-teal-50 px-3 py-1 rounded-full border border-teal-200">
          Technical Pipeline Architecture
        </span>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mt-3">
          How ResQ Works: From Silicon to Incident Resolution
        </h1>
        <p className="mt-3 text-sm text-slate-600 leading-relaxed">
          Follow the exact 7-stage data lifecycle that turns raw sensor voltage pulses into verified emergency incident responses.
        </p>
      </div>

      {/* Visual Step-by-Step Interactive Flow */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Stage Selector */}
        <div className="lg:col-span-5 space-y-2">
          {steps.map((s, idx) => (
            <button
              key={s.step}
              onClick={() => setActiveStep(idx)}
              className={`w-full text-left p-4 rounded-xl border transition-all flex items-start gap-3.5 ${
                activeStep === idx
                  ? 'bg-white border-teal-500 shadow-md ring-1 ring-teal-500/30'
                  : 'bg-white/60 border-slate-200 hover:bg-white hover:border-slate-300'
              }`}
            >
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center font-mono font-bold text-xs flex-shrink-0 mt-0.5 ${
                  activeStep === idx
                    ? 'bg-teal-600 text-white'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                0{s.step}
              </div>
              <div className="min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-xs font-bold text-slate-900 truncate">{s.name}</h3>
                  <span className="text-[10px] uppercase font-semibold text-teal-700 bg-teal-50 px-1.5 py-0.2 rounded border border-teal-100 flex-shrink-0">
                    {s.badge}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 truncate mt-0.5">{s.summary}</p>
              </div>
            </button>
          ))}
        </div>

        {/* Right Column: Active Stage Deep Dive */}
        <div className="lg:col-span-7 bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-card space-y-6 sticky top-24">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <span className="text-xs font-mono font-bold text-teal-600">STAGE 0{steps[activeStep].step} OF 07</span>
              <h2 className="text-xl font-bold text-slate-900 mt-1">{steps[activeStep].name}</h2>
            </div>
            <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-slate-100 text-slate-700 border border-slate-200">
              {steps[activeStep].badge}
            </span>
          </div>

          <div className="space-y-4">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Architectural Function</h3>
            <p className="text-sm text-slate-700 leading-relaxed">{steps[activeStep].details}</p>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Protocol & Transport Mechanism</span>
            <p className="font-mono text-xs font-semibold text-teal-800">{steps[activeStep].protocol}</p>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <button
              onClick={() => setActiveStep(prev => Math.max(0, prev - 1))}
              disabled={activeStep === 0}
              className="text-xs font-medium text-slate-600 disabled:opacity-30 hover:text-slate-900"
            >
              ← Previous Stage
            </button>

            <button
              onClick={() => setActiveStep(prev => Math.min(steps.length - 1, prev + 1))}
              disabled={activeStep === steps.length - 1}
              className="text-xs font-semibold text-teal-700 hover:text-teal-800 disabled:opacity-30 inline-flex items-center gap-1"
            >
              <span>Next Stage</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Visual System Architecture Diagram (CSS & SVG diagram) */}
      <div className="bg-slate-900 text-white p-6 sm:p-10 rounded-2xl border border-slate-800 space-y-8">
        <div>
          <span className="text-xs font-bold text-teal-400 uppercase tracking-widest">Topology & Node Communication</span>
          <h2 className="text-2xl font-bold mt-1">End-to-End System Topology Diagram</h2>
          <p className="text-xs text-slate-400 mt-1">
            Physical sensor peripherals to real-time browser WebSocket dispatch.
          </p>
        </div>

        {/* Responsive flowchart cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="p-4 bg-slate-800/80 rounded-xl border border-slate-700">
            <span className="text-[10px] text-teal-400 font-bold uppercase">1. Physical Edge</span>
            <h4 className="font-bold text-sm text-white mt-1">Sensors + NodeMCU</h4>
            <ul className="text-xs text-slate-400 mt-2 space-y-1">
              <li>• DHT11 (Temp/Hum)</li>
              <li>• MQ-2 (Gas/Smoke)</li>
              <li>• Flame IR Photodiode</li>
              <li>• ESP8266 Wi-Fi 802.11</li>
            </ul>
          </div>

          <div className="p-4 bg-slate-800/80 rounded-xl border border-slate-700">
            <span className="text-[10px] text-teal-400 font-bold uppercase">2. Ingestion Gateway</span>
            <h4 className="font-bold text-sm text-white mt-1">Express API Server</h4>
            <ul className="text-xs text-slate-400 mt-2 space-y-1">
              <li>• POST /api/iot/readings</li>
              <li>• Header: x-api-key check</li>
              <li>• Device status heartbeat</li>
              <li>• Rate-limiter (600/min)</li>
            </ul>
          </div>

          <div className="p-4 bg-slate-800/80 rounded-xl border border-slate-700">
            <span className="text-[10px] text-teal-400 font-bold uppercase">3. Real-Time & DB</span>
            <h4 className="font-bold text-sm text-white mt-1">MongoDB & Socket.IO</h4>
            <ul className="text-xs text-slate-400 mt-2 space-y-1">
              <li>• Time-series collection</li>
              <li>• Rule engine evaluation</li>
              <li>• Event: sensor:reading</li>
              <li>• Event: alert:new</li>
            </ul>
          </div>

          <div className="p-4 bg-slate-800/80 rounded-xl border border-slate-700">
            <span className="text-[10px] text-teal-400 font-bold uppercase">4. Human Console</span>
            <h4 className="font-bold text-sm text-white mt-1">React Dashboard</h4>
            <ul className="text-xs text-slate-400 mt-2 space-y-1">
              <li>• Live sensor gauges</li>
              <li>• Incident triage queue</li>
              <li>• Recharts analytics</li>
              <li>• CSV telemetry download</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HowItWorksPage;
