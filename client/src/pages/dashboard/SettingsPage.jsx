import React, { useState } from 'react';
import {
  User,
  Lock,
  Radio,
  Check,
  Shield,
  Save,
  AlertCircle,
  Copy,
  Cpu,
  Key,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useOutletContext } from 'react-router-dom';

const SettingsPage = () => {
  const { user, updateProfile } = useAuth();
  const { openHardwareGuide } = useOutletContext() || {};

  const [name, setName] = useState(user?.name || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setMessage('');
    setErrorMessage('');

    if (newPassword && newPassword !== confirmPassword) {
      setErrorMessage('New passwords do not match.');
      return;
    }

    if (newPassword && !currentPassword) {
      setErrorMessage('Current password is required to set a new password.');
      return;
    }

    try {
      setSaving(true);
      const updateData = { name };
      if (currentPassword && newPassword) {
        updateData.currentPassword = currentPassword;
        updateData.newPassword = newPassword;
      }

      const res = await updateProfile(updateData);
      if (res.success) {
        setMessage('Profile updated successfully.');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setErrorMessage(res.message);
      }
    } catch (err) {
      setErrorMessage('Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Page Title */}
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">System & Account Settings</h1>
        <p className="text-xs text-slate-500 mt-1">
          Manage operator profile credentials, security passwords, and hardware gateway configurations.
        </p>
      </div>

      {message && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-600" />
          <span>{message}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Profile & Password Form */}
      <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-card space-y-6">
        <div className="flex items-center gap-2.5 text-teal-700 font-bold text-sm border-b border-slate-100 pb-3">
          <User className="w-5 h-5" />
          <span>Operator Profile Information</span>
        </div>

        <form onSubmit={handleUpdateProfile} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Email Address</label>
              <input
                type="email"
                value={user?.email || ''}
                disabled
                className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-500 cursor-not-allowed"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">Managed by system administrator</span>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100">
            <h3 className="font-bold text-slate-900 text-sm mb-3">Change Account Password</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Current Password</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Confirm New Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>
          </div>

          <div className="pt-3 flex items-center justify-end">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-lg shadow-sm transition-colors disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? 'Saving Changes...' : 'Save Settings'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* IoT Gateway Integration Quick Box */}
      <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-card space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 text-teal-700 font-bold text-sm">
            <Radio className="w-5 h-5" />
            <span>ESP8266 Firmware & Connectivity Guide</span>
          </div>

          {openHardwareGuide && (
            <button
              onClick={openHardwareGuide}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 transition-colors"
            >
              <span>View Firmware Code</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <p className="text-xs text-slate-600 leading-relaxed">
          Physical hardware transmits sensor data to the server using HTTP POST. Each registered node is authenticated using its secret API key sent via the <code className="font-mono text-teal-700 bg-teal-50 px-1 py-0.5 rounded">x-api-key</code> request header.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1 text-xs font-mono">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <span className="text-[10px] uppercase text-slate-400 block font-sans">API Telemetry Endpoint</span>
            <span className="font-bold text-slate-800">POST /api/iot/readings</span>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <span className="text-[10px] uppercase text-slate-400 block font-sans">Required Headers</span>
            <span className="font-bold text-teal-700">x-api-key: &lt;DEVICE_KEY&gt;</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
