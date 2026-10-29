import React from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldAlert,
  Activity,
  Flame,
  Wind,
  Cpu,
  ArrowRight,
  Database,
  Radio,
  Bell,
  LineChart,
  Server,
  Zap,
  CheckCircle2,
  Clock,
  ExternalLink,
} from 'lucide-react';

const HomePage = () => {
  const steps = [
    {
      num: '01',
      title: 'Sensor Acquisition',
      desc: 'DHT temperature/humidity, MQ gas sensors, and optical flame detectors capture environmental telemetry.',
      icon: Activity,
    },
    {
      num: '02',
      title: 'ESP8266 Edge Processing',
      desc: 'NodeMCU microcontroller samples signals, serializes JSON payloads, and authenticates via hardware API keys.',
      icon: Cpu,
    },
    {
      num: '03',
      title: 'Express REST Ingestion',
      desc: 'Node.js backend validates payload integrity, verifies device credentials, and timestamps telemetry packets.',
      icon: Server,
    },
    {
      num: '04',
      title: 'Persistence & Indexing',
      desc: 'MongoDB Atlas persists time-series readings with compound indexing for immediate query retrieval.',
      icon: Database,
    },
    {
      num: '05',
      title: 'Real-Time Broadcast',
      desc: 'Socket.IO streams incoming measurements instantaneously to connected safety operators without page reload.',
      icon: Radio,
    },
    {
      num: '06',
      title: 'Rule-Based Alerting',
      desc: 'Autonomous evaluation engine compares sensor readings with configured thresholds and triggers deduplicated alerts.',
      icon: Bell,
    },
    {
      num: '07',
      title: 'Incident Verification',
      desc: 'Authorized operators review, acknowledge, and resolve alerts with audit notes and status tracking.',
      icon: CheckCircle2,
    },
  ];

  const features = [
    {
      icon: Radio,
      title: 'Real-Time Telemetry Streaming',
      desc: 'Instant sensor updates delivered over WebSockets with live gauges, heartbeat monitoring, and device status tracking.',
    },
    {
      icon: Flame,
      title: 'Autonomous Hazard Detection',
      desc: 'Configurable rules for flame, hazardous gas, and thermal thresholds with cooldown controls to prevent alert flooding.',
    },
    {
      icon: Cpu,
      title: 'Hardware-Authentic Ingestion',
      desc: 'Compatible with NodeMCU ESP8266, ESP32, and Arduino Wi-Fi shields via secure per-device API keys and HTTPClient.',
    },
    {
      icon: LineChart,
      title: 'Historical Analytics & Export',
      desc: 'Comprehensive multi-sensor charts over 1h, 24h, 7d, and 30d timeframes with CSV download capabilities.',
    },
  ];

  const techStack = [
    { name: 'NodeMCU ESP8266', role: 'IoT Edge Transceiver', desc: 'Wi-Fi 802.11 b/g/n, 80MHz MCU, ADC0 & GPIO logic' },
    { name: 'Express & Node.js', role: 'Backend API Gateway', desc: 'Secure REST endpoints, rate limiting, and JWT auth' },
    { name: 'MongoDB Atlas', role: 'Telemetry Persistence', desc: 'Mongoose schemas with time-series compound indexing' },
    { name: 'Socket.IO', role: 'Real-Time Pipeline', desc: 'Bidirectional WebSocket event streaming with rooms' },
    { name: 'React + Vite', role: 'Operator Console', desc: 'Modular component architecture with responsive Tailwind UI' },
    { name: 'Recharts', role: 'Data Visualization', desc: 'Dynamic SVG sensor charts and incident breakdown graphs' },
  ];

  const useCases = [
    {
      title: 'Server Rooms & Data Centers',
      scenario: 'Early detection of cooling failures, electrical overheating, and smoke buildup in high-density server racks.',
    },
    {
      title: 'Hazardous Chemical Storage',
      scenario: 'Continuous monitoring of volatile organic vapors and combustible gas leaks near storage drums.',
    },
    {
      title: 'Boiler & Mechanical Plants',
      scenario: 'Monitoring boiler room exhaust temperatures, flame presence, and ambient carbon monoxide concentrations.',
    },
  ];

  return (
    <div className="space-y-20 pb-20">
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-16 lg:pt-20 lg:pb-24 border-b border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Left Column */}
            <div className="lg:col-span-7 space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-teal-50 border border-teal-200 text-teal-800 text-xs font-semibold">
                <span className="w-2 h-2 rounded-full bg-teal-600 animate-pulse"></span>
                <span>NodeMCU / ESP8266 Telemetry Engine</span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 tracking-tight leading-[1.15]">
                Smarter Monitoring.{' '}
                <span className="text-teal-600">Faster Emergency Response.</span>
              </h1>

              <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-2xl">
                ResQ is a production-quality IoT emergency monitoring platform designed to ingest physical sensor streams from NodeMCU/ESP8266 devices, evaluate hazardous conditions in real-time, and empower safety teams with actionable incident management.
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Link
                  to="/dashboard"
                  className="inline-flex items-center gap-2 px-6 py-3.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-sm font-semibold shadow-md shadow-teal-600/25 transition-all"
                >
                  <span>Explore Dashboard</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>

                <Link
                  to="/how-it-works"
                  className="inline-flex items-center gap-2 px-6 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-sm font-semibold transition-all"
                >
                  <span>How ResQ Works</span>
                </Link>
              </div>

              {/* Hardware trust indicators */}
              <div className="pt-4 flex flex-wrap items-center gap-6 text-xs text-slate-500 font-medium">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Real ESP8266 REST Ingestion</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Full-Duplex Socket.IO</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Zero-Fake Mock Data Policy</span>
                </div>
              </div>
            </div>

            {/* Right Column: Interactive Dashboard Live Mock Preview */}
            <div className="lg:col-span-5">
              <div className="bg-slate-900 rounded-2xl p-5 shadow-2xl border border-slate-800 text-white relative">
                {/* Header bar */}
                <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-rose-500/80"></span>
                    <span className="w-3 h-3 rounded-full bg-amber-500/80"></span>
                    <span className="w-3 h-3 rounded-full bg-emerald-500/80"></span>
                    <span className="ml-2 text-xs font-mono text-slate-400">RESQ-NODE-01 // TELEMETRY</span>
                  </div>
                  <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/80 border border-emerald-800/80 px-2 py-0.5 rounded">
                    ONLINE
                  </span>
                </div>

                {/* Sensor cards preview */}
                <div className="grid grid-cols-2 gap-3 my-4">
                  <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700/60">
                    <span className="text-[11px] text-slate-400">Ambient Temp</span>
                    <div className="text-2xl font-bold font-mono text-white mt-1">24.5 °C</div>
                    <span className="text-[10px] text-emerald-400">Normal Range (&lt; 36°C)</span>
                  </div>

                  <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700/60">
                    <span className="text-[11px] text-slate-400">Relative Humidity</span>
                    <div className="text-2xl font-bold font-mono text-white mt-1">48.2 %</div>
                    <span className="text-[10px] text-emerald-400">Optimal (30-60%)</span>
                  </div>

                  <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700/60">
                    <span className="text-[11px] text-slate-400">Gas Concentration</span>
                    <div className="text-2xl font-bold font-mono text-teal-400 mt-1">72 PPM</div>
                    <span className="text-[10px] text-slate-400">Threshold: 180 PPM</span>
                  </div>

                  <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700/60">
                    <span className="text-[11px] text-slate-400">Flame IR Sensor</span>
                    <div className="text-2xl font-bold font-mono text-emerald-400 mt-1">CLEAR</div>
                    <span className="text-[10px] text-emerald-400">No Flame Detected</span>
                  </div>
                </div>

                {/* Live stream ticker */}
                <div className="p-3 bg-slate-950/70 rounded-xl border border-slate-800/80 text-[11px] font-mono text-slate-400">
                  <div className="flex items-center justify-between text-slate-500 mb-1">
                    <span>INCOMING TELEMETRY STREAM</span>
                    <span className="text-teal-400">3000ms TICK</span>
                  </div>
                  <p className="text-slate-300 truncate">&gt; POST /api/iot/readings HTTP/1.1 201 Created</p>
                  <p className="text-emerald-400 truncate">&gt; Socket broadcast: sensor:reading -&gt; room:device:RESQ-NODE-01</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 7-Step Process Pipeline Flow */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <h2 className="text-xs font-bold text-teal-700 uppercase tracking-widest mb-2">End-to-End Architecture</h2>
          <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            How Telemetry Flows From Silicon to Screen
          </h3>
          <p className="mt-2 text-sm text-slate-600">
            A transparent 7-step pipeline connecting physical hardware sensors to real-time incident operators.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {steps.slice(0, 4).map((step) => {
            const Icon = step.icon;
            return (
              <div key={step.num} className="p-5 bg-white rounded-xl border border-slate-200 shadow-card hover:shadow-card-hover transition-all">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-mono font-bold text-teal-600 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                    Step {step.num}
                  </span>
                  <Icon className="w-5 h-5 text-slate-600" />
                </div>
                <h4 className="font-bold text-slate-900 text-sm mb-1.5">{step.title}</h4>
                <p className="text-xs text-slate-600 leading-relaxed">{step.desc}</p>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          {steps.slice(4, 7).map((step) => {
            const Icon = step.icon;
            return (
              <div key={step.num} className="p-5 bg-white rounded-xl border border-slate-200 shadow-card hover:shadow-card-hover transition-all">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-mono font-bold text-teal-600 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                    Step {step.num}
                  </span>
                  <Icon className="w-5 h-5 text-slate-600" />
                </div>
                <h4 className="font-bold text-slate-900 text-sm mb-1.5">{step.title}</h4>
                <p className="text-xs text-slate-600 leading-relaxed">{step.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Feature Cards Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-slate-900 text-white rounded-3xl p-8 sm:p-12 border border-slate-800">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-xs font-bold text-teal-400 uppercase tracking-widest mb-2">Core Capabilities</h2>
            <h3 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Engineered for Industrial Safety & Mission-Critical Reliability
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feat) => {
              const Icon = feat.icon;
              return (
                <div key={feat.title} className="p-5 bg-slate-800/60 rounded-2xl border border-slate-700/60 hover:border-teal-500/50 transition-colors">
                  <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/30 text-teal-400 flex items-center justify-center mb-4">
                    <Icon className="w-5 h-5" />
                  </div>
                  <h4 className="font-bold text-base mb-2 text-white">{feat.title}</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">{feat.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Technology Stack Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <h2 className="text-xs font-bold text-teal-700 uppercase tracking-widest mb-2">Technology Foundation</h2>
          <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Production-Grade MERN & Embedded IoT Stack
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {techStack.map((tech) => (
            <div key={tech.name} className="p-5 bg-white rounded-xl border border-slate-200 shadow-card">
              <span className="text-[10px] font-bold text-teal-700 uppercase tracking-wider">{tech.role}</span>
              <h4 className="text-base font-bold text-slate-900 mt-1 mb-1">{tech.name}</h4>
              <p className="text-xs text-slate-600 leading-relaxed">{tech.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Use Cases Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-teal-50/70 border border-teal-200/80 rounded-2xl p-8 sm:p-10">
          <div className="max-w-2xl mb-8">
            <h2 className="text-xs font-bold text-teal-800 uppercase tracking-widest mb-1">Target Scenarios</h2>
            <h3 className="text-2xl font-bold text-slate-900">Real-World Environmental Emergency Deployments</h3>
            <p className="text-xs text-slate-600 mt-1">
              Where temperature anomalies, gas buildup, and fire hazards demand rapid containment.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {useCases.map((uc) => (
              <div key={uc.title} className="bg-white p-6 rounded-xl border border-teal-100 shadow-sm">
                <h4 className="font-bold text-slate-900 text-sm mb-2">{uc.title}</h4>
                <p className="text-xs text-slate-600 leading-relaxed">{uc.scenario}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Ready to Launch Banner */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="p-8 sm:p-12 bg-slate-900 text-white rounded-2xl flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h3 className="text-2xl font-bold mb-2">Explore the Live Operator Dashboard</h3>
            <p className="text-xs text-slate-400 max-w-xl">
              Inspect registered ESP8266 nodes, stream live sensor readings, trigger simulated emergency hazard conditions, and acknowledge alerts.
            </p>
          </div>
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 px-6 py-3 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold rounded-xl text-sm transition-all shadow-md shadow-teal-500/20 whitespace-nowrap"
          >
            <span>Launch Dashboard</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </div>
  );
};

export default HomePage;
