import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import PublicLayout from './layouts/PublicLayout';
import DashboardLayout from './layouts/DashboardLayout';
import ProtectedRoute from './components/ProtectedRoute';

// Public Pages
import HomePage from './pages/public/HomePage';
import AboutPage from './pages/public/AboutPage';
import HowItWorksPage from './pages/public/HowItWorksPage';

// Auth Pages
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';

// Dashboard Pages
import OverviewPage from './pages/dashboard/OverviewPage';
import LiveMonitoringPage from './pages/dashboard/LiveMonitoringPage';
import DevicesPage from './pages/dashboard/DevicesPage';
import AlertsPage from './pages/dashboard/AlertsPage';
import AnalyticsPage from './pages/dashboard/AnalyticsPage';
import ArchitecturePage from './pages/dashboard/ArchitecturePage';
import SettingsPage from './pages/dashboard/SettingsPage';

// Remote Manual Hazard Controller Pages
import ControllerLoginPage from './pages/controller/ControllerLoginPage';
import ControllerDashboardPage from './pages/controller/ControllerDashboardPage';
import ControllerProtectedRoute from './components/ControllerProtectedRoute';

function App() {
  return (
    <Routes>
      {/* Public Routes with Navbar & Footer */}
      <Route element={<PublicLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/how-it-works" element={<HowItWorksPage />} />
      </Route>

      {/* Auth Routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* Remote Manual Hazard Controller Routes */}
      <Route path="/controller/login" element={<ControllerLoginPage />} />
      <Route path="/controllers/login" element={<Navigate to="/controller/login" replace />} />
      <Route
        path="/controller/dashboard"
        element={
          <ControllerProtectedRoute>
            <ControllerDashboardPage />
          </ControllerProtectedRoute>
        }
      />
      <Route path="/controller" element={<Navigate to="/controller/dashboard" replace />} />
      <Route path="/controllers" element={<Navigate to="/controller/dashboard" replace />} />

      {/* Authenticated Dashboard Routes */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<OverviewPage />} />
        <Route path="monitoring" element={<LiveMonitoringPage />} />
        <Route path="devices" element={<DevicesPage />} />
        <Route path="alerts" element={<AlertsPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="architecture" element={<ArchitecturePage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
