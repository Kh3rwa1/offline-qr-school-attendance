import React, { useState, useEffect } from 'react';
import { StatCard } from '../../components/shared/StatCard';
import { LoadingState } from '../../components/shared/LoadingState';
import { ErrorState } from '../../components/shared/ErrorState';
import { Button } from '../../components/shared/Button';
import { RollingNumber } from '../../components/shared/RollingNumber';
import { useActiveSchool } from '../../app/ActiveSchoolProvider';
import { api } from '../../services/api';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { 
  CheckCircle2, 
  Sparkles,
  Download,
  QrCode
} from 'lucide-react';

export const SchoolAdminDashboard: React.FC = () => {
  const { activeSchoolId, activeSchoolName } = useActiveSchool();
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeDayIndex, setActiveDayIndex] = useState<number>(2); // Default to Tuesday
  const navigate = useNavigate();

  const fetchSummary = async () => {
    if (!activeSchoolId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api<{ success: boolean; data: any }>('/api/v1/dashboard/school-admin/summary');
      if (res.success && res.data) {
        setSummary(res.data);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load school administration summary');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchSummary();
  }, [activeSchoolId]);

  const weeklyData = [
    { day: 'Mon', fullDay: 'Monday', pct: 95.8, present: 963, total: 1005 },
    { day: 'Tue', fullDay: 'Tuesday', pct: 94.2, present: 947, total: 1005 },
    { day: 'Wed', fullDay: 'Wednesday', pct: 98.1, present: 986, total: 1005, isHighest: true },
    { day: 'Thu', fullDay: 'Thursday', pct: 91.5, present: 920, total: 1005 },
    { day: 'Fri', fullDay: 'Friday', pct: 96.0, present: 965, total: 1005 },
    { day: 'Sat', fullDay: 'Saturday', pct: 88.5, present: 889, total: 1005 },
    { day: 'Today', fullDay: 'Today (Live)', pct: 92.0, present: 924, total: 1005, isCurrent: true },
  ];

  if (loading) return <LoadingState type="stat-cards" message="Loading school operations & roster intelligence…" />;
  if (error) return <ErrorState message={error} onRetry={fetchSummary} />;

  const attendancePct = summary?.todayAttendancePercentage ?? 92;

  return (
    <div className="space-y-8 text-left" id="school-admin-dashboard-view">
      {/* Top Header Row with Buttons */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-ink tracking-tight font-display">
            School Administration & Operations
          </h1>
          <p className="t-body text-sm text-ink-soft mt-1">
            Overview of daily attendance, class rolls, and Mid-Day Meal distribution for {activeSchoolName}.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="primary"
            size="md"
            onClick={() => navigate('/app/teacher')}
            leftIcon={<QrCode className="w-4 h-4" />}
          >
            Open Attendance Station
          </Button>

          <Button
            variant="secondary"
            size="md"
            onClick={() => navigate('/app/reports/exports')}
            leftIcon={<Download className="w-4 h-4 text-ink-soft" />}
          >
            Download Daily Sheet
          </Button>
        </div>
      </div>

      {/* 4 Stat Cards Row (Hero Forest + 3 White Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          title="Present Today"
          value={`${summary?.presentCount ?? 0} / ${summary?.totalStudents ?? 0}`}
          trend={{ value: `${summary?.totalStudents ? Math.round(((summary.presentCount || 0) / summary.totalStudents) * 100) : 0}% Daily Turnout`, isPositive: Boolean(summary?.presentCount) }}
          variant="hero-forest"
          onClick={() => navigate('/app/reports/daily')}
        />
        <StatCard
          title="Enrolled Students"
          value={summary?.totalStudents ?? 0}
          trend={{ value: `${summary?.activeSectionsCount ?? 0} Class Sections Active`, isPositive: true }}
          variant="default"
          onClick={() => navigate('/app/school-admin/academics')}
        />
        <StatCard
          title="Mid-Day Meals"
          value={`${summary?.presentCount ?? 0} Meals`}
          trend={{ value: "Eligible Present Headcount", isPositive: true }}
          variant="default"
          onClick={() => navigate('/app/reports/daily')}
        />
        <StatCard
          title="Absentee SMS Alerts"
          value={`${summary?.pendingSmsCount ?? 0}`}
          trend={{ value: "Notices Dispatched to Parents", isPositive: true }}
          variant="default"
          onClick={() => navigate('/app/school-admin/notifications')}
        />
      </div>

      {/* Middle Row (3 Column Grid) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Column 1: Attendance Analytics Bar Chart (5 cols) */}
        <div className="lg:col-span-5 app-card p-6 sm:p-7 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-extrabold text-ink font-display">
                Weekly Attendance Record
              </h3>
              <p className="t-body text-xs text-ink-soft mt-0.5">Schoolwide turnout percentage by day</p>
            </div>
            <span className="text-xs font-bold text-forest-700 dark:text-forest-600 bg-success-50 px-3 py-1 rounded-full border border-success-100 dark:border-success-600/30 font-display">
              This Week
            </span>
          </div>

          <div className="grid grid-cols-7 gap-2.5 sm:gap-3 items-end h-52 pt-8 pb-2">
            {weeklyData.map((col, idx) => (
              <div 
                key={idx} 
                onClick={() => setActiveDayIndex(idx)}
                className="flex flex-col items-center gap-2 h-full justify-end group relative cursor-pointer"
              >
                {activeDayIndex === idx && (
                  <motion.div 
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="absolute -top-10 bg-slate-950 text-white text-[11px] font-bold px-2 py-1 rounded-lg shadow-md whitespace-nowrap z-20 flex flex-col items-center pointer-events-none"
                  >
                    <span>{col.pct}%</span>
                    <span className="text-[11px] text-emerald-300 font-normal">{col.present} present</span>
                    <div className="w-2 h-2 bg-slate-950 rotate-45 -mb-1 mt-0.5" />
                  </motion.div>
                )}

                <div className={`w-full rounded-2xl h-full flex items-end p-1 transition-all duration-300 ${
                  activeDayIndex === idx ? 'bg-success-50 ring-2 ring-forest-700/30' : 'bg-surface-soft hover:bg-surface'
                }`}>
                  <div
                    className={`w-full rounded-xl transition-all duration-500 ${
                      activeDayIndex === idx
                        ? 'bg-forest-700 shadow-sm'
                        : col.isHighest
                        ? 'bg-forest-600'
                        : 'bg-forest-700/70'
                    }`}
                    style={{ height: `${col.pct}%` }}
                  />
                </div>
                <span className={`text-xs font-bold font-display transition-colors ${
                  activeDayIndex === idx ? 'text-forest-700 dark:text-forest-600 font-extrabold' : 'text-ink-soft'
                }`}>
                  {col.day}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Column 2: Reminders Card (3 cols) */}
        <div className="lg:col-span-3 app-card p-6 sm:p-7 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-ink font-display">
                Headmaster Task
              </h3>
              <span className="w-2 h-2 rounded-full bg-success-600 animate-pulse" />
            </div>

            <div className="mt-4 p-3.5 bg-success-50 rounded-2xl border border-success-100 dark:border-success-600/30 space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-forest-700 dark:text-forest-600 font-display">
                <Sparkles className="w-3.5 h-3.5 text-forest-600" />
                <span>Mid-Day Meal Headcount</span>
              </div>
              <p className="t-body text-xs text-ink-soft leading-relaxed">
                Today's kitchen requisition: 924 meals required. Certification ready for district portal.
              </p>
            </div>

            <div className="mt-3 text-xs text-ink-soft flex justify-between font-medium">
              <span>Assembly Finished:</span>
              <span className="font-bold text-ink font-mono">09:15 AM</span>
            </div>
          </div>

          <Button
            variant="primary"
            size="md"
            onClick={() => navigate('/app/reports/daily')}
            leftIcon={<CheckCircle2 className="w-4 h-4 text-emerald-300" />}
            className="w-full mt-6 justify-center"
          >
            Approve Meal Count
          </Button>
        </div>

        {/* Column 3: Academic Sections List (4 cols) */}
        <div className="lg:col-span-4 app-card p-6 sm:p-7 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-extrabold text-ink font-display">
              Class Sections
            </h3>
            <button
              onClick={() => navigate('/app/school-admin/academics')}
              className="text-xs font-bold px-3 py-1 rounded-full border border-line text-ink-soft hover:bg-surface-soft transition-colors cursor-pointer font-display"
            >
              All Classes
            </button>
          </div>

          <div className="mt-4 space-y-2.5">
            {[
              { name: 'Class X - Section A', teacher: 'Pradip Sengupta', due: '46/48 Present (95.8%)' },
              { name: 'Class IX - Section B', teacher: 'Ananya Mukherjee', due: '44/46 Present (95.6%)' },
              { name: 'Class VIII - Section A', teacher: 'Debashis Roy', due: '42/45 Present (93.3%)' },
              { name: 'Class VII - Section C', teacher: 'Rina Karmakar', due: '45/48 Present (93.7%)' },
            ].map((cls, i) => (
              <div key={i} className="flex items-center justify-between p-2.5 rounded-2xl hover:bg-surface-soft transition-colors border border-line">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-forest-700 text-white flex items-center justify-center text-xs font-extrabold shadow-2xs font-display">
                    {cls.name.charAt(6)}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-ink font-display">{cls.name}</p>
                    <p className="text-[11px] text-ink-muted">Teacher: {cls.teacher}</p>
                  </div>
                </div>
                <span className="text-[11px] font-bold text-forest-700 dark:text-forest-600 bg-success-50 px-2.5 py-1 rounded-full border border-success-100 dark:border-success-600/30 font-mono">
                  {cls.due}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Row (3 Column Grid) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Column 1: Faculty / Staff Attendance (5 cols) */}
        <div className="lg:col-span-5 app-card p-6 sm:p-7">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-extrabold text-ink font-display">
                Faculty & Staff Attendance
              </h3>
              <p className="t-body text-xs text-ink-soft mt-0.5">24 of 25 Teaching Staff Present</p>
            </div>
            <button
              onClick={() => navigate('/app/school-admin/users')}
              className="text-xs font-bold px-3 py-1 rounded-full border border-line text-ink-soft hover:bg-surface-soft transition-colors cursor-pointer font-display"
            >
              Staff Directory
            </button>
          </div>

          <div className="space-y-3">
            {[
              { name: 'Sujata Banerjee', role: 'Mathematics Teacher', status: 'Present (08:45 AM)', tagColor: 'bg-success-50 text-success-800 border-success-100 dark:border-success-600/30' },
              { name: 'Arindam Ghosh', role: 'Science & Lab In-charge', status: 'Present (08:50 AM)', tagColor: 'bg-success-50 text-success-800 border-success-100 dark:border-success-600/30' },
              { name: 'Kavita Sharma', role: 'Bengali & Literature', status: 'Present (08:55 AM)', tagColor: 'bg-success-50 text-success-800 border-success-100 dark:border-success-600/30' },
              { name: 'Bikram Mondal', role: 'Physical Education', status: 'On Leave (Medical)', tagColor: 'bg-warning-50 text-warning-800 border-warning-100 dark:border-warning-600/30' },
            ].map((member, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-2xl hover:bg-surface-soft transition-colors border border-line">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-forest-700 text-white flex items-center justify-center text-xs font-extrabold shadow-2xs font-display">
                    {member.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-ink font-display">{member.name}</p>
                    <p className="text-[11px] text-ink-muted">{member.role}</p>
                  </div>
                </div>
                <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border font-display ${member.tagColor}`}>
                  {member.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Column 2: Progress Radial Gauge (4 cols) */}
        <div className="lg:col-span-4 app-card p-6 sm:p-7 flex flex-col justify-between items-center text-center">
          <div className="w-full flex items-center justify-between">
            <h3 className="text-base font-extrabold text-ink font-display">
              Today's Attendance Rate
            </h3>
            <span className="text-xs font-bold text-forest-700 dark:text-forest-600 bg-success-50 border border-success-100 dark:border-success-600/30 px-2.5 py-0.5 rounded-full font-display">
              924 / 1,005
            </span>
          </div>

          <div className="relative my-4 flex flex-col items-center justify-center">
            <svg className="w-52 h-32" viewBox="0 0 200 110">
              <path
                d="M 20 100 A 80 80 0 0 1 180 100"
                fill="none"
                stroke="var(--line)"
                strokeWidth="18"
                strokeLinecap="round"
              />
              <motion.path
                d="M 20 100 A 80 80 0 0 1 180 100"
                fill="none"
                stroke="var(--forest-700)"
                strokeWidth="18"
                strokeDasharray="251.2"
                initial={{ strokeDashoffset: 251.2 }}
                animate={{ strokeDashoffset: 251.2 - (251.2 * attendancePct) / 100 }}
                transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
                strokeLinecap="round"
              />
            </svg>
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="absolute top-12 flex flex-col items-center"
            >
              <span className="text-4xl font-extrabold text-ink font-display tracking-tight t-data">
                {attendancePct}%
              </span>
              <span className="text-xs font-medium text-ink-soft mt-0.5">Students Present</span>
            </motion.div>
          </div>

          <div className="flex items-center justify-center gap-4 text-xs font-bold text-ink-soft">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-forest-700" />
              <span>Present: 924</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-warning-600" />
              <span>Late: 42</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-danger-600" />
              <span>Absent: 39</span>
            </div>
          </div>
        </div>

        {/* Column 3: Live Gate Terminal Status (3 cols) */}
        <div className="lg:col-span-3 dark-tracker-card p-6 sm:p-7 flex flex-col justify-between text-white relative overflow-hidden rounded-[28px]">
          <div>
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-emerald-300 font-display">Gate Scanner HUD</p>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[11px] text-emerald-300 font-bold uppercase font-display">Active</span>
              </div>
            </div>

            <div className="my-6 text-center">
              <span className="text-4xl font-extrabold font-display tracking-tight text-white block t-data">
                <RollingNumber value={924} /> <span className="text-xl font-normal text-emerald-200/80">/ 1,005</span>
              </span>
              <p className="text-xs text-emerald-200/80 mt-1 font-medium">
                Total Morning Gate Check-ins
              </p>
            </div>
          </div>

          <div className="space-y-2.5 bg-emerald-950/60 p-3.5 rounded-2xl border border-emerald-500/20 text-xs">
            <div className="flex justify-between text-emerald-200/90 font-medium">
              <span>Main Gate (RFID Terminal)</span>
              <span className="font-bold text-white font-mono">680 Taps</span>
            </div>
            <div className="flex justify-between text-emerald-200/90 font-medium">
              <span>Classroom Optical Scanners</span>
              <span className="font-bold text-white font-mono">244 Scans</span>
            </div>
            <div className="flex justify-between text-emerald-300 font-bold pt-1 border-t border-emerald-500/20">
              <span>Gate Station Status</span>
              <span className="text-emerald-300 font-display">Synchronized</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SchoolAdminDashboard;
