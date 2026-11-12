import React, { useState, useEffect } from 'react';
import {
  Flame,
  Wind,
  Compass,
  Droplets,
  Users,
  Thermometer,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Radio,
  Play,
  Square,
  RefreshCw,
  Bell,
  Volume2,
  VolumeX,
  Zap,
  Info,
  Check,
  X,
  ExternalLink,
} from 'lucide-react';
import api from '../../services/api';
import { useSocket } from '../../context/SocketContext';
import HardwareGuideModal from '../../components/HardwareGuideModal';

const HomePage = () => {
  const [devices, setDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [telemetryHistory, setTelemetryHistory] = useState([]);
  const [activeAlerts, setActiveAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [simLoading, setSimLoading] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  const { latestReading, isConnected, simulationState, recentAlerts } = useSocket();

  // Load initial devices and recent telemetry
  useEffect(() => {
    const initData = async () => {
      try {
        const [devRes, alertsRes] = await Promise.all([
          api.get('/devices'),
          api.get('/alerts?status=active&limit=10'),
        ]);

        if (devRes.data?.success && devRes.data.devices.length > 0) {
          setDevices(devRes.data.devices);
          const firstId = devRes.data.devices[0].deviceId;
          setSelectedDeviceId(firstId);

          // Get recent readings for this device
          try {
            const readingsRes = await api.get(`/iot/devices/${firstId}/readings?limit=15`);
            if (readingsRes.data?.success) {
              setTelemetryHistory(readingsRes.data.readings);
            }
          } catch (e) {
            console.warn('Could not fetch historical readings:', e.message);
          }
        }

        if (alertsRes.data?.success) {
          setActiveAlerts(alertsRes.data.alerts);
        }
      } catch (err) {
        console.error('Error initializing Home Page data:', err);
      } finally {
        setLoading(false);
      }
    };

    initData();
  }, []);

  // Handle incoming live readings from Socket.IO
  useEffect(() => {
    if (latestReading) {
      if (!selectedDeviceId || latestReading.deviceId === selectedDeviceId) {
        setTelemetryHistory((prev) => [latestReading, ...prev.slice(0, 14)]);
      }

      // Update device list state
      setDevices((prev) =>
        prev.map((d) =>
          d.deviceId === latestReading.deviceId
            ? {
                ...d,
                status: 'online',
                lastSeenAt: latestReading.timestamp,
                latestReading: {
                  ...d.latestReading,
                  ...latestReading,
                },
              }
            : d
        )
      );
    }
  }, [latestReading, selectedDeviceId]);

  // Handle incoming live alerts from Socket.IO
  useEffect(() => {
    if (recentAlerts && recentAlerts.length > 0) {
      const active = recentAlerts.filter((a) => a.status === 'active');
      setActiveAlerts(active);
    }
  }, [recentAlerts]);

  // Switch selected room/device
  const handleSelectDevice = async (devId) => {
    setSelectedDeviceId(devId);
    try {
      const res = await api.get(`/iot/devices/${devId}/readings?limit=15`);
      if (res.data?.success) {
        setTelemetryHistory(res.data.readings);
      }
    } catch (err) {
      console.warn('Error loading device readings:', err);
    }
  };

  // Quick hazard scenario simulation trigger
  const handleTriggerScenario = async (scenario) => {
    try {
      setSimLoading(true);
      await api.post('/simulation/scenario', { scenario });
    } catch (err) {
      console.error('Failed to trigger scenario:', err);
    } finally {
      setSimLoading(false);
    }
  };

  const selectedDevice = devices.find((d) => d.deviceId === selectedDeviceId) || devices[0];
  const currentData = telemetryHistory[0] || selectedDevice?.latestReading || {};

  // Extraction of all sensor metrics
  const flameDetected = Boolean(currentData.flame);
  const temp = currentData.temperature !== undefined && currentData.temperature !== null ? currentData.temperature : 24.5;
  const hum = currentData.humidity !== undefined && currentData.humidity !== null ? currentData.humidity : 48;
  const gas = currentData.gas !== undefined && currentData.gas !== null ? currentData.gas : 65;
  const smoke = currentData.smoke !== undefined && currentData.smoke !== null ? currentData.smoke : Math.round(gas * 0.85);
  const tiltDetected = Boolean(currentData.tilt);
  const earthquakeDetected = Boolean(currentData.earthquake);
  const vibration = currentData.vibration !== undefined && currentData.vibration !== null ? currentData.vibration : 0.04;
  const waterDetected = Boolean(currentData.water);
  const waterLevel = currentData.waterLevel !== undefined && currentData.waterLevel !== null ? currentData.waterLevel : 0;
  const personCount = currentData.personCount !== undefined && currentData.personCount !== null ? currentData.personCount : 3;

  // Hazard conditions
  const isFireHazard = flameDetected || temp > 50;
  const isSmokeHazard = smoke > 200 || gas > 200;
  const isTiltHazard = tiltDetected || earthquakeDetected || vibration > 1.5;
  const isWaterHazard = waterDetected || waterLevel > 40;
  const isPersonHazard = personCount > 10;

  const anyHazardActive = isFireHazard || isSmokeHazard || isTiltHazard || isWaterHazard || isPersonHazard || activeAlerts.length > 0;

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-6 animate-pulse">
        <div className="h-10 bg-slate-200 rounded-lg w-1/3"></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-64 bg-white rounded-2xl border border-slate-200 p-6"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* 1. Header & Live System Status */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              IoT Emergency Detection Hub
            </h1>
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                anyHazardActive
                  ? 'bg-rose-100 text-rose-800 border border-rose-300 animate-pulse'
                  : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${anyHazardActive ? 'bg-rose-600' : 'bg-emerald-500'}`} />
              {anyHazardActive ? 'Hazards Active' : 'All Detections Safe'}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Real-time multi-hazard telemetry monitoring directly from NodeMCU ESP8266 IoT nodes.
          </p>
        </div>

        {/* Room / Device Selector & Hardware Guide */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm text-xs">
            <span className="text-slate-400 font-semibold uppercase text-[10px]">Room / Node:</span>
            <select
              value={selectedDeviceId}
              onChange={(e) => handleSelectDevice(e.target.value)}
              className="bg-transparent font-bold text-slate-800 focus:outline-none cursor-pointer"
            >
              {devices.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.deviceId} — {d.name} ({d.location})
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => setIsGuideOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors"
          >
            <Cpu className="w-3.5 h-3.5 text-teal-400" />
            <span>ESP8266 Pinout Guide</span>
          </button>
        </div>
      </div>

      {/* 2. Interactive One-Click Test Scenario Toolbar */}
      <div className="bg-slate-900 text-white p-4 sm:p-5 rounded-2xl shadow-md border border-slate-800 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-teal-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
              Live Test Hazard Simulator (One-Click Demonstrations):
            </span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400' : 'bg-rose-500'}`} />
            <span>{isConnected ? 'Socket Telemetry Push: Active' : 'Connecting...'}</span>
          </div>
        </div>

        {/* Test Buttons */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 pt-1 text-xs font-semibold">
          <button
            onClick={() => handleTriggerScenario('nominal')}
            disabled={simLoading}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-emerald-950/70 border border-slate-700 hover:border-emerald-500 text-emerald-400 transition-colors flex items-center justify-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>All Safe (Clear)</span>
          </button>

          <button
            onClick={() => handleTriggerScenario('fire_hazard')}
            disabled={simLoading}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-rose-950/70 border border-slate-700 hover:border-rose-500 text-rose-400 transition-colors flex items-center justify-center gap-2"
          >
            <Flame className="w-4 h-4" />
            <span>Test Fire Alert</span>
          </button>

          <button
            onClick={() => handleTriggerScenario('smoke_leak')}
            disabled={simLoading}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-amber-950/70 border border-slate-700 hover:border-amber-500 text-amber-400 transition-colors flex items-center justify-center gap-2"
          >
            <Wind className="w-4 h-4" />
            <span>Test Smoke Alert</span>
          </button>

          <button
            onClick={() => handleTriggerScenario('earthquake')}
            disabled={simLoading}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-orange-950/70 border border-slate-700 hover:border-orange-500 text-orange-400 transition-colors flex items-center justify-center gap-2"
          >
            <Compass className="w-4 h-4" />
            <span>Test Tilt / Quake</span>
          </button>

          <button
            onClick={() => handleTriggerScenario('water_leak')}
            disabled={simLoading}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-cyan-950/70 border border-slate-700 hover:border-cyan-500 text-cyan-400 transition-colors flex items-center justify-center gap-2"
          >
            <Droplets className="w-4 h-4" />
            <span>Test Water Leak</span>
          </button>

          <button
            onClick={() => handleTriggerScenario('crowded_room')}
            disabled={simLoading}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-purple-950/70 border border-slate-700 hover:border-purple-500 text-purple-400 transition-colors flex items-center justify-center gap-2"
          >
            <Users className="w-4 h-4" />
            <span>Test Person Count</span>
          </button>
        </div>
      </div>

      {/* 3. Emergency Active Alert Banner (If Any Hazard Active) */}
      {anyHazardActive && (
        <div className="bg-rose-600 text-white p-4 sm:p-5 rounded-2xl shadow-lg border border-rose-700 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-pulse">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-extrabold uppercase tracking-wider bg-white text-rose-700 px-2 py-0.5 rounded">
                  Critical Emergency Alert
                </span>
                <span className="text-xs font-mono font-bold text-rose-100">
                  Node: {selectedDevice?.deviceId || 'RESQ-NODE-01'}
                </span>
              </div>
              <p className="text-sm font-bold mt-1 text-white">
                {isFireHazard
                  ? '🔥 Active fire & optical flame signature detected in facility!'
                  : isSmokeHazard
                  ? `💨 Smoke / gas concentration spiked to ${smoke} PPM (Threshold: 200 PPM)!`
                  : isTiltHazard
                  ? `⚠️ Seismic vibration tremor (${vibration}g) and structural tilt detected!`
                  : isWaterHazard
                  ? `💧 Water accumulation detected on floor (Moisture Level: ${waterLevel}%)!`
                  : `👥 Room overcrowding hazard: ${personCount} persons inside (Limit: 10)!`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <button
              onClick={() => handleTriggerScenario('nominal')}
              className="w-full md:w-auto px-4 py-2 bg-white text-rose-700 hover:bg-rose-50 rounded-xl text-xs font-extrabold uppercase shadow-sm transition-all"
            >
              Silence & Reset to Safe
            </button>
          </div>
        </div>
      )}

      {/* 4. THE 5 CORE DETECTION SECTIONS (Direct on Home Page) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* SECTION 1: FIRE DETECTION */}
        <div
          className={`p-6 rounded-3xl border transition-all shadow-card flex flex-col justify-between ${
            isFireHazard
              ? 'bg-rose-50 border-rose-400 ring-4 ring-rose-500/20 shadow-xl'
              : 'bg-white border-slate-200'
          }`}
        >
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
                    isFireHazard ? 'bg-rose-500 text-white animate-bounce' : 'bg-rose-50 text-rose-600'
                  }`}
                >
                  <Flame className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Fire Detection</h3>
                  <span className="text-[11px] text-slate-500 font-medium">IR Flame Sensor (GPIO5 / D1)</span>
                </div>
              </div>

              <span
                className={`px-2.5 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider ${
                  isFireHazard
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'bg-emerald-100 text-emerald-800'
                }`}
              >
                {isFireHazard ? 'Fire Detected!' : 'Safe (No Fire)'}
              </span>
            </div>

            {/* Fire Status Callout */}
            <div className="my-5 p-4 rounded-2xl bg-white/80 border border-slate-200/80 shadow-sm text-center">
              <span className="text-xs text-slate-400 font-semibold uppercase block">Optical Flame State</span>
              <div
                className={`text-2xl font-black font-mono mt-1 ${
                  flameDetected ? 'text-rose-600 animate-pulse' : 'text-emerald-600'
                }`}
              >
                {flameDetected ? 'ACTIVE FLAME DETECTED' : 'SPECTRUM CLEAR'}
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block">
                {flameDetected ? '760–1100nm infrared fire radiation confirmed' : 'No optical flame radiation detected'}
              </span>
            </div>

            {/* Secondary Thermal Metric */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-slate-400 text-[10px] uppercase font-bold block">Ambient Heat</span>
                <span className={`text-base font-bold font-mono ${temp > 50 ? 'text-rose-600' : 'text-slate-800'}`}>
                  {temp} °C
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-slate-400 text-[10px] uppercase font-bold block">Fire Threshold</span>
                <span className="text-base font-bold font-mono text-slate-700">&gt; 50.0 °C</span>
              </div>
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Buzzer Relay: {isFireHazard ? 'Triggered (ALARM ON)' : 'Standby'}</span>
            <span className="font-semibold text-slate-700">Digital Pin D1</span>
          </div>
        </div>

        {/* SECTION 2: SMOKE & GAS DETECTION */}
        <div
          className={`p-6 rounded-3xl border transition-all shadow-card flex flex-col justify-between ${
            isSmokeHazard
              ? 'bg-amber-50 border-amber-400 ring-4 ring-amber-500/20 shadow-xl'
              : 'bg-white border-slate-200'
          }`}
        >
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
                    isSmokeHazard ? 'bg-amber-500 text-white animate-bounce' : 'bg-amber-50 text-amber-600'
                  }`}
                >
                  <Wind className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Smoke & Gas Detection</h3>
                  <span className="text-[11px] text-slate-500 font-medium">MQ-2 / MQ-135 (ADC0 / A0)</span>
                </div>
              </div>

              <span
                className={`px-2.5 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider ${
                  isSmokeHazard
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'bg-emerald-100 text-emerald-800'
                }`}
              >
                {isSmokeHazard ? 'Smoke Alert!' : 'Air Quality Safe'}
              </span>
            </div>

            {/* Smoke PPM Callout */}
            <div className="my-5 p-4 rounded-2xl bg-white/80 border border-slate-200/80 shadow-sm text-center">
              <span className="text-xs text-slate-400 font-semibold uppercase block">Smoke Concentration</span>
              <div
                className={`text-3xl font-black font-mono mt-1 ${
                  smoke > 200 ? 'text-amber-600' : 'text-teal-700'
                }`}
              >
                {smoke} <span className="text-base font-bold">PPM</span>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-slate-200 rounded-full h-2.5 mt-3 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    smoke > 200 ? 'bg-amber-500' : 'bg-teal-500'
                  }`}
                  style={{ width: `${Math.min(100, Math.max(5, (smoke / 500) * 100))}%` }}
                />
              </div>
              <span className="text-[10px] text-slate-400 mt-1 block">
                Target: Combustible Smoke, LPG, Carbon Monoxide
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-slate-400 text-[10px] uppercase font-bold block">Gas Reading</span>
                <span className="text-base font-bold font-mono text-slate-800">{gas} PPM</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-slate-400 text-[10px] uppercase font-bold block">Smoke Safe Limit</span>
                <span className="text-base font-bold font-mono text-slate-700">&lt; 200 PPM</span>
              </div>
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Ventilation Exhaust: {isSmokeHazard ? 'Active Exhaust ON' : 'Standby'}</span>
            <span className="font-semibold text-slate-700">Analog Pin A0</span>
          </div>
        </div>

        {/* SECTION 3: TILT & EARTHQUAKE DETECTION */}
        <div
          className={`p-6 rounded-3xl border transition-all shadow-card flex flex-col justify-between ${
            isTiltHazard
              ? 'bg-orange-50 border-orange-400 ring-4 ring-orange-500/20 shadow-xl'
              : 'bg-white border-slate-200'
          }`}
        >
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
                    isTiltHazard ? 'bg-orange-500 text-white animate-bounce' : 'bg-orange-50 text-orange-600'
                  }`}
                >
                  <Compass className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Tilt & Earthquake</h3>
                  <span className="text-[11px] text-slate-500 font-medium">SW-420 / Seismic Sensor (D5)</span>
                </div>
              </div>

              <span
                className={`px-2.5 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider ${
                  isTiltHazard
                    ? 'bg-orange-600 text-white shadow-sm'
                    : 'bg-emerald-100 text-emerald-800'
                }`}
              >
                {isTiltHazard ? 'Seismic / Tilt Alert!' : 'Structure Stable'}
              </span>
            </div>

            {/* Seismic Status Callout */}
            <div className="my-5 p-4 rounded-2xl bg-white/80 border border-slate-200/80 shadow-sm text-center">
              <span className="text-xs text-slate-400 font-semibold uppercase block">Structural Vibration Intensity</span>
              <div
                className={`text-3xl font-black font-mono mt-1 ${
                  vibration > 1.5 ? 'text-orange-600 animate-pulse' : 'text-emerald-600'
                }`}
              >
                {vibration} <span className="text-base font-bold">g</span>
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block">
                {isTiltHazard ? '⚠️ Abnormal structural tilt angle & tremor detected!' : 'Foundation upright & vibration nominal (0° Tilt)'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-slate-400 text-[10px] uppercase font-bold block">Tilt Sensor</span>
                <span className={`text-base font-bold font-mono ${tiltDetected ? 'text-orange-600' : 'text-emerald-700'}`}>
                  {tiltDetected ? 'TILTED' : 'UPRIGHT'}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-slate-400 text-[10px] uppercase font-bold block">Tremor Limit</span>
                <span className="text-base font-bold font-mono text-slate-700">&lt; 1.5 g</span>
              </div>
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Structural Safety: {isTiltHazard ? 'Inspection Required' : 'Certified Level'}</span>
            <span className="font-semibold text-slate-700">Digital Pin D5</span>
          </div>
        </div>

        {/* SECTION 4: WATER & FLOOD DETECTION */}
        <div
          className={`p-6 rounded-3xl border transition-all shadow-card flex flex-col justify-between ${
            isWaterHazard
              ? 'bg-cyan-50 border-cyan-400 ring-4 ring-cyan-500/20 shadow-xl'
              : 'bg-white border-slate-200'
          }`}
        >
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
                    isWaterHazard ? 'bg-cyan-600 text-white animate-bounce' : 'bg-cyan-50 text-cyan-600'
                  }`}
                >
                  <Droplets className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Water Detection</h3>
                  <span className="text-[11px] text-slate-500 font-medium">Flood Probe Sensor (GPIO12 / D6)</span>
                </div>
              </div>

              <span
                className={`px-2.5 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider ${
                  isWaterHazard
                    ? 'bg-cyan-600 text-white shadow-sm'
                    : 'bg-emerald-100 text-emerald-800'
                }`}
              >
                {isWaterHazard ? 'Water Leak Alert!' : 'Dry & Safe'}
              </span>
            </div>

            {/* Water Status Callout */}
            <div className="my-5 p-4 rounded-2xl bg-white/80 border border-slate-200/80 shadow-sm text-center">
              <span className="text-xs text-slate-400 font-semibold uppercase block">Water Accumulation</span>
              <div
                className={`text-3xl font-black font-mono mt-1 ${
                  waterDetected || waterLevel > 0 ? 'text-cyan-600 animate-pulse' : 'text-emerald-600'
                }`}
              >
                {waterLevel > 0 ? `${waterLevel}%` : (waterDetected ? 'LEAK DETECTED' : '0% DRY')}
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block">
                {isWaterHazard ? '💧 Liquid contact confirmed on floor probe!' : 'Conductive probe dry; no flood risk'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-slate-400 text-[10px] uppercase font-bold block">Probe State</span>
                <span className={`text-base font-bold font-mono ${waterDetected ? 'text-cyan-600' : 'text-emerald-700'}`}>
                  {waterDetected ? 'SUBMERGED' : 'DRY'}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-slate-400 text-[10px] uppercase font-bold block">Sump Shutoff</span>
                <span className="text-base font-bold font-mono text-slate-700">
                  {isWaterHazard ? 'TRIGGERED' : 'Standby'}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Moisture State: {isWaterHazard ? 'Liquid Alert' : 'Floor Dry'}</span>
            <span className="font-semibold text-slate-700">Digital Pin D6</span>
          </div>
        </div>

        {/* SECTION 5: PERSON COUNT IN ROOM */}
        <div
          className={`p-6 rounded-3xl border transition-all shadow-card flex flex-col justify-between ${
            isPersonHazard
              ? 'bg-purple-50 border-purple-400 ring-4 ring-purple-500/20 shadow-xl'
              : 'bg-white border-slate-200'
          }`}
        >
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
                    isPersonHazard ? 'bg-purple-600 text-white animate-bounce' : 'bg-purple-50 text-purple-600'
                  }`}
                >
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Person Count in Room</h3>
                  <span className="text-[11px] text-slate-500 font-medium">PIR & Headcount Sensor (D7)</span>
                </div>
              </div>

              <span
                className={`px-2.5 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider ${
                  isPersonHazard
                    ? 'bg-purple-700 text-white shadow-sm'
                    : 'bg-teal-100 text-teal-800'
                }`}
              >
                {isPersonHazard ? 'Overcrowded!' : 'Occupancy Normal'}
              </span>
            </div>

            {/* Person Count Callout */}
            <div className="my-5 p-4 rounded-2xl bg-white/80 border border-slate-200/80 shadow-sm text-center">
              <span className="text-xs text-slate-400 font-semibold uppercase block">Room Occupancy</span>
              <div
                className={`text-4xl font-black font-mono mt-1 ${
                  personCount > 10 ? 'text-purple-700 animate-pulse' : 'text-slate-900'
                }`}
              >
                {personCount} <span className="text-lg font-bold text-slate-500">Persons</span>
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block">
                {personCount > 10 ? '⚠️ Safe room occupancy limit (10 persons) exceeded!' : 'Active occupancy within safe evacuation capacity'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-slate-400 text-[10px] uppercase font-bold block">PIR Motion</span>
                <span className="text-base font-bold font-mono text-emerald-700">ACTIVE</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-slate-400 text-[10px] uppercase font-bold block">Max Safe Limit</span>
                <span className="text-base font-bold font-mono text-slate-700">10 Persons</span>
              </div>
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Evacuation Capacity: {personCount <= 10 ? 'Safe' : 'Congested'}</span>
            <span className="font-semibold text-slate-700">Digital Pin D7</span>
          </div>
        </div>

        {/* SECTION 6: ROOM CLIMATE & TELEMETRY HEARTBEAT */}
        <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-card flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center">
                  <Thermometer className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Room Atmosphere</h3>
                  <span className="text-[11px] text-slate-500 font-medium">DHT11 / 22 Sensor (D2)</span>
                </div>
              </div>

              <span className="px-2.5 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider bg-emerald-100 text-emerald-800">
                Atmosphere OK
              </span>
            </div>

            {/* Atmosphere Callout */}
            <div className="my-5 p-4 rounded-2xl bg-slate-50 border border-slate-200 text-center">
              <span className="text-xs text-slate-400 font-semibold uppercase block">Ambient Climate</span>
              <div className="flex items-center justify-center gap-6 mt-2 font-mono">
                <div>
                  <span className="text-2xl font-bold text-slate-900">{temp} °C</span>
                  <span className="text-[10px] text-slate-400 block font-sans">Temperature</span>
                </div>
                <div className="h-8 w-px bg-slate-200"></div>
                <div>
                  <span className="text-2xl font-bold text-teal-700">{hum} %</span>
                  <span className="text-[10px] text-slate-400 block font-sans">Humidity</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-slate-400 text-[10px] uppercase font-bold block">Wi-Fi RSSI</span>
                <span className="text-base font-bold font-mono text-slate-800">
                  {selectedDevice?.metadata?.signalRssi ?? -58} dBm
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-slate-400 text-[10px] uppercase font-bold block">Stream Rate</span>
                <span className="text-base font-bold font-mono text-teal-700">3000 ms</span>
              </div>
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Hardware: NodeMCU ESP8266</span>
            <span className="font-semibold text-slate-700">Digital Pin D2</span>
          </div>
        </div>
      </div>

      {/* 5. Live Ingested Telemetry Feed Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-card overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 bg-slate-50/60">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Live Ingested Telemetry Stream</h3>
            <p className="text-xs text-slate-500">Direct packet log pushed via Socket.IO from edge microcontroller</p>
          </div>
          <span className="text-xs font-mono text-teal-700 font-bold bg-teal-50 px-2.5 py-1 rounded-lg border border-teal-200">
            Auto-Updating Every 3s
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100/75 text-slate-600 text-[11px] uppercase tracking-wider font-semibold border-b border-slate-200">
                <th className="py-2.5 px-4">Time</th>
                <th className="py-2.5 px-4">Device</th>
                <th className="py-2.5 px-4">Fire (Flame)</th>
                <th className="py-2.5 px-4">Smoke Level</th>
                <th className="py-2.5 px-4">Tilt / Quake</th>
                <th className="py-2.5 px-4">Water Leak</th>
                <th className="py-2.5 px-4">Persons</th>
                <th className="py-2.5 px-4">Temp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
              {telemetryHistory.length > 0 ? (
                telemetryHistory.map((packet, idx) => (
                  <tr key={packet._id || idx} className={idx === 0 ? 'bg-teal-50/30' : 'hover:bg-slate-50'}>
                    <td className="py-2.5 px-4 text-slate-500">
                      {new Date(packet.timestamp || Date.now()).toLocaleTimeString()}
                    </td>
                    <td className="py-2.5 px-4 font-bold text-slate-900">{packet.deviceId || 'RESQ-NODE-01'}</td>
                    <td className="py-2.5 px-4">
                      {packet.flame ? (
                        <span className="px-2 py-0.5 rounded bg-rose-600 text-white font-bold text-[10px]">
                          FIRE!
                        </span>
                      ) : (
                        <span className="text-emerald-700">Clear</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 font-bold text-amber-700">
                      {packet.smoke || packet.gas || 50} PPM
                    </td>
                    <td className="py-2.5 px-4">
                      {packet.tilt || packet.earthquake ? (
                        <span className="px-2 py-0.5 rounded bg-orange-600 text-white font-bold text-[10px]">
                          QUAKE!
                        </span>
                      ) : (
                        <span className="text-emerald-700">Stable ({packet.vibration || 0.04}g)</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4">
                      {packet.water ? (
                        <span className="px-2 py-0.5 rounded bg-cyan-600 text-white font-bold text-[10px]">
                          LEAK!
                        </span>
                      ) : (
                        <span className="text-emerald-700">Dry</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 font-bold text-purple-700">
                      {packet.personCount || 3} in room
                    </td>
                    <td className="py-2.5 px-4 text-rose-600">
                      {packet.temperature || 24.5} °C
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-xs text-slate-400 font-sans">
                    Waiting for incoming telemetry packets...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Hardware Guide Modal */}
      <HardwareGuideModal isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} />
    </div>
  );
};

export default HomePage;
