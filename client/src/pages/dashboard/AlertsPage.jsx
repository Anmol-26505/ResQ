import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  Flame,
  Wind,
  Thermometer,
  ShieldAlert,
  CheckCircle2,
  Clock,
  Filter,
  User,
  SlidersHorizontal,
  Plus,
  X,
  FileCheck,
  Check,
  Eye,
  RefreshCw,
} from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';

const AlertsPage = () => {
  const [alerts, setAlerts] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [actionType, setActionType] = useState(''); // 'acknowledge' or 'resolve'
  const [operatorNote, setOperatorNote] = useState('');
  const [submittingAction, setSubmittingAction] = useState(false);

  // Rules drawer state
  const [isRulesModalOpen, setIsRulesModalOpen] = useState(false);
  const [rules, setRules] = useState([]);

  const { user } = useAuth();
  const { recentAlerts } = useSocket();

  const fetchAlerts = async () => {
    try {
      const res = await api.get(`/alerts?status=${statusFilter}&severity=${severityFilter}&limit=100`);
      if (res.data?.success) {
        setAlerts(res.data.alerts);
      }
    } catch (err) {
      console.error('Error fetching alerts:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchRules = async () => {
    try {
      const res = await api.get('/alerts/rules/all');
      if (res.data?.success) {
        setRules(res.data.rules);
      }
    } catch (err) {
      console.error('Error fetching rules:', err);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, [statusFilter, severityFilter]);

  useEffect(() => {
    fetchRules();
  }, []);

  // When a new alert arrives over WebSocket, add to top if matching filter
  useEffect(() => {
    if (recentAlerts.length > 0) {
      const latest = recentAlerts[0];
      setAlerts((prev) => {
        const exists = prev.find((a) => a._id === latest._id);
        if (exists) {
          return prev.map((a) => (a._id === latest._id ? latest : a));
        }
        return [latest, ...prev];
      });
    }
  }, [recentAlerts]);

  const handleOpenAction = (alert, type) => {
    setSelectedAlert(alert);
    setActionType(type);
    setOperatorNote('');
  };

  const handleSubmitAction = async (e) => {
    e.preventDefault();
    if (!selectedAlert || !actionType) return;

    try {
      setSubmittingAction(true);
      const endpoint = `/alerts/${selectedAlert._id}/${actionType}`;
      const res = await api.patch(endpoint, { note: operatorNote });

      if (res.data?.success) {
        setAlerts((prev) =>
          prev.map((a) => (a._id === selectedAlert._id ? res.data.alert : a))
        );
        setSelectedAlert(null);
        setActionType('');
      }
    } catch (err) {
      alert('Failed to update incident: ' + (err.response?.data?.message || err.message));
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleToggleRule = async (rule) => {
    try {
      const res = await api.patch(`/alerts/rules/${rule._id}`, {
        isEnabled: !rule.isEnabled,
      });
      if (res.data?.success) {
        setRules((prev) =>
          prev.map((r) => (r._id === rule._id ? res.data.rule : r))
        );
      }
    } catch (err) {
      console.error('Failed to toggle alert rule:', err);
    }
  };

  const activeCount = alerts.filter((a) => a.status === 'active').length;
  const criticalCount = alerts.filter((a) => a.severity === 'critical' && a.status === 'active').length;

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Incident Queue & Alert Rules</h1>
            {activeCount > 0 && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">
                {activeCount} Active
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Deduplicated environmental hazard incidents with operator audit trails.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsRulesModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg text-xs font-semibold text-slate-700 shadow-sm transition-colors"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-teal-600" />
            <span>Configured Threshold Rules ({rules.length})</span>
          </button>
        </div>
      </div>

      {/* KPI Ticker */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-card">
          <span className="text-xs text-slate-500 font-medium">Critical Unacknowledged</span>
          <div className="text-2xl font-bold text-rose-600 mt-1">{criticalCount}</div>
          <span className="text-[11px] text-slate-400">Immediate containment required</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-card">
          <span className="text-xs text-slate-500 font-medium">Total Active Incidents</span>
          <div className="text-2xl font-bold text-amber-600 mt-1">{activeCount}</div>
          <span className="text-[11px] text-slate-400">Warning & critical queue</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-card">
          <span className="text-xs text-slate-500 font-medium">Cooldown & Deduplication</span>
          <div className="text-sm font-bold text-emerald-700 mt-2 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Flood Prevention Active</span>
          </div>
          <span className="text-[11px] text-slate-400">5-minute window per sensor rule</span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-card">
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
          {['all', 'active', 'acknowledged', 'resolved'].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors ${
                statusFilter === s
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-500">Severity:</span>
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1 text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            <option value="all">All Severities</option>
            <option value="critical">Critical Only</option>
            <option value="warning">Warning Only</option>
          </select>
        </div>
      </div>

      {/* Incidents Table / Cards */}
      <div className="space-y-3">
        {alerts.length > 0 ? (
          alerts.map((alert) => {
            const isCritical = alert.severity === 'critical';
            const isActive = alert.status === 'active';
            const isAck = alert.status === 'acknowledged';
            const isResolved = alert.status === 'resolved';

            return (
              <div
                key={alert._id}
                className={`p-4 sm:p-5 rounded-2xl border transition-all bg-white shadow-card ${
                  isActive && isCritical
                    ? 'border-rose-300 ring-2 ring-rose-500/20'
                    : isActive
                    ? 'border-amber-300 ring-2 ring-amber-500/20'
                    : 'border-slate-200'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider ${
                        isCritical
                          ? 'bg-rose-100 text-rose-800 border border-rose-200'
                          : 'bg-amber-100 text-amber-800 border border-amber-200'
                      }`}
                    >
                      {alert.severity}
                    </span>
                    <span className="font-mono text-xs font-bold text-slate-900">{alert.deviceId}</span>
                    <span className="text-slate-300">•</span>
                    <span className="text-xs text-slate-500 font-medium capitalize">{alert.sensorType} Sensor</span>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-slate-400 font-mono">
                    <span>{new Date(alert.timestamp).toLocaleString()}</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        isActive
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : isAck
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      }`}
                    >
                      {alert.status}
                    </span>
                  </div>
                </div>

                {/* Message & Sensor Reading Details */}
                <div className="py-3 space-y-2">
                  <h3 className="font-bold text-sm text-slate-900">{alert.title}</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">{alert.message}</p>

                  <div className="inline-flex items-center gap-4 text-xs font-mono bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700">
                    <div>
                      <span className="text-slate-400 text-[10px] uppercase font-sans">Trigger Value: </span>
                      <span className="font-bold text-rose-600">{String(alert.readingValue)}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] uppercase font-sans">Threshold Rule: </span>
                      <span className="font-bold text-slate-800">{String(alert.thresholdValue)}</span>
                    </div>
                  </div>
                </div>

                {/* Human Audit Trail Section */}
                {(alert.acknowledgedBy || alert.resolvedBy) && (
                  <div className="pt-2 text-xs text-slate-500 border-t border-slate-100 space-y-1">
                    {alert.acknowledgedBy && (
                      <div className="flex items-start gap-1.5">
                        <User className="w-3.5 h-3.5 text-slate-400 mt-0.5" />
                        <span>
                          Acknowledged by <strong className="text-slate-700">{alert.acknowledgedBy.name}</strong> at{' '}
                          {new Date(alert.acknowledgedAt).toLocaleTimeString()}
                          {alert.acknowledgeNotes && (
                            <span className="italic text-slate-600"> — "{alert.acknowledgeNotes}"</span>
                          )}
                        </span>
                      </div>
                    )}
                    {alert.resolvedBy && (
                      <div className="flex items-start gap-1.5 text-emerald-700">
                        <Check className="w-3.5 h-3.5 mt-0.5" />
                        <span>
                          Resolved by <strong>{alert.resolvedBy.name}</strong> at{' '}
                          {new Date(alert.resolvedAt).toLocaleTimeString()}
                          {alert.resolutionNotes && (
                            <span className="italic"> — "{alert.resolutionNotes}"</span>
                          )}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Action Buttons */}
                {!isResolved && (
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                    {isActive && (
                      <button
                        onClick={() => handleOpenAction(alert, 'acknowledge')}
                        className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-lg text-xs font-semibold transition-colors"
                      >
                        Acknowledge Incident
                      </button>
                    )}
                    <button
                      onClick={() => handleOpenAction(alert, 'resolve')}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
                    >
                      Resolve Incident
                    </button>
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="p-12 text-center text-xs text-slate-400 bg-white rounded-2xl border border-slate-200">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
            <p className="font-bold text-slate-700 text-sm">Incident Queue Clear</p>
            <p className="mt-1">No alerts matching the selected status or severity filter.</p>
          </div>
        )}
      </div>

      {/* Operator Acknowledge / Resolve Modal */}
      {selectedAlert && actionType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-bold text-slate-900 capitalize">
                {actionType} Incident: {selectedAlert.deviceId}
              </h3>
              <button onClick={() => setSelectedAlert(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600">{selectedAlert.message}</p>

            <form onSubmit={handleSubmitAction} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Operator Inspection Notes / Resolution Summary
                </label>
                <textarea
                  value={operatorNote}
                  onChange={(e) => setOperatorNote(e.target.value)}
                  placeholder={
                    actionType === 'acknowledge'
                      ? 'e.g. Field team dispatched to inspect heat exhaust duct.'
                      : 'e.g. Sensor normalized; ventilation damper replaced and verified safe.'
                  }
                  rows={3}
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedAlert(null)}
                  className="px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingAction}
                  className={`px-4 py-2 text-white font-semibold rounded-lg shadow-sm ${
                    actionType === 'resolve'
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : 'bg-amber-600 hover:bg-amber-700'
                  }`}
                >
                  {submittingAction ? 'Recording...' : `Confirm ${actionType}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Threshold Rules Drawer / Modal */}
      {isRulesModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-base font-bold text-slate-900">Configured Safety Threshold Rules</h3>
                <p className="text-xs text-slate-500">Autonomous evaluation criteria applied to every incoming telemetry packet</p>
              </div>
              <button onClick={() => setIsRulesModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-3 text-xs flex-1 divide-y divide-slate-100">
              {rules.map((rule) => (
                <div key={rule._id} className="pt-3 first:pt-0 flex items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-slate-900 text-sm">{rule.name}</h4>
                      <span
                        className={`text-[10px] font-bold uppercase px-1.5 py-0.2 rounded ${
                          rule.severity === 'critical' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {rule.severity}
                      </span>
                    </div>
                    <p className="text-slate-500 text-xs mt-0.5">{rule.description}</p>
                    <div className="mt-1 font-mono text-[11px] text-teal-800">
                      Condition: {rule.sensorType} {rule.operator} {String(rule.thresholdValue)} (Cooldown: {rule.cooldownMinutes}m)
                    </div>
                  </div>

                  <button
                    onClick={() => handleToggleRule(rule)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex-shrink-0 ${
                      rule.isEnabled
                        ? 'bg-teal-50 text-teal-700 border border-teal-300'
                        : 'bg-slate-100 text-slate-500 border border-slate-200'
                    }`}
                  >
                    {rule.isEnabled ? 'Enabled' : 'Disabled'}
                  </button>
                </div>
              ))}
            </div>

            <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 text-right">
              <button
                onClick={() => setIsRulesModalOpen(false)}
                className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AlertsPage;
