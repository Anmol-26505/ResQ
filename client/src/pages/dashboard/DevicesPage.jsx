import React, { useState, useEffect } from 'react';
import {
  Cpu,
  Plus,
  Search,
  Wifi,
  WifiOff,
  Key,
  Copy,
  Check,
  RefreshCw,
  Edit,
  Trash2,
  ExternalLink,
  Shield,
  Clock,
  Radio,
  X,
  AlertTriangle,
} from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';

const DevicesPage = () => {
  const [devices, setDevices] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
  const [activeApiKey, setActiveApiKey] = useState('');
  const [copiedKey, setCopiedKey] = useState(false);
  const [deviceHistory, setDeviceHistory] = useState([]);

  // New device form state
  const [newDeviceId, setNewDeviceId] = useState('');
  const [newName, setNewName] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [newDeviceType, setNewDeviceType] = useState('NodeMCU ESP8266');
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const { isAdmin } = useAuth();
  const { isConnected, latestReading } = useSocket();

  const fetchDevices = async () => {
    try {
      const res = await api.get('/devices');
      if (res.data?.success) {
        setDevices(res.data.devices);
      }
    } catch (err) {
      console.error('Error fetching device list:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDevices();
  }, []);

  // Update status when live reading arrives
  useEffect(() => {
    if (latestReading) {
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
  }, [latestReading]);

  const handleCreateDevice = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!newDeviceId || !newName) {
      setFormError('Please fill in Device ID and Name');
      return;
    }

    try {
      setFormSubmitting(true);
      const res = await api.post('/devices', {
        deviceId: newDeviceId.toUpperCase(),
        name: newName,
        location: newLocation,
        deviceType: newDeviceType,
        supportedSensors: ['temperature', 'humidity', 'gas', 'flame'],
      });

      if (res.data?.success) {
        setIsAddModalOpen(false);
        setActiveApiKey(res.data.device.apiKey);
        setIsKeyModalOpen(true);
        fetchDevices();
        // Reset form
        setNewDeviceId('');
        setNewName('');
        setNewLocation('');
      }
    } catch (err) {
      setFormError(err.response?.data?.message || 'Device registration failed.');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleRegenerateKey = async (deviceId) => {
    if (!window.confirm(`Regenerate API key for ${deviceId}? Connected hardware must update its headers.`)) {
      return;
    }
    try {
      const res = await api.post(`/devices/${deviceId}/regenerate-key`);
      if (res.data?.success) {
        setActiveApiKey(res.data.apiKey);
        setIsKeyModalOpen(true);
        fetchDevices();
      }
    } catch (err) {
      alert('Failed to regenerate key: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleToggleActive = async (device) => {
    try {
      await api.patch(`/devices/${device._id}`, {
        isActive: !device.isActive,
      });
      fetchDevices();
    } catch (err) {
      console.error('Failed to toggle device state:', err);
    }
  };

  const handleDeleteDevice = async (deviceId) => {
    if (!window.confirm(`Are you sure you want to permanently delete device ${deviceId}?`)) {
      return;
    }
    try {
      await api.delete(`/devices/${deviceId}`);
      fetchDevices();
      if (selectedDevice?.deviceId === deviceId) {
        setSelectedDevice(null);
      }
    } catch (err) {
      alert('Failed to delete device: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleViewDetails = async (device) => {
    setSelectedDevice(device);
    try {
      const res = await api.get(`/iot/devices/${device.deviceId}/readings?limit=25`);
      if (res.data?.success) {
        setDeviceHistory(res.data.readings);
      }
    } catch (err) {
      console.error('Failed to load device history:', err);
    }
  };

  const handleCopyKey = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const filteredDevices = devices.filter((d) => {
    const matchesSearch =
      d.deviceId.toLowerCase().includes(search.toLowerCase()) ||
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      (d.location && d.location.toLowerCase().includes(search.toLowerCase()));

    const matchesStatus = statusFilter === 'all' || d.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">IoT Device Management</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Register hardware nodes, monitor device connectivity, and manage API authorization keys.
          </p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Register New Device</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-card">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by ID, name, or location..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 text-slate-800"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs text-slate-500 font-medium">Filter Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            <option value="all">All Devices ({devices.length})</option>
            <option value="online">Online Only</option>
            <option value="offline">Offline Only</option>
          </select>
        </div>
      </div>

      {/* Devices List Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100/75 text-slate-600 text-[11px] uppercase tracking-wider border-b border-slate-200">
                <th className="py-3 px-4 font-semibold">Device ID & Name</th>
                <th className="py-3 px-4 font-semibold">Connectivity</th>
                <th className="py-3 px-4 font-semibold">Location</th>
                <th className="py-3 px-4 font-semibold">Hardware Type</th>
                <th className="py-3 px-4 font-semibold">Latest Telemetry</th>
                <th className="py-3 px-4 font-semibold">Last Seen</th>
                <th className="py-3 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredDevices.length > 0 ? (
                filteredDevices.map((dev) => {
                  const isOnline = dev.status === 'online';
                  const reading = dev.latestReading || {};

                  return (
                    <tr key={dev._id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center font-bold flex-shrink-0">
                            <Cpu className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="font-bold font-mono text-slate-900 block">{dev.deviceId}</span>
                            <span className="text-[11px] text-slate-500 truncate">{dev.name}</span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            isOnline
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                          {dev.status}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-slate-600 truncate max-w-xs">{dev.location || 'Unassigned'}</td>

                      <td className="py-3.5 px-4 font-mono text-slate-500 text-[11px]">{dev.deviceType}</td>

                      <td className="py-3.5 px-4 font-mono">
                        {reading.temperature !== undefined && reading.temperature !== null ? (
                          <div className="space-y-0.5 text-[11px]">
                            <span className="text-rose-600 font-bold">{reading.temperature}°C</span>
                            <span className="text-slate-400"> / </span>
                            <span className="text-teal-700">{reading.humidity}%</span>
                            <span className="text-slate-400"> / </span>
                            <span className="text-amber-700 font-bold">{reading.gas} PPM</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 font-sans text-[11px]">No readings</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-slate-500 font-mono text-[11px]">
                        {dev.lastSeenAt ? new Date(dev.lastSeenAt).toLocaleTimeString() : 'Never'}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() => handleViewDetails(dev)}
                            className="p-1.5 text-slate-600 hover:text-teal-700 hover:bg-teal-50 rounded"
                            title="View Telemetry & Details"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => {
                              setActiveApiKey(dev.apiKey);
                              setIsKeyModalOpen(true);
                            }}
                            className="p-1.5 text-slate-600 hover:text-amber-700 hover:bg-amber-50 rounded"
                            title="View / Copy API Key"
                          >
                            <Key className="w-3.5 h-3.5" />
                          </button>

                          {isAdmin && (
                            <button
                              onClick={() => handleDeleteDevice(dev.deviceId)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded"
                              title="Delete Device"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-xs text-slate-400">
                    No matching devices found. Click "Register New Device" to add an ESP8266 node.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Device Details Modal */}
      {selectedDevice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <span className="font-mono text-xs font-bold text-teal-700">{selectedDevice.deviceId}</span>
                <h3 className="text-base font-bold text-slate-900">{selectedDevice.name}</h3>
              </div>
              <button
                onClick={() => setSelectedDevice(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5 text-xs flex-1">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-slate-400 text-[10px] uppercase block">Status</span>
                  <span className="font-bold text-slate-800">{selectedDevice.status}</span>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-slate-400 text-[10px] uppercase block">Firmware</span>
                  <span className="font-bold text-slate-800 font-mono">{selectedDevice.metadata?.firmwareVersion}</span>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-slate-400 text-[10px] uppercase block">Signal</span>
                  <span className="font-bold text-slate-800 font-mono">{selectedDevice.metadata?.signalRssi ?? -58} dBm</span>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-slate-400 text-[10px] uppercase block">IP Address</span>
                  <span className="font-bold text-slate-800 font-mono">{selectedDevice.metadata?.ipAddress || '192.168.1.101'}</span>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-slate-800 mb-2">Recent Ingested Telemetry (Last 25)</h4>
                <div className="border border-slate-200 rounded-xl overflow-hidden max-h-56 overflow-y-auto">
                  <table className="w-full text-left font-mono text-[11px]">
                    <thead className="bg-slate-100 text-slate-600">
                      <tr>
                        <th className="p-2">Time</th>
                        <th className="p-2">Temp</th>
                        <th className="p-2">Hum</th>
                        <th className="p-2">Gas</th>
                        <th className="p-2">Flame</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {deviceHistory.map((h, i) => (
                        <tr key={h._id || i} className="hover:bg-slate-50">
                          <td className="p-2 text-slate-500">{new Date(h.timestamp).toLocaleTimeString()}</td>
                          <td className="p-2 text-rose-600">{h.temperature !== null ? `${h.temperature}°C` : '--'}</td>
                          <td className="p-2 text-teal-700">{h.humidity !== null ? `${h.humidity}%` : '--'}</td>
                          <td className="p-2 text-amber-700">{h.gas !== null ? `${h.gas} PPM` : '--'}</td>
                          <td className="p-2">{h.flame ? 'FLAME' : 'Clear'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <button
                onClick={() => handleRegenerateKey(selectedDevice.deviceId)}
                className="text-xs text-amber-700 font-semibold hover:underline"
              >
                Regenerate API Key
              </button>
              <button
                onClick={() => setSelectedDevice(null)}
                className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Device Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-bold text-slate-900">Register New IoT Device</h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-rose-50 text-rose-800 text-xs rounded-lg border border-rose-200">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateDevice} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Device ID (Hardware Identifier)</label>
                <input
                  type="text"
                  value={newDeviceId}
                  onChange={(e) => setNewDeviceId(e.target.value)}
                  placeholder="e.g. RESQ-NODE-04"
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Device Name / Label</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Battery Storage Bay Unit"
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Installation Location</label>
                <input
                  type="text"
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                  placeholder="e.g. East Wing, Cabinet 3"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Device Microcontroller Type</label>
                <select
                  value={newDeviceType}
                  onChange={(e) => setNewDeviceType(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="NodeMCU ESP8266">NodeMCU ESP8266 (ESP-12E)</option>
                  <option value="ESP32 Gateway">ESP32 Dual-Core Gateway</option>
                  <option value="Arduino WiFi Shield">Arduino + WiFi Shield</option>
                </select>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-4 py-2 bg-teal-600 text-white font-semibold rounded-lg hover:bg-teal-700 disabled:opacity-50"
                >
                  {formSubmitting ? 'Registering...' : 'Register Device'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* API Key Display Modal */}
      {isKeyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <Key className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Device Hardware API Key</h3>
                <p className="text-xs text-slate-500">Configure your ESP8266 firmware header with this key.</p>
              </div>
            </div>

            <div className="p-3 bg-slate-950 text-slate-200 rounded-xl font-mono text-xs flex items-center justify-between border border-slate-800">
              <span className="truncate mr-2">{activeApiKey}</span>
              <button
                onClick={() => handleCopyKey(activeApiKey)}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded transition-colors"
                title="Copy Key"
              >
                {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs">
              <p className="font-semibold mb-1">Hardware Header Usage:</p>
              <code className="text-[11px] font-mono text-amber-950 block">
                http.addHeader("x-api-key", "{activeApiKey.slice(0, 16)}...");
              </code>
            </div>

            <div className="text-right">
              <button
                onClick={() => setIsKeyModalOpen(false)}
                className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold"
              >
                I Have Saved This Key
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DevicesPage;
