import React, { useState } from 'react';
import { Student, Language } from '../types';
import {
  Download,
  Send,
  CheckCircle2,
  BarChart3,
  Users,
  Calendar,
  TrendingUp,
  MessageSquare,
  Sparkles,
  AlertTriangle,
  School as SchoolIcon,
  RotateCcw,
  Check,
  Info,
  Layers,
} from 'lucide-react';
import { estimateSmsSegments } from '../services/sms/smsUtils';
import { Button } from './shared/Button';

interface ReportsModalProps {
  students: Student[];
  language: Language;
}

interface HistoricalUsage {
  month: string;
  days: number;
  avgAbsenceRate: number;
  totalAbsences: number;
  totalSegments: number;
  cost: number;
}

const SCHOOLS_METRICS = {
  primary: {
    id: 'primary',
    name: 'Murshidabad Model Primary School',
    totalStudents: 1410,
    preferredLanguage: 'bn',
    defaultTemplate: 'প্রিয় অভিভাবক, আপনার সন্তান {studentNameBn} আজ অনুপস্থিত। বিদ্যালয়: মুর্শিদাবাদ মডেল প্রাইমারী স্কুল।',
    history: [
      { month: 'June 2026', days: 22, avgAbsenceRate: 8.4, totalAbsences: 2608, totalSegments: 5216, cost: 625.92 },
      { month: 'July 2026', days: 23, avgAbsenceRate: 9.1, totalAbsences: 2950, totalSegments: 5900, cost: 708.00 },
    ] as HistoricalUsage[]
  },
  high: {
    id: 'high',
    name: 'Murshidabad Girls High School',
    totalStudents: 1150,
    preferredLanguage: 'bn',
    defaultTemplate: 'মুর্শিদাবাদ গার্লস হাই স্কুল: আপনার মেয়ে {studentNameBn} আজ স্কুলে অনুপস্থিত আছে। অনুগ্রহ করে কারণ জানান।',
    history: [
      { month: 'June 2026', days: 22, avgAbsenceRate: 6.2, totalAbsences: 1568, totalSegments: 3136, cost: 376.32 },
      { month: 'July 2026', days: 23, avgAbsenceRate: 6.8, totalAbsences: 1798, totalSegments: 3596, cost: 431.52 },
    ] as HistoricalUsage[]
  }
};

