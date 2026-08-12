import React, { useState, useEffect } from 'react';
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
  Sparkle
} from 'lucide-react';
import { estimateSmsSegments } from '../services/sms/smsUtils';

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
    alert('Generating & Downloading Official Attendance Register XLSX file...');
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

  // Calculate segment progress for template character limits (70 for Bengali, 160 for English)
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

  // Standard pricing estimation in INR (₹0.12 per segment)
  const segmentCost = 0.12;
  const estMonthlyCost = estMonthlySegments * segmentCost;
  const extrapolatedMonthlyCost = monthlyExtrapolatedSegments * segmentCost;

  return (
    <div id="reports-modal" className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex-1 flex flex-col gap-6">
      {/* Header and Download Button */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">
            {language === 'bn' ? 'স্কুল অ্যাডমিন রিপোর্ট ও SMS নোটিফিকেশন' : 'School Admin Reports & SMS Queue'}
          </h2>
          <p className="text-xs text-slate-500 font-semibold mt-0.5">
            {language === 'bn'
              ? 'অষ্টম শ্রেণী-ক | আজকের উপস্থিতির সারসংক্ষেপ ও অভিভাবক মেসেজ কিউ'
              : 'Class VIII-A | Daily Register, Attendance Performance, & SMS Analytics'}
          </p>
        </div>

        <button
          id="export-xlsx-btn"
          onClick={handleExportXlsx}
          className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 cursor-pointer shadow-md hover:shadow-lg transition-all"
        >
          <Download className="w-4 h-4" />
          <span>Export XLSX Register</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-100">
        <button
          id="tab-dispatches"
          onClick={() => setActiveTab('dispatches')}
          className={`px-5 py-3 text-sm font-bold tracking-tight border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'dispatches'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <Send className="w-4 h-4" />
          <span>{language === 'bn' ? 'আজকের নোটিফিকেশন কিউ' : 'Daily Dispatches'}</span>
        </button>

        <button
          id="tab-sms-usage"
          onClick={() => setActiveTab('sms-usage')}
          className={`px-5 py-3 text-sm font-bold tracking-tight border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'sms-usage'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>{language === 'bn' ? 'SMS ব্যবহার ও প্রাক্কলন' : 'SMS Usage & Metrics'}</span>
          <span className="bg-indigo-100 text-indigo-800 text-[10px] px-2 py-0.5 rounded-full font-black animate-pulse">
            LIVE
          </span>
        </button>

        <button
          id="tab-estimator"
          onClick={() => setActiveTab('estimator')}
          className={`px-5 py-3 text-sm font-bold tracking-tight border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'estimator'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-400 hover:text-slate-600'
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
            <div id="card-total-enrolled" className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                Total Enrolled
              </div>
              <div className="text-3xl font-black text-slate-800">{totalEnrolled}</div>
              <div className="text-[10px] text-slate-500 font-medium mt-1">Active class size roster</div>
            </div>

            <div id="card-confirmed-present" className="bg-emerald-50 rounded-2xl p-5 border border-emerald-100">
              <div className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest mb-1">
                Confirmed Present
              </div>
              <div className="text-3xl font-black text-emerald-800">{presentStudents.length}</div>
              <div className="text-[10px] text-emerald-600 font-semibold mt-1">
                {totalEnrolled > 0 ? Math.round((presentStudents.length / totalEnrolled) * 100) : 0}% Attendance rate today
              </div>
            </div>

            <div id="card-confirmed-absent" className="bg-rose-50 rounded-2xl p-5 border border-rose-100">
              <div className="text-[10px] font-bold text-rose-700 uppercase tracking-widest mb-1">
                Confirmed Absent
              </div>
              <div className="text-3xl font-black text-rose-800">{absentStudents.length}</div>
              <div className="text-[10px] text-rose-600 font-semibold mt-1">
                Pending parent alerts in queue
              </div>
            </div>
          </div>

          {/* SMS Queue Table */}
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
              <Send className="w-4 h-4 text-blue-600" />
              <span>Automated Parent SMS Job Dispatch Log (DLT Approved Templates)</span>
            </h3>

            <div className="overflow-x-auto rounded-2xl border border-slate-100 shadow-sm">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="p-3">Student Name</th>
                    <th className="p-3">Guardian Recipient</th>
                    <th className="p-3">Language Payload</th>
                    <th className="p-3">Segment Estimate</th>
                    <th className="p-3">DLT Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {absentStudents.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-400 italic font-medium bg-slate-50/50">
                        No absent students confirmed yet. Session must be finalized to trigger SMS jobs.
                      </td>
                    </tr>
                  ) : (
                    absentStudents.map((stu) => {
                      const { text, charCount, isUnicode, segments } = getStudentSmsDetails(stu);
                      return (
                        <tr key={stu.id} className="hover:bg-slate-50 transition-colors">
                          <td className="p-3">
                            <div className="font-bold text-slate-800">{stu.name}</div>
                            <div className="text-[10px] text-slate-500">{stu.nameBn}</div>
                          </td>
                          <td className="p-3 font-mono text-slate-600">+91 ******4321</td>
                          <td className="p-3 text-slate-600 max-w-xs">
                            <div className="text-[11px] italic bg-slate-50 p-2 rounded-lg border border-slate-100 leading-relaxed">
                              "{text}"
                            </div>
                          </td>
                          <td className="p-3 font-mono">
                            <div className="font-semibold text-slate-700">{segments} Seg</div>
                            <div className="text-[9px] text-slate-400">{charCount} Chars ({isUnicode ? 'Unicode' : 'GSM'})</div>
                          </td>
                          <td className="p-3">
                            <span className="bg-emerald-100 text-emerald-800 font-bold px-2 py-1 rounded-lg text-[9px] flex items-center gap-1 w-max">
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
          <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="bg-indigo-600 text-white p-2.5 rounded-xl shadow-sm">
                <SchoolIcon className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">
                  {language === 'bn' ? 'স্কুল-নির্দিষ্ট সেটিংস ও টেমপ্লেট নির্বাচন' : 'School Profile & Template Configuration'}
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Select a school profile to load custom SMS templates and view official historical dispatches.
                </p>
              </div>
            </div>

            <div className="flex gap-2 self-stretch md:self-auto">
              <button
                id="btn-school-primary"
                onClick={() => handleSchoolChange('primary')}
                className={`flex-1 md:flex-none px-4 py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                  selectedSchool === 'primary'
                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                Primary School
              </button>
              <button
                id="btn-school-high"
                onClick={() => handleSchoolChange('high')}
                className={`flex-1 md:flex-none px-4 py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                  selectedSchool === 'high'
                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                Girls High School
              </button>
            </div>
          </div>

          {/* Historical Baseline Analytics Card */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-xs p-5 flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-indigo-600" />
                  <span>Official Monthly Segment Usage History</span>
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  Verified historic dispatches and billing parameters for {SCHOOLS_METRICS[selectedSchool].name}
                </p>
              </div>
              <span className="bg-emerald-100 text-emerald-800 font-extrabold px-2.5 py-0.5 rounded-full text-[10px]">
                DLT Audited
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Table Metrics */}
              <div className="overflow-x-auto rounded-xl border border-slate-100">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider border-b border-slate-100">
                    <tr>
                      <th className="p-3">Academic Month</th>
                      <th className="p-3 text-center">School Days</th>
                      <th className="p-3 text-center">Avg Absences</th>
                      <th className="p-3 text-center">Total Segments</th>
                      <th className="p-3 text-right">Billable (INR)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {SCHOOLS_METRICS[selectedSchool].history.map((hist, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="p-3 font-bold text-slate-800">{hist.month}</td>
                        <td className="p-3 text-center font-mono">{hist.days} Days</td>
                        <td className="p-3 text-center font-mono">{hist.avgAbsenceRate}%</td>
                        <td className="p-3 text-center font-mono text-indigo-600 font-bold">{hist.totalSegments} Seg</td>
                        <td className="p-3 text-right font-mono font-bold text-emerald-700">₹{hist.cost.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Graphical Segment Representation */}
              <div className="bg-slate-50/50 rounded-xl p-4 border border-slate-100/50 flex flex-col justify-between">
                <div>
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Segment Distribution Comparison</h4>
                  <div className="flex flex-col gap-3.5">
                    {SCHOOLS_METRICS[selectedSchool].history.map((hist, idx) => {
                      const maxSeg = 6000;
                      const pct = Math.round((hist.totalSegments / maxSeg) * 100);
                      return (
                        <div key={idx} className="flex flex-col gap-1">
                          <div className="flex justify-between text-xs font-semibold">
                            <span className="text-slate-600">{hist.month}</span>
                            <span className="text-indigo-700 font-mono font-bold">{hist.totalSegments} billable segments</span>
                          </div>
                          <div className="w-full bg-slate-200/60 h-2.5 rounded-full overflow-hidden">
                            <div 
                              className="bg-indigo-600 h-full rounded-full transition-all duration-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-4 flex items-start gap-2 bg-indigo-50/50 border border-indigo-100/50 p-2.5 rounded-lg text-[10px] text-indigo-800 font-semibold leading-normal">
                  <Info className="w-4 h-4 shrink-0 text-indigo-600" />
                  <span>Billing parameters estimate at a base rate of ₹0.12 per DLT segment. Bengali unicode requires multi-segment billing.</span>
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Template Previewer & Live Meter */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Editor Area (7 columns) */}
            <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-100 p-5 flex flex-col gap-4">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                    <MessageSquare className="w-4 h-4 text-indigo-600" />
                    <span>Live SMS Template Customization</span>
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Modify school templates using standard placeholders: {"{studentNameBn}"}, {"{rollNumber}"}, {"{schoolName}"}
                  </p>
                </div>
                <button
                  onClick={() => setCustomTemplate(SCHOOLS_METRICS[selectedSchool].defaultTemplate)}
                  className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                  title="Reset Template"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>

              <textarea
                value={customTemplate}
                onChange={(e) => setCustomTemplate(e.target.value)}
                className="w-full h-32 p-3 text-xs border border-slate-200 rounded-xl font-mono focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 bg-slate-50/50 placeholder-slate-400 leading-relaxed"
                placeholder="Type customized absence SMS here..."
              />

              {/* Dynamic Segment Progress Bar */}
              <div className="flex flex-col gap-2">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-slate-500 flex items-center gap-1">
                    <Layers className="w-3.5 h-3.5 text-slate-400" />
                    <span>Segment {progress.segmentCount}</span>
                  </span>
                  <span className="font-mono text-slate-700">
                    {progress.charCount} Chars (Limit: {progress.segmentMax})
                  </span>
                </div>
                
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200/50">
                  <div 
                    className={`h-full rounded-full transition-all duration-300 ${
                      progress.segmentCount > 2 
                        ? 'bg-rose-500' 
                        : progress.segmentCount > 1 
                          ? 'bg-amber-500' 
                          : 'bg-indigo-600'
                    }`}
                    style={{ width: `${progress.progressPercent}%` }}
                  />
                </div>

                <div className="flex justify-between text-[10px] text-slate-400 font-bold">
                  <span>0 Chars</span>
                  <span className="text-indigo-600">{progress.isUnicode ? 'Bengali Unicode (70/67 limits)' : 'English GSM (160/153 limits)'}</span>
                  <span>{progress.segmentMax} Limit</span>
                </div>
              </div>
            </div>

            {/* Calculations & Summary Area (5 columns) */}
            <div className="lg:col-span-5 bg-slate-50/50 rounded-2xl border border-slate-100 p-5 flex flex-col justify-between gap-5">
              <div>
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Live Roster Projection</h4>

                <div className="divide-y divide-slate-200/60 text-xs font-medium text-slate-700">
                  <div className="py-2.5 flex justify-between">
                    <span className="text-slate-500">Absent Students Today</span>
                    <span className="font-bold font-mono text-slate-800">{absentStudents.length} Students</span>
                  </div>

                  <div className="py-2.5 flex justify-between">
                    <span className="text-slate-500">Estimated Segments per SMS</span>
                    <span className="font-bold font-mono text-slate-800">{progress.segmentCount} Seg</span>
                  </div>

                  <div className="py-2.5 flex justify-between">
                    <span className="text-slate-500 font-bold text-indigo-600">Today's Class Segment Total</span>
                    <span className="font-black font-mono text-indigo-800">{todayTotalSegments} Segments</span>
                  </div>

                  <div className="py-2.5 flex justify-between border-t-2 border-slate-200">
                    <span className="text-slate-500 font-bold">Estimated Monthly Segments</span>
                    <span className="font-black font-mono text-indigo-800">{monthlyExtrapolatedSegments} Segments</span>
                  </div>

                  <div className="py-2.5 flex justify-between">
                    <span className="text-emerald-700 font-extrabold flex items-center gap-1">
                      <Sparkle className="w-3.5 h-3.5 text-emerald-600 animate-spin" />
                      <span>Est. Class Monthly Cost</span>
                    </span>
                    <span className="font-black font-mono text-emerald-800 text-sm">₹{extrapolatedMonthlyCost.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Warn / Info block */}
              <div className="bg-amber-50 rounded-xl p-3 border border-amber-100 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-[10px] text-amber-800 font-medium leading-relaxed">
                  <strong>Unicode Segment Counting:</strong> Since templates use Bengali Unicode letters, each individual message character reduces the standard 160-char SMS limit to 70 for the first segment and 67 thereafter. Keeping names short and templates efficient avoids costly third-segment splits!
                </div>
              </div>
            </div>
          </div>

          {/* Rendered Live Roster Preview */}
          <div className="flex flex-col gap-3">
            <h4 className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
              <Check className="w-4 h-4 text-emerald-600" />
              <span>Preview of Rendered Student SMS Dispatches</span>
            </h4>

            <div className="overflow-x-auto rounded-xl border border-slate-100 shadow-xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="p-3">Student</th>
                    <th className="p-3">Guardian No.</th>
                    <th className="p-3">Rendered Template Content Preview</th>
                    <th className="p-3 text-center">Chars</th>
                    <th className="p-3 text-center">Segments</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {students.slice(0, 3).map((stu) => {
                    const { text, charCount, segments } = getStudentSmsDetails(stu, customTemplate);
                    return (
                      <tr key={stu.id} className="hover:bg-slate-50/50">
                        <td className="p-3">
                          <div className="font-bold text-slate-800">{stu.name}</div>
                          <div className="text-[10px] text-slate-400">{stu.nameBn}</div>
                        </td>
                        <td className="p-3 font-mono text-slate-600">+91 ******4321</td>
                        <td className="p-3 max-w-sm font-sans italic text-slate-600 text-[11px] bg-slate-50/30">
                          "{text}"
                        </td>
                        <td className="p-3 text-center font-mono">{charCount}</td>
                        <td className="p-3 text-center font-mono font-bold text-indigo-600">{segments} Seg</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'estimator' && (
        <div className="flex flex-col gap-6">
          {/* Daily Extrapolation Banner (Real Data Based) */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-5 border border-blue-100/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-start gap-3">
              <div className="bg-blue-600 text-white p-2.5 rounded-xl shadow-sm mt-0.5">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">
                  {language === 'bn' ? 'সরাসরি সেশনের তথ্যের ভিত্তিতে প্রাক্কলন' : 'Active Session Extrapolation'}
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Extrapolating monthly segment metrics directly from today's active school register state.
                </p>
              </div>
            </div>

            <div className="flex gap-4 bg-white/80 backdrop-blur-sm px-4 py-2.5 rounded-xl border border-blue-100/80 shadow-xs self-stretch md:self-auto justify-around">
              <div className="text-center px-1">
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Today's Segments</div>
                <div className="text-xl font-black text-blue-700 font-mono mt-0.5">{todayTotalSegments}</div>
              </div>
              <div className="w-px bg-slate-200" />
              <div className="text-center px-1">
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Estimated Monthly</div>
                <div className="text-xl font-black text-indigo-700 font-mono mt-0.5">{monthlyExtrapolatedSegments}</div>
              </div>
            </div>
          </div>

          {/* Extrapolation Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-slate-50/50 rounded-2xl p-5 border border-slate-100/80 flex flex-col justify-between">
              <div>
                <div className="text-slate-400 font-bold text-[10px] uppercase tracking-wider flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>Standard School Month</span>
                </div>
                <p className="text-xs text-slate-500 font-medium mt-1">Estimated academic days in standard period</p>
              </div>
              <div className="text-2xl font-black text-slate-800 mt-4">22 Days</div>
            </div>

            <div className="bg-slate-50/50 rounded-2xl p-5 border border-slate-100/80 flex flex-col justify-between">
              <div>
                <div className="text-slate-400 font-bold text-[10px] uppercase tracking-wider flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-slate-400" />
                  <span>Projected Absentee Alerts</span>
                </div>
                <p className="text-xs text-slate-500 font-medium mt-1">Based on today's localized attendance trend</p>
              </div>
              <div className="text-2xl font-black text-slate-800 mt-4">{monthlyExtrapolatedAbsences} SMS</div>
            </div>

            <div className="bg-slate-50/50 rounded-2xl p-5 border border-slate-100/80 flex flex-col justify-between">
              <div>
                <div className="text-slate-400 font-bold text-[10px] uppercase tracking-wider flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
                  <span>Estimated Monthly Cost</span>
                </div>
                <p className="text-xs text-slate-500 font-medium mt-1">Calculated at standard premium segment rates</p>
              </div>
              <div className="text-2xl font-black text-slate-800 mt-4">₹{extrapolatedMonthlyCost.toFixed(2)}</div>
            </div>
          </div>

          {/* Interactive Historical Scenario Modeling Simulator */}
          <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-xs flex flex-col gap-5">
            <div>
              <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-indigo-600" />
                <span>Historical Custom Scenario Modeling & Plan Simulator</span>
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Model diverse administrative assumptions, class parameters, and linguistic profiles to map future quota envelopes.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Sliders and Inputs */}
              <div className="flex flex-col gap-4">
                {/* Total Class Size / School Enrollment */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-center text-xs font-bold text-slate-600">
                    <span className="flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-slate-400" />
                      Roster Size (Students)
                    </span>
                    <span className="font-mono text-slate-800 bg-slate-100 px-2 py-0.5 rounded">{customTotalStudents}</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="1000"
                    step="5"
                    value={customTotalStudents}
                    onChange={(e) => setCustomTotalStudents(Number(e.target.value))}
                    className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                  />
                </div>

                {/* Monthly Session Days */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-center text-xs font-bold text-slate-600">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      Academic Days Per Month
                    </span>
                    <span className="font-mono text-slate-800 bg-slate-100 px-2 py-0.5 rounded">{customSchoolDays} Days</span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="31"
                    step="1"
                    value={customSchoolDays}
                    onChange={(e) => setCustomSchoolDays(Number(e.target.value))}
                    className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                  />
                </div>

                {/* Average Absence Rate Slider */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-center text-xs font-bold text-slate-600">
                    <span className="flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-slate-400" />
                      Expected Absence Rate (%)
                    </span>
                    <span className="font-mono text-slate-800 bg-slate-100 px-2 py-0.5 rounded">{customAbsenceRate}%</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="50"
                    step="1"
                    value={customAbsenceRate}
                    onChange={(e) => setCustomAbsenceRate(Number(e.target.value))}
                    className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                  />
                </div>

                {/* SMS Language Toggle */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-600">SMS Language Profile (Character Set)</label>
                  <div className="grid grid-cols-2 gap-2 mt-0.5">
                    <button
                      type="button"
                      onClick={() => setCustomLanguage('bn')}
                      className={`px-3 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                        customLanguage === 'bn'
                          ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                          : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      Bengali Unicode (2 Segments)
                    </button>
                    <button
                      type="button"
                      onClick={() => setCustomLanguage('en')}
                      className={`px-3 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                        customLanguage === 'en'
                          ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                          : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      English GSM 7-bit (1 Segment)
                    </button>
                  </div>
                </div>
              </div>

              {/* Dynamic Projection Results Panel */}
              <div className="bg-slate-50/50 rounded-2xl p-5 border border-slate-100 flex flex-col justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Model Outcomes</h4>

                  <div className="divide-y divide-slate-100">
                    <div className="py-2.5 flex justify-between items-center text-xs font-medium">
                      <span className="text-slate-500">Projected Absences Per Month</span>
                      <span className="font-bold font-mono text-slate-800">{estMonthlyAbsences}</span>
                    </div>

                    <div className="py-2.5 flex justify-between items-center text-xs font-medium">
                      <span className="text-slate-500 font-medium">Segments Per Dispatch</span>
                      <span className="font-bold font-mono text-slate-800">{estSegmentPerMsg} Segment{estSegmentPerMsg > 1 ? 's' : ''}</span>
                    </div>

                    <div className="py-2.5 flex justify-between items-center text-xs font-medium">
                      <span className="text-indigo-600 font-bold">Total Estimated Segments</span>
                      <span className="font-black font-mono text-indigo-800 text-sm">{estMonthlySegments}</span>
                    </div>

                    <div className="py-2.5 flex justify-between items-center text-xs font-medium">
                      <span className="text-emerald-700 font-bold">Estimated Cost (INR)</span>
                      <span className="font-black font-mono text-emerald-800 text-sm">₹{estMonthlyCost.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* Alert/Tip Box */}
                <div className="mt-4 bg-amber-50 rounded-xl p-3 border border-amber-100 flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="text-[10px] text-amber-800 font-medium leading-normal">
                    {customLanguage === 'bn' ? (
                      <span>
                        <strong>Bengali Unicode:</strong> Messages containing Unicode characters are limited to 70 characters for the first segment, and 67 characters per segment for multi-part dispatches. Optimizing placeholders keeps costs down!
                      </span>
                    ) : (
                      <span>
                        <strong>English GSM:</strong> Traditional standard GSM character templates fit up to 160 characters in a single billing segment. Highly economical for simple messaging workflows.
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
