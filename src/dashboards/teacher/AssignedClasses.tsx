import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useActiveSchool } from '../../app/ActiveSchoolProvider';
import { LoadingState } from '../../components/shared/LoadingState';
import { ErrorState } from '../../components/shared/ErrorState';
import { StatCard } from '../../components/shared/StatCard';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { QrCode, ArrowRight, School, Users } from 'lucide-react';
import { offlineDb } from '../../db/offlineDb';

export const AssignedClasses: React.FC = () => {
  const { activeSchoolId, activeSchoolName } = useActiveSchool();
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    async function load() {
      if (!activeSchoolId) return;
      setLoading(true);
      setError(null);
      try {
        const res = await api<{ success: boolean; data: any[] }>(`/api/v1/schools/${activeSchoolId}/attendance/classes`);
        if (res.data) {
          setClasses(res.data);
        } else {
          setClasses([]);
        }
      } catch (err: any) {
        // Offline fallback: load from cached roster items
        const cached = await offlineDb.rosters.toArray();
        const uniqueMap = new Map<string, any>();
        cached.forEach((r: any) => {
          if (!uniqueMap.has(r.classSectionId)) {
            uniqueMap.set(r.classSectionId, {
              classSectionId: r.classSectionId,
              className: r.className,
              sectionName: r.sectionName,
              studentCount: cached.filter((c: any) => c.classSectionId === r.classSectionId).length,
            });
          }
        });
        setClasses(Array.from(uniqueMap.values()));
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [activeSchoolId]);

  const handleOpenClassScanner = (classSectionId: string) => {
    localStorage.setItem('attendance.classSectionId', classSectionId);
    navigate('/app/teacher');
  };

  if (loading) return <LoadingState message="Loading your assigned classes…" />;
  if (error) return <ErrorState message={error} />;

  const totalStudents = classes.reduce((sum, c) => sum + (c.studentCount || 0), 0);

  return (
    <div className="space-y-8" id="assigned-classes-view">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight font-display">
            My Classroom Teaching Duty
          </h1>
          <p className="text-sm font-medium text-slate-500 mt-1">
            Classes designated for your daily optical QR scanning and attendance roll sign-off at {activeSchoolName}.
          </p>
        </div>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => {
            if (classes.length > 0) {
              handleOpenClassScanner(classes[0].classSectionId);
            } else {
              navigate('/app/teacher');
            }
          }}
          className="btn-forest-primary text-sm font-display cursor-pointer"
        >
          <QrCode className="w-4 h-4" />
          <span>Launch Scanner Station</span>
        </motion.button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          title="Assigned Classes"
          value={`${classes.length} Sections`}
          trend={{ value: classes.length > 0 ? "Active Roster Duty" : "No assignments yet", isPositive: classes.length > 0 }}
          variant="hero-forest"
        />
        <StatCard
          title="Total Students"
          value={`${totalStudents} Students`}
          trend={{ value: "In Your Direct Roster", isPositive: true }}
          variant="default"
        />
        <StatCard
          title="Attendance Station"
          value="QR & Barcode"
          trend={{ value: "Offline-First Sync", isPositive: true }}
          variant="default"
        />
        <StatCard
          title="Offline Roster Cache"
          value="Synchronized"
          trend={{ value: "Available in IndexedDB", isPositive: true }}
          variant="default"
        />
      </div>

      {/* Class Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {classes.map((cls) => (
          <div key={cls.classSectionId} className="app-card p-6 sm:p-7 space-y-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-2xl bg-[#144e39] text-white flex items-center justify-center font-extrabold text-sm shadow-xs font-display">
                  {cls.className?.replace('Class ', '') || 'C'}
                </div>
                <span className="text-[10px] font-extrabold px-3 py-1 rounded-full bg-emerald-50 text-[#144e39] border border-emerald-200 uppercase tracking-wider">
                  Active Roll
                </span>
              </div>

              <div className="mt-4">
                <h3 className="font-extrabold text-lg text-slate-900 font-display">
                  {cls.className} - {cls.sectionName}
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-1">
                  Enrolled Students: <span className="font-bold text-slate-900">{cls.studentCount || 0} Students</span>
                </p>
              </div>
            </div>

            <div className="space-y-2.5 pt-2 border-t border-slate-100">
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleOpenClassScanner(cls.classSectionId)}
                className="w-full mt-3 py-3 rounded-full bg-[#144e39] hover:bg-[#0f3d2c] text-white font-bold text-xs shadow-md shadow-[#144e39]/20 transition-all font-display flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>Open Scanner HUD</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </motion.button>
            </div>
          </div>
        ))}

        {classes.length === 0 && (
          <div className="col-span-full py-16 text-center app-card space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
              <School className="w-6 h-6" />
            </div>
            <p className="text-base font-extrabold text-slate-800 font-display">No Classes Assigned</p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto font-medium">
              School Admin has not assigned teaching duties for your account at {activeSchoolName}.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AssignedClasses;
