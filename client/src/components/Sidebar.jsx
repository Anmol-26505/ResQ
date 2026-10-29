import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Activity,
  Cpu,
  AlertTriangle,
  BarChart3,
  Network,
  Settings,
  LogOut,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';

const Sidebar = ({ isMobileOpen, setIsMobileOpen }) => {
  const { user, logout } = useAuth();
  const { recentAlerts, isConnected } = useSocket();

  const activeAlertsCount = recentAlerts.filter(a => a.status === 'active').length;

  const navItems = [
    { label: 'Overview', to: '/dashboard', icon: LayoutDashboard, end: true },
    { label: 'Live Monitoring', to: '/dashboard/monitoring', icon: Activity },
    { label: 'Devices', to: '/dashboard/devices', icon: Cpu },
    {
      label: 'Alerts & Incidents',
      to: '/dashboard/alerts',
      icon: AlertTriangle,
      badge: activeAlertsCount > 0 ? activeAlertsCount : null,
      badgeColor: 'bg-rose-500 text-white',
    },
    { label: 'Analytics & History', to: '/dashboard/analytics', icon: BarChart3 },
    { label: 'System Architecture', to: '/dashboard/architecture', icon: Network },
    { label: 'Settings', to: '/dashboard/settings', icon: Settings },
  ];

  const handleLinkClick = () => {
    if (setIsMobileOpen) setIsMobileOpen(false);
  };

  return (
    <>
      {/* Mobile backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-slate-900 text-slate-300 flex flex-col border-r border-slate-800 transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand header */}
        <div className="h-16 px-6 flex items-center justify-between border-b border-slate-800/80">
          <NavLink to="/" className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-teal-500 flex items-center justify-center text-slate-950 font-bold shadow-md shadow-teal-500/20">
              <ShieldCheck className="w-5 h-5 text-slate-900" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-white text-base tracking-tight font-sans">ResQ</span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-1 py-0.5 rounded bg-teal-950 text-teal-400 border border-teal-800/80">
                  IoT
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-medium">Emergency Monitor</p>
            </div>
          </NavLink>
        </div>

        {/* Telemetry connection status indicator */}
        <div className="px-5 py-3 border-b border-slate-800/60 bg-slate-950/40">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full ${
                  isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'
                }`}
              />
              <span className="text-slate-400 text-[11px] font-medium">
                {isConnected ? 'Socket Telemetry Active' : 'Connecting to Gateway...'}
              </span>
            </div>
            <Zap className={`w-3.5 h-3.5 ${isConnected ? 'text-teal-400' : 'text-slate-600'}`} />
          </div>
        </div>

        {/* Navigation items */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.label}
                to={item.to}
                end={item.end}
                onClick={handleLinkClick}
                className={({ isActive }) =>
                  `flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-teal-600/20 text-teal-300 font-semibold border-l-2 border-teal-500 pl-3'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`
                }
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span>{item.label}</span>
                </div>
                {item.badge !== null && item.badge !== undefined && (
                  <span
                    className={`px-1.5 py-0.5 text-[10px] font-bold rounded-full ${item.badgeColor}`}
                  >
                    {item.badge}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* User profile & quick logout footer */}
        <div className="p-3 border-t border-slate-800/80 bg-slate-950/40">
          <div className="flex items-center justify-between p-2 rounded-lg bg-slate-800/40 border border-slate-800">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-teal-700 text-teal-100 flex items-center justify-center font-bold text-xs uppercase flex-shrink-0">
                {user?.name ? user.name.charAt(0) : 'U'}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-200 truncate">{user?.name || 'Operator'}</p>
                <span className="text-[10px] text-teal-400 uppercase tracking-wider font-medium">
                  {user?.role === 'admin' ? 'System Admin' : 'Safety Officer'}
                </span>
              </div>
            </div>
            <button
              onClick={logout}
              title="Sign Out"
              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
