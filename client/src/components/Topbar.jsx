import React, { useState } from 'react';
import {
  Menu,
  Bell,
  Radio,
  Play,
  Square,
  Flame,
  Wind,
  Thermometer,
  ShieldAlert,
  ChevronDown,
  User,
  LogOut,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import api from '../services/api';
import { useNavigate } from 'react-router-dom';

const Topbar = ({ onOpenMobileMenu, onOpenHardwareGuide }) => {
  const { user, logout } = useAuth();
  const { isConnected, recentAlerts, simulationState } = useSocket();
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isScenarioMenuOpen, setIsScenarioMenuOpen] = useState(false);
  const [simLoading, setSimLoading] = useState(false);
  const navigate = useNavigate();

  const activeAlerts = recentAlerts.filter((a) => a.status === 'active');

  const handleToggleSimulation = async () => {
    try {
      setSimLoading(true);
      await api.post('/simulation/toggle', {
        action: simulationState.isRunning ? 'stop' : 'start',
      });
    } catch (err) {
      console.error('Failed to toggle simulation:', err);
    } finally {
      setSimLoading(false);
    }
  };

  const handleTriggerScenario = async (scenario) => {
    setIsScenarioMenuOpen(false);
    try {
      setSimLoading(true);
      await api.post('/simulation/scenario', { scenario });
    } catch (err) {
      console.error('Failed to trigger simulation scenario:', err);
    } finally {
      setSimLoading(false);
    }
  };

  return (
    <header className="sticky top-0 z-30 h-16 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between">
      {/* Left: Mobile trigger & connection state */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobileMenu}
          className="lg:hidden p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg"
          aria-label="Open sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Live Hardware vs Simulation Indicator Pill */}
        <div className="flex items-center gap-2">
          {simulationState.isRunning ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-300">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
              <span>Demo Simulator: {simulationState.scenario.replace('_', ' ').toUpperCase()}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-300">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>ESP8266 Telemetry Gateway</span>
            </div>
          )}
        </div>
      </div>

      {/* Right: Simulation Controls & Notifications & Profile */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Simulation Controls Dropdown */}
        <div className="relative">
          <div className="inline-flex rounded-lg shadow-sm border border-slate-200 overflow-hidden">
            <button
              onClick={handleToggleSimulation}
              disabled={simLoading}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
                simulationState.isRunning
                  ? 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                  : 'bg-teal-50 text-teal-700 hover:bg-teal-100'
              }`}
            >
              {simulationState.isRunning ? (
                <>
                  <Square className="w-3.5 h-3.5 fill-current" />
                  <span className="hidden sm:inline">Stop Sim</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span className="hidden sm:inline">Start Demo Sim</span>
                </>
              )}
            </button>
            <button
              onClick={() => setIsScenarioMenuOpen(!isScenarioMenuOpen)}
              className="px-2 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 border-l border-slate-200"
              title="Trigger Emergency Hazard Scenarios"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Scenario Menu */}
          {isScenarioMenuOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-slate-200 py-1.5 z-50 text-xs">
              <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Simulate Emergency Hazard
              </div>
              <button
                onClick={() => handleTriggerScenario('nominal')}
                className="w-full text-left px-3 py-2 text-slate-700 hover:bg-slate-50 flex items-center gap-2 font-medium"
              >
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>Nominal Normal Conditions</span>
              </button>
              <button
                onClick={() => handleTriggerScenario('fire_hazard')}
                className="w-full text-left px-3 py-2 text-rose-600 hover:bg-rose-50 flex items-center gap-2 font-medium"
              >
                <Flame className="w-4 h-4 text-rose-500" />
                <span>Fire & Flame Emergency</span>
              </button>
              <button
                onClick={() => handleTriggerScenario('gas_leak')}
                className="w-full text-left px-3 py-2 text-amber-700 hover:bg-amber-50 flex items-center gap-2 font-medium"
              >
                <Wind className="w-4 h-4 text-amber-500" />
                <span>Combustible Gas / Smoke Leak</span>
              </button>
              <button
                onClick={() => handleTriggerScenario('high_heat')}
                className="w-full text-left px-3 py-2 text-orange-600 hover:bg-orange-50 flex items-center gap-2 font-medium"
              >
                <Thermometer className="w-4 h-4 text-orange-500" />
                <span>High Temperature Breach</span>
              </button>
            </div>
          )}
        </div>

        {/* Hardware Guide Button */}
        <button
          onClick={onOpenHardwareGuide}
          className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg shadow-sm transition-colors"
        >
          <Radio className="w-3.5 h-3.5 text-teal-600" />
          <span>ESP8266 Code</span>
        </button>

        {/* Alerts Bell */}
        <button
          onClick={() => navigate('/dashboard/alerts')}
          className="relative p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
          title="View Incidents"
        >
          <Bell className="w-5 h-5" />
          {activeAlerts.length > 0 && (
            <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-rose-600 text-[10px] font-bold text-white shadow-sm animate-pulse">
              {activeAlerts.length}
            </span>
          )}
        </button>

        {/* User Avatar & Menu */}
        <div className="relative">
          <button
            onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
            className="flex items-center gap-2 p-1 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-teal-600 text-white flex items-center justify-center font-bold text-xs uppercase shadow-sm">
              {user?.name ? user.name.charAt(0) : 'U'}
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-500 hidden sm:block" />
          </button>

          {isProfileMenuOpen && (
            <div className="absolute right-0 mt-2 w-52 bg-white rounded-xl shadow-lg border border-slate-200 py-1.5 z-50 text-xs">
              <div className="px-3.5 py-2 border-b border-slate-100">
                <p className="font-semibold text-slate-800 truncate">{user?.name}</p>
                <p className="text-[11px] text-slate-500 truncate">{user?.email}</p>
              </div>
              <button
                onClick={() => {
                  setIsProfileMenuOpen(false);
                  navigate('/dashboard/settings');
                }}
                className="w-full text-left px-3.5 py-2 text-slate-700 hover:bg-slate-50 flex items-center gap-2"
              >
                <User className="w-3.5 h-3.5 text-slate-400" />
                <span>Account Profile</span>
              </button>
              <button
                onClick={() => {
                  setIsProfileMenuOpen(false);
                  logout();
                }}
                className="w-full text-left px-3.5 py-2 text-rose-600 hover:bg-rose-50 flex items-center gap-2"
              >
                <LogOut className="w-3.5 h-3.5 text-rose-500" />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Topbar;
