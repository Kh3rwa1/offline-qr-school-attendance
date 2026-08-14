import React from 'react';
import { NavLink } from 'react-router-dom';
import { useSession } from '../app/SessionProvider';
import { getNavigationForRole } from '../auth/permissions';

export const MobileNavigation: React.FC = () => {
  const { activeRole } = useSession();
  const navItems = getNavigationForRole(activeRole || undefined).slice(0, 5);

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-xl border-t border-slate-800 z-30 px-2 py-1 shadow-2xl">
      <div className="flex items-center justify-around">
        {navItems.map((item) => (
          <NavLink
            key={item.id}
            to={item.href}
            end={item.href === '/app/super-admin' || item.href === '/app/school-admin' || item.href === '/app/teacher' || item.href === '/app/rfid'}
            className={({ isActive }) =>
              `flex flex-col items-center py-1.5 px-3 rounded-xl transition-all ${
                isActive ? 'text-indigo-400 font-black' : 'text-slate-400 font-medium'
              }`
            }
          >
            <span className="text-lg leading-none">{item.icon}</span>
            <span className="text-[10px] mt-1 whitespace-nowrap">{item.label.split(' ')[0]}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
};

export default MobileNavigation;
