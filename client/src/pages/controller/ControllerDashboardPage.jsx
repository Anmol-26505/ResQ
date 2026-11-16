import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Flame,
  Droplets,
  Compass,
  Activity,
  Wind,
  Sliders,
  Shield,
  LogOut,
  ExternalLink,
  RefreshCw,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Radio,
  User,
  X,
  Volume2,
} from 'lucide-react';
import api from '../../services/api';
import { useSocket } from '../../context/SocketContext';

const HAZARDS = [
  {
    id: 'fire',
    name: 'FIRE',
    meaning: 'Fire detected',
    description: 'Optical flame & infrared thermal radiation signature',
    icon: Flame,
    color: 'rose',
    activeGradient: 'from-rose-600 to-red-700',
    ringColor: 'ring-rose-500/30 border-rose-500',
    activeBadge: 'bg-rose-500 text-white',
    activeText: 'text-rose-400',
  },
  {
    id: 'water',
    name: 'WATER',
    meaning: 'Water leakage detected',
    description: 'Floor liquid accumulation & moisture probe contact',
    icon: Droplets,
    color: 'cyan',
    activeGradient: 'from-cyan-600 to-blue-700',
    ringColor: 'ring-cyan-500/30 border-cyan-500',
    activeBadge: 'bg-cyan-500 text-white',
    activeText: 'text-cyan-400',
  },
  {
    id: 'tilt',
    name: 'TILT',
    meaning: 'Building tilt detected',
    description: 'Structural inclination exceeding safety baseline',
    icon: Compass,
    color: 'amber',
    activeGradient: 'from-amber-600 to-orange-700',
    ringColor: 'ring-amber-500/30 border-amber-500',
    activeBadge: 'bg-amber-500 text-white',
    activeText: 'text-amber-400',
  },
  {
    id: 'earthquake',
    name: 'EARTHQUAKE',
    meaning: 'Earthquake detected',
    description: 'High-energy seismic vibration & structural shockwaves',
    icon: Activity,
    color: 'purple',
    activeGradient: 'from-purple-600 to-indigo-700',
    ringColor: 'ring-purple-500/30 border-purple-500',
    activeBadge: 'bg-purple-500 text-white',
    activeText: 'text-purple-400',
  },
  {
    id: 'gas',
    name: 'GAS',
    meaning: 'Hazardous gas leakage detected',
    description: 'Combustible gas & smoke concentration spike in facility',
    icon: Wind,
    color: 'emerald',
    activeGradient: 'from-emerald-600 to-teal-700',
    ringColor: 'ring-emerald-500/30 border-emerald-500',
    activeBadge: 'bg-emerald-500 text-white',
    activeText: 'text-emerald-400',
  },
];

