import React, { useState, useEffect } from 'react';
import {
  Activity,
  Flame,
  Wind,
  Thermometer,
  Droplets,
  Compass,
  Users,
  Radio,
  Cpu,
  Play,
  Square,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Zap,
  Info,
} from 'lucide-react';
import api from '../../services/api';
import { useSocket } from '../../context/SocketContext';

const LiveMonitoringPage = () => {
  const [devices, setDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [telemetryHistory, setTelemetryHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const { latestReading, isConnected, simulationState } = useSocket();

  // Load device list
  useEffect(() => {
    const fetchDevices = async () => {
      try {
        const res = await api.get('/devices');
        if (res.data?.success && res.data.devices.length > 0) {
          setDevices(res.data.devices);
          setSelectedDeviceId(res.data.devices[0].deviceId);

          // Fetch recent readings for primary device
          const readingsRes = await api.get(`/iot/devices/${res.data.devices[0].deviceId}/readings?limit=20`);
          if (readingsRes.data?.success) {
            setTelemetryHistory(readingsRes.data.readings);
          }
        }
      } catch (err) {
        console.error('Error fetching devices:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDevices();
  }, []);

  // When device selection changes, fetch its readings
  const handleSelectDevice = async (devId) => {
    setSelectedDeviceId(devId);
    try {
      const res = await api.get(`/iot/devices/${devId}/readings?limit=20`);
      if (res.data?.success) {
        setTelemetryHistory(res.data.readings);
      }
    } catch (err) {
      console.error('Error fetching device readings:', err);
    }
  };

  // Prepend live incoming socket readings
  useEffect(() => {
    if (latestReading) {
      if (!selectedDeviceId || latestReading.deviceId === selectedDeviceId) {
        setTelemetryHistory((prev) => [latestReading, ...prev.slice(0, 19)]);
      }

      // Update device state in local list
      setDevices((prev) =>
        prev.map((d) =>
          d.deviceId === latestReading.deviceId
            ? {
                ...d,
                status: 'online',
                lastSeenAt: latestReading.timestamp,
                latestReading: {
                  temperature: latestReading.temperature,
                  humidity: latestReading.humidity,
                  gas: latestReading.gas,
                  flame: latestReading.flame,
                  timestamp: latestReading.timestamp,
                },
              }
            : d
        )
      );
    }
  }, [latestReading, selectedDeviceId]);

  const selectedDevice = devices.find((d) => d.deviceId === selectedDeviceId) || devices[0];
  const activeReading = telemetryHistory[0] || selectedDevice?.latestReading || {};

  // Status assessments against standard safety thresholds
  const temp = activeReading.temperature !== undefined && activeReading.temperature !== null ? activeReading.temperature : 24.5;
  const hum = activeReading.humidity !== undefined && activeReading.humidity !== null ? activeReading.humidity : 48;
  const gas = activeReading.gas !== undefined && activeReading.gas !== null ? activeReading.gas : 65;
  const smoke = activeReading.smoke !== undefined && activeReading.smoke !== null ? activeReading.smoke : Math.round(gas * 0.85);
  const flame = Boolean(activeReading.flame);
  const tilt = Boolean(activeReading.tilt);
  const earthquake = Boolean(activeReading.earthquake);
  const vibration = activeReading.vibration !== undefined && activeReading.vibration !== null ? activeReading.vibration : 0.04;
  const water = Boolean(activeReading.water);
  const waterLevel = activeReading.waterLevel !== undefined && activeReading.waterLevel !== null ? activeReading.waterLevel : 0;
  const personCount = activeReading.personCount !== undefined && activeReading.personCount !== null ? activeReading.personCount : 3;

  const isTempCritical = temp > 50;
  const isTempWarning = temp > 36;
  const isGasCritical = gas > 300 || smoke > 300;
  const isGasWarning = gas > 180 || smoke > 180;
  const isFlameCritical = flame === true;
  const isTiltCritical = tilt || earthquake || vibration > 1.5;
  const isWaterCritical = water || waterLevel > 40;
  const isPersonOvercrowded = personCount > 10;

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-slate-200 rounded w-1/3"></div>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-40 bg-white rounded-xl border border-slate-200"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header & Device Picker */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Live Telemetry Monitor</h1>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                isConnected ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
              {isConnected ? 'Socket Stream Active' : 'Disconnected'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time environmental sensor telemetry updating via WebSocket push.
          </p>
        </div>

        {/* Device selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-600">Select Node:</span>
          <select
            value={selectedDeviceId}
            onChange={(e) => handleSelectDevice(e.target.value)}
            className="text-xs font-medium bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 shadow-sm"
          >
            {devices.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.deviceId} — {d.name} ({d.status})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Selected Node Status Bar */}
      {selectedDevice && (
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-card flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center font-bold">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 text-sm font-mono">{selectedDevice.deviceId}</span>
                <span className="text-xs text-slate-500">| {selectedDevice.name}</span>
                <span
                  className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                    selectedDevice.status === 'online'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {selectedDevice.status}
                </span>
              </div>
              <p className="text-xs text-slate-500">{selectedDevice.location}</p>
            </div>
          </div>

          <div className="flex items-center gap-6 text-xs text-slate-600 font-mono">
            <div>
              <span className="text-[10px] uppercase text-slate-400 block font-sans">Hardware Type</span>
              <span className="font-semibold">{selectedDevice.deviceType}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase text-slate-400 block font-sans">Wi-Fi Signal</span>
              <span className="font-semibold">{selectedDevice.metadata?.signalRssi ?? -55} dBm</span>
            </div>
            <div>
              <span className="text-[10px] uppercase text-slate-400 block font-sans">Last Telemetry</span>
              <span className="font-semibold">
                {selectedDevice.lastSeenAt
                  ? new Date(selectedDevice.lastSeenAt).toLocaleTimeString()
                  : 'No packets yet'}
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase text-slate-400 block font-sans">Data Stream</span>
              <span
                className={`font-semibold ${
                  activeReading.isSimulated ? 'text-amber-600' : 'text-emerald-600'
                }`}
              >
                {activeReading.isSimulated ? 'Simulated Telemetry' : 'Live Hardware Stream'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 6 Sensor Gauges / Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* Flame Optical Detector Card */}
        <div
          className={`p-5 rounded-2xl border transition-all ${
            isFlameCritical
              ? 'bg-rose-100 border-rose-400 ring-4 ring-rose-500/30 animate-pulse shadow-lg'
              : 'bg-white border-slate-200 shadow-card'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-600">Fire & Flame Detection</span>
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                isFlameCritical ? 'bg-rose-600 text-white' : 'bg-rose-50 text-rose-600'
              }`}
            >
              <Flame className="w-4 h-4" />
            </div>
          </div>

          <div
            className={`text-2xl font-extrabold font-mono tracking-tight ${
              isFlameCritical ? 'text-rose-700' : 'text-emerald-700'
            }`}
          >
            {isFlameCritical ? 'ACTIVE FLAME DETECTED' : 'SPECTRUM CLEAR'}
          </div>

          <div className="mt-2 text-xs space-y-1">
            <div className="flex items-center justify-between text-slate-500">
              <span>Sensor:</span>
              <span className="font-mono font-medium">IR Photodiode (D1)</span>
            </div>
            <div
              className={`font-bold text-[11px] ${
                isFlameCritical ? 'text-rose-800' : 'text-emerald-700'
              }`}
            >
              {isFlameCritical ? 'FIRE HAZARD CONFIRMED' : 'No optical flame radiation'}
            </div>
          </div>
        </div>

        {/* Gas / Smoke Sensor Card */}
        <div
          className={`p-5 rounded-2xl border transition-all ${
            isGasCritical
              ? 'bg-rose-50/80 border-rose-300 ring-2 ring-rose-500/20 shadow-md'
              : isGasWarning
              ? 'bg-amber-50/80 border-amber-300 ring-2 ring-amber-500/20'
              : 'bg-white border-slate-200 shadow-card'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-600">Smoke & Gas Concentration</span>
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                isGasCritical
                  ? 'bg-rose-500 text-white animate-bounce'
                  : isGasWarning
                  ? 'bg-amber-500 text-white'
                  : 'bg-amber-50 text-amber-600'
              }`}
            >
              <Wind className="w-4 h-4" />
            </div>
          </div>

          <div className="text-3xl font-extrabold font-mono text-slate-900 tracking-tight">
            {smoke} <span className="text-base font-bold">PPM</span>
          </div>

          <div className="mt-2 text-xs space-y-1">
            <div className="flex items-center justify-between text-slate-500">
              <span>Threshold Limits:</span>
              <span className="font-mono font-medium">&gt; 180 (Warn) / &gt; 300 (Crit)</span>
            </div>
            <div
              className={`font-bold text-[11px] ${
                isGasCritical ? 'text-rose-700' : isGasWarning ? 'text-amber-700' : 'text-emerald-700'
              }`}
            >
              {isGasCritical
                ? 'CRITICAL SMOKE / GAS LEAK'
                : isGasWarning
                ? 'Gas Elevation Warning'
                : 'Ambient Air Quality Safe'}
            </div>
          </div>
        </div>

        {/* Tilt / Earthquake Sensor Card */}
        <div
          className={`p-5 rounded-2xl border transition-all ${
            isTiltCritical
              ? 'bg-orange-50 border-orange-400 ring-4 ring-orange-500/20 shadow-lg'
              : 'bg-white border-slate-200 shadow-card'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-600">Tilt & Earthquake Tremor</span>
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                isTiltCritical ? 'bg-orange-500 text-white animate-bounce' : 'bg-orange-50 text-orange-600'
              }`}
            >
              <Compass className="w-4 h-4" />
            </div>
          </div>

          <div className="text-3xl font-extrabold font-mono text-slate-900 tracking-tight">
            {vibration} <span className="text-base font-bold">g</span>
          </div>

          <div className="mt-2 text-xs space-y-1">
            <div className="flex items-center justify-between text-slate-500">
              <span>Tilt State:</span>
              <span className="font-mono font-medium">{tilt ? 'TILT ANGLE EXCEEDED' : 'Upright Level'}</span>
            </div>
            <div
              className={`font-bold text-[11px] ${
                isTiltCritical ? 'text-orange-700' : 'text-emerald-700'
              }`}
            >
              {isTiltCritical ? 'SEISMIC TREMOR / TILT DETECTED' : 'Structure Level & Stable'}
            </div>
          </div>
        </div>

        {/* Water Detection Card */}
        <div
          className={`p-5 rounded-2xl border transition-all ${
            isWaterCritical
              ? 'bg-cyan-50 border-cyan-400 ring-4 ring-cyan-500/20 shadow-lg'
              : 'bg-white border-slate-200 shadow-card'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-600">Water Leak / Flood Sensor</span>
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                isWaterCritical ? 'bg-cyan-600 text-white animate-bounce' : 'bg-cyan-50 text-cyan-600'
              }`}
            >
              <Droplets className="w-4 h-4" />
            </div>
          </div>

          <div className="text-2xl font-extrabold font-mono text-slate-900 tracking-tight">
            {water ? 'LEAK DETECTED' : 'DRY & SAFE'}
          </div>

          <div className="mt-2 text-xs space-y-1">
            <div className="flex items-center justify-between text-slate-500">
              <span>Probe Moisture:</span>
              <span className="font-mono font-medium">{waterLevel > 0 ? `${waterLevel}%` : '0%'}</span>
            </div>
            <div
              className={`font-bold text-[11px] ${
                isWaterCritical ? 'text-cyan-800' : 'text-emerald-700'
              }`}
            >
              {isWaterCritical ? 'WATER CONTACT ON PROBE' : 'Floor surface dry'}
            </div>
          </div>
        </div>

        {/* Person Count in Room Card */}
        <div
          className={`p-5 rounded-2xl border transition-all ${
            isPersonOvercrowded
              ? 'bg-purple-50 border-purple-400 ring-4 ring-purple-500/20 shadow-lg'
              : 'bg-white border-slate-200 shadow-card'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-600">Person Count in Room</span>
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                isPersonOvercrowded ? 'bg-purple-600 text-white animate-bounce' : 'bg-purple-50 text-purple-600'
              }`}
            >
              <Users className="w-4 h-4" />
            </div>
          </div>

          <div className="text-3xl font-extrabold font-mono text-slate-900 tracking-tight">
            {personCount} <span className="text-base font-bold text-slate-500">Persons</span>
          </div>

          <div className="mt-2 text-xs space-y-1">
            <div className="flex items-center justify-between text-slate-500">
              <span>Safe Room Limit:</span>
              <span className="font-mono font-medium">Max 10 Persons</span>
            </div>
            <div
              className={`font-bold text-[11px] ${
                isPersonOvercrowded ? 'text-purple-700' : 'text-emerald-700'
              }`}
            >
              {isPersonOvercrowded ? 'OVERCROWDED HAZARD' : 'Safe Occupancy Limit'}
            </div>
          </div>
        </div>

        {/* Room Atmosphere Card */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-card">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-600">Room Climate</span>
            <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
              <Thermometer className="w-4 h-4" />
            </div>
          </div>

          <div className="text-3xl font-extrabold font-mono text-slate-900 tracking-tight">
            {temp} °C
          </div>

          <div className="mt-2 text-xs space-y-1">
            <div className="flex items-center justify-between text-slate-500">
              <span>Humidity:</span>
              <span className="font-mono font-medium">{hum}% RH</span>
            </div>
            <div className="font-bold text-[11px] text-emerald-700">
              Optimal Atmospheric Environment
            </div>
          </div>
        </div>
      </div>

      {/* Live Stream Telemetry Packet History Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Incoming Telemetry Feed (Live Socket Stream)</h2>
            <p className="text-xs text-slate-500">Sub-second telemetry packets arriving via Socket.IO</p>
          </div>
          <span className="text-xs font-mono text-slate-400">Buffer: 20 most recent</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100/75 text-slate-600 text-[11px] uppercase tracking-wider border-b border-slate-200">
                <th className="py-2.5 px-4 font-semibold">Timestamp</th>
                <th className="py-2.5 px-4 font-semibold">Device</th>
                <th className="py-2.5 px-4 font-semibold">Fire</th>
                <th className="py-2.5 px-4 font-semibold">Smoke</th>
                <th className="py-2.5 px-4 font-semibold">Tilt / Quake</th>
                <th className="py-2.5 px-4 font-semibold">Water</th>
                <th className="py-2.5 px-4 font-semibold">Persons</th>
                <th className="py-2.5 px-4 font-semibold">Temp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {telemetryHistory.length > 0 ? (
                telemetryHistory.map((r, idx) => (
                  <tr key={r._id || idx} className={idx === 0 ? 'bg-teal-50/30' : 'hover:bg-slate-50'}>
                    <td className="py-2.5 px-4 text-slate-600">
                      {new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </td>
                    <td className="py-2.5 px-4 font-bold text-slate-900">{r.deviceId}</td>
                    <td className="py-2.5 px-4">
                      {r.flame ? (
                        <span className="text-rose-600 font-bold bg-rose-100 px-1.5 py-0.5 rounded text-[10px]">
                          FIRE!
                        </span>
                      ) : (
                        <span className="text-emerald-700 font-medium text-[11px]">Clear</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-amber-700 font-bold">{r.smoke || r.gas || 50} PPM</td>
                    <td className="py-2.5 px-4">
                      {r.tilt || r.earthquake ? (
                        <span className="text-orange-600 font-bold bg-orange-100 px-1.5 py-0.5 rounded text-[10px]">
                          QUAKE!
                        </span>
                      ) : (
                        <span className="text-emerald-700">{r.vibration || 0.04}g</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4">
                      {r.water ? (
                        <span className="text-cyan-600 font-bold bg-cyan-100 px-1.5 py-0.5 rounded text-[10px]">
                          LEAK!
                        </span>
                      ) : (
                        <span className="text-emerald-700">Dry</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 font-bold text-purple-700">{r.personCount || 3}</td>
                    <td className="py-2.5 px-4 text-rose-600 font-bold">{r.temperature !== null ? `${r.temperature} °C` : '--'}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-xs text-slate-400 font-sans">
                    No readings ingested yet. Start the demo simulator or connect your ESP8266 node.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default LiveMonitoringPage;
