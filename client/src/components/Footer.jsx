import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, Cpu, Activity, Github, Terminal, HardDrive } from 'lucide-react';

const Footer = () => {
  return (
    <footer className="bg-slate-900 text-slate-400 text-sm border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Brand Col */}
          <div className="space-y-4 md:col-span-1">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-teal-500 text-slate-950 flex items-center justify-center font-bold">
                <ShieldAlert className="w-5 h-5 text-slate-900" />
              </div>
              <span className="font-bold text-white text-lg tracking-tight">ResQ</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Full-stack IoT emergency monitoring and incident response platform. Telemetry ingestion from NodeMCU ESP8266 nodes with automated hazard evaluation.
            </p>
            <div className="flex items-center gap-2 text-xs text-teal-400 bg-teal-950/60 border border-teal-800/60 rounded-md px-2.5 py-1 w-fit">
              <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse"></span>
              <span>Telemetry Engine Online</span>
            </div>
          </div>

          {/* Platform Nav */}
          <div>
            <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider mb-3">Platform</h3>
            <ul className="space-y-2 text-xs">
              <li><Link to="/dashboard" className="hover:text-teal-400 transition-colors">Overview Console</Link></li>
              <li><Link to="/dashboard/monitoring" className="hover:text-teal-400 transition-colors">Live Sensor Streams</Link></li>
              <li><Link to="/dashboard/devices" className="hover:text-teal-400 transition-colors">Node Registry</Link></li>
              <li><Link to="/dashboard/alerts" className="hover:text-teal-400 transition-colors">Incident Queue</Link></li>
              <li><Link to="/dashboard/analytics" className="hover:text-teal-400 transition-colors">Historical Analytics</Link></li>
            </ul>
          </div>

          {/* Architecture & Hardware */}
          <div>
            <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider mb-3">System & Tech</h3>
            <ul className="space-y-2 text-xs">
              <li><Link to="/how-it-works" className="hover:text-teal-400 transition-colors">Data Flow Pipeline</Link></li>
              <li><Link to="/about" className="hover:text-teal-400 transition-colors">Hardware & Limitations</Link></li>
              <li><Link to="/dashboard/architecture" className="hover:text-teal-400 transition-colors">ESP8266 Pinout & Specs</Link></li>
              <li><span className="text-slate-500">NodeMCU / ESP8266 Firmware</span></li>
              <li><span className="text-slate-500">DHT11/22, MQ-2, Flame IR</span></li>
            </ul>
          </div>

          {/* Project Details */}
          <div>
            <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider mb-3">Project Architecture</h3>
            <div className="space-y-2 text-xs text-slate-400">
              <p>Stack: React, Vite, Tailwind, Express.js, MongoDB Atlas, Socket.IO.</p>
              <p>API Protocols: HTTP/REST, WebSocket real-time telemetry broadcast.</p>
              <div className="pt-2">
                <span className="text-[11px] text-slate-500 block">Version 1.0.0 (Production Build)</span>
                <span className="text-[11px] text-slate-500 block">Autonomous Hazard Evaluation Core</span>
              </div>
            </div>
          </div>
        </div>

        <div className="pt-8 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>© {new Date().getFullYear()} ResQ Emergency Monitoring Systems. Built for resilient IoT safety.</p>
          <div className="flex items-center gap-4">
            <span className="text-slate-400">Node.js + React + ESP8266 MERN Architecture</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
