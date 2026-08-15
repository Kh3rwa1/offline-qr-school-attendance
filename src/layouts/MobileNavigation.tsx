import React from 'react';
import { NavLink } from 'react-router-dom';
import { useSession } from '../app/SessionProvider';
import { getNavigationForRole } from '../auth/permissions';
import { getNavIcon } from './Sidebar';

export const MobileNavigation: React.FC = () => {
  const { activeRole } = useSession();
  const navItems = getNavigationForRole(activeRole || undefined).slice(0, 5);

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-surface/95 dark:bg-surface/95 backdrop-blur-xl border-t border-line z-30 px-2 py-1.5 shadow-2xl">
      <div className="flex items-center justify-around">
        {navItems.map((item) => (
          <NavLink
            key={item.id}
            to={item.href}
            end={item.href === '/app/super-admin' || item.href === '/app/school-admin' || item.href === '/app/teacher' || item.href === '/app/rfid'}
            className={({ isActive }) =>
              `flex flex-col items-center py-1.5 px-3 rounded-xl transition-all ${
                isActive ? 'text-forest-700 dark:text-forest-600 font-bold' : 'text-ink-soft font-medium hover:text-ink'
              }`
            }
          >
            <span className="text-base leading-none mb-1">{getNavIcon(item.icon)}</span>
            <span className="text-[11px] whitespace-nowrap font-display">{item.label.split(' ')[0]}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
};

export default MobileNavigation;
