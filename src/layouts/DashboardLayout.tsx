import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { MobileNavigation } from './MobileNavigation';

export const DashboardLayout: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#eef2f5] p-3 sm:p-5 lg:p-7 flex justify-center items-start">
      {/* Outer App Shell Box */}
      <div className="w-full max-w-[1550px] bg-white rounded-[32px] sm:rounded-[36px] shadow-[0_10px_40px_rgba(0,0,0,0.04)] border border-slate-200/70 overflow-hidden flex min-h-[92vh]">
        {/* Desktop Left Sidebar */}
        <Sidebar />

        {/* Main Workspace Area */}
        <div className="flex-1 flex flex-col min-w-0 pb-16 lg:pb-0 bg-[#fbfcfd]">
          <TopBar />
          <main className="flex-1 p-5 sm:p-8 lg:p-10 w-full overflow-y-auto">
            <Outlet />
          </main>
        </div>
      </div>

      {/* Mobile Bottom Navigation */}
      <MobileNavigation />
    </div>
  );
};

export default DashboardLayout;
