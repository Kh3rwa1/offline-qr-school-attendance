import React from 'react';
import { NavLink } from 'react-router-dom';
import { useSession } from '../app/SessionProvider';
import { getNavigationForRole } from '../auth/permissions';
import { motion } from 'motion/react';
import {
  Building2,
  School,
  ShieldCheck,
  FileText,
  BarChart3,
  Users,
  GraduationCap,
  BookOpen,
  ClipboardCheck,
  MessageSquare,
  ScanLine,
  Package,
  Calendar,
  TrendingUp,
  Download,
  Radio,
  CreditCard,
  UserPlus,
  History,
  LogOut,
  Sparkles,
} from 'lucide-react';

export const getNavIcon = (iconKey: string): React.ReactNode => {
  const iconProps = { className: 'w-4 h-4 shrink-0', strokeWidth: 2 };
  switch (iconKey) {
    case 'platform':
      return <Building2 {...iconProps} />;
    case 'schools':
      return <School {...iconProps} />;
    case 'security':
      return <ShieldCheck {...iconProps} />;
    case 'audit':
      return <FileText {...iconProps} />;
    case 'operations':
      return <BarChart3 {...iconProps} />;
    case 'users':
      return <Users {...iconProps} />;
    case 'students':
      return <GraduationCap {...iconProps} />;
    case 'academics':
      return <BookOpen {...iconProps} />;
    case 'attendance':
      return <ClipboardCheck {...iconProps} />;
    case 'notifications':
      return <MessageSquare {...iconProps} />;
    case 'classes':
      return <GraduationCap {...iconProps} />;
    case 'scanner':
      return <ScanLine {...iconProps} />;
    case 'offline':
      return <Package {...iconProps} />;
    case 'daily':
      return <Calendar {...iconProps} />;
    case 'trends':
      return <TrendingUp {...iconProps} />;
    case 'exports':
      return <Download {...iconProps} />;
    case 'station':
    case 'readers':
      return <Radio {...iconProps} />;
    case 'cards':
      return <CreditCard {...iconProps} />;
    case 'enrollment':
      return <UserPlus {...iconProps} />;
    case 'events':
      return <History {...iconProps} />;
    default:
      return <Sparkles {...iconProps} />;
  }
};

export const Sidebar: React.FC = () => {
  const { activeRole, logout } = useSession();
  const navItems = getNavigationForRole(activeRole || undefined);

  return (
    <aside className="hidden lg:flex lg:flex-col w-64 bg-surface border-r border-line text-ink min-h-full p-6 justify-between select-none">
      <div className="space-y-7">
        {/* Brand Header */}
        <div className="flex items-center gap-3 px-2">
          <div className="w-10 h-10 rounded-2xl bg-forest-700 flex items-center justify-center text-white shadow-md shadow-forest-700/20">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z" />
              <path d="M12 6a6 6 0 1 0 6 6 6 6 0 0 0-6-6zm0 10a4 4 0 1 1 4-4 4 4 0 0 1-4 4z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-ink font-display">AttendEase</h1>
          </div>
        </div>

        {/* Navigation Sections */}
        <div className="space-y-6">
          <div>
            <p className="px-3 t-label text-ink-muted font-display mb-3">
              Navigation
            </p>
            <div className="space-y-1">
              {navItems.map((item) => (
                <NavLink
                  key={item.id}
                  to={item.href}
                  end={item.href === '/app/super-admin' || item.href === '/app/school-admin' || item.href === '/app/teacher' || item.href === '/app/rfid'}
                  className={({ isActive }) =>
                    `flex items-center justify-between px-3.5 py-2.5 min-h-[44px] rounded-2xl text-xs transition-all relative group ${
                      isActive
                        ? 'text-ink font-bold bg-surface-soft shadow-2xs border border-line/60'
                        : 'text-ink-soft hover:text-ink hover:bg-surface-soft/60 font-medium'
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
                            className="absolute left-0 top-2 bottom-2 w-1.5 bg-forest-700 rounded-r-full"
                          />
                        )}
                        <span className={`transition-colors duration-200 ${isActive ? 'text-forest-700 dark:text-forest-600' : 'text-ink-soft group-hover:text-ink'}`}>
                          {getNavIcon(item.icon)}
                        </span>
                        <span className="font-display text-sm">{item.label}</span>
                      </motion.div>
                      {item.id === 'rfid' && (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-success-50 text-success-800 border border-success-100 dark:border-success-600/30 animate-pulse">
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
            <p className="px-3 t-label text-ink-muted font-display mb-3">
              Session
            </p>
            <div className="space-y-1 text-xs font-semibold text-ink-soft">
              <motion.button
                whileHover={{ x: 2, scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => void logout()}
                className="w-full flex items-center gap-3 px-3.5 py-2.5 min-h-[44px] rounded-2xl hover:text-danger-600 hover:bg-danger-50 transition-all font-display text-left cursor-pointer"
              >
                <LogOut className="w-4 h-4 text-ink-muted group-hover:text-danger-600 transition-colors" />
                <span>Logout Session</span>
              </motion.button>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom PWA Offline Card */}
      <motion.div
        whileHover={{ y: -2 }}
        transition={{ type: 'spring', stiffness: 350, damping: 25 }}
        className="dark-tracker-card p-5 relative overflow-hidden text-white mt-6 rounded-[28px]"
      >
        <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center mb-3">
          <Download className="w-4 h-4 text-emerald-400" />
        </div>
        <h4 className="text-sm font-extrabold font-display leading-tight">
          Offline PWA App
        </h4>
        <p className="text-xs text-emerald-100 mt-1 font-medium">
          Zero-connectivity attendance cache
        </p>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => {
            window.location.href = '/app/teacher/offline';
          }}
          className="mt-4 w-full py-2.5 px-3 min-h-[44px] rounded-full bg-forest-700 hover:bg-forest-800 text-white text-xs font-bold transition-all shadow-md font-display cursor-pointer"
        >
          Offline Workspace
        </motion.button>
      </motion.div>
    </aside>
  );
};

export default Sidebar;
