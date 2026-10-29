import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  Download,
  Calendar,
  Filter,
  Activity,
  Layers,
  ShieldAlert,
  Cpu,
  TrendingUp,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import api from '../../services/api';

const AnalyticsPage = () => {
  const [range, setRange] = useState('7d');
  const [selectedDevice, setSelectedDevice] = useState('ALL');
  const [devices, setDevices] = useState([]);
  const [readings, setReadings] = useState([]);
  const [incidentStats, setIncidentStats] = useState(null);
  const [deviceHealth, setDeviceHealth] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const [readingsRes, incidentsRes, healthRes, devicesRes] = await Promise.all([
        api.get(`/analytics/readings?range=${range}&deviceId=${selectedDevice}`),
        api.get(`/analytics/incidents?range=${range}`),
        api.get('/analytics/device-health'),
        api.get('/devices'),
      ]);

      if (readingsRes.data?.success) {
        const formatted = readingsRes.data.readings.map((r) => ({
          time: new Date(r.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit' }),
          temperature: r.temperature,
          humidity: r.humidity,
          gas: r.gas,
        }));
        setReadings(formatted);
      }
      if (incidentsRes.data?.success) setIncidentStats(incidentsRes.data);
      if (healthRes.data?.success) setDeviceHealth(healthRes.data.devices);
      if (devicesRes.data?.success) setDevices(devicesRes.data.devices);
    } catch (err) {
      console.error('Error fetching analytics data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [range, selectedDevice]);

  const handleExportCsv = async () => {
    try {
      setExporting(true);
      const res = await api.get(`/analytics/export-csv?range=${range}&deviceId=${selectedDevice}`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `resq-telemetry-${range}-${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      alert('CSV Export failed. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const severityData = [
    { name: 'Critical Hazards', value: incidentStats?.severityBreakdown?.critical || 0, color: '#f43f5e' },
    { name: 'Warnings', value: incidentStats?.severityBreakdown?.warning || 0, color: '#f59e0b' },
  ];

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Telemetry Analytics & Reports</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Persisted historical time-series telemetry aggregations and incident statistics.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Time range selector */}
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-xs shadow-sm">
            {['1h', '24h', '7d', '30d'].map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-3 py-1.5 rounded-md font-semibold transition-colors ${
                  range === r
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {r.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Device filter dropdown */}
          <select
            value={selectedDevice}
            onChange={(e) => setSelectedDevice(e.target.value)}
            className="text-xs bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 shadow-sm"
          >
            <option value="ALL">All Registered Nodes</option>
            {devices.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.deviceId} — {d.name}
              </option>
            ))}
          </select>

          {/* CSV Export Button */}
          <button
            onClick={handleExportCsv}
            disabled={exporting}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{exporting ? 'Exporting...' : 'Export CSV'}</span>
          </button>
        </div>
      </div>

      {/* Main Historical Chart */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-card space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Historical Environmental Sensor Readings</h2>
            <p className="text-xs text-slate-500">
              Aggregated time-series trend over the selected {range} window ({readings.length} sample points)
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono">
            <span className="flex items-center gap-1.5 text-rose-600 font-semibold">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span> Temp (°C)
            </span>
            <span className="flex items-center gap-1.5 text-teal-600 font-semibold">
              <span className="w-2.5 h-2.5 rounded-full bg-teal-500"></span> Humidity (%)
            </span>
            <span className="flex items-center gap-1.5 text-amber-600 font-semibold">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> Gas (PPM)
            </span>
          </div>
        </div>

        <div className="h-80 w-full pt-2">
          {readings.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={readings} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
                <Line
                  type="monotone"
                  dataKey="temperature"
                  name="Temperature (°C)"
                  stroke="#f43f5e"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="humidity"
                  name="Humidity (%)"
                  stroke="#14b8a6"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="gas"
                  name="Gas (PPM)"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-xs text-slate-400">
              No historical sensor data found for this range.
            </div>
          )}
        </div>
      </div>

      {/* Incident Distribution Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Incident Severity Pie */}
        <div className="lg:col-span-5 bg-white p-5 rounded-xl border border-slate-200 shadow-card flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Incident Severity Distribution</h3>
            <p className="text-xs text-slate-500">Hazard events broken down by severity rating</p>
          </div>

          <div className="h-56 w-full flex items-center justify-center my-2">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={severityData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {severityData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-2 gap-2 text-center text-xs pt-2 border-t border-slate-100">
            <div className="p-2 bg-rose-50 rounded-lg">
              <span className="text-slate-500 text-[10px] block font-semibold uppercase">Critical</span>
              <span className="font-bold text-base text-rose-700">
                {incidentStats?.severityBreakdown?.critical || 0}
              </span>
            </div>
            <div className="p-2 bg-amber-50 rounded-lg">
              <span className="text-slate-500 text-[10px] block font-semibold uppercase">Warnings</span>
              <span className="font-bold text-base text-amber-700">
                {incidentStats?.severityBreakdown?.warning || 0}
              </span>
            </div>
          </div>
        </div>

        {/* Device Health & Readings Count Table */}
        <div className="lg:col-span-7 bg-white p-5 rounded-xl border border-slate-200 shadow-card">
          <div className="mb-4">
            <h3 className="text-sm font-bold text-slate-900">Hardware Fleet Reliability & Uptime</h3>
            <p className="text-xs text-slate-500">Total historical telemetry records and incident frequency per node</p>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-600 text-[11px] uppercase tracking-wider">
                  <th className="py-2.5 px-3 font-semibold">Node ID</th>
                  <th className="py-2.5 px-3 font-semibold">Status</th>
                  <th className="py-2.5 px-3 font-semibold">Archived Packets</th>
                  <th className="py-2.5 px-3 font-semibold">Incidents</th>
                  <th className="py-2.5 px-3 font-semibold">Signal RSSI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                {deviceHealth.map((dh) => (
                  <tr key={dh.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 font-bold text-slate-900">{dh.deviceId}</td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                          dh.status === 'online' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {dh.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-700">{dh.readingsCount?.toLocaleString()}</td>
                    <td className="py-2.5 px-3">
                      <span className={dh.alertCount > 0 ? 'text-rose-600 font-bold' : 'text-slate-400'}>
                        {dh.alertCount}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-500">{dh.rssi} dBm</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsPage;
