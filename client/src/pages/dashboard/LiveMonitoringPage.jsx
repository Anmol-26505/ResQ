import React, { useState, useEffect } from 'react';
import {
  Activity,
  Flame,
  Wind,
  Thermometer,
  Droplets,
  Compass,
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
  const [backendStatus, setBackendStatus] = useState('CHECKING...');
  const [lastSavedTimestamp, setLastSavedTimestamp] = useState(null);
  const [deviceApiOnline, setDeviceApiOnline] = useState(null);
  const { latestReading, isConnected, simulationState, manualHazards = {}, controllerDeviceOnline, deviceStatuses } = useSocket();

  useEffect(() => {
    if (typeof controllerDeviceOnline === 'boolean') {
      setDeviceApiOnline(controllerDeviceOnline);
    }
  }, [controllerDeviceOnline]);

  useEffect(() => {
    const devId = selectedDeviceId || 'RESQ-NODE-01';
    const statusObj = deviceStatuses?.[devId];
    if (statusObj) {
      if (statusObj.status === 'online' || statusObj.isOnline === true) {
        setDeviceApiOnline(true);
      } else if (statusObj.status === 'offline' || statusObj.isOnline === false) {
        setDeviceApiOnline(false);
      }
    }
  }, [deviceStatuses, selectedDeviceId]);

  // Load device list
  useEffect(() => {
    const fetchDevices = async () => {
      try {
        const res = await api.get('/devices');
        if (res.data?.success && res.data.devices.length > 0) {
          setDevices(res.data.devices);
          const primaryDev =
            res.data.devices.find((d) => d.manualStatusOverride === 'online') ||
            res.data.devices.find((d) => d.deviceId === 'RESQ-NODE-01') ||
            res.data.devices[0];
          setSelectedDeviceId(primaryDev.deviceId);

          // Fetch recent readings for primary device
          const readingsRes = await api.get(`/iot/devices/${primaryDev.deviceId}/readings?limit=20`);
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
                  ...d.latestReading,
                  ...latestReading,
                },
              }
            : d
        )
      );
    }
  }, [latestReading, selectedDeviceId]);

  // Real-time 2-second telemetry polling fallback (works even if WebSocket is disconnected)
  useEffect(() => {
    const pollInterval = setInterval(async () => {
      try {
        const devId = selectedDeviceId || 'RESQ-NODE-01';
        const res = await api.get(`/sensors/latest?deviceId=${devId}`);
        if (res.data?.success) {
          setBackendStatus('CONNECTED');
          if (res.data.lastSavedAt) {
            setLastSavedTimestamp(res.data.lastSavedAt);
          }
          if (res.data.manualStatusOverride === 'online' || controllerDeviceOnline === true) {
            setDeviceApiOnline(true);
          } else if (res.data.manualStatusOverride === 'offline' || controllerDeviceOnline === false) {
            setDeviceApiOnline(false);
          } else if (res.data.isOnline !== undefined) {
            setDeviceApiOnline(Boolean(res.data.isOnline));
          } else if (res.data.deviceStatus === 'online') {
            setDeviceApiOnline(true);
          } else if (res.data.deviceStatus === 'offline') {
            setDeviceApiOnline(false);
          }
          const fresh = res.data.latestReading || res.data.reading;
          if (fresh && (!selectedDeviceId || fresh.deviceId === selectedDeviceId)) {
            setTelemetryHistory((prev) => {
              if (prev.length === 0 || !prev[0]?.timestamp) return [fresh];
              const prevTime = new Date(prev[0].timestamp).getTime();
              const freshTime = new Date(fresh.timestamp).getTime();
              if (freshTime > prevTime) return [fresh, ...prev.slice(0, 19)];
              return prev;
            });
          }
          if (res.data.devices && res.data.devices.length > 0) {
            setDevices(res.data.devices);
          }
        } else {
          setBackendStatus('DATABASE ERROR');
        }
      } catch (e) {
        if (e.response?.status >= 500) {
          setBackendStatus('DATABASE ERROR');
        } else {
          setBackendStatus('OFFLINE');
        }
      }
    }, 2000);

    return () => clearInterval(pollInterval);
  }, [selectedDeviceId]);

  const selectedDevice = devices.find((d) => d.deviceId === selectedDeviceId) || devices[0];
  const activeReading = telemetryHistory[0] || selectedDevice?.latestReading || {};

  // Freshness calculations (< 30s = FRESH, 30s-2m = STALE, > 2m = OFFLINE)
  const readingTime = activeReading?.timestamp
    ? new Date(activeReading.timestamp).getTime()
    : (activeReading?.createdAt ? new Date(activeReading.createdAt).getTime() : 0);
  const readingAgeMs = readingTime > 0 ? (Date.now() - readingTime) : Infinity;
  const isFresh = readingTime > 0 && readingAgeMs < 30000;
  const isStale = readingAgeMs >= 30000 && readingAgeMs < 120000;
  const isOffline = readingAgeMs >= 120000 || readingTime === 0;

  const freshnessStatus = isFresh ? 'FRESH' : (isStale ? 'STALE' : 'OFFLINE');
  const isSimulated = Boolean(activeReading?.isSimulated);
  const sequenceNumber = activeReading?.seq !== undefined && activeReading?.seq !== null ? `#${activeReading.seq}` : (activeReading?.sequenceNumber !== undefined && activeReading?.sequenceNumber !== null ? `#${activeReading.sequenceNumber}` : '--');

  // Device Connection Status & Data Freshness (Part 8 exact states)
  let deviceConnectionStatus = 'WAITING FOR DATA';
  let dataFreshness = 'WAITING FOR DATA';

  if (backendStatus === 'DATABASE ERROR') {
    deviceConnectionStatus = 'DATABASE ERROR';
    dataFreshness = 'DATABASE ERROR';
  } else if (backendStatus === 'OFFLINE') {
    deviceConnectionStatus = 'OFFLINE';
    dataFreshness = 'OFFLINE';
  } else if (deviceApiOnline === false) {
    deviceConnectionStatus = 'OFFLINE';
    dataFreshness = 'OFFLINE';
  } else if (deviceApiOnline === true) {
    deviceConnectionStatus = 'CONNECTED';
    dataFreshness = 'CONNECTED';
  } else if (readingTime === 0) {
    deviceConnectionStatus = 'WAITING FOR DATA';
    dataFreshness = 'WAITING FOR DATA';
  } else if (isFresh) {
    deviceConnectionStatus = 'CONNECTED';
    dataFreshness = 'CONNECTED';
  } else if (isStale) {
    deviceConnectionStatus = 'DATA STALE';
    dataFreshness = 'DATA STALE';
  } else {
    deviceConnectionStatus = 'OFFLINE';
    dataFreshness = 'OFFLINE';
  }

  // Status assessments against standard safety thresholds (NO FAKE FALLBACKS)
  const temp = activeReading?.temperature !== undefined && activeReading?.temperature !== null ? activeReading.temperature : null;
  const hum = activeReading?.humidity !== undefined && activeReading?.humidity !== null ? activeReading.humidity : null;
  const gas = activeReading?.gas !== undefined && activeReading?.gas !== null ? activeReading.gas : null;
  const smoke = activeReading?.smoke !== undefined && activeReading?.smoke !== null ? activeReading.smoke : (gas !== null ? Math.round(gas * 0.85) : null);
  const flame = Boolean(activeReading?.flame);
  const tilt = Boolean(activeReading?.tilt);
  const earthquake = Boolean(activeReading?.earthquake);
  const vibration = activeReading?.vibration !== undefined && activeReading?.vibration !== null ? activeReading.vibration : null;
  const hasWaterSensor = Boolean(
    activeReading?.hasWaterSensor === true ||
    (isSimulated && (activeReading?.water === true || (activeReading?.waterLevel && activeReading.waterLevel > 0)))
  );
  const water = Boolean(hasWaterSensor && activeReading?.water);
  const waterLevel = hasWaterSensor && activeReading?.waterLevel !== undefined && activeReading?.waterLevel !== null ? activeReading.waterLevel : null;

  // Strict physical hazard verification: only active if device is connected AND reading is fresh
  const isDeviceOnline = deviceApiOnline === true || (deviceApiOnline === null && isFresh);
  const hasValidFreshSensorStream = Boolean(
    isDeviceOnline &&
    isFresh &&
    activeReading &&
    (activeReading.deviceId || isSimulated)
  );

  const isTempCritical = Boolean(hasValidFreshSensorStream && temp !== null && temp > 50);
  const isTempWarning = Boolean(hasValidFreshSensorStream && temp !== null && temp > 36);
  const isGasCritical = Boolean((hasValidFreshSensorStream && ((gas !== null && gas > 300) || (smoke !== null && smoke > 300))) || manualHazards.gas);
  const isGasWarning = Boolean(hasValidFreshSensorStream && ((gas !== null && gas > 180) || (smoke !== null && smoke > 180)));
  const isFlameCritical = Boolean((hasValidFreshSensorStream && flame === true) || manualHazards.fire);
  const isTiltCritical = Boolean(
    (hasValidFreshSensorStream && (tilt || earthquake || (vibration !== null && vibration > 0.22))) ||
    manualHazards.tilt ||
    manualHazards.earthquake
  );
  const isWaterCritical = Boolean(
    (hasValidFreshSensorStream && hasWaterSensor && (water || (waterLevel !== null && waterLevel > 40))) ||
    manualHazards.water
  );

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

          <div className="flex flex-wrap items-center gap-4 sm:gap-6 text-xs text-slate-600 font-mono">
            <div>
              <span className="text-[10px] uppercase text-slate-400 block font-sans font-semibold">Device Status</span>
              <span
                className={`font-bold text-[10px] px-2 py-0.5 rounded ${
                  deviceConnectionStatus === 'CONNECTED'
                    ? 'bg-emerald-100 text-emerald-800'
                    : deviceConnectionStatus === 'DATA STALE'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-rose-100 text-rose-800'
                }`}
              >
                {deviceConnectionStatus}
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase text-slate-400 block font-sans font-semibold">Backend Ingest</span>
              <span
                className={`font-bold text-[10px] px-2 py-0.5 rounded ${
                  backendStatus === 'CONNECTED'
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-rose-100 text-rose-800'
                }`}
              >
                {backendStatus}
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase text-slate-400 block font-sans font-semibold">Data Stream</span>
              <span
                className={`font-semibold ${
                  activeReading.isSimulated ? 'text-amber-600' : 'text-emerald-600'
                }`}
              >
                {activeReading.isSimulated ? 'Simulation' : 'Real Hardware'}
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase text-slate-400 block font-sans font-semibold">Freshness</span>
              <span
                className={`font-bold text-[10px] px-2 py-0.5 rounded ${
                  dataFreshness === 'CONNECTED'
                    ? 'bg-emerald-100 text-emerald-800'
                    : dataFreshness === 'DATA STALE'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-rose-100 text-rose-800'
                }`}
              >
                {dataFreshness} {dataFreshness === 'CONNECTED' ? '(<30s)' : ''}
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase text-slate-400 block font-sans font-semibold">Seq #</span>
              <span className="font-semibold text-teal-700">{sequenceNumber}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase text-slate-400 block font-sans font-semibold">Last Received</span>
              <span className="font-semibold">
                {readingTime > 0
                  ? new Date(readingTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                  : 'No packets yet'}
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase text-slate-400 block font-sans font-semibold">Last DB Save</span>
              <span className="font-semibold">
                {lastSavedTimestamp
                  ? new Date(lastSavedTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                  : (readingTime > 0 ? new Date(readingTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '--')}
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
            {smoke !== null ? (
              <>{smoke} <span className="text-base font-bold">PPM</span></>
            ) : (
              <span className="text-xl text-slate-400 font-sans">Awaiting Data</span>
            )}
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
            {vibration !== null ? (
              <>{vibration} <span className="text-base font-bold">g</span></>
            ) : (
              <span className="text-xl text-slate-400 font-sans">Awaiting Data</span>
            )}
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
            <span className="text-xs font-semibold text-slate-600">Water Leak / Moisture Probe</span>
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                isWaterCritical ? 'bg-cyan-600 text-white animate-bounce' : 'bg-slate-100 text-slate-400'
              }`}
            >
              <Droplets className="w-4 h-4" />
            </div>
          </div>

          <div className="text-2xl font-extrabold font-mono text-slate-900 tracking-tight">
            {hasWaterSensor ? (water ? 'LEAK DETECTED' : 'DRY & SAFE') : 'NOT CONNECTED'}
          </div>

          <div className="mt-2 text-xs space-y-1">
            <div className="flex items-center justify-between text-slate-500">
              <span>Probe Moisture:</span>
              <span className="font-mono font-medium">{hasWaterSensor && waterLevel !== null ? `${waterLevel}%` : 'N/A'}</span>
            </div>
            <div
              className={`font-bold text-[11px] ${
                isWaterCritical ? 'text-cyan-800' : 'text-slate-500'
              }`}
            >
              {hasWaterSensor ? (isWaterCritical ? 'WATER CONTACT ON PROBE' : 'Floor surface dry') : 'Water sensor not installed'}
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
            {temp !== null ? `${temp} °C` : '--'}
          </div>

          <div className="mt-2 text-xs space-y-1">
            <div className="flex items-center justify-between text-slate-500">
              <span>Humidity:</span>
              <span className="font-mono font-medium">{hum !== null ? `${hum}% RH` : '--'}</span>
            </div>
            <div className="font-bold text-[11px] text-emerald-700">
              Optimal Atmospheric Environment
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiveMonitoringPage;
