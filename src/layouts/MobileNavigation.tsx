import React from 'react';
import { NavLink } from 'react-router-dom';
import { useSession } from '../app/SessionProvider';
import { getNavigationForRole } from '../auth/permissions';
import { getNavIcon } from './Sidebar';

export const MobileNavigation: React.FC = () => {
  const { activeRole } = useSession();
  const navItems = getNavigationForRole(activeRole || undefined).slice(0, 5);

  return (
    <nav
      aria-label="Mobile Navigation"
      className="lg:hidden fixed bottom-0 left-0 right-0 bg-surface/95 dark:bg-surface/95 backdrop-blur-xl border-t border-line z-30 px-2 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-2xl"
    >
      <div className="flex items-center justify-around">
        {navItems.map((item) => (
          <NavLink
            key={item.id}
            to={item.href}
            end={item.href === '/app/super-admin' || item.href === '/app/school-admin' || item.href === '/app/teacher' || item.href === '/app/rfid'}
            aria-current={undefined}
            className={({ isActive }) =>
              `min-h-[48px] min-w-[48px] flex flex-col items-center justify-center py-1 px-2.5 rounded-2xl transition-all ${
                isActive ? 'text-forest-700 dark:text-forest-600 font-bold bg-success-50/50 dark:bg-success-600/10' : 'text-ink-soft font-medium hover:text-ink'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span className="text-base leading-none mb-1">{getNavIcon(item.icon)}</span>
                <span className="text-xs font-semibold whitespace-nowrap font-display">{item.label.split(' ')[0]}</span>
                {isActive && <span className="sr-only">(current page)</span>}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
};

export default MobileNavigation;