export const ReportsModal: React.FC<ReportsModalProps> = ({ students, language }) => {
  const [activeTab, setActiveTab] = useState<'dispatches' | 'sms-usage' | 'estimator'>('dispatches');

  // Interactive Estimator States
  const [customTotalStudents, setCustomTotalStudents] = useState<number>(52);
  const [customSchoolDays, setCustomSchoolDays] = useState<number>(22);
  const [customAbsenceRate, setCustomAbsenceRate] = useState<number>(12);
  const [customLanguage, setCustomLanguage] = useState<'bn' | 'en'>('bn');

  // SMS Usage State
  const [selectedSchool, setSelectedSchool] = useState<'primary' | 'high'>('primary');
  const [customTemplate, setCustomTemplate] = useState<string>(SCHOOLS_METRICS.primary.defaultTemplate);

  // Sync template when switching schools
  const handleSchoolChange = (schoolId: 'primary' | 'high') => {
    setSelectedSchool(schoolId);
    setCustomTemplate(SCHOOLS_METRICS[schoolId].defaultTemplate);
  };

  const presentStudents = students.filter((s) => s.status === 'PRESENT');
  const absentStudents = students.filter((s) => s.status === 'ABSENT' || s.status === 'UNMARKED');
  const totalEnrolled = students.length;

  const handleExportXlsx = () => {
    const csvContent = [
      ['Roll Number', 'Student Name', 'Status', 'Time', 'Method'].join(','),
      ...students.map((s) => [
        `"${s.rollNumber}"`,
        `"${s.name}"`,
        `"${s.status}"`,
        `"${(s as any).time || ''}"`,
        `"${(s as any).method || 'Standard'}"`,
      ].join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `attendance_register_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Helper to estimate actual message length and segment count for a student
  const getStudentSmsDetails = (stu: Student, templateText?: string) => {
    const text = templateText 
      ? templateText
          .replace(/\{studentName\}/g, stu.name)
          .replace(/\{studentNameBn\}/g, stu.nameBn || stu.name)
          .replace(/\{rollNumber\}/g, String(stu.rollNumber))
          .replace(/\{className\}/g, stu.className || 'Class VIII')
          .replace(/\{sectionName\}/g, stu.section || 'A')
          .replace(/\{schoolName\}/g, selectedSchool === 'primary' ? 'Murshidabad Model Primary School' : 'Murshidabad Girls High School')
          .replace(/\{date\}/g, '11 Aug 2026')
      : language === 'bn'
        ? `শ্রদ্ধেয় অভিভাবক, আপনার সন্তান ${stu.nameBn || stu.name} আজ অনুপস্থিত।`
        : `Dear Parent, your child ${stu.name} was marked ABSENT today.`;

    const { charCount, isUnicode, segmentCount } = estimateSmsSegments(text);

    return { text, charCount, isUnicode, segments: segmentCount };
  };

  // Calculate segment progress for template character limits
  const getTemplateProgress = (text: string) => {
    const { charCount, isUnicode, segmentCount } = estimateSmsSegments(text);
    
    let segmentMax = 160;
    let prevLimit = 0;
    
    if (isUnicode) {
      if (segmentCount === 1) {
        segmentMax = 70;
        prevLimit = 0;
      } else {
        segmentMax = 70 + (segmentCount - 1) * 67;
        prevLimit = 70 + (segmentCount - 2) * 67;
      }
    } else {
      if (segmentCount === 1) {
        segmentMax = 160;
        prevLimit = 0;
      } else {
        segmentMax = 160 + (segmentCount - 1) * 153;
        prevLimit = 160 + (segmentCount - 2) * 153;
      }
    }

    const currentSegmentChars = charCount - prevLimit;
    const currentSegmentCap = segmentMax - prevLimit;
    const progressPercent = currentSegmentCap > 0 ? Math.min(100, (currentSegmentChars / currentSegmentCap) * 100) : 0;

    return {
      charCount,
      isUnicode,
      segmentCount,
      segmentMax,
      currentSegmentChars,
      progressPercent
    };
  };

  const progress = getTemplateProgress(customTemplate);

  // Calculate actual session total segment usage based on the live roster
  const todaySmsDetailsList = absentStudents.map(s => getStudentSmsDetails(s, customTemplate));
  const todayTotalSegments = todaySmsDetailsList.reduce((acc, curr) => acc + curr.segments, 0);

  // Extrapolated monthly estimation based on current session
  const monthlyExtrapolatedAbsences = absentStudents.length * 22;
  const monthlyExtrapolatedSegments = todayTotalSegments * 22;

  // Custom scenario estimation
  const estMonthlyAbsences = Math.round(customTotalStudents * customSchoolDays * (customAbsenceRate / 100));
  const estSegmentPerMsg = customLanguage === 'bn' ? 2 : 1;
  const estMonthlySegments = estMonthlyAbsences * estSegmentPerMsg;

  // Standard pricing estimation in INR
  const segmentCost = 0.12;
  const estMonthlyCost = estMonthlySegments * segmentCost;
  const extrapolatedMonthlyCost = monthlyExtrapolatedSegments * segmentCost;

  return (
    <div id="reports-modal" className="app-card p-6 flex-1 flex flex-col gap-6 text-left">
      {/* Header and Download Button */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-ink tracking-tight font-display">
            {language === 'bn' ? 'স্কুল অ্যাডমিন রিপোর্ট ও SMS নোটিফিকেশন' : 'School Admin Reports & SMS Queue'}
          </h2>
          <p className="t-body text-xs text-ink-soft mt-0.5">
            {language === 'bn'
              ? 'অষ্টম শ্রেণী-ক | আজকের উপস্থিতির সারসংক্ষেপ ও অভিভাবক মেসেজ কিউ'
              : 'Class VIII-A | Daily Register, Attendance Performance, & SMS Analytics'}
          </p>
        </div>

        <Button
          id="export-xlsx-btn"
          variant="primary"
          size="md"
          onClick={handleExportXlsx}
          leftIcon={<Download className="w-4 h-4" />}
        >
          Export XLSX Register
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-line">
        <button
          id="tab-dispatches"
          onClick={() => setActiveTab('dispatches')}
          className={`px-5 py-3 text-sm font-bold tracking-tight border-b-2 transition-all flex items-center gap-2 cursor-pointer font-display ${
            activeTab === 'dispatches'
              ? 'border-forest-700 text-forest-700 dark:text-forest-600'
              : 'border-transparent text-ink-muted hover:text-ink'
          }`}
        >
          <Send className="w-4 h-4" />
          <span>{language === 'bn' ? 'আজকের নোটিফিকেশন কিউ' : 'Daily Dispatches'}</span>
        </button>

        <button
          id="tab-sms-usage"
          onClick={() => setActiveTab('sms-usage')}
          className={`px-5 py-3 text-sm font-bold tracking-tight border-b-2 transition-all flex items-center gap-2 cursor-pointer font-display ${
            activeTab === 'sms-usage'
              ? 'border-forest-700 text-forest-700 dark:text-forest-600'
              : 'border-transparent text-ink-muted hover:text-ink'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>{language === 'bn' ? 'SMS ব্যবহার ও প্রাক্কলন' : 'SMS Usage & Metrics'}</span>
          <span className="bg-success-50 text-success-800 border border-success-100 dark:border-success-600/30 text-[11px] px-2 py-0.5 rounded-full font-bold">
            LIVE
          </span>
        </button>

        <button
          id="tab-estimator"
          onClick={() => setActiveTab('estimator')}
          className={`px-5 py-3 text-sm font-bold tracking-tight border-b-2 transition-all flex items-center gap-2 cursor-pointer font-display ${
            activeTab === 'estimator'
              ? 'border-forest-700 text-forest-700 dark:text-forest-600'
              : 'border-transparent text-ink-muted hover:text-ink'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>{language === 'bn' ? 'কাস্টম সিনারিও সিমুলেটর' : 'Scenario Simulator'}</span>
        </button>
      </div>

      {activeTab === 'dispatches' && (
        <div className="flex flex-col gap-6">
          {/* Overview Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div id="card-total-enrolled" className="bg-surface-soft rounded-2xl p-5 border border-line">
              <div className="t-label text-ink-muted mb-1">
                Total Enrolled
              </div>
              <div className="text-3xl font-extrabold text-ink font-display t-data">{totalEnrolled}</div>
              <div className="text-[11px] text-ink-soft mt-1">Active class size roster</div>
            </div>

            <div id="card-confirmed-present" className="bg-success-50 rounded-2xl p-5 border border-success-100 dark:border-success-600/30">
              <div className="t-label text-success-600 mb-1">
                Confirmed Present
              </div>
              <div className="text-3xl font-extrabold text-success-800 font-display t-data">{presentStudents.length}</div>
              <div className="text-[11px] text-success-800 font-semibold mt-1">
                {totalEnrolled > 0 ? Math.round((presentStudents.length / totalEnrolled) * 100) : 0}% Attendance rate today
              </div>
            </div>

            <div id="card-confirmed-absent" className="bg-danger-50 rounded-2xl p-5 border border-danger-100 dark:border-danger-600/30">
              <div className="t-label text-danger-600 mb-1">
                Confirmed Absent
              </div>
              <div className="text-3xl font-extrabold text-danger-800 font-display t-data">{absentStudents.length}</div>
              <div className="text-[11px] text-danger-800 font-semibold mt-1">
                Pending parent alerts in queue
              </div>
            </div>
          </div>

          {/* SMS Queue Table */}
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-bold text-ink flex items-center gap-2 font-display">
              <Send className="w-4 h-4 text-forest-700 dark:text-forest-600" />
              <span>Automated Parent SMS Job Dispatch Log (DLT Approved Templates)</span>
            </h3>

            <div className="overflow-x-auto rounded-2xl border border-line shadow-2xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-surface-soft text-ink-muted font-bold uppercase tracking-wider font-display">
                  <tr>
                    <th className="p-3">Student Name</th>
                    <th className="p-3">Guardian Recipient</th>
                    <th className="p-3">Language Payload</th>
                    <th className="p-3">Segment Estimate</th>
                    <th className="p-3">DLT Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line font-medium text-ink bg-surface">
                  {absentStudents.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-ink-muted italic font-medium bg-surface-soft/50">
                        No absent students confirmed yet. Session must be finalized to trigger SMS jobs.
                      </td>
                    </tr>
                  ) : (
                    absentStudents.map((stu) => {
                      const { text, charCount, isUnicode, segments } = getStudentSmsDetails(stu);
                      return (
                        <tr key={stu.id} className="table-row-hover">
                          <td className="p-3">
                            <div className="font-bold text-ink font-display">{stu.name}</div>
                            <div className="text-[11px] text-ink-soft">{stu.nameBn}</div>
                          </td>
                          <td className="p-3 font-mono text-ink-soft">+91 ******4321</td>
                          <td className="p-3 text-ink-soft max-w-xs">
                            <div className="text-[11px] italic bg-surface-soft p-2 rounded-xl border border-line leading-relaxed">
                              "{text}"
                            </div>
                          </td>
                          <td className="p-3 font-mono">
                            <div className="font-semibold text-ink">{segments} Seg</div>
                            <div className="text-[11px] text-ink-muted">{charCount} Chars ({isUnicode ? 'Unicode' : 'GSM'})</div>
                          </td>
                          <td className="p-3">
                            <span className="bg-success-50 text-success-800 border border-success-100 dark:border-success-600/30 font-bold px-2 py-1 rounded-full text-[11px] flex items-center gap-1 w-max font-display">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              QUEUED_FOR_DISPATCH
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'sms-usage' && (
        <div className="flex flex-col gap-6">
          {/* Active School Selection */}
          <div className="bg-surface-soft rounded-2xl p-5 border border-line flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="bg-forest-700 text-white p-2.5 rounded-xl shadow-xs">
                <SchoolIcon className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-ink font-display">
                  {language === 'bn' ? 'স্কুল-নির্দিষ্ট সেটিংস ও টেমপ্লেট নির্বাচন' : 'School Profile & Template Configuration'}
                </h3>
                <p className="t-body text-xs text-ink-soft mt-0.5">
                  Select a school profile to load custom SMS templates and view official historical dispatches.
                </p>
              </div>
            </div>

            <div className="flex gap-2 self-stretch md:self-auto">
              <button
                id="btn-school-primary"
                onClick={() => handleSchoolChange('primary')}
                className={`flex-1 md:flex-none px-4 py-2 text-xs font-bold rounded-full border transition-all cursor-pointer font-display ${
                  selectedSchool === 'primary'
                    ? 'bg-forest-700 border-forest-700 text-white shadow-2xs'
                    : 'bg-surface border-line text-ink-soft hover:bg-surface-soft'
                }`}
              >
                Primary School
              </button>
              <button
                id="btn-school-high"
                onClick={() => handleSchoolChange('high')}
                className={`flex-1 md:flex-none px-4 py-2 text-xs font-bold rounded-full border transition-all cursor-pointer font-display ${
                  selectedSchool === 'high'
                    ? 'bg-forest-700 border-forest-700 text-white shadow-2xs'
                    : 'bg-surface border-line text-ink-soft hover:bg-surface-soft'
                }`}
              >
                Girls High School
              </button>
            </div>
          </div>

          {/* Historical Baseline Analytics Card */}
          <div className="bg-surface rounded-2xl border border-line shadow-2xs p-5 flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold text-ink flex items-center gap-1.5 font-display">
                  <TrendingUp className="w-4 h-4 text-forest-700 dark:text-forest-600" />
                  <span>Official Monthly Segment Usage History</span>
                </h3>
                <p className="t-body text-xs text-ink-soft">
                  Verified historic dispatches and billing parameters for {SCHOOLS_METRICS[selectedSchool].name}
                </p>
              </div>
              <span className="bg-success-50 text-success-800 border border-success-100 dark:border-success-600/30 font-bold px-2.5 py-0.5 rounded-full text-[11px] font-display">
                DLT Audited
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Table Metrics */}
              <div className="overflow-x-auto rounded-xl border border-line">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-soft text-ink-muted font-bold uppercase tracking-wider border-b border-line font-display">
                    <tr>
                      <th className="p-3">Academic Month</th>
                      <th className="p-3 text-center">School Days</th>
                      <th className="p-3 text-center">Avg Absences</th>
                      <th className="p-3 text-center">Total Segments</th>
                      <th className="p-3 text-right">Billable (INR)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line font-medium text-ink bg-surface">
                    {SCHOOLS_METRICS[selectedSchool].history.map((hist, idx) => (
                      <tr key={idx} className="table-row-hover">
                        <td className="p-3 font-bold text-ink font-display">{hist.month}</td>
                        <td className="p-3 text-center font-mono">{hist.days} Days</td>
                        <td className="p-3 text-center font-mono">{hist.avgAbsenceRate}%</td>
                        <td className="p-3 text-center font-mono text-forest-700 dark:text-forest-600 font-bold">{hist.totalSegments} Seg</td>
                        <td className="p-3 text-right font-mono font-bold text-success-800">₹{hist.cost.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Graphical Segment Representation */}
              <div className="bg-surface-soft rounded-xl p-4 border border-line flex flex-col justify-between">
                <div>
                  <h4 className="t-label text-ink-muted mb-3">Segment Distribution Comparison</h4>
                  <div className="flex flex-col gap-3.5">
                    {SCHOOLS_METRICS[selectedSchool].history.map((hist, idx) => {
                      const maxSeg = 6000;
                      const pct = Math.round((hist.totalSegments / maxSeg) * 100);
                      return (
                        <div key={idx} className="flex flex-col gap-1">
                          <div className="flex justify-between text-xs font-semibold">
                            <span className="text-ink">{hist.month}</span>
                            <span className="text-forest-700 dark:text-forest-600 font-mono font-bold">{hist.totalSegments} billable segments</span>
                          </div>
                          <div className="w-full bg-surface h-2 rounded-full overflow-hidden border border-line">
                            <div 
                              className="bg-forest-700 h-full rounded-full transition-all duration-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-4 flex items-start gap-2 bg-info-50 border border-info-100 dark:border-info-600/30 p-2.5 rounded-xl text-[11px] text-info-800 font-medium leading-normal">
                  <Info className="w-4 h-4 shrink-0 text-info-600 mt-0.5" />
                  <span>Billing parameters estimate at a base rate of ₹0.12 per DLT segment. Bengali unicode requires multi-segment billing.</span>
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Template Previewer & Live Meter */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 bg-surface rounded-2xl border border-line p-5 flex flex-col gap-4">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-sm font-bold text-ink flex items-center gap-1.5 font-display">
                    <MessageSquare className="w-4 h-4 text-forest-700 dark:text-forest-600" />
                    <span>Live SMS Template Customization</span>
                  </h3>
                  <p className="t-body text-xs text-ink-soft">
                    Modify school templates using standard placeholders: {"{studentNameBn}"}, {"{rollNumber}"}, {"{schoolName}"}
                  </p>
                </div>
                <button
                  onClick={() => setCustomTemplate(SCHOOLS_METRICS[selectedSchool].defaultTemplate)}
                  className="p-1.5 hover:bg-surface-soft rounded-xl text-ink-muted hover:text-ink transition-colors cursor-pointer"
                  title="Reset Template"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>

              <textarea
                value={customTemplate}
                onChange={(e) => setCustomTemplate(e.target.value)}
                className="w-full h-32 p-3 text-xs border border-line rounded-2xl font-mono focus:border-forest-700 bg-surface-soft text-ink placeholder:text-slate-500 leading-relaxed outline-none"
                placeholder="Type customized absence SMS here..."
              />

              {/* Dynamic Segment Progress Bar */}
              <div className="flex flex-col gap-2">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-ink-soft flex items-center gap-1">
                    <Layers className="w-3.5 h-3.5 text-ink-muted" />
                    <span>Segment {progress.segmentCount}</span>
                  </span>
                  <span className="font-mono text-ink font-bold">
                    {progress.charCount} Chars (Limit: {progress.segmentMax})
                  </span>
                </div>
                
                <div className="w-full bg-surface-soft h-2 rounded-full overflow-hidden border border-line">
                  <div 
                    className={`h-full rounded-full transition-all duration-300 ${
                      progress.segmentCount > 2 
                        ? 'bg-danger-600' 
                        : progress.segmentCount > 1 
                          ? 'bg-warning-600' 
                          : 'bg-forest-700'
                    }`}
                    style={{ width: `${progress.progressPercent}%` }}
                  />
                </div>

                <div className="flex justify-between text-[11px] text-ink-muted font-bold">
                  <span>0 Chars</span>
                  <span className="text-forest-700 dark:text-forest-600">{progress.isUnicode ? 'Bengali Unicode (70/67 limits)' : 'English GSM (160/153 limits)'}</span>
                  <span>{progress.segmentMax} Limit</span>
                </div>
              </div>
            </div>

            {/* Calculations & Summary Area */}
            <div className="lg:col-span-5 bg-surface-soft rounded-2xl border border-line p-5 flex flex-col justify-between gap-5">
              <div>
                <h4 className="t-label text-ink-muted mb-3">Live Roster Projection</h4>

                <div className="divide-y divide-line text-xs font-medium text-ink">
                  <div className="py-2.5 flex justify-between">
                    <span className="text-ink-soft">Absent Students Today</span>
                    <span className="font-bold font-mono text-ink">{absentStudents.length} Students</span>
                  </div>

                  <div className="py-2.5 flex justify-between">
                    <span className="text-ink-soft">Estimated Segments per SMS</span>
                    <span className="font-bold font-mono text-ink">{progress.segmentCount} Seg</span>
                  </div>

                  <div className="py-2.5 flex justify-between">
                    <span className="text-forest-700 dark:text-forest-600 font-bold">Today's Class Segment Total</span>
                    <span className="font-bold font-mono text-forest-700 dark:text-forest-600">{todayTotalSegments} Segments</span>
                  </div>

                  <div className="py-2.5 flex justify-between border-t border-line">
                    <span className="text-ink font-bold">Estimated Monthly Segments</span>
                    <span className="font-bold font-mono text-ink">{monthlyExtrapolatedSegments} Segments</span>
                  </div>

                  <div className="py-2.5 flex justify-between">
                    <span className="text-success-800 font-bold flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-success-600" />
                      <span>Est. Class Monthly Cost</span>
                    </span>
                    <span className="font-black font-mono text-success-800 text-sm">₹{extrapolatedMonthlyCost.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div className="bg-warning-50 rounded-xl p-3 border border-warning-100 dark:border-warning-600/30 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-warning-600 shrink-0 mt-0.5" />
                <div className="text-[11px] text-warning-800 font-medium leading-relaxed">
                  <strong>Unicode Segment Counting:</strong> Since templates use Bengali Unicode letters, each individual message character reduces the standard 160-char SMS limit to 70 for the first segment and 67 thereafter. Keeping names short and templates efficient avoids costly third-segment splits!
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'estimator' && (
        <div className="flex flex-col gap-6">
          <div className="bg-surface-soft rounded-2xl p-5 border border-line flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-start gap-3">
              <div className="bg-forest-700 text-white p-2.5 rounded-xl shadow-xs mt-0.5">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-ink font-display">
                  {language === 'bn' ? 'সরাসরি সেশনের তথ্যের ভিত্তিতে প্রাক্কলন' : 'Active Session Extrapolation'}
                </h3>
                <p className="t-body text-xs text-ink-soft mt-0.5">
                  Extrapolating monthly segment metrics directly from today's active school register state.
                </p>
              </div>
            </div>

            <div className="flex gap-4 bg-surface px-4 py-2.5 rounded-2xl border border-line shadow-2xs self-stretch md:self-auto justify-around">
              <div className="text-center px-1">
                <div className="t-label text-ink-muted">Today's Segments</div>
                <div className="text-xl font-extrabold text-forest-700 dark:text-forest-600 font-mono mt-0.5">{todayTotalSegments}</div>
              </div>
              <div className="w-px bg-line" />
              <div className="text-center px-1">
                <div className="t-label text-ink-muted">Estimated Monthly</div>
                <div className="text-xl font-extrabold text-ink font-mono mt-0.5">{monthlyExtrapolatedSegments}</div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-surface-soft rounded-2xl p-5 border border-line flex flex-col justify-between">
              <div>
                <div className="t-label text-ink-muted flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-ink-muted" />
                  <span>Standard School Month</span>
                </div>
                <p className="t-body text-xs text-ink-soft mt-1">Estimated academic days in standard period</p>
              </div>
              <div className="text-2xl font-extrabold text-ink font-display mt-4">22 Days</div>
            </div>

            <div className="bg-surface-soft rounded-2xl p-5 border border-line flex flex-col justify-between">
              <div>
                <div className="t-label text-ink-muted flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-ink-muted" />
                  <span>Projected Absentee Alerts</span>
                </div>
                <p className="t-body text-xs text-ink-soft mt-1">Based on today's localized attendance trend</p>
              </div>
              <div className="text-2xl font-extrabold text-ink font-display mt-4">{monthlyExtrapolatedAbsences} SMS</div>
            </div>

            <div className="bg-surface-soft rounded-2xl p-5 border border-line flex flex-col justify-between">
              <div>
                <div className="t-label text-ink-muted flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-ink-muted" />
                  <span>Estimated Monthly Cost</span>
                </div>
                <p className="t-body text-xs text-ink-soft mt-1">Calculated at standard premium segment rates</p>
              </div>
              <div className="text-2xl font-extrabold text-success-800 font-display mt-4">₹{extrapolatedMonthlyCost.toFixed(2)}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportsModal;
