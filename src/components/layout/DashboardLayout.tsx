import React, { useState } from 'react';
import { UserRole, hasPermission } from '../../auth/permissions';
import { NetworkSyncBar } from '../NetworkSyncBar';

export interface DashboardLayoutProps {
  userRole: UserRole | string;
  userName?: string;
  schoolName?: string;
  activeView: string;
  onNavigate: (view: string) => void;
  onLogout: () => void;
  children: React.ReactNode;
  availableSchools?: Array<{ id: string; name: string; code: string }>;
  onSelectSchool?: (schoolId: string) => void;
  selectedSchoolId?: string;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  userRole,
  userName = 'User',
  schoolName = 'Primary School',
  activeView,
  onNavigate,
  onLogout,
  children,
  availableSchools = [],
  onSelectSchool,
  selectedSchoolId,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'SCHOOL_ADMIN':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'TEACHER':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'RFID_OPERATOR':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'REPORT_VIEWER':
        return 'bg-cyan-100 text-cyan-800 border-cyan-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const navItems = [
    { id: 'dashboard', label: 'Overview', icon: '📊', show: true },
    {
      id: 'super-admin',
      label: 'Cross-School Platform',
      icon: '🏢',
      show: hasPermission(userRole, 'CROSS_SCHOOL_VIEW'),
    },
    {
      id: 'school-admin',
      label: 'School Administration',
      icon: '🏫',
      show: hasPermission(userRole, 'SCHOOL_ADMIN_SETTINGS'),
    },
    {
      id: 'teacher',
      label: 'Attendance & Roster',
      icon: '📝',
      show: hasPermission(userRole, 'ATTENDANCE_TAKE'),
    },
    {
      id: 'rfid-operator',
      label: 'RFID Smartcards',
      icon: '💳',
      show: hasPermission(userRole, 'RFID_ENROLL_CARDS'),
    },
    {
      id: 'report-viewer',
      label: 'Analytics & Reports',
      icon: '📈',
      show: hasPermission(userRole, 'REPORT_VIEW_ANALYTICS'),
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Brand & Context Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            {/* Logo and Context */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-black text-xl shadow-md">
                🎓
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg font-bold text-slate-900 leading-tight">AttendEase OS</h1>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-bold border ${getRoleBadgeColor(userRole)}`}>
                    {userRole}
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-medium">
                  {userRole === 'SUPER_ADMIN' ? 'Global Multi-Tenant Console' : schoolName}
                </p>
              </div>
            </div>

            {/* Cross-School Tenant Switcher (Super Admin only) */}
            {userRole === 'SUPER_ADMIN' && availableSchools.length > 0 && onSelectSchool && (
              <div className="hidden md:flex items-center gap-2 bg-slate-100 p-1 rounded-lg border border-slate-300">
                <span className="text-xs font-semibold text-slate-600 pl-2">Tenant:</span>
                <select
                  value={selectedSchoolId}
                  onChange={(e) => onSelectSchool(e.target.value)}
                  className="text-xs bg-white border border-slate-300 rounded px-2 py-1 font-medium text-slate-800"
                >
                  <option value="">All Schools (Platform Overview)</option>
                  {availableSchools.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.code})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* User Profile & Actions */}
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-semibold text-slate-800">{userName}</p>
                <p className="text-xs text-slate-400">Authenticated</p>
              </div>
              <button
                onClick={onLogout}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-red-50 text-slate-700 hover:text-red-700 border border-slate-200 transition-colors"
                id="header-logout-btn"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>

        {/* Role Navigation Bar */}
        <nav className="bg-slate-100 border-t border-slate-200 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto flex items-center gap-1 overflow-x-auto py-1">
            {navItems
              .filter((item) => item.show)
              .map((item) => {
                const isActive = activeView === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onNavigate(item.id)}
                    className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-md transition-all whitespace-nowrap ${
                      isActive
                        ? 'bg-white text-indigo-700 shadow-sm border border-slate-200'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                    }`}
                    id={`nav-btn-${item.id}`}
                  >
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                );
              })}
          </div>
        </nav>
      </header>

      {/* Connectivity & Sync Status Bar */}
      <NetworkSyncBar />

      {/* Main Role Content Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-500">
        Offline-Ready Multi-Tenant School Attendance System • Enterprise Grade
      </footer>
    </div>
  );
};
