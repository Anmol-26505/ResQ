import React from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldAlert,
  Cpu,
  Server,
  Activity,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  FileText,
  ArrowRight,
  Info,
} from 'lucide-react';

const AboutPage = () => {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
      {/* Page Header */}
      <div className="border-b border-slate-200 pb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-50 border border-teal-200 text-teal-800 text-xs font-semibold mb-3">
          <Info className="w-3.5 h-3.5" />
          <span>Project Specifications & Scope</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
          About the ResQ Emergency Platform
        </h1>
        <p className="mt-3 text-base text-slate-600 leading-relaxed">
          An architectural breakdown of the ResQ IoT safety system: its engineering motivations, hardware integration reality, software design choices, and real-world boundary conditions.
        </p>
      </div>

      {/* Problem Statement & Objectives */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-card space-y-4">
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">The Problem Statement</h2>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            In industrial enclosures, server racks, and chemical storage facilities, environmental hazards such as electrical fires, toxic gas leaks, and cooling breakdowns often begin as localized micro-anomalies. Traditional offline smoke alarms or periodic physical manual walkthroughs often fail to detect early thermal surges or low-concentration toxic vapor buildup until irreversible equipment damage or structural risk has already occurred.
          </p>
        </div>

        <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-card space-y-4">
          <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Project Objectives</h2>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            ResQ establishes an unbroken, real-time telemetry chain from low-cost NodeMCU ESP8266 microcontrollers to a centralized operator web console. The objective is continuous telemetry ingestion, automated rule-based evaluation, sub-second WebSocket hazard broadcasting, and a disciplined workflow for incident acknowledgment and resolution.
          </p>
        </div>
      </div>

      {/* Why IoT Monitoring is Useful */}
      <div className="bg-slate-900 text-white p-8 rounded-2xl border border-slate-800 space-y-6">
        <h2 className="text-xl font-bold">Why Edge IoT Monitoring is Essential</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-xs text-slate-300">
          <div className="p-4 bg-slate-800/60 rounded-xl border border-slate-700/60">
            <h3 className="font-semibold text-white text-sm mb-2">Zero Latency Telemetry</h3>
            <p>
              Sensor data captured directly at equipment surfaces is transmitted immediately over Wi-Fi without human dependency or delays.
            </p>
          </div>
          <div className="p-4 bg-slate-800/60 rounded-xl border border-slate-700/60">
            <h3 className="font-semibold text-white text-sm mb-2">Multi-Hazard Fusion</h3>
            <p>
              Simultaneous evaluation of temperature, humidity, gas concentration, and optical flame signatures prevents single-sensor false positives.
            </p>
          </div>
          <div className="p-4 bg-slate-800/60 rounded-xl border border-slate-700/60">
            <h3 className="font-semibold text-white text-sm mb-2">Audited Incident Record</h3>
            <p>
              Every emergency alert records exact sensor readings, trigger thresholds, timestamps, and operator acknowledgment notes for audit compliance.
            </p>
          </div>
        </div>
      </div>

      {/* Hardware & Software Components Breakdown */}
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-slate-900">Hardware & Software Specifications</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Hardware Column */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-card space-y-4">
            <div className="flex items-center gap-2 text-teal-700 font-bold text-sm">
              <Cpu className="w-4 h-4" />
              <span>Physical Hardware Layer</span>
            </div>
            <ul className="space-y-3 text-xs text-slate-600">
              <li className="flex items-start gap-2">
                <span className="font-bold text-slate-900 min-w-28">NodeMCU ESP8266:</span>
                <span>Tensilica L106 32-bit core running at 80MHz, integrated 802.11 b/g/n Wi-Fi transceiver with onboard PCB antenna.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-slate-900 min-w-28">DHT11 / DHT22:</span>
                <span>Capacitive humidity sensor & NTC thermistor providing calibrated digital output on 1-wire protocol.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-slate-900 min-w-28">MQ-2 / MQ-135:</span>
                <span>Metal oxide semiconductor gas sensor detecting LPG, propane, methane, hydrogen, and combustible smoke particles via ADC0.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-slate-900 min-w-28">Flame IR Sensor:</span>
                <span>YG1006 photodiode sensitive to infrared radiation in the 760nm–1100nm spectrum emitted by active fires.</span>
              </li>
            </ul>
          </div>

          {/* Software Column */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-card space-y-4">
            <div className="flex items-center gap-2 text-teal-700 font-bold text-sm">
              <Server className="w-4 h-4" />
              <span>Server & Client Software Stack</span>
            </div>
            <ul className="space-y-3 text-xs text-slate-600">
              <li className="flex items-start gap-2">
                <span className="font-bold text-slate-900 min-w-28">Express.js API:</span>
                <span>REST routing with rate limiting, input sanitization, and hardware API key validation via headers.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-slate-900 min-w-28">MongoDB & Mongoose:</span>
                <span>Compound time-series indexes on deviceId and timestamp for high-performance telemetry storage and analytical aggregations.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-slate-900 min-w-28">Socket.IO:</span>
                <span>WebSocket event broker streaming telemetry and real-time hazard triggers to authenticated clients without polling.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-slate-900 min-w-28">React + Tailwind:</span>
                <span>Human-designed responsive dashboard with live gauges, alert triage modals, Recharts graphs, and CSV export.</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Expected Outcomes and Real-World Limitations */}
      <div className="p-6 sm:p-8 bg-amber-50/70 border border-amber-200 rounded-2xl space-y-4">
        <div className="flex items-center gap-2 text-amber-900 font-bold text-base">
          <AlertTriangle className="w-5 h-5 text-amber-600" />
          <span>Real-World System Capabilities & Explicit Limitations</span>
        </div>
        <p className="text-xs sm:text-sm text-amber-950 leading-relaxed">
          In keeping with our engineering integrity principles, ResQ does not claim capabilities unsupported by our software and hardware architecture:
        </p>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-amber-900 pt-1">
          <li className="flex items-start gap-2">
            <span className="font-bold text-amber-950">• Sensor Preheating:</span>
            <span>MQ series gas sensors require a 20-30 second heater coil stabilization period after cold boot before ADC readings reach nominal baseline.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-bold text-amber-950">• Emergency Dispatch:</span>
            <span>ResQ provides an internal operator incident queue. It does NOT automatically place emergency calls to municipal fire services or 911/112 unless a third-party telephony webhook is configured.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-bold text-amber-950">• Network Availability:</span>
            <span>ESP8266 nodes require an active 2.4GHz 802.11 b/g/n Wi-Fi gateway. Devices that lose signal are flagged as "Offline" after 60 seconds of missed heartbeats.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-bold text-amber-950">• Human-in-the-Loop:</span>
            <span>Alerts are classified as automatically detected sensor conditions until verified and acknowledged by an authorized human operator.</span>
          </li>
        </ul>
      </div>

      {/* Next Link */}
      <div className="flex justify-between items-center pt-4 border-t border-slate-200">
        <Link to="/how-it-works" className="inline-flex items-center gap-2 text-teal-700 font-semibold text-sm hover:underline">
          <span>Read the Technical Data Flow</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
        <Link to="/dashboard" className="px-5 py-2.5 bg-teal-600 text-white rounded-lg text-xs font-semibold hover:bg-teal-700 transition-colors">
          Open Console
        </Link>
      </div>
    </div>
  );
};

export default AboutPage;
