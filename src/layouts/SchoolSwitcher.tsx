import React from 'react';
import { useSession } from '../app/SessionProvider';
import { useActiveSchool } from '../app/ActiveSchoolProvider';
import { X, Check, Building2, ShieldCheck } from 'lucide-react';
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
      <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="glass-panel rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-slate-700/80 space-y-4 relative overflow-hidden"
        >
          {/* Saffron Accent Top Border */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-orange-500 to-indigo-500" />

          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-base font-black text-white font-display">Switch Active School</h3>
              <p className="text-xs text-slate-400 font-medium mt-0.5">
                Authorized educational institutions & state districts
              </p>
            </div>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </motion.button>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-semibold">
              {error}
            </div>
          )}

          <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
            {memberships.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">No additional school memberships found.</p>
            ) : (
              memberships.map((mem) => {
                const isSelected = mem.schoolId === activeSchoolId;
                return (
                  <motion.button
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    key={mem.schoolId}
                    onClick={() => handleSelect(mem.schoolId)}
                    className={`w-full flex items-center justify-between p-4 rounded-2xl border text-left transition-all ${
                      isSelected
                        ? 'bg-gradient-to-r from-indigo-950/60 to-slate-900/90 border-indigo-500 shadow-lg shadow-indigo-500/15 ring-1 ring-indigo-500'
                        : 'bg-slate-900/60 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900'
                    }`}
                  >
                    <div className="flex items-center gap-3.5">
                      <div
                        className={`w-11 h-11 rounded-2xl flex items-center justify-center text-lg shadow-md ${
                          isSelected
                            ? 'bg-indigo-600 text-white shadow-indigo-600/30'
                            : 'bg-slate-800 text-slate-300 border border-slate-700'
                        }`}
                      >
                        🏫
                      </div>
                      <div>
                        <p className="text-xs font-black text-white font-display">{mem.schoolName}</p>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                            {mem.role}
                          </span>
                          {mem.udiseCode && (
                            <span className="text-[10px] text-amber-400 font-mono font-semibold">
                              UDISE: {mem.udiseCode}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {isSelected && (
                      <div className="w-7 h-7 rounded-full bg-indigo-500 text-white flex items-center justify-center shadow-md">
                        <Check className="w-4 h-4" />
                      </div>
                    )}
                  </motion.button>
                );
              })
            )}
          </div>

          <div className="pt-2 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-300 bg-slate-800 hover:bg-slate-700 transition-colors"
            >
              Close
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default SchoolSwitcher;
