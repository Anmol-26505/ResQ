import React, { useState, useEffect } from 'react';
import {
  Flame,
  Wind,
  Compass,
  Droplets,
  Thermometer,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Volume2,
  VolumeX,
  Zap,
  Bell,
  Send,
  Check,
  X,
  ShieldCheck,
} from 'lucide-react';
import api from '../../services/api';
import { useSocket } from '../../context/SocketContext';
import HardwareGuideModal from '../../components/HardwareGuideModal';
import audioAlarmService from '../../services/audioAlarm';

const HomePage = () => {
  const [devices, setDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [telemetryHistory, setTelemetryHistory] = useState([]);
  const [activeAlerts, setActiveAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [simLoading, setSimLoading] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  // Audio Alarm state
  const [isMuted, setIsMuted] = useState(audioAlarmService.isMuted);
  const [isAudioUnlocked, setIsAudioUnlocked] = useState(false);
  const [testingTelegram, setTestingTelegram] = useState(false);
  const [telegramStatus, setTelegramStatus] = useState(null);

  const { latestReading, isConnected, recentAlerts } = useSocket();

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

  // Automatic 2-second synchronization hook querying GET /api/sensors/latest
  useEffect(() => {
    const pollInterval = setInterval(async () => {
      try {
        const [sensorRes, alertsRes] = await Promise.all([
          api.get('/sensors/latest'),
          api.get('/alerts?status=active&limit=10'),
        ]);

        if (sensorRes.data?.success) {
          const freshReading = sensorRes.data.latestReading || sensorRes.data.reading;
          if (freshReading) {
            setTelemetryHistory((prev) => {
              if (prev.length === 0 || !prev[0]?.timestamp) {
                return [freshReading];
              }
              const prevTime = new Date(prev[0].timestamp).getTime();
              const freshTime = new Date(freshReading.timestamp).getTime();
              if (freshTime > prevTime) {
                return [freshReading, ...prev.slice(0, 14)];
              }
              return prev;
            });
          }

          if (sensorRes.data.devices && sensorRes.data.devices.length > 0) {
            setDevices(sensorRes.data.devices);
            if (!selectedDeviceId) {
              setSelectedDeviceId(sensorRes.data.devices[0].deviceId);
            }
          }
        }

        if (alertsRes.data?.success) {
          setActiveAlerts(alertsRes.data.alerts);
        }
      } catch (err) {
        // Silent polling catch to avoid intrusive console errors during network blips
      }
    }, 2000);

    return () => clearInterval(pollInterval);
  }, [selectedDeviceId]);

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

  // Extraction of all 4 physical sensor metrics + climate
  const flameDetected = Boolean(currentData.flame);
  const temp = currentData.temperature !== undefined && currentData.temperature !== null ? currentData.temperature : 24.5;
  const hum = currentData.humidity !== undefined && currentData.humidity !== null ? currentData.humidity : 48;
  const gas = currentData.gas !== undefined && currentData.gas !== null ? currentData.gas : 65;
  const smoke = currentData.smoke !== undefined && currentData.smoke !== null ? currentData.smoke : Math.round(gas * 0.85);
  const tiltDetected = Boolean(currentData.tilt);
  const tiltAngle = currentData.tiltAngle !== undefined && currentData.tiltAngle !== null ? currentData.tiltAngle : null;
  const earthquakeDetected = Boolean(currentData.earthquake);
  const vibration = currentData.vibration !== undefined && currentData.vibration !== null ? currentData.vibration : 0.04;
  const waterDetected = Boolean(currentData.hasWaterSensor && currentData.water);
  const hasWaterSensor = Boolean(
    currentData.hasWaterSensor === true ||
    (currentData.isSimulated && (currentData.water === true || (currentData.waterLevel && currentData.waterLevel > 0)))
  );
  const waterLevel = hasWaterSensor && currentData.waterLevel !== undefined && currentData.waterLevel !== null ? currentData.waterLevel : null;
  const distance = currentData.distance !== undefined && currentData.distance !== null && currentData.distance > 0 ? currentData.distance : null;

  const isDeviceOnline = selectedDevice?.status === 'online' || (currentData.timestamp && (Date.now() - new Date(currentData.timestamp).getTime()) < 60000);
  const lastTimestamp = currentData.timestamp
    ? new Date(currentData.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : (selectedDevice?.lastSeenAt ? new Date(selectedDevice.lastSeenAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Awaiting live stream');

  // Hazard conditions
  const isFireHazard = flameDetected || temp > 50;
  const isSmokeHazard = smoke > 200 || gas > 200;
  const isTiltHazard = tiltDetected || (tiltAngle !== null && Math.abs(tiltAngle) >= 10);
  const isQuakeHazard = earthquakeDetected || vibration >= 0.25;
  
  // Water hazard is only true if a genuine water sensor is present AND triggered, or simulated in test mode
  const isWaterHazard = Boolean(hasWaterSensor && (waterDetected || (waterLevel !== null && waterLevel > 40)));

  // Filter out any false/stale water alerts (e.g. 0% reading or no sensor) from blocking the dashboard
  const genuineActiveAlerts = activeAlerts.filter((a) => {
    if (a.sensorType === 'water' || a.sensorType === 'waterLevel') {
      return Boolean(hasWaterSensor && (a.readingValue === true || Number(a.readingValue) > 40));
    }
    return true;
  });

  const anyHazardActive = isFireHazard || isSmokeHazard || isTiltHazard || isQuakeHazard || isWaterHazard || genuineActiveAlerts.length > 0;

  // Web Audio Alarm Lifecycle: play continuous siren when hazard is active
  useEffect(() => {
    if (anyHazardActive) {
      // Prioritize hazards: Fire > Earthquake > Gas > Tilt
      let hazardType = 'fire';
      if (isFireHazard) hazardType = 'fire';
      else if (isQuakeHazard) hazardType = 'earthquake';
      else if (isSmokeHazard) hazardType = 'gas';
      else if (isTiltHazard) hazardType = 'tilt';

      if (isAudioUnlocked && !isMuted) {
        audioAlarmService.startAlarm(hazardType);
      }
    } else {
      audioAlarmService.stopAlarm();
    }
  }, [anyHazardActive, isFireHazard, isSmokeHazard, isTiltHazard, isQuakeHazard, isAudioUnlocked, isMuted]);

  // Clean up audio on unmount
  useEffect(() => {
    return () => {
      audioAlarmService.stopAlarm();
    };
  }, []);

  // Auto-unlock Web Audio on first interaction anywhere on page (satisfies browser gesture autoplay policy)
  useEffect(() => {
    const handleFirstGesture = () => {
      if (!isAudioUnlocked) {
        const unlocked = audioAlarmService.init();
        if (unlocked) {
          setIsAudioUnlocked(true);
        }
      }
    };

    window.addEventListener('pointerdown', handleFirstGesture, { once: true });
    window.addEventListener('keydown', handleFirstGesture, { once: true });

    return () => {
      window.removeEventListener('pointerdown', handleFirstGesture);
      window.removeEventListener('keydown', handleFirstGesture);
    };
  }, [isAudioUnlocked]);

  // Handle User Audio Activation (satisfies browser gesture autoplay policy)
  const handleToggleAudio = () => {
    const unlocked = audioAlarmService.init();
    setIsAudioUnlocked(unlocked);
  };

  const handleToggleMute = () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    audioAlarmService.setMuted(newMuted);
    if (!isAudioUnlocked && !newMuted) {
      const unlocked = audioAlarmService.init();
      setIsAudioUnlocked(unlocked);
    }
  };

  const handleTestAlarm = (type = 'fire') => {
    const unlocked = audioAlarmService.init();
    setIsAudioUnlocked(unlocked);
    audioAlarmService.testAlarm(type);
  };

  // Test Telegram Bot integration endpoint
  const handleTestTelegram = async () => {
    setTestingTelegram(true);
    setTelegramStatus(null);
    try {
      const res = await api.post('/alerts/test-telegram');
      if (res.data?.success) {
        setTelegramStatus({ success: true, message: 'Telegram test alert delivered to bot chat!' });
      } else {
        setTelegramStatus({ success: false, message: res.data?.message || 'Telegram test failed' });
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Telegram delivery failed';
      setTelegramStatus({ success: false, message: msg });
    } finally {
      setTestingTelegram(false);
      setTimeout(() => setTelegramStatus(null), 6000);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-6 animate-pulse">
        <div className="h-10 bg-slate-200 rounded-lg w-1/3"></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-64 bg-white rounded-2xl border border-slate-200 p-6"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* 1. Header & Live System Status */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex flex-wrap items-center gap-3">
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

            {/* Device Online/Offline Live Badge */}
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                isDeviceOnline
                  ? 'bg-teal-50 text-teal-800 border border-teal-300'
                  : 'bg-slate-100 text-slate-600 border border-slate-300'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${isDeviceOnline ? 'bg-teal-500 animate-ping' : 'bg-slate-400'}`} />
              {isDeviceOnline ? 'Hardware Online' : 'Hardware Standby'}
            </span>
          </div>

          <p className="text-xs sm:text-sm text-slate-500 mt-1 flex flex-wrap items-center gap-2">
            <span>Real-time multi-hazard telemetry monitoring directly from NodeMCU ESP8266 IoT nodes.</span>
            <span className="font-mono text-teal-700 bg-teal-50 px-2 py-0.5 rounded font-medium text-[11px]">
              Last Reading: {lastTimestamp}
            </span>
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
            <span>ESP8266 Firmware & Pinout</span>
          </button>
        </div>
      </div>

      {/* 2. LAPTOP AUDIBLE ALARMS & TELEGRAM EMERGENCY TOOLBAR */}
      <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-md border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Bell className={`w-4 h-4 ${anyHazardActive ? 'text-rose-400 animate-bounce' : 'text-teal-400'}`} />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
              Laptop Audible Alarm System:
            </span>
          </div>

          {/* Alarm Current State Badge */}
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${
              isMuted
                ? 'bg-amber-950 text-amber-300 border border-amber-700/80'
                : (isAudioUnlocked
                  ? (anyHazardActive
                    ? 'bg-rose-950 text-rose-300 border border-rose-600 animate-pulse'
                    : 'bg-emerald-950 text-emerald-300 border border-emerald-700/80')
                  : 'bg-slate-800 text-slate-400 border border-slate-700')
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${isMuted ? 'bg-amber-400' : (isAudioUnlocked ? (anyHazardActive ? 'bg-rose-500 animate-ping' : 'bg-emerald-400') : 'bg-slate-400')}`} />
            {isMuted ? 'Muted' : (isAudioUnlocked ? (anyHazardActive ? 'Alarm Sounding' : 'Armed & Ready') : 'Audio Inactive')}
          </span>
        </div>

        {/* Audio System Controls */}
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
          {/* Enable / Activate Audio Button */}
          {!isAudioUnlocked && (
            <button
              onClick={handleToggleAudio}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-500 text-white rounded-xl shadow-sm transition-colors"
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span>Enable Alarm Sound</span>
            </button>
          )}

          {/* Mute / Unmute Button */}
          <button
            onClick={handleToggleMute}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition-colors ${
              isMuted
                ? 'bg-amber-950/60 hover:bg-amber-900 border-amber-700 text-amber-300'
                : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
            }`}
            title={isMuted ? 'Unmute audible alarms' : 'Mute audible alarms'}
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5 text-amber-400" /> : <Volume2 className="w-3.5 h-3.5 text-emerald-400" />}
            <span>{isMuted ? 'Unmute' : 'Mute'}</span>
          </button>

          {/* Test Alarm Sound Dropdown / Quick Buttons */}
          <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-xl border border-slate-700">
            <span className="text-[10px] text-slate-400 uppercase font-bold px-2">Test:</span>
            <button
              onClick={() => handleTestAlarm('fire')}
              className="px-2 py-1 hover:bg-rose-950/70 text-rose-300 rounded text-[11px] font-medium"
              title="Test Fire Siren (880/660Hz rapid alternation)"
            >
              Fire
            </button>
            <button
              onClick={() => handleTestAlarm('gas')}
              className="px-2 py-1 hover:bg-amber-950/70 text-amber-300 rounded text-[11px] font-medium"
              title="Test Gas Alert (Double-beep chime)"
            >
              Gas
            </button>
            <button
              onClick={() => handleTestAlarm('tilt')}
              className="px-2 py-1 hover:bg-orange-950/70 text-orange-300 rounded text-[11px] font-medium"
              title="Test Tilt Alert (Descending slide)"
            >
              Tilt
            </button>
            <button
              onClick={() => handleTestAlarm('earthquake')}
              className="px-2 py-1 hover:bg-red-950/70 text-red-300 rounded text-[11px] font-medium"
              title="Test Earthquake Alert (Low-frequency rumble)"
            >
              Quake
            </button>
          </div>

          {/* Test Telegram Notification Button */}
          <button
            onClick={handleTestTelegram}
            disabled={testingTelegram}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600/90 hover:bg-blue-600 text-white rounded-xl shadow-sm transition-colors disabled:opacity-50"
            title="Send test message to Telegram bot using configured TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID"
          >
            <Send className="w-3.5 h-3.5 text-blue-200" />
            <span>{testingTelegram ? 'Testing Bot...' : 'Test Telegram'}</span>
          </button>
        </div>
      </div>

      {/* Telegram status notification toast banner */}
      {telegramStatus && (
        <div
          className={`p-3 rounded-xl text-xs font-semibold flex items-center justify-between border ${
            telegramStatus.success
              ? 'bg-blue-50 text-blue-900 border-blue-200'
              : 'bg-rose-50 text-rose-900 border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {telegramStatus.success ? <Check className="w-4 h-4 text-blue-600" /> : <X className="w-4 h-4 text-rose-600" />}
            <span>{telegramStatus.message}</span>
          </div>
          <button onClick={() => setTelegramStatus(null)} className="text-slate-400 hover:text-slate-600">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 3. Interactive One-Click Test Scenario Toolbar */}
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

        {/* 5 One-Click Test Buttons (Fire, Smoke, Tilt/Quake, Water, All Safe) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 pt-1 text-xs font-semibold">
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
        </div>
      </div>

      {/* 4. Emergency Active Alert Banner (If Any Hazard Active) */}
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
                  ? `💨 Smoke / gas concentration spiked to ${smoke} PPM (Threshold: > 200 PPM)!`
                  : isTiltHazard
                  ? `📐 Structural building tilt (${tiltAngle ?? 16}°) confirmed!`
                  : isQuakeHazard
                  ? `⚠️ Seismic vibration tremor (${vibration}g) registered!`
                  : isWaterHazard
                  ? (currentData?.isSimulated
                      ? `💧 [SIMULATED TEST] Water leak / flood scenario active (Simulated Level: ${waterLevel || 85}%)!`
                      : `💧 Water accumulation detected on floor (Moisture Level: ${waterLevel}%)!`)
                  : genuineActiveAlerts.length > 0
                  ? `⚠️ ${genuineActiveAlerts[0].title}: ${genuineActiveAlerts[0].message || 'Alert active'}`
                  : '🟢 Safety monitoring active: All systems nominal.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <button
              onClick={() => {
                handleTriggerScenario('nominal');
                audioAlarmService.stopAlarm();
              }}
              className="w-full md:w-auto px-4 py-2 bg-white text-rose-700 hover:bg-rose-50 rounded-xl text-xs font-extrabold uppercase shadow-sm transition-all"
            >
              Silence & Reset to Safe
            </button>
          </div>
        </div>
      )}

      {/* 5. THE 5 CORE DETECTION SECTIONS (Direct on Home Page) */}
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
                  <span className="text-[11px] text-slate-500 font-medium">IR Flame Optical (GPIO14 / D5)</span>
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
            <span>Telegram Bot: {isFireHazard ? 'Dispatched (Urgent)' : 'Armed'}</span>
            <span className="font-semibold text-slate-700">Digital Pin D5</span>
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
                  <span className="text-[11px] text-slate-500 font-medium">MQ-2 Gas / Smoke (ADC0 / A0)</span>
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
                Target: Combustible Gas, LPG, Methane, Smoke
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

        {/* SECTION 3: TILT & EARTHQUAKE DETECTION (Calibrated MPU6050) */}
        <div
          className={`p-6 rounded-3xl border transition-all shadow-card flex flex-col justify-between ${
            isTiltHazard || isQuakeHazard
              ? 'bg-orange-50 border-orange-400 ring-4 ring-orange-500/20 shadow-xl'
              : 'bg-white border-slate-200'
          }`}
        >
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
                    isTiltHazard || isQuakeHazard ? 'bg-orange-500 text-white animate-bounce' : 'bg-orange-50 text-orange-600'
                  }`}
                >
                  <Compass className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Tilt & Earthquake</h3>
                  <span className="text-[11px] text-slate-500 font-medium">MPU6050 6-Axis (Calibrated Baseline)</span>
                </div>
              </div>

              <span
                className={`px-2.5 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider ${
                  isTiltHazard || isQuakeHazard
                    ? 'bg-orange-600 text-white shadow-sm'
                    : 'bg-emerald-100 text-emerald-800'
                }`}
              >
                {isTiltHazard ? 'Sustained Tilt!' : (isQuakeHazard ? 'Seismic Tremor!' : 'Structure Stable')}
              </span>
            </div>

            {/* Seismic Status Callout */}
            <div className="my-5 p-4 rounded-2xl bg-white/80 border border-slate-200/80 shadow-sm text-center">
              <span className="text-xs text-slate-400 font-semibold uppercase block">Relative Structural Shift & Tremor</span>
              <div
                className={`text-3xl font-black font-mono mt-1 ${
                  vibration >= 0.25 || isTiltHazard ? 'text-orange-600 animate-pulse' : 'text-emerald-600'
                }`}
              >
                {tiltAngle !== null ? `${tiltAngle}° Relative Tilt` : (vibration > 0 ? `${vibration} g` : '0° Upright')}
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block">
                {isTiltHazard
                  ? '⚠️ Sustained structural building tilt confirmed relative to calibrated baseline!'
                  : (isQuakeHazard
                    ? `⚠️ Seismic shock deviation: ${vibration} g (Exceeds 0.25g threshold)!`
                    : `Dynamic Vibration: ${vibration} g (Stationary noise filtered) • Foundation level`)}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-slate-400 text-[10px] uppercase font-bold block">Relative Tilt</span>
                <span className={`text-base font-bold font-mono ${isTiltHazard ? 'text-orange-600' : 'text-emerald-700'}`}>
                  {tiltAngle !== null ? `${tiltAngle}°` : (tiltDetected ? 'TILTED' : '0.0°')}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-slate-400 text-[10px] uppercase font-bold block">Dynamic Vibration</span>
                <span className="text-base font-bold font-mono text-slate-700">{vibration} g</span>
              </div>
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Filter: EMA α=0.25 + 3° Hysteresis</span>
            <span className="font-semibold text-slate-700">I2C Pins D2/D1</span>
          </div>
        </div>

        {/* SECTION 4: WATER & ULTRASONIC DISTANCE */}
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
                    isWaterHazard
                      ? 'bg-cyan-600 text-white animate-bounce'
                      : !hasWaterSensor
                      ? 'bg-slate-100 text-slate-400'
                      : 'bg-cyan-50 text-cyan-600'
                  }`}
                >
                  <Droplets className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Water & Proximity</h3>
                  <span className="text-[11px] text-slate-500 font-medium">HC-SR04 Proximity • Floor Probe (Optional)</span>
                </div>
              </div>

              <span
                className={`px-2.5 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider ${
                  isWaterHazard
                    ? 'bg-cyan-600 text-white shadow-sm'
                    : !hasWaterSensor
                    ? 'bg-slate-100 text-slate-600'
                    : 'bg-emerald-100 text-emerald-800'
                }`}
              >
                {isWaterHazard ? 'Water Leak Alert!' : (!hasWaterSensor ? 'Sensor Not Connected' : 'Dry & Normal')}
              </span>
            </div>

            {/* Water & Distance Status Callout */}
            <div className="my-5 p-4 rounded-2xl bg-white/80 border border-slate-200/80 shadow-sm text-center">
              <span className="text-xs text-slate-400 font-semibold uppercase block">Ultrasonic Distance / Moisture</span>
              <div
                className={`text-3xl font-black font-mono mt-1 ${
                  isWaterHazard ? 'text-cyan-600 animate-pulse' : 'text-slate-800'
                }`}
              >
                {distance !== null ? `${distance} cm Range` : (hasWaterSensor && waterLevel !== null ? `${waterLevel}%` : 'Proximity Standby')}
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block">
                {distance !== null
                  ? `Echo distance: ${distance} cm • Floor Probe: ${hasWaterSensor ? (isWaterHazard ? '⚠️ Liquid Detected!' : 'Surface dry') : 'SENSOR NOT CONNECTED'}`
                  : (hasWaterSensor ? (isWaterHazard ? '💧 Liquid accumulation detected on floor!' : 'Floor dry; normal') : 'Moisture probe not installed on physical node')}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-slate-400 text-[10px] uppercase font-bold block">Ultrasonic Range</span>
                <span className="text-base font-bold font-mono text-slate-700">
                  {distance !== null ? `${distance} cm` : 'Active'}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-slate-400 text-[10px] uppercase font-bold block">Floor Moisture Probe</span>
                <span className={`text-base font-bold font-mono ${isWaterHazard ? 'text-cyan-600' : 'text-slate-600'}`}>
                  {hasWaterSensor ? (isWaterHazard ? 'FLOOD ALERT' : `${waterLevel ?? 0}% (Dry)`) : 'Not Installed (N/A)'}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Water Emergency: {isWaterHazard ? 'ACTIVE ALERT' : 'INACTIVE'}</span>
            <span className="font-semibold text-slate-700">HC-SR04 D6/D7</span>
          </div>
        </div>

        {/* SECTION 5: ROOM CLIMATE & TELEMETRY HEARTBEAT */}
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
                <span className="text-base font-bold font-mono text-teal-700">2000 ms</span>
              </div>
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Hardware: NodeMCU ESP8266</span>
            <span className="font-semibold text-slate-700">Digital Pin D2</span>
          </div>
        </div>
      </div>

      {/* 6. Live Ingested Telemetry Feed Table (No Occupancy) */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-card overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 bg-slate-50/60">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Live Ingested Telemetry Stream</h3>
            <p className="text-xs text-slate-500">Direct packet log pushed via Socket.IO from edge microcontroller</p>
          </div>
          <span className="text-xs font-mono text-teal-700 font-bold bg-teal-50 px-2.5 py-1 rounded-lg border border-teal-200">
            Auto-Updating Every 2s
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100/75 text-slate-600 text-[11px] uppercase tracking-wider font-semibold border-b border-slate-200">
                <th className="py-2.5 px-4">Time</th>
                <th className="py-2.5 px-4">Device</th>
                <th className="py-2.5 px-4">Fire (Flame)</th>
                <th className="py-2.5 px-4">Gas / Smoke</th>
                <th className="py-2.5 px-4">MPU6050 Tilt / Quake</th>
                <th className="py-2.5 px-4">Ultrasonic / Water</th>
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
                      {packet.gas || packet.smoke || packet.mq2 || 50} PPM
                    </td>
                    <td className="py-2.5 px-4">
                      {packet.tilt || packet.earthquake ? (
                        <span className="px-2 py-0.5 rounded bg-orange-600 text-white font-bold text-[10px]">
                          {packet.tilt ? 'TILT!' : 'QUAKE!'}
                        </span>
                      ) : (
                        <span className="text-emerald-700">
                          {packet.tiltAngle !== undefined && packet.tiltAngle !== null ? `${packet.tiltAngle}°` : 'Stable'} ({packet.vibration || 0.04}g)
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 font-bold text-cyan-700">
                      {packet.distance !== undefined && packet.distance !== null ? `${packet.distance} cm` : (packet.water ? 'LEAK!' : 'Dry')}
                    </td>
                    <td className="py-2.5 px-4 text-rose-600">
                      {packet.temperature || 24.5} °C
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-xs text-slate-400 font-sans">
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
