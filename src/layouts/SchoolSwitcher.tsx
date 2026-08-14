import React from 'react';
import { useSession } from '../app/SessionProvider';
import { useActiveSchool } from '../app/ActiveSchoolProvider';
import { X, Check } from 'lucide-react';

export interface SchoolSwitcherProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SchoolSwitcher: React.FC<SchoolSwitcherProps> = ({ isOpen, onClose }) => {
  const { memberships, activeMembership, switchSchool } = useSession();
  const { activeSchoolId } = useActiveSchool();

  if (!isOpen) return null;

  const handleSelect = async (schoolId: string) => {
    try {
      await switchSchool(schoolId);
      onClose();
    } catch (err: any) {
      alert(err.message || 'Failed to switch school');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-4">
        <div className="flex items-center justify-between border-b pb-3">
          <div>
            <h3 className="text-base font-black text-slate-900">Switch Active School</h3>
            <p className="text-xs text-slate-500 font-medium">
              Select an authorized school membership to operate
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-2 max-h-80 overflow-y-auto">
          {memberships.length === 0 ? (
            <p className="text-xs text-slate-400 py-4 text-center">No additional school memberships found.</p>
          ) : (
            memberships.map((mem) => {
              const isSelected = mem.schoolId === activeSchoolId;
              return (
                <button
                  key={mem.schoolId}
                  onClick={() => handleSelect(mem.schoolId)}
                  className={`w-full flex items-center justify-between p-3.5 rounded-2xl border text-left transition-all ${
                    isSelected
                      ? 'bg-indigo-50 border-indigo-300 ring-2 ring-indigo-500/20'
                      : 'bg-white border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center text-base ${
                        isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      🏫
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900">{mem.schoolName}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-slate-100 text-slate-600">
                          Role: {mem.role}
                        </span>
                        {mem.udiseCode && (
                          <span className="text-[10px] text-slate-400 font-mono">
                            UDISE: {mem.udiseCode}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {isSelected && (
                    <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center">
                      <Check className="w-3.5 h-3.5" />
                    </div>
                  )}
                </button>
              );
            })
          )}
        </div>

        <div className="pt-2 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default SchoolSwitcher;
