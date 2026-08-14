import React from 'react';
import { NavLink } from 'react-router-dom';
import { useSession } from '../app/SessionProvider';
import { getNavigationForRole } from '../auth/permissions';

export const Sidebar: React.FC = () => {
  const { activeRole } = useSession();
  const navItems = getNavigationForRole(activeRole || undefined);

  return (
    <aside className="hidden lg:flex lg:flex-col w-64 bg-slate-900 border-r border-slate-800 text-white min-h-screen">
      {/* Brand Header */}
      <div className="h-16 flex items-center gap-3 px-6 border-b border-slate-800">
        <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-black text-lg shadow-md">
          🎓
        </div>
        <div>
          <h1 className="text-sm font-black tracking-tight text-white leading-none">AttendEase OS</h1>
          <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider mt-1">
            Enterprise Edition
          </p>
        </div>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
        <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
          Navigation Hub
        </p>
        {navItems.map((item) => (
          <NavLink
            key={item.id}
            to={item.href}
            end={item.href === '/app/super-admin' || item.href === '/app/school-admin' || item.href === '/app/teacher' || item.href === '/app/rfid'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`
            }
          >
            <span className="text-base">{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </div>

      {/* Role Badge Footer */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/40">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          <span className="text-xs font-bold text-slate-300">
            Active Role: <span className="text-indigo-400">{activeRole || 'TEACHER'}</span>
          </span>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