const ControllerDashboardPage = () => {
  const navigate = useNavigate();
  const { isConnected, manualHazards, manualHazardDetails, manualActiveCount, manualLastUpdated, refreshManualHazards } = useSocket();

  const [togglingHazard, setTogglingHazard] = useState(null);
  const [clearingAll, setClearingAll] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const [currentUser, setCurrentUser] = useState('Anmol');

  useEffect(() => {
    try {
      const stored = localStorage.getItem('resq_controller_user');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.username) setCurrentUser(parsed.username);
      }
    } catch (e) {
      // Ignore
    }
  }, []);

  const showToast = (message, type = 'info') => {
    setToastMessage({ message, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const handleToggleHazard = async (hazardId) => {
    const isCurrentlyActive = Boolean(manualHazards[hazardId]);
    setTogglingHazard(hazardId);

    try {
      if (isCurrentlyActive) {
        const res = await api.post('/controller/hazard/deactivate', { hazard: hazardId });
        if (res.data?.success) {
          showToast(`Deactivated ${hazardId.toUpperCase()} hazard alert.`, 'success');
        }
      } else {
        const res = await api.post('/controller/hazard/activate', { hazard: hazardId });
        if (res.data?.success) {
          showToast(`🚨 ACTIVATED ${hazardId.toUpperCase()} hazard alert! Broadcasted to all visitors.`, 'warning');
        }
      }
      await refreshManualHazards();
    } catch (err) {
      console.error('Error toggling hazard:', err);
      const msg = err.response?.data?.message || err.message || 'Operation failed';
      showToast(`Error: ${msg}`, 'error');
    } finally {
      setTogglingHazard(null);
    }
  };

  const handleClearAll = async () => {
    try {
      setClearingAll(true);
      const res = await api.post('/controller/hazard/clear-all');
      if (res.data?.success) {
        showToast('All manual hazard alerts have been cleared.', 'success');
      }
      setShowClearModal(false);
      await refreshManualHazards();
    } catch (err) {
      console.error('Error clearing manual hazards:', err);
      showToast('Failed to clear manual hazards.', 'error');
    } finally {
      setClearingAll(false);
    }
  };

  const handleLogout = async () => {
    try {
      await api.post('/controller/logout').catch(() => {});
    } finally {
      localStorage.removeItem('resq_controller_token');
      localStorage.removeItem('resq_controller_user');
      navigate('/controller/login', { replace: true });
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between">
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 max-w-md animate-slide-in">
          <div
            className={`p-4 rounded-2xl shadow-2xl border text-xs font-semibold flex items-center justify-between gap-3 ${
              toastMessage.type === 'warning'
                ? 'bg-rose-950 text-rose-200 border-rose-600'
                : toastMessage.type === 'success'
                ? 'bg-emerald-950 text-emerald-200 border-emerald-600'
                : toastMessage.type === 'error'
                ? 'bg-red-950 text-red-200 border-red-700'
                : 'bg-slate-900 text-slate-200 border-slate-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 animate-ping" />
              <span>{toastMessage.message}</span>
            </div>
            <button onClick={() => setToastMessage(null)} className="text-white/60 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Top Controller Navigation Bar */}
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Brand & Controller Heading */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-600 to-rose-800 flex items-center justify-center text-white shadow-sm shadow-rose-900/40">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base text-white tracking-tight">Controller Dashboard</span>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-rose-950 text-rose-300 border border-rose-800">
                  Remote Manual Override
                </span>
              </div>
              <p className="text-[11px] text-slate-400">ResQ Multi-Hazard Real-Time Emergency Controller</p>
            </div>
          </div>

          {/* Operator Status & Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Operator Badge */}
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-slate-800/80 border border-slate-700 rounded-xl text-xs text-slate-300">
              <User className="w-3.5 h-3.5 text-teal-400" />
              <span>Operator:</span>
              <span className="font-bold text-white">{currentUser}</span>
            </div>

            {/* Socket Status Pill */}
            <div
              className={`hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                isConnected
                  ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800'
                  : 'bg-rose-950/80 text-rose-300 border border-rose-800'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
              <span>{isConnected ? 'Socket Broadcast Online' : 'Connecting...'}</span>
            </div>

            {/* View Live Website Button */}
            <Link
              to="/"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-semibold border border-slate-700 transition-colors"
              title="Open public live dashboard in a new tab to see alerts"
            >
              <ExternalLink className="w-3.5 h-3.5 text-teal-400" />
              <span className="hidden sm:inline">View Website</span>
            </Link>

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-950/60 hover:bg-rose-900 border border-rose-800 text-rose-300 hover:text-white rounded-xl text-xs font-semibold transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Controller Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-1 space-y-6">
        {/* Status Summary & Master Clear Bar */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">Manual Hazard Triggers</h2>
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                  manualActiveCount > 0
                    ? 'bg-rose-950 text-rose-300 border border-rose-600 animate-pulse'
                    : 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${manualActiveCount > 0 ? 'bg-rose-500' : 'bg-emerald-400'}`} />
                <span>{manualActiveCount} of 5 Hazards Active</span>
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Click any hazard button to instantly broadcast the corresponding critical emergency alert to all live website visitors.
            </p>
          </div>

          {/* Master Clear Button */}
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <button
              onClick={() => refreshManualHazards()}
              className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition-colors"
              title="Refresh manual hazard status from server"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            <button
              onClick={() => setShowClearModal(true)}
              disabled={manualActiveCount === 0 || clearingAll}
              className="flex-1 md:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-rose-950/70 hover:bg-rose-900 border border-rose-700 text-rose-200 hover:text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
            >
              <Trash2 className="w-4 h-4 text-rose-400" />
              <span>Clear All Manual Alerts</span>
            </button>
          </div>
        </div>

        {/* The 5 Large Hazard Controller Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {HAZARDS.map((hazard) => {
            const Icon = hazard.icon;
            const isActive = Boolean(manualHazards[hazard.id]);
            const details = manualHazardDetails[hazard.id] || {};
            const isToggling = togglingHazard === hazard.id;

            return (
              <div
                key={hazard.id}
                className={`relative rounded-3xl border p-6 flex flex-col justify-between transition-all duration-200 shadow-xl overflow-hidden ${
                  isActive
                    ? `bg-slate-900 border-2 ${hazard.ringColor} ring-4 shadow-2xl`
                    : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                {/* Active Indicator Top Glow */}
                {isActive && (
                  <div
                    className={`absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r ${hazard.activeGradient}`}
                  />
                )}

                <div>
                  {/* Card Header: Icon + State Badge */}
                  <div className="flex items-center justify-between mb-4">
                    <div
                      className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${
                        isActive
                          ? `bg-gradient-to-br ${hazard.activeGradient} text-white shadow-lg animate-pulse`
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      <Icon className="w-7 h-7" />
                    </div>

                    <span
                      className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border ${
                        isActive
                          ? `${hazard.activeBadge} border-white/30 animate-pulse shadow-md`
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}
                    >
                      {isActive ? '🚨 ACTIVE ALERT' : 'STANDBY (SAFE)'}
                    </span>
                  </div>

                  {/* Hazard Title & Meaning */}
                  <div>
                    <h3 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
                      <span>{hazard.name}</span>
                    </h3>
                    <p className={`text-xs font-bold mt-1 ${isActive ? hazard.activeText : 'text-slate-400'}`}>
                      {hazard.meaning}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                      {hazard.description}
                    </p>
                  </div>
                </div>

                {/* Card Footer: Metadata + Trigger Button */}
                <div className="mt-6 pt-4 border-t border-slate-800/80 space-y-4">
                  {/* Status / Timestamp information */}
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span className="flex items-center gap-1 font-mono">
                      <Clock className="w-3.5 h-3.5 text-slate-500" />
                      {isActive && details.activatedAt
                        ? `Triggered: ${new Date(details.activatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
                        : 'Status: Inactive'}
                    </span>
                    <span className="font-semibold text-slate-500 uppercase text-[10px]">
                      {isActive ? 'Live on Dashboard' : 'Ready'}
                    </span>
                  </div>

                  {/* Toggle Button */}
                  <button
                    onClick={() => handleToggleHazard(hazard.id)}
                    disabled={isToggling}
                    className={`w-full py-3.5 px-4 rounded-2xl font-black text-xs uppercase tracking-wider shadow-lg transition-all flex items-center justify-center gap-2 ${
                      isActive
                        ? 'bg-rose-950 hover:bg-rose-900 border-2 border-rose-600 text-rose-200 hover:text-white shadow-rose-950/50'
                        : `bg-gradient-to-r ${hazard.activeGradient} hover:brightness-110 active:scale-[0.99] text-white shadow-black/40`
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {isToggling ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                        <span>Updating State...</span>
                      </>
                    ) : isActive ? (
                      <>
                        <X className="w-4 h-4" />
                        <span>Deactivate {hazard.name}</span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-4 h-4" />
                        <span>Activate {hazard.name}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Operational Guidelines & Info Box */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 text-xs text-slate-400 space-y-3">
          <div className="flex items-center gap-2 text-white font-bold text-sm">
            <Shield className="w-4 h-4 text-teal-400" />
            <span>Controller System Operational Notice</span>
          </div>
          <ul className="list-disc pl-5 space-y-1.5 leading-relaxed text-slate-400">
            <li>
              <strong className="text-slate-200">Global Synchronized State:</strong> Activating any hazard pushes real-time WebSocket events to every visitor currently viewing the ResQ website.
            </li>
            <li>
              <strong className="text-slate-200">Simultaneous Hazards:</strong> You can activate multiple hazards at once (e.g. FIRE + WATER + TILT). They will all appear simultaneously on the dashboard.
            </li>
            <li>
              <strong className="text-slate-200">Sensor Coexistence:</strong> If an ESP8266 hardware sensor is actively detecting fire and you deactivate manual fire, the fire alert will remain active until the physical sensor clears.
            </li>
            <li>
              <strong className="text-slate-200">Clear All Manual Alerts:</strong> Only clears manually triggered hazards. Physical sensor readings are never modified or dismissed.
            </li>
          </ul>
        </div>
      </main>

      {/* Confirmation Modal for Clear All */}
      {showClearModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-5 animate-scale-in">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-rose-950 border border-rose-800 flex items-center justify-center text-rose-400 flex-shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-white">Clear All Manual Alerts?</h3>
                <p className="text-xs text-slate-400">Confirmation Required</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              This will deactivate all <strong>{manualActiveCount}</strong> currently active manual hazards.
              Every connected website visitor will see these manual alerts removed immediately. Genuine physical sensor alerts will not be affected.
            </p>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setShowClearModal(false)}
                disabled={clearingAll}
                className="flex-1 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleClearAll}
                disabled={clearingAll}
                className="flex-1 py-3 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs uppercase tracking-wider transition-colors flex items-center justify-center gap-2 shadow-lg shadow-rose-900/30"
              >
                {clearingAll ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    <span>Clearing...</span>
                  </>
                ) : (
                  <span>Yes, Clear All</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-4 text-center text-xs text-slate-500 font-mono">
        ResQ Remote Manual Hazard Controller • Authorized Session: {currentUser} • Connected to Render Cloud
      </footer>
    </div>
  );
};

export default ControllerDashboardPage;
