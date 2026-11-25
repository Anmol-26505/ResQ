import React, { useState, useEffect } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import {
  Cpu,
  Radio,
  Wifi,
  WifiOff,
  AlertTriangle,
  Flame,
  Activity,
  Layers,
  Clock,
  ArrowRight,
  TrendingUp,
  ShieldAlert,
  CheckCircle2,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import api from '../../services/api';
import { useSocket } from '../../context/SocketContext';

const OverviewPage = () => {
  const [stats, setStats] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { latestReading, recentAlerts, isConnected } = useSocket();
  const { openHardwareGuide } = useOutletContext() || {};

  const fetchOverviewData = async () => {
    try {
      const [overviewRes, readingsRes, devicesRes] = await Promise.all([
        api.get('/analytics/overview'),
        api.get('/analytics/readings?range=24h'),
        api.get('/devices'),
      ]);

      if (overviewRes.data?.success) setStats(overviewRes.data.data);
      if (readingsRes.data?.success) {
        // Format readings for chart
        const formatted = readingsRes.data.readings.map((r) => ({
          time: new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          temperature: r.temperature,
          humidity: r.humidity,
          gas: r.gas,
        }));
        setChartData(formatted);
      }
      if (devicesRes.data?.success) setDevices(devicesRes.data.devices);
    } catch (err) {
      console.error('Error fetching dashboard overview data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchOverviewData();
  }, []);

  // When a new reading arrives over socket, update chart & devices
  useEffect(() => {
    if (latestReading) {
      setChartData((prev) => {
        const newPoint = {
          time: new Date(latestReading.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          temperature: latestReading.temperature,
          humidity: latestReading.humidity,
          gas: latestReading.gas,
        };
        const updated = [...prev, newPoint];
        return updated.slice(-60); // keep recent 60 points
      });

      // Update specific device in state
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

      // Increment today's readings counter dynamically
      setStats((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          readings: {
            ...prev.readings,
            today: (prev.readings?.today || 0) + 1,
            total: (prev.readings?.total || 0) + 1,
          },
        };
      });
    }
  }, [latestReading]);

  const handleManualRefresh = () => {
    setRefreshing(true);
    fetchOverviewData();
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-slate-200 rounded-lg w-1/4"></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-28 bg-white rounded-xl border border-slate-200 p-4"></div>
          ))}
        </div>
        <div className="h-72 bg-white rounded-xl border border-slate-200"></div>
      </div>
    );
  }

  const activeAlertsList = stats?.recentAlerts || [];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Mission Control Overview</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time physical telemetry stream from registered ESP8266 IoT nodes.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleManualRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg text-xs font-semibold text-slate-700 shadow-sm transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Sync Stats</span>
          </button>

          <Link
            to="/dashboard/monitoring"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Live Stream</span>
          </Link>
        </div>
      </div>

      {/* Real Summary KPI Cards calculated from backend */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Devices */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-card">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Registered Nodes</span>
            <Cpu className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{stats?.devices?.total ?? 0}</div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
            <span className="font-semibold text-teal-700">{stats?.devices?.onlineRate ?? 0}%</span>
            <span>availability rate</span>
          </div>
        </div>

        {/* Online Devices */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-card">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Online Devices</span>
            <Wifi className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-emerald-700">{stats?.devices?.online ?? 0}</div>
          <div className="text-[11px] text-emerald-600 mt-1 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Heartbeat active</span>
          </div>
        </div>

        {/* Offline Devices */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-card">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Offline Devices</span>
            <WifiOff className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-slate-600">{stats?.devices?.offline ?? 0}</div>
          <div className="text-[11px] text-slate-500 mt-1">
            <span>&gt; 60s without ping</span>
          </div>
        </div>

        {/* Active Incidents */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-card">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Active Incidents</span>
            <AlertTriangle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-bold text-rose-600">{stats?.alerts?.active ?? 0}</div>
          <div className="text-[11px] text-rose-700 mt-1 flex items-center gap-1">
            <span className="font-bold">{stats?.alerts?.critical ?? 0}</span>
            <span>critical severity</span>
          </div>
        </div>

        {/* Readings Today */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-card">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Readings Today</span>
            <Layers className="w-4 h-4 text-teal-600" />
          </div>
          <div className="text-2xl font-bold text-teal-700">{stats?.readings?.today?.toLocaleString() ?? 0}</div>
          <div className="text-[11px] text-slate-500 mt-1">
            <span>{stats?.readings?.total?.toLocaleString() ?? 0} total archived</span>
          </div>
        </div>
      </div>

      {/* Main Charts & Telemetry Stream Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Recharts 24-Hour Multi-Sensor Chart */}
        <div className="lg:col-span-8 bg-white p-5 rounded-xl border border-slate-200 shadow-card space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">24-Hour Environmental Telemetry Trends</h2>
              <p className="text-xs text-slate-500">Live composite of temperature, humidity, and combustible gas levels</p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5 text-rose-600 font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span> Temp (°C)
              </span>
              <span className="flex items-center gap-1.5 text-teal-600 font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-teal-500"></span> Humidity (%)
              </span>
              <span className="flex items-center gap-1.5 text-amber-600 font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> Gas (PPM)
              </span>
            </div>
          </div>

          <div className="h-72 w-full pt-2">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="tempGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="humGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#14b8a6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="time" stroke="#94a3b8" fontSize={10} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} domain={['auto', 'auto']} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderRadius: '8px',
                      border: 'none',
                      color: '#fff',
                      fontSize: '11px',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="temperature"
                    name="Temperature (°C)"
                    stroke="#f43f5e"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#tempGradient)"
                  />
                  <Area
                    type="monotone"
                    dataKey="humidity"
                    name="Humidity (%)"
                    stroke="#14b8a6"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#humGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                Awaiting telemetry streams to populate chart...
              </div>
            )}
          </div>
        </div>

        {/* Right: Active Incidents Queue */}
        <div className="lg:col-span-4 bg-white p-5 rounded-xl border border-slate-200 shadow-card flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-600" />
              <h2 className="text-sm font-bold text-slate-900">Incident Triage Queue</h2>
            </div>
            <Link to="/dashboard/alerts" className="text-xs font-semibold text-teal-700 hover:underline">
              View All
            </Link>
          </div>

          <div className="flex-1 divide-y divide-slate-100 overflow-y-auto max-h-[300px]">
            {activeAlertsList.length > 0 ? (
              activeAlertsList.map((alert) => {
                const displayTitle = (alert.title || '')
                  .replace(/\s*\(Manual Controller\)/gi, '')
                  .replace(/\s*\[Triggered by.*?\]/gi, '')
                  .trim();
                const displayMessage = (alert.message || '')
                  .replace(/\s*\[Triggered by.*?\]/gi, '')
                  .replace(/\s*\(Manual Controller\)/gi, '')
                  .trim();

                return (
                  <div key={alert._id} className="py-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                          alert.severity === 'critical'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {alert.severity}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <h4 className="text-xs font-bold text-slate-800 truncate">{displayTitle}</h4>
                    <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">{displayMessage}</p>
                  </div>
                );
              })
            ) : (
              <div className="py-12 text-center text-xs text-slate-400 space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                <p className="font-medium text-slate-600">All Nodes Operating Nominally</p>
                <p className="text-[11px] text-slate-400">No unacknowledged hazardous conditions detected.</p>
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-slate-100 mt-auto">
            <Link
              to="/dashboard/alerts"
              className="w-full inline-flex items-center justify-center gap-1.5 py-2 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200"
            >
              <span>Manage Incident Rules</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* Node Status Grid */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-card space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Connected IoT Nodes Status</h2>
            <p className="text-xs text-slate-500">Live health, readings, and physical installation location</p>
          </div>
          <Link
            to="/dashboard/devices"
            className="text-xs font-semibold text-teal-700 hover:underline flex items-center gap-1"
          >
            <span>Device Registry</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {devices.map((dev) => {
            const isOnline = dev.status === 'online';
            const reading = dev.latestReading || {};

            return (
              <div
                key={dev._id}
                className="p-4 rounded-xl border border-slate-200 hover:border-slate-300 transition-colors bg-slate-50/50 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                      }`}
                    />
                    <h3 className="font-bold text-xs text-slate-900 font-mono">{dev.deviceId}</h3>
                  </div>
                  <span
                    className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                      isOnline
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {dev.status}
                  </span>
                </div>

                <div className="space-y-0.5">
                  <p className="text-xs font-semibold text-slate-800 truncate">{dev.name}</p>
                  <p className="text-[11px] text-slate-500 truncate">{dev.location}</p>
                </div>

                {/* Latest readings row */}
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200 text-center font-mono">
                  <div className="p-1.5 bg-white rounded border border-slate-200">
                    <span className="text-[9px] text-slate-400 block font-sans">TEMP</span>
                    <span className="text-xs font-bold text-slate-800">
                      {reading.temperature !== undefined && reading.temperature !== null ? `${reading.temperature}°C` : '--'}
                    </span>
                  </div>

                  <div className="p-1.5 bg-white rounded border border-slate-200">
                    <span className="text-[9px] text-slate-400 block font-sans">HUM</span>
                    <span className="text-xs font-bold text-slate-800">
                      {reading.humidity !== undefined && reading.humidity !== null ? `${reading.humidity}%` : '--'}
                    </span>
                  </div>

                  <div className="p-1.5 bg-white rounded border border-slate-200">
                    <span className="text-[9px] text-slate-400 block font-sans">GAS</span>
                    <span className="text-xs font-bold text-teal-700">
                      {reading.gas !== undefined && reading.gas !== null ? `${reading.gas}` : '--'}
                    </span>
                  </div>
                </div>

                <div className="text-[10px] text-slate-400 flex items-center justify-between pt-1 font-mono">
                  <span>RSSI: {dev.metadata?.signalRssi ?? -60} dBm</span>
                  <span>{dev.lastSeenAt ? new Date(dev.lastSeenAt).toLocaleTimeString() : 'Never'}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default OverviewPage;
