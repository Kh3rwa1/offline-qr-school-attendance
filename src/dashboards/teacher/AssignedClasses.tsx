import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useActiveSchool } from '../../app/ActiveSchoolProvider';
import { LoadingState } from '../../components/shared/LoadingState';
import { ErrorState } from '../../components/shared/ErrorState';
import { StatCard } from '../../components/shared/StatCard';
import { Button } from '../../components/shared/Button';
import { EmptyState } from '../../components/shared/EmptyState';
import { useNavigate } from 'react-router-dom';
import { QrCode, ArrowRight } from 'lucide-react';
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

  if (loading) return <LoadingState type="stat-cards" message="Loading your assigned classes…" />;
  if (error) return <ErrorState message={error} />;

  const totalStudents = classes.reduce((sum, c) => sum + (c.studentCount || 0), 0);

  return (
    <div className="space-y-8 text-left" id="assigned-classes-view">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-ink tracking-tight font-display">
            My Classroom Teaching Duty
          </h1>
          <p className="t-body text-sm text-ink-soft mt-1">
            Classes designated for your daily optical QR scanning and attendance roll sign-off at {activeSchoolName}.
          </p>
        </div>

        <Button
          variant="primary"
          size="md"
          onClick={() => {
            if (classes.length > 0) {
              handleOpenClassScanner(classes[0].classSectionId);
            } else {
              navigate('/app/teacher');
            }
          }}
          leftIcon={<QrCode className="w-4 h-4" />}
        >
          Launch Scanner Station
        </Button>
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
                <div className="w-10 h-10 rounded-2xl bg-forest-700 text-white flex items-center justify-center font-extrabold text-sm shadow-2xs font-display">
                  {cls.className?.replace('Class ', '') || 'C'}
                </div>
                <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-success-50 text-success-800 border border-success-100 dark:border-success-600/30 uppercase tracking-wider font-display">
                  Active Roll
                </span>
              </div>

              <div className="mt-4">
                <h3 className="font-extrabold text-lg text-ink font-display">
                  {cls.className} - {cls.sectionName}
                </h3>
                <p className="t-body text-xs text-ink-soft mt-1">
                  Enrolled Students: <span className="font-bold text-ink font-mono">{cls.studentCount || 0} Students</span>
                </p>
              </div>
            </div>

            <div className="space-y-2.5 pt-2 border-t border-line">
              <Button
                variant="primary"
                size="md"
                onClick={() => handleOpenClassScanner(cls.classSectionId)}
                rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
                className="w-full justify-center mt-3"
              >
                Open Scanner HUD
              </Button>
            </div>
          </div>
        ))}

        {classes.length === 0 && (
          <div className="col-span-full py-8">
            <EmptyState
              kind="roster"
              title="No Classes Assigned"
              description={`School Admin has not assigned teaching duties for your account at ${activeSchoolName}.`}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default AssignedClasses;
