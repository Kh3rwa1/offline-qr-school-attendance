import React from 'react';
import { NavLink } from 'react-router-dom';
import { useSession } from '../app/SessionProvider';
import { getNavigationForRole } from '../auth/permissions';
import { motion } from 'motion/react';
import { LayoutDashboard, Calendar, BarChart2, Users, Settings, HelpCircle, LogOut, Radio, Download, Shield } from 'lucide-react';

export const Sidebar: React.FC = () => {
  const { activeRole, logout } = useSession();
  const navItems = getNavigationForRole(activeRole || undefined);

  return (
    <aside className="hidden lg:flex lg:flex-col w-64 bg-white border-r border-slate-100 text-slate-700 min-h-full p-6 justify-between select-none">
      <div className="space-y-7">
        {/* Brand Header */}
        <div className="flex items-center gap-3 px-2">
          <div className="w-10 h-10 rounded-2xl bg-[#144e39] flex items-center justify-center text-white shadow-md shadow-[#144e39]/20">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z"/>
              <path d="M12 6a6 6 0 1 0 6 6 6 6 0 0 0-6-6zm0 10a4 4 0 1 1 4-4 4 4 0 0 1-4 4z"/>
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-slate-900 font-display">AttendEase</h1>
          </div>
        </div>

        {/* Navigation Sections */}
        <div className="space-y-6">
          <div>
            <p className="px-3 text-[11px] font-extrabold uppercase tracking-wider text-slate-400 font-display mb-3">
              Menu
            </p>
            <div className="space-y-1">
              {navItems.map((item) => (
                <NavLink
                  key={item.id}
                  to={item.href}
                  end={item.href === '/app/super-admin' || item.href === '/app/school-admin' || item.href === '/app/teacher' || item.href === '/app/rfid'}
                  className={({ isActive }) =>
                    `flex items-center justify-between px-3.5 py-3 rounded-2xl text-sm font-bold transition-all relative group ${
                      isActive
                        ? 'text-slate-900 font-extrabold bg-slate-100/90 shadow-2xs'
                        : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50 font-semibold'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <motion.div 
                        whileHover={{ x: 2 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                        className="flex items-center gap-3"
                      >
                        {isActive && (
                          <motion.div 
                            layoutId="activeNavIndicator"
                            className="absolute left-0 top-2 bottom-2 w-1.5 bg-[#144e39] rounded-r-full" 
                          />
                        )}
                        <span className="text-lg text-slate-600 group-hover:scale-110 transition-transform duration-200">{item.icon}</span>
                        <span className="font-display">{item.label}</span>
                      </motion.div>
                      {item.id === 'rfid' && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 animate-pulse">
                          Live
                        </span>
                      )}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>

          <div>
            <p className="px-3 text-[11px] font-extrabold uppercase tracking-wider text-slate-400 font-display mb-3">
              General
            </p>
            <div className="space-y-1 text-sm font-semibold text-slate-500">
              <motion.button
                whileHover={{ x: 2, scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => void logout()}
                className="w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl hover:text-rose-600 hover:bg-rose-50/70 transition-all font-display text-left"
              >
                <LogOut className="w-5 h-5 text-slate-400 group-hover:text-rose-500 transition-colors" />
                <span>Logout Session</span>
              </motion.button>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Dark Card Widget (Reference Image match) */}
      <motion.div 
        whileHover={{ y: -3 }}
        transition={{ type: 'spring', stiffness: 350, damping: 25 }}
        className="dark-tracker-card p-5 relative overflow-hidden text-white mt-6"
      >
        <div className="w-7 h-7 rounded-xl bg-white/10 flex items-center justify-center mb-3">
          <Download className="w-4 h-4 text-emerald-400" />
        </div>
        <h4 className="text-sm font-extrabold font-display leading-tight">
          Download our <br />Mobile PWA App
        </h4>
        <p className="text-[11px] text-emerald-300/80 mt-1 font-medium">
          Offline attendance on tablets
        </p>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => {
            window.location.href = '/app/teacher/offline';
          }}
          className="mt-4 w-full py-2.5 px-3 rounded-full bg-[#144e39] hover:bg-[#195f46] text-white text-xs font-bold transition-all shadow-md font-display"
        >
          Offline Workspace
        </motion.button>
      </motion.div>
    </aside>
  );
};

export default Sidebar;
