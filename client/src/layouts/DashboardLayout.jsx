import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';
import HardwareGuideModal from '../components/HardwareGuideModal';

const DashboardLayout = () => {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar (Desktop fixed & Mobile drawer) */}
      <Sidebar isMobileOpen={isMobileOpen} setIsMobileOpen={setIsMobileOpen} />

      {/* Main content area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        <Topbar
          onOpenMobileMenu={() => setIsMobileOpen(true)}
          onOpenHardwareGuide={() => setIsGuideOpen(true)}
        />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
          <Outlet context={{ openHardwareGuide: () => setIsGuideOpen(true) }} />
        </main>
      </div>

      {/* Hardware integration code modal */}
      <HardwareGuideModal isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} />
    </div>
  );
};

export default DashboardLayout;
