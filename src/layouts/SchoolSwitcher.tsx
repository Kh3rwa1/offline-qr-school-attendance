import React from 'react';
import { useSession } from '../app/SessionProvider';
import { useActiveSchool } from '../app/ActiveSchoolProvider';
import { X, Check, Building2 } from 'lucide-react';
import { Button } from '../components/shared/Button';
import { Toast } from '../components/shared/Toast';
import { motion, AnimatePresence } from 'motion/react';

export interface SchoolSwitcherProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SchoolSwitcher: React.FC<SchoolSwitcherProps> = ({ isOpen, onClose }) => {
  const { memberships, switchSchool } = useSession();
  const { activeSchoolId } = useActiveSchool();
  const [error, setError] = React.useState<string | null>(null);
  const [switchingId, setSwitchingId] = React.useState<string | null>(null);

  if (!isOpen) return null;

  const handleSelect = async (schoolId: string) => {
    if (switchingId) return;
    setError(null);
    setSwitchingId(schoolId);
    try {
      await switchSchool(schoolId);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to switch school');
    } finally {
      setSwitchingId(null);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="app-card max-w-lg w-full p-6 sm:p-7 shadow-2xl space-y-4 relative overflow-hidden"
        >
          {/* Accent Top Border */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-forest-700" />

          <div className="flex items-center justify-between border-b border-line pb-3">
            <div>
              <h3 className="t-title text-base font-bold text-ink">Switch Active School</h3>
              <p className="t-body text-xs text-ink-soft mt-0.5">
                Authorized educational institutions & state districts
              </p>
            </div>
            <button
              onClick={onClose}
              aria-label="Close school switcher"
              className="p-1.5 rounded-xl text-ink-muted hover:text-ink hover:bg-surface-soft transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {error && (
            <Toast kind="error" message={error} onDismiss={() => setError(null)} autoDismiss={false} />
          )}

          <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
            {memberships.length === 0 ? (
              <p className="text-xs text-ink-soft py-6 text-center">No additional school memberships found.</p>
            ) : (
              memberships.map((mem) => {
                const isSelected = mem.schoolId === activeSchoolId;
                return (
                  <motion.button
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    key={mem.schoolId}
                    onClick={() => handleSelect(mem.schoolId)}
                    className={`w-full flex items-center justify-between p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-surface-soft border-forest-700 shadow-md shadow-forest-700/10 ring-1 ring-forest-700'
                        : 'bg-surface border-line hover:border-ink-muted hover:bg-surface-soft/60'
                    }`}
                  >
                    <div className="flex items-center gap-3.5">
                      <div
                        className={`w-11 h-11 rounded-2xl flex items-center justify-center text-lg shadow-md ${
                          isSelected
                            ? 'bg-forest-700 text-white shadow-forest-700/30'
                            : 'bg-surface-soft text-ink-soft border border-line'
                        }`}
                      >
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-ink font-display">{mem.schoolName}</p>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <span className="text-[11px] px-2.5 py-0.5 rounded-full font-bold bg-surface-soft text-ink-soft border border-line">
                            {mem.role}
                          </span>
                          {mem.udiseCode && (
                            <span className="text-[11px] text-forest-700 dark:text-forest-600 font-mono font-semibold">
                              UDISE: {mem.udiseCode}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {isSelected && (
                      <div className="w-7 h-7 rounded-full bg-forest-700 text-white flex items-center justify-center shadow-md">
                        <Check className="w-4 h-4" />
                      </div>
                    )}
                  </motion.button>
                );
              })
            )}
          </div>

          <div className="pt-2 flex justify-end">
            <Button variant="secondary" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default SchoolSwitcher;
