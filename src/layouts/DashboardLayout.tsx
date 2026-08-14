import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { MobileNavigation } from './MobileNavigation';

export const DashboardLayout: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Desktop Left Sidebar */}
      <Sidebar />

      {/* Main Workspace Area */}
      <div className="flex-1 flex flex-col min-w-0 pb-16 lg:pb-0">
        <TopBar />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <MobileNavigation />
    </div>
  );
};

export default DashboardLayout;
