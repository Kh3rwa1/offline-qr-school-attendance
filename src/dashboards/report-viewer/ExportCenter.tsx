import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Download,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Sparkles,
  ShieldCheck,
  Search,
  Check,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import { useActiveSchool } from '../../app/ActiveSchoolProvider';
import { useLanguage } from '../../app/LanguageProvider';
import { getUserSafeError } from '../../errors/userSafeErrors';
import { api } from '../../services/api';
import { Button } from '../../components/shared/Button';
import { Toast } from '../../components/shared/Toast';

interface ClassItem {
  id: string;
  className: string;
  sectionName: string;
}

interface AcademicYearItem {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
}

interface ValidationResponse {
  isValid: boolean;
  canExport: boolean;
  blockingErrors: Array<{ code: string; message: string; entityId?: string; link?: string }>;
  warnings: Array<{ code: string; message: string; entityId?: string; link?: string }>;
  summary: {
    totalStudents: number;
    totalClasses: number;
    workingDays: number;
    totalSessions: number;
    finalizedSessions: number;
    pendingSessions: number;
    missingBanglarShikshaCount: number;
    duplicateRollCount: number;
    unmarkedCount: number;
    correctionsCount: number;
  };
}

export const ExportCenter: React.FC = () => {
  const { activeSchoolId, activeSchoolName } = useActiveSchool();
  const { t } = useLanguage();

  // Wizard Step State (1: Type, 2: Scope, 3: Period, 4: Format, 5: Validate, 6: Download)
  const [currentStep, setCurrentStep] = useState<number>(1);

  // Configuration Parameters
  const [reportType, setReportType] = useState<string>('monthly-register');
  const [scopeType, setScopeType] = useState<'WHOLE_SCHOOL' | 'ALL_CLASSES' | 'SELECTED_CLASSES' | 'SELECTED_SECTION'>('ALL_CLASSES');
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [classSearchTerm, setClassSearchTerm] = useState<string>('');

  const [periodType, setPeriodType] = useState<string>('current-month');
  const [selectedYear, setSelectedYear] = useState<number>(() => new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(() => new Date().getMonth() + 1);
  const [customStartDate, setCustomStartDate] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [customEndDate, setCustomEndDate] = useState<string>(() => new Date().toISOString().slice(0, 10));

  const [exportFormat, setExportFormat] = useState<'xlsx' | 'csv' | 'html'>('xlsx');

  // Execution & Feedback State
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [validationData, setValidationData] = useState<ValidationResponse | null>(null);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [generatedReport, setGeneratedReport] = useState<{ reportId: string; downloadUrl: string; filename: string; fileHash: string } | null>(null);

  // Query: Classes
  const { data: classesData } = useQuery({
    queryKey: ['schools', activeSchoolId, 'class-sections'],
    queryFn: async () => {
      if (!activeSchoolId) return [];
      const res = await api<{ classSections: ClassItem[] }>(`/api/v1/schools/${activeSchoolId}/class-sections`);
      return res.classSections || [];
    },
    enabled: Boolean(activeSchoolId),
  });

  // Query: Academic Years (Dynamic)
  const { data: academicYearsData } = useQuery({
    queryKey: ['schools', activeSchoolId, 'academic-years'],
    queryFn: async () => {
      if (!activeSchoolId) return [];
      const res = await api<{ academicYears: AcademicYearItem[] }>(`/api/v1/schools/${activeSchoolId}/academic-years`);
      return res.academicYears || [];
    },
    enabled: Boolean(activeSchoolId),
  });

  const classes = classesData || [];
  const academicYears = academicYearsData || [];

  // Compute effective start and end dates based on period selection
  const computeDateRange = (): { start: string; end: string; label: string } => {
    const now = new Date();
    if (periodType === 'today') {
      const todayStr = now.toISOString().slice(0, 10);
      return { start: todayStr, end: todayStr, label: todayStr };
    }
    if (periodType === 'yesterday') {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      const yStr = y.toISOString().slice(0, 10);
      return { start: yStr, end: yStr, label: yStr };
    }
    if (periodType === 'current-month') {
      const y = now.getFullYear();
      const m = now.getMonth() + 1;
      const days = new Date(y, m, 0).getDate();
      const start = `${y}-${String(m).padStart(2, '0')}-01`;
      const end = `${y}-${String(m).padStart(2, '0')}-${String(days).padStart(2, '0')}`;
      return { start, end, label: `${y}-${String(m).padStart(2, '0')}` };
    }
    if (periodType === 'previous-month') {
      const y = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
      const m = now.getMonth() === 0 ? 12 : now.getMonth();
      const days = new Date(y, m, 0).getDate();
      const start = `${y}-${String(m).padStart(2, '0')}-01`;
      const end = `${y}-${String(m).padStart(2, '0')}-${String(days).padStart(2, '0')}`;
      return { start, end, label: `${y}-${String(m).padStart(2, '0')}` };
    }
    if (periodType === 'specific-month') {
      const days = new Date(selectedYear, selectedMonth, 0).getDate();
      const start = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`;
      const end = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(days).padStart(2, '0')}`;
      return { start, end, label: `${selectedYear}-${String(selectedMonth).padStart(2, '0')}` };
    }
    if (periodType === 'academic-year') {
      const currentYearObj = academicYears.find((ay) => ay.isCurrent) || academicYears[0];
      if (currentYearObj) {
        return { start: currentYearObj.startDate, end: currentYearObj.endDate, label: currentYearObj.name };
      }
      const y = now.getFullYear();
      return { start: `${y}-01-01`, end: `${y}-12-31`, label: String(y) };
    }
    // custom
    return { start: customStartDate, end: customEndDate, label: `${customStartDate} to ${customEndDate}` };
  };

  // Run Pre-flight Validation
  const handleValidate = async () => {
    if (!activeSchoolId) return;
    setIsValidating(true);
    setExportError(null);

    try {
      const { start, end } = computeDateRange();
      const payload: Record<string, any> = {
        reportType,
        scopeType,
        startDate: start,
        endDate: end,
      };

      if (scopeType === 'SELECTED_CLASSES' || scopeType === 'SELECTED_SECTION') {
        payload.classSectionIds = selectedClassIds;
      }

      const res = await api<ValidationResponse>(`/api/v1/schools/${activeSchoolId}/reports/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      setValidationData(res);
      setCurrentStep(5);
    } catch (err: any) {
      setExportError(getUserSafeError(err).message);
    } finally {
      setIsValidating(false);
    }
  };

  // Execute Generation & Download
  const handleExecuteExport = async () => {
    if (!activeSchoolId) return;
    setIsExporting(true);
    setExportError(null);

    try {
      const { start, end } = computeDateRange();
      const payload: Record<string, any> = {
        reportType,
        scopeType,
        startDate: start,
        endDate: end,
        format: exportFormat,
      };

      if (scopeType === 'SELECTED_CLASSES' || scopeType === 'SELECTED_SECTION') {
        payload.classSectionIds = selectedClassIds;
      }

      const res = await api<{
        success: boolean;
        reportId: string;
        downloadUrl: string;
        filename: string;
        fileHashSha256: string;
      }>(`/api/v1/schools/${activeSchoolId}/reports/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      setGeneratedReport({
        reportId: res.reportId,
        downloadUrl: res.downloadUrl,
        filename: res.filename,
        fileHash: res.fileHashSha256,
      });

      // Trigger browser download
      const downloadRes = await fetch(res.downloadUrl, { credentials: 'include' });
      if (!downloadRes.ok) {
        throw new Error('Download request failed');
      }

      const blob = await downloadRes.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = res.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      setSuccessToast(t('exportSuccess'));
      setCurrentStep(6);
    } catch (err: any) {
      setExportError(getUserSafeError(err).message);
    } finally {
      setIsExporting(false);
    }
  };

  // One-Click Whole-School Monthly Excel Export
  const handleOneClickMonthlyExport = async () => {
    if (!activeSchoolId) return;
    setIsExporting(true);
    setExportError(null);

    try {
      const now = new Date();
      const y = now.getFullYear();
      const m = now.getMonth() + 1;
      const days = new Date(y, m, 0).getDate();
      const start = `${y}-${String(m).padStart(2, '0')}-01`;
      const end = `${y}-${String(m).padStart(2, '0')}-${String(days).padStart(2, '0')}`;

      const res = await api<{
        success: boolean;
        reportId: string;
        downloadUrl: string;
        filename: string;
        fileHashSha256: string;
      }>(`/api/v1/schools/${activeSchoolId}/reports/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportType: 'monthly-register',
          scopeType: 'ALL_CLASSES',
          startDate: start,
          endDate: end,
          format: 'xlsx',
        }),
      });

      const downloadRes = await fetch(res.downloadUrl, { credentials: 'include' });
      if (!downloadRes.ok) throw new Error('Download failed');

      const blob = await downloadRes.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = res.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      setSuccessToast(t('exportSuccess'));
    } catch (err: any) {
      setExportError(getUserSafeError(err).message);
    } finally {
      setIsExporting(false);
    }
  };

  const filteredClasses = classes.filter((c) =>
    `${c.className} ${c.sectionName}`.toLowerCase().includes(classSearchTerm.toLowerCase())
  );

  return (
    <div id="export-center-view" className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
            <FileSpreadsheet className="w-7 h-7 text-primary" />
            {t('exportWizardTitle')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t('exportWizardSubtitle')} {activeSchoolName ? `— ${activeSchoolName}` : ''}
          </p>
        </div>
      </div>

      {/* ONE-CLICK INSTANT EXPORT CARD */}
      <div className="bg-gradient-to-r from-primary/10 via-background to-primary/5 border border-primary/20 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              <span className="font-semibold text-foreground text-base">{t('oneClickMonthlyExport')}</span>
            </div>
            <p className="text-sm text-muted-foreground">
              {t('oneClickMonthlyExportDesc')}
            </p>
          </div>
          <Button
            id="btn-one-click-monthly-export"
            variant="primary"
            size="lg"
            className="min-h-[44px] min-w-[44px] px-6 text-sm font-medium shadow-sm hover:shadow"
            onClick={handleOneClickMonthlyExport}
            disabled={isExporting}
          >
            {isExporting ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Download className="w-4 h-4 mr-2" />
            )}
            {t('generateOneClickExcel')}
          </Button>
        </div>
      </div>

      {/* 6-STEP GUIDED WIZARD CONTAINER */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        {/* Wizard Steps Navigation Bar */}
        <div className="grid grid-cols-2 md:grid-cols-6 border-b border-border text-center text-sm font-medium bg-muted/30">
          {[
            { step: 1, label: t('stepReportType') },
            { step: 2, label: t('stepScope') },
            { step: 3, label: t('stepPeriod') },
            { step: 4, label: t('stepFormat') },
            { step: 5, label: t('stepValidate') },
            { step: 6, label: t('stepDownload') },
          ].map((item) => (
            <button
              key={item.step}
              type="button"
              onClick={() => {
                if (item.step < currentStep || (item.step === 5 && validationData)) {
                  setCurrentStep(item.step);
                }
              }}
              className={`min-h-[44px] px-3 py-3 border-b-2 flex items-center justify-center transition-colors ${
                currentStep === item.step
                  ? 'border-primary text-primary font-semibold bg-background'
                  : currentStep > item.step
                  ? 'border-transparent text-foreground hover:text-primary'
                  : 'border-transparent text-muted-foreground/60 cursor-not-allowed'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Step Content */}
        <div className="p-6">
          {/* STEP 1: REPORT TYPE */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-foreground">{t('stepReportType')}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[
                  {
                    id: 'monthly-register',
                    title: t('monthlyAttendanceRegister'),
                    desc: t('monthlyAttendanceRegisterDesc'),
                  },
                  {
                    id: 'daily-register',
                    title: t('dailyAttendanceRegister'),
                    desc: t('dailyAttendanceRegisterDesc'),
                  },
                  {
                    id: 'daily-school',
                    title: t('wholeSchoolDailySummary'),
                    desc: t('wholeSchoolDailySummaryDesc'),
                  },
                  {
                    id: 'academic-year',
                    title: t('academicYearAttendanceRegister'),
                    desc: t('academicYearAttendanceRegisterDesc'),
                  },
                  {
                    id: 'custom-range',
                    title: t('customDateRangeRegister'),
                    desc: t('customDateRangeRegisterDesc'),
                  },
                  {
                    id: 'absentee',
                    title: t('absenteeReport'),
                    desc: t('absenteeReportDesc'),
                  },
                  {
                    id: 'consecutive-absence',
                    title: t('consecutiveAbsenceReport'),
                    desc: t('consecutiveAbsenceReportDesc'),
                  },
                  {
                    id: 'corrections',
                    title: t('attendanceCorrectionsReport'),
                    desc: t('attendanceCorrectionsReportDesc'),
                  },
                ].map((item) => (
                  <label
                    key={item.id}
                    className={`flex items-start p-4 border rounded-xl cursor-pointer transition-all ${
                      reportType === item.id
                        ? 'border-primary bg-primary/5 ring-1 ring-primary'
                        : 'border-border hover:border-muted-foreground/40 bg-card'
                    }`}
                  >
                    <input
                      type="radio"
                      name="reportType"
                      value={item.id}
                      checked={reportType === item.id}
                      onChange={() => setReportType(item.id)}
                      className="mt-1 mr-3 text-primary focus:ring-primary w-4 h-4"
                    />
                    <div>
                      <div className="font-medium text-foreground text-sm">{item.title}</div>
                      <div className="text-sm text-muted-foreground mt-0.5">{item.desc}</div>
                    </div>
                  </label>
                ))}
              </div>

              <div className="flex justify-end pt-4">
                <Button
                  id="btn-wizard-next-step-1"
                  variant="primary"
                  className="min-h-[44px] min-w-[44px] px-6 text-sm"
                  onClick={() => setCurrentStep(2)}
                >
                  {t('continueBtn')} <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          )}

          {/* STEP 2: SCOPE */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-foreground">{t('stepScope')}</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {[
                  { id: 'ALL_CLASSES', title: t('scopeAllClasses') },
                  { id: 'WHOLE_SCHOOL', title: t('scopeWholeSchool') },
                  { id: 'SELECTED_CLASSES', title: t('scopeSelectedClasses') },
                ].map((item) => (
                  <label
                    key={item.id}
                    className={`flex items-center p-4 border rounded-xl cursor-pointer transition-all ${
                      scopeType === item.id
                        ? 'border-primary bg-primary/5 ring-1 ring-primary'
                        : 'border-border hover:border-muted-foreground/40 bg-card'
                    }`}
                  >
                    <input
                      type="radio"
                      name="scopeType"
                      value={item.id}
                      checked={scopeType === item.id}
                      onChange={() => setScopeType(item.id as any)}
                      className="mr-3 text-primary focus:ring-primary w-4 h-4"
                    />
                    <span className="font-medium text-foreground text-sm">{item.title}</span>
                  </label>
                ))}
              </div>

              {scopeType === 'SELECTED_CLASSES' && (
                <div className="mt-4 border border-border rounded-xl p-4 bg-muted/10 space-y-3">
                  <div className="flex items-center justify-between gap-4">
                    <div className="relative flex-1 max-w-sm">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <input
                        type="text"
                        placeholder={t('searchClasses')}
                        value={classSearchTerm}
                        onChange={(e) => setClassSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 text-sm bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="min-h-[44px] text-sm"
                        onClick={() => setSelectedClassIds(classes.map((c) => c.id))}
                      >
                        {t('selectAll')}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="min-h-[44px] text-sm"
                        onClick={() => setSelectedClassIds([])}
                      >
                        {t('clearSelection')}
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 max-h-60 overflow-y-auto p-1">
                    {filteredClasses.map((cls) => {
                      const isSelected = selectedClassIds.includes(cls.id);
                      return (
                        <button
                          key={cls.id}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              setSelectedClassIds(selectedClassIds.filter((id) => id !== cls.id));
                            } else {
                              setSelectedClassIds([...selectedClassIds, cls.id]);
                            }
                          }}
                          className={`min-h-[44px] p-2 text-left border rounded-lg text-sm flex items-center justify-between transition-all ${
                            isSelected
                              ? 'border-primary bg-primary/10 font-semibold text-primary'
                              : 'border-border hover:bg-muted/50 text-foreground'
                          }`}
                        >
                          <span>
                            {cls.className} - {cls.sectionName}
                          </span>
                          {isSelected && <Check className="w-4 h-4 text-primary" />}
                        </button>
                      );
                    })}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {t('selectedCount', { count: selectedClassIds.length })}
                  </div>
                </div>
              )}

              <div className="flex justify-between pt-4">
                <Button
                  variant="outline"
                  className="min-h-[44px] min-w-[44px] px-6 text-sm"
                  onClick={() => setCurrentStep(1)}
                >
                  {t('back')}
                </Button>
                <Button
                  id="btn-wizard-next-step-2"
                  variant="primary"
                  className="min-h-[44px] min-w-[44px] px-6 text-sm"
                  disabled={scopeType === 'SELECTED_CLASSES' && selectedClassIds.length === 0}
                  onClick={() => setCurrentStep(3)}
                >
                  {t('continueBtn')} <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          )}

          {/* STEP 3: PERIOD */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-foreground">{t('stepPeriod')}</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {[
                  { id: 'current-month', title: t('periodCurrentMonth') },
                  { id: 'previous-month', title: t('periodPreviousMonth') },
                  { id: 'specific-month', title: t('periodSelectedMonth') },
                  { id: 'academic-year', title: t('periodCurrentYear') },
                  { id: 'today', title: t('periodToday') },
                  { id: 'custom-range', title: t('periodCustomRange') },
                ].map((item) => (
                  <label
                    key={item.id}
                    className={`flex items-center p-4 border rounded-xl cursor-pointer transition-all ${
                      periodType === item.id
                        ? 'border-primary bg-primary/5 ring-1 ring-primary'
                        : 'border-border hover:border-muted-foreground/40 bg-card'
                    }`}
                  >
                    <input
                      type="radio"
                      name="periodType"
                      value={item.id}
                      checked={periodType === item.id}
                      onChange={() => setPeriodType(item.id)}
                      className="mr-3 text-primary focus:ring-primary w-4 h-4"
                    />
                    <span className="font-medium text-foreground text-sm">{item.title}</span>
                  </label>
                ))}
              </div>

              {periodType === 'specific-month' && (
                <div className="flex flex-wrap gap-4 p-4 border border-border rounded-xl bg-muted/10">
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-foreground">{t('selectMonth')}</label>
                    <select
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(parseInt(e.target.value, 10))}
                      className="min-h-[44px] px-3 py-2 bg-background border border-border rounded-lg text-sm"
                    >
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                        <option key={m} value={m}>
                          {new Date(2026, m - 1, 1).toLocaleString('default', { month: 'long' })}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-foreground">{t('selectYear')}</label>
                    <select
                      value={selectedYear}
                      onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
                      className="min-h-[44px] px-3 py-2 bg-background border border-border rounded-lg text-sm"
                    >
                      {academicYears.length > 0
                        ? academicYears.map((ay) => (
                            <option key={ay.id} value={parseInt(ay.name, 10) || new Date().getFullYear()}>
                              {ay.name}
                            </option>
                          ))
                        : [2024, 2025, 2026, 2027].map((y) => (
                            <option key={y} value={y}>
                              {y}
                            </option>
                          ))}
                    </select>
                  </div>
                </div>
              )}

              {periodType === 'custom-range' && (
                <div className="flex flex-wrap gap-4 p-4 border border-border rounded-xl bg-muted/10">
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-foreground">{t('startDate')}</label>
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="min-h-[44px] px-3 py-2 bg-background border border-border rounded-lg text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-foreground">{t('endDate')}</label>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="min-h-[44px] px-3 py-2 bg-background border border-border rounded-lg text-sm"
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-between pt-4">
                <Button
                  variant="outline"
                  className="min-h-[44px] min-w-[44px] px-6 text-sm"
                  onClick={() => setCurrentStep(2)}
                >
                  {t('back')}
                </Button>
                <Button
                  id="btn-wizard-next-step-3"
                  variant="primary"
                  className="min-h-[44px] min-w-[44px] px-6 text-sm"
                  onClick={() => setCurrentStep(4)}
                >
                  {t('continueBtn')} <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          )}

          {/* STEP 4: FORMAT */}
          {currentStep === 4 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-foreground">{t('stepFormat')}</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {[
                  {
                    id: 'xlsx',
                    title: t('formatExcel'),
                    desc: t('formatExcelDesc'),
                  },
                  {
                    id: 'csv',
                    title: t('formatCSV'),
                    desc: t('formatCSVDesc'),
                  },
                  {
                    id: 'html',
                    title: t('formatPrint'),
                    desc: t('formatPrintDesc'),
                  },
                ].map((item) => (
                  <label
                    key={item.id}
                    className={`flex flex-col p-4 border rounded-xl cursor-pointer transition-all ${
                      exportFormat === item.id
                        ? 'border-primary bg-primary/5 ring-1 ring-primary'
                        : 'border-border hover:border-muted-foreground/40 bg-card'
                    }`}
                  >
                    <div className="flex items-center">
                      <input
                        type="radio"
                        name="exportFormat"
                        value={item.id}
                        checked={exportFormat === item.id}
                        onChange={() => setExportFormat(item.id as any)}
                        className="mr-3 text-primary focus:ring-primary w-4 h-4"
                      />
                      <span className="font-medium text-foreground text-sm">{item.title}</span>
                    </div>
                    <span className="text-sm text-muted-foreground mt-2 pl-7">{item.desc}</span>
                  </label>
                ))}
              </div>

              <div className="flex justify-between pt-4">
                <Button
                  variant="outline"
                  className="min-h-[44px] min-w-[44px] px-6 text-sm"
                  onClick={() => setCurrentStep(3)}
                >
                  {t('back')}
                </Button>
                <Button
                  id="btn-wizard-next-step-4"
                  variant="primary"
                  className="min-h-[44px] min-w-[44px] px-6 text-sm"
                  onClick={handleValidate}
                  disabled={isValidating}
                >
                  {isValidating ? (
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <ShieldCheck className="w-4 h-4 mr-2" />
                  )}
                  {t('stepValidate')}
                </Button>
              </div>
            </div>
          )}

          {/* STEP 5: VALIDATE & PREVIEW */}
          {currentStep === 5 && validationData && (
            <div className="space-y-5">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-primary" />
                  {t('validationTitle')}
                </h2>
                {validationData.isValid ? (
                  <span className="px-3 py-1 bg-green-500/10 text-green-700 dark:text-green-400 font-semibold text-sm rounded-full flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" /> {t('validationPassed')}
                  </span>
                ) : (
                  <span className="px-3 py-1 bg-destructive/10 text-destructive font-semibold text-sm rounded-full flex items-center gap-1">
                    <XCircle className="w-4 h-4" /> {t('validationErrors', { count: validationData.blockingErrors.length })}
                  </span>
                )}
              </div>

              {/* Validation Summary Matrix */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-muted/20 border border-border rounded-xl p-3 text-center">
                  <div className="text-sm text-muted-foreground">{t('totalStudentsEnrolled')}</div>
                  <div className="text-xl font-bold text-foreground mt-1">{validationData.summary.totalStudents}</div>
                </div>
                <div className="bg-muted/20 border border-border rounded-xl p-3 text-center">
                  <div className="text-sm text-muted-foreground">{t('totalClassesCount')}</div>
                  <div className="text-xl font-bold text-foreground mt-1">{validationData.summary.totalClasses}</div>
                </div>
                <div className="bg-muted/20 border border-border rounded-xl p-3 text-center">
                  <div className="text-sm text-muted-foreground">{t('workingDaysCount')}</div>
                  <div className="text-xl font-bold text-foreground mt-1">{validationData.summary.workingDays}</div>
                </div>
                <div className="bg-muted/20 border border-border rounded-xl p-3 text-center">
                  <div className="text-sm text-muted-foreground">{t('finalizedSessionsCount')}</div>
                  <div className="text-xl font-bold text-foreground mt-1">{validationData.summary.finalizedSessions}</div>
                </div>
              </div>

              {/* Blocking Errors (if any) */}
              {validationData.blockingErrors.length > 0 && (
                <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-xl space-y-2">
                  <div className="font-semibold text-destructive text-sm flex items-center gap-2">
                    <XCircle className="w-4 h-4" />
                    {t('validationErrors', { count: validationData.blockingErrors.length })}
                  </div>
                  <ul className="list-disc pl-5 text-sm text-destructive space-y-1">
                    {validationData.blockingErrors.map((err, idx) => (
                      <li key={idx}>
                        {err.message}
                        {err.link && (
                          <a href={err.link} className="ml-2 underline font-medium">
                            {t('viewFixIssue')}
                          </a>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Warnings (if any) */}
              {validationData.warnings.length > 0 && (
                <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl space-y-2">
                  <div className="font-semibold text-amber-700 dark:text-amber-400 text-sm flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    {t('validationWarnings', { count: validationData.warnings.length })}
                  </div>
                  <ul className="list-disc pl-5 text-sm text-amber-800 dark:text-amber-300 space-y-1">
                    {validationData.warnings.slice(0, 5).map((w, idx) => (
                      <li key={idx}>
                        {w.message}
                        {w.link && (
                          <a href={w.link} className="ml-2 underline font-medium">
                            {t('viewFixIssue')}
                          </a>
                        )}
                      </li>
                    ))}
                    {validationData.warnings.length > 5 && (
                      <li className="italic">
                        ...and {validationData.warnings.length - 5} more warnings
                      </li>
                    )}
                  </ul>
                </div>
              )}

              <div className="text-sm text-muted-foreground italic border-t border-border pt-3">
                {t('disclaimerNonCertification')}
              </div>

              <div className="flex justify-between pt-2">
                <Button
                  variant="outline"
                  className="min-h-[44px] min-w-[44px] px-6 text-sm"
                  onClick={() => setCurrentStep(4)}
                >
                  {t('back')}
                </Button>
                <Button
                  id="btn-wizard-execute-download"
                  variant="primary"
                  className="min-h-[44px] min-w-[44px] px-6 text-sm"
                  onClick={handleExecuteExport}
                  disabled={!validationData.isValid || isExporting}
                >
                  {isExporting ? (
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4 mr-2" />
                  )}
                  {exportFormat === 'xlsx' ? t('downloadExcelBtn') : t('downloadCSV')}
                </Button>
              </div>
            </div>
          )}

          {/* STEP 6: DOWNLOAD SUCCESS */}
          {currentStep === 6 && generatedReport && (
            <div className="text-center py-8 space-y-4">
              <div className="w-16 h-16 bg-green-500/10 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h2 className="text-xl font-bold text-foreground">{t('exportSuccess')}</h2>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                File: <span className="font-mono text-foreground font-semibold">{generatedReport.filename}</span>
              </p>
              <div className="text-sm font-mono text-muted-foreground bg-muted/30 p-2 rounded-lg max-w-lg mx-auto overflow-x-auto">
                {t('fileHashSha256')} {generatedReport.fileHash}
              </div>

              <div className="flex justify-center gap-3 pt-4">
                <Button
                  variant="outline"
                  className="min-h-[44px] min-w-[44px] px-6 text-sm"
                  onClick={() => {
                    setCurrentStep(1);
                    setGeneratedReport(null);
                  }}
                >
                  Export Another Register
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {exportError && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-xl">
          {exportError}
        </div>
      )}

      {successToast && (
        <Toast kind="success" text={successToast} onDismiss={() => setSuccessToast(null)} />
      )}
    </div>
  );
};

export default ExportCenter;
