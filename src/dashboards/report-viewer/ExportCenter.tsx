import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, RefreshCw, ShieldCheck } from 'lucide-react';
import { useActiveSchool } from '../../app/ActiveSchoolProvider';
import { useLanguage } from '../../app/LanguageProvider';
import { Button } from '../../components/shared/Button';
import { getUserSafeError } from '../../errors/userSafeErrors';
import { api } from '../../services/api';

type ScopeType = 'WHOLE_SCHOOL' | 'ALL_CLASSES' | 'SELECTED_CLASSES' | 'SELECTED_SECTION' | 'SELECTED_STUDENTS' | 'ONE_STUDENT';
type Format = 'xlsx' | 'csv' | 'html';
type Locale = 'en' | 'bn' | 'hi';
interface ClassItem { id: string; className: string; sectionName: string }
interface StudentItem { id: string; studentCode: string; name: string; nameBn?: string | null }
interface ProfileItem { id: string; profileName: string; version: string; isDefault: boolean }
interface ValidationItem { code: string; message: string; link?: string }
interface ValidationResult {
  isValid: boolean;
  canExport: boolean;
  blockingErrors: ValidationItem[];
  warnings: ValidationItem[];
  summary: { totalStudents: number; totalClasses: number; workingDays: number; finalizedSessions: number; unmarkedCount: number; estimatedCells: number };
}
interface GeneratedArtifact { reportId: string; status: string; artifact: { filename: string; sha256: string; byteSize: number; format: Format; contentType: string; downloadUrl: string } }

const COPY = {
  en: {
    title: 'Create attendance registers and exports', subtitle: 'Choose exactly what you need, review data warnings, then download the stored file.', oneClick: 'One-click monthly register', oneClickDesc: 'Whole-school monthly Excel register using the default reporting profile.', oneClickButton: 'Generate monthly Excel', stepType: '1. Report', stepScope: '2. Scope', stepPeriod: '3. Period', stepFormat: '4. Format', stepValidate: '5. Review', stepDownload: '6. Download', continue: 'Continue', back: 'Back', validate: 'Validate report', generate: 'Generate and download', reportType: 'Choose the report', scope: 'Choose people or classes', period: 'Choose the period', format: 'Choose the file format', profile: 'Reporting profile', allClasses: 'All classes', wholeSchool: 'Whole school', selectedClasses: 'Selected classes', selectedSection: 'One section', selectedStudents: 'Selected students', oneStudent: 'One student', currentMonth: 'Current month', today: 'Today', custom: 'Custom dates', startDate: 'Start date', endDate: 'End date', excel: 'Excel workbook (.xlsx)', csv: 'CSV data file (.csv)', html: 'Printable web document (.html)', chooseClasses: 'Select classes', chooseStudents: 'Select students', noStudents: 'No students found', selected: 'selected', totalStudents: 'Total Enrolled Students', totalClasses: 'Classes', workingDays: 'Applicable Working Days', finalized: 'Finalized Sessions', unmarked: 'Unmarked Entries', warnings: 'Warnings to review', blocking: 'Fix these items first', ready: 'Ready to generate', success: 'Attendance report exported successfully', hash: 'SHA-256', exactFile: 'Future downloads return these same verified bytes.', another: 'Create another report', error: 'The report could not be completed.', internal: 'Internal school-management report only. It is not government certification or proof of portal submission.', noProfile: 'Default profile', monthly: 'Monthly attendance register', daily: 'Daily class register', dailySchool: 'Whole-school daily summary', academicYear: 'Academic-year register', customReport: 'Custom date-range register', absentee: 'Absentee report', consecutive: 'Consecutive-absence report', corrections: 'Attendance corrections', missing: 'Missing-data report', complete: 'Complete internal package', selectRequired: 'Select at least one item before continuing.', fileSize: 'File size', status: 'Status', downloadAgain: 'Download same file again',
  },
  bn: {
    title: 'হাজিরা রেজিস্টার ও এক্সপোর্ট তৈরি', subtitle: 'যা দরকার তা বেছে নিন, তথ্যের সতর্কতা দেখুন, তারপর সংরক্ষিত ফাইল ডাউনলোড করুন।', oneClick: 'এক ক্লিকে মাসিক রেজিস্টার', oneClickDesc: 'ডিফল্ট রিপোর্টিং প্রোফাইল দিয়ে পুরো বিদ্যালয়ের মাসিক Excel রেজিস্টার।', oneClickButton: 'মাসিক Excel তৈরি করুন', stepType: '১. রিপোর্ট', stepScope: '২. পরিসর', stepPeriod: '৩. সময়', stepFormat: '৪. ফরম্যাট', stepValidate: '৫. পর্যালোচনা', stepDownload: '৬. ডাউনলোড', continue: 'এগিয়ে যান', back: 'পিছনে', validate: 'রিপোর্ট যাচাই করুন', generate: 'তৈরি ও ডাউনলোড করুন', reportType: 'রিপোর্ট বেছে নিন', scope: 'শিক্ষার্থী বা শ্রেণি বেছে নিন', period: 'সময়কাল বেছে নিন', format: 'ফাইলের ফরম্যাট বেছে নিন', profile: 'রিপোর্টিং প্রোফাইল', allClasses: 'সব শ্রেণি', wholeSchool: 'পুরো বিদ্যালয়', selectedClasses: 'নির্বাচিত শ্রেণি', selectedSection: 'একটি বিভাগ', selectedStudents: 'নির্বাচিত শিক্ষার্থী', oneStudent: 'একজন শিক্ষার্থী', currentMonth: 'চলতি মাস', today: 'আজ', custom: 'নিজস্ব তারিখ', startDate: 'শুরুর তারিখ', endDate: 'শেষের তারিখ', excel: 'Excel ওয়ার্কবুক (.xlsx)', csv: 'CSV তথ্য ফাইল (.csv)', html: 'প্রিন্টযোগ্য ওয়েব ডকুমেন্ট (.html)', chooseClasses: 'শ্রেণি নির্বাচন করুন', chooseStudents: 'শিক্ষার্থী নির্বাচন করুন', noStudents: 'কোনো শিক্ষার্থী পাওয়া যায়নি', selected: 'নির্বাচিত', totalStudents: 'মোট শিক্ষার্থী', totalClasses: 'শ্রেণি', workingDays: 'মোট কর্মদিবস', finalized: 'চূড়ান্ত সেশন', unmarked: 'চিহ্নিত নয়', warnings: 'যে সতর্কতাগুলি দেখবেন', blocking: 'আগে এগুলি ঠিক করুন', ready: 'রিপোর্ট তৈরির জন্য প্রস্তুত', success: 'হাজিরা রিপোর্ট সফলভাবে এক্সপোর্ট হয়েছে', hash: 'SHA-256', exactFile: 'পরের প্রতিটি ডাউনলোডে একই যাচাইকৃত বাইট থাকবে।', another: 'আরেকটি রিপোর্ট তৈরি করুন', error: 'রিপোর্টটি সম্পন্ন করা যায়নি।', internal: 'শুধু বিদ্যালয়ের অভ্যন্তরীণ ব্যবস্থাপনা রিপোর্ট। এটি সরকারি সার্টিফিকেশন বা পোর্টালে জমার প্রমাণ নয়।', noProfile: 'ডিফল্ট প্রোফাইল', monthly: 'মাসিক হাজিরা রেজিস্টার', daily: 'দৈনিক শ্রেণি রেজিস্টার', dailySchool: 'পুরো বিদ্যালয়ের দৈনিক সারাংশ', academicYear: 'শিক্ষাবর্ষের রেজিস্টার', customReport: 'নিজস্ব তারিখের রেজিস্টার', absentee: 'অনুপস্থিতির রিপোর্ট', consecutive: 'টানা অনুপস্থিতির রিপোর্ট', corrections: 'হাজিরা সংশোধন', missing: 'অসম্পূর্ণ তথ্যের রিপোর্ট', complete: 'সম্পূর্ণ অভ্যন্তরীণ প্যাকেজ', selectRequired: 'এগোনোর আগে কমপক্ষে একটি নির্বাচন করুন।', fileSize: 'ফাইলের আকার', status: 'অবস্থা', downloadAgain: 'একই ফাইল আবার ডাউনলোড করুন',
  },
  hi: {
    title: 'उपस्थिति रजिस्टर और निर्यात बनाएँ', subtitle: 'ज़रूरत चुनें, डेटा चेतावनियाँ देखें, फिर संग्रहीत फ़ाइल डाउनलोड करें।', oneClick: 'एक क्लिक मासिक रजिस्टर', oneClickDesc: 'डिफ़ॉल्ट रिपोर्टिंग प्रोफ़ाइल से पूरे विद्यालय का मासिक Excel रजिस्टर।', oneClickButton: 'मासिक Excel बनाएँ', stepType: '1. रिपोर्ट', stepScope: '2. दायरा', stepPeriod: '3. अवधि', stepFormat: '4. प्रारूप', stepValidate: '5. समीक्षा', stepDownload: '6. डाउनलोड', continue: 'आगे', back: 'पीछे', validate: 'रिपोर्ट जाँचें', generate: 'बनाएँ और डाउनलोड करें', reportType: 'रिपोर्ट चुनें', scope: 'विद्यार्थी या कक्षाएँ चुनें', period: 'अवधि चुनें', format: 'फ़ाइल प्रारूप चुनें', profile: 'रिपोर्टिंग प्रोफ़ाइल', allClasses: 'सभी कक्षाएँ', wholeSchool: 'पूरा विद्यालय', selectedClasses: 'चुनी कक्षाएँ', selectedSection: 'एक अनुभाग', selectedStudents: 'चुने विद्यार्थी', oneStudent: 'एक विद्यार्थी', currentMonth: 'वर्तमान महीना', today: 'आज', custom: 'अपनी तिथियाँ', startDate: 'आरंभ तिथि', endDate: 'समाप्ति तिथि', excel: 'Excel वर्कबुक (.xlsx)', csv: 'CSV डेटा फ़ाइल (.csv)', html: 'प्रिंट योग्य वेब दस्तावेज़ (.html)', chooseClasses: 'कक्षाएँ चुनें', chooseStudents: 'विद्यार्थी चुनें', noStudents: 'कोई विद्यार्थी नहीं मिला', selected: 'चुने गए', totalStudents: 'कुल विद्यार्थी', totalClasses: 'कक्षाएँ', workingDays: 'लागू कार्यदिवस', finalized: 'अंतिम सत्र', unmarked: 'अदर्ज प्रविष्टियाँ', warnings: 'समीक्षा की चेतावनियाँ', blocking: 'पहले इन्हें ठीक करें', ready: 'रिपोर्ट बनाने के लिए तैयार', success: 'उपस्थिति रिपोर्ट सफलतापूर्वक निर्यात हुई', hash: 'SHA-256', exactFile: 'आगे हर डाउनलोड में यही सत्यापित बाइट मिलेंगे।', another: 'दूसरी रिपोर्ट बनाएँ', error: 'रिपोर्ट पूरी नहीं हो सकी।', internal: 'केवल विद्यालय की आंतरिक प्रबंधन रिपोर्ट। यह सरकारी प्रमाणन या पोर्टल जमा करने का प्रमाण नहीं है।', noProfile: 'डिफ़ॉल्ट प्रोफ़ाइल', monthly: 'मासिक उपस्थिति रजिस्टर', daily: 'दैनिक कक्षा रजिस्टर', dailySchool: 'पूरे विद्यालय का दैनिक सारांश', academicYear: 'शैक्षणिक-वर्ष रजिस्टर', customReport: 'अपनी तिथि-सीमा का रजिस्टर', absentee: 'अनुपस्थिति रिपोर्ट', consecutive: 'लगातार अनुपस्थिति रिपोर्ट', corrections: 'उपस्थिति सुधार', missing: 'अपूर्ण डेटा रिपोर्ट', complete: 'पूरा आंतरिक पैकेज', selectRequired: 'आगे बढ़ने से पहले कम से कम एक चुनें।', fileSize: 'फ़ाइल आकार', status: 'स्थिति', downloadAgain: 'यही फ़ाइल फिर डाउनलोड करें',
  },
} as const;

const REPORTS = [
  ['monthly-register', 'monthly'], ['daily-register', 'daily'], ['daily-school', 'dailySchool'], ['academic-year', 'academicYear'], ['custom-range', 'customReport'], ['absentee', 'absentee'], ['consecutive-absence', 'consecutive'], ['corrections', 'corrections'], ['missing-data', 'missing'], ['complete-package', 'complete'],
] as const;

function monthRange() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  return { start: `${year}-${String(month).padStart(2, '0')}-01`, end: `${year}-${String(month).padStart(2, '0')}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}` };
}

export const ExportCenter: React.FC = () => {
  const { activeSchoolId, activeSchoolName } = useActiveSchool();
  const { language } = useLanguage();
  const locale = language as Locale;
  const c = COPY[locale];
  const initial = monthRange();
  const [step, setStep] = useState(1);
  const [reportType, setReportType] = useState('monthly-register');
  const [scopeType, setScopeType] = useState<ScopeType>('ALL_CLASSES');
  const [classIds, setClassIds] = useState<string[]>([]);
  const [studentIds, setStudentIds] = useState<string[]>([]);
  const [periodType, setPeriodType] = useState<'current-month' | 'today' | 'custom'>('current-month');
  const [startDate, setStartDate] = useState(initial.start);
  const [endDate, setEndDate] = useState(initial.end);
  const [format, setFormat] = useState<Format>('xlsx');
  const [profileId, setProfileId] = useState('');
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [generated, setGenerated] = useState<GeneratedArtifact | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const classesQuery = useQuery({
    queryKey: ['report-classes', activeSchoolId],
    enabled: Boolean(activeSchoolId),
    queryFn: async () => (await api<{ classSections: ClassItem[] }>(`/api/v1/schools/${activeSchoolId}/class-sections`)).classSections || [],
  });
  const studentsQuery = useQuery({
    queryKey: ['report-students', activeSchoolId],
    enabled: Boolean(activeSchoolId),
    queryFn: async () => (await api<{ students: StudentItem[] }>(`/api/v1/schools/${activeSchoolId}/students?status=ACTIVE&limit=200`)).students || [],
  });
  const profilesQuery = useQuery({
    queryKey: ['report-profiles', activeSchoolId],
    enabled: Boolean(activeSchoolId),
    queryFn: async () => (await api<{ profiles: ProfileItem[] }>(`/api/v1/schools/${activeSchoolId}/reports/profiles`)).profiles || [],
  });
  const classes = classesQuery.data || [];
  const studentList = studentsQuery.data || [];
  const profiles = profilesQuery.data || [];

  const range = useMemo(() => {
    if (periodType === 'today') { const day = new Date().toISOString().slice(0, 10); return { start: day, end: day }; }
    if (periodType === 'current-month') return monthRange();
    return { start: startDate, end: endDate };
  }, [periodType, startDate, endDate]);

  const selectionValid = !['SELECTED_CLASSES', 'SELECTED_SECTION'].includes(scopeType)
    ? !['SELECTED_STUDENTS', 'ONE_STUDENT'].includes(scopeType) || studentIds.length > 0
    : classIds.length > 0;

  const payload = () => ({
    reportType,
    scopeType,
    classSectionIds: ['SELECTED_CLASSES', 'SELECTED_SECTION'].includes(scopeType) ? classIds : undefined,
    studentIds: ['SELECTED_STUDENTS', 'ONE_STUDENT'].includes(scopeType) ? studentIds : undefined,
    periodType: periodType.toUpperCase().replace('-', '_'),
    startDate: range.start,
    endDate: range.end,
    format,
    profileId: profileId || undefined,
    locale,
  });

  const download = async (artifact: GeneratedArtifact['artifact']) => {
    const response = await fetch(artifact.downloadUrl, { credentials: 'include' });
    if (!response.ok) throw new Error('REPORT_DOWNLOAD_FAILED');
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = artifact.filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const validate = async () => {
    if (!activeSchoolId || !selectionValid) { setError(c.selectRequired); return; }
    setBusy(true); setError('');
    try {
      const response = await api<{ validation: ValidationResult }>(`/api/v1/schools/${activeSchoolId}/reports/validate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload()) });
      setValidation(response.validation); setStep(5);
    } catch (cause) { setError(getUserSafeError(cause, language).message || c.error); }
    finally { setBusy(false); }
  };

  const generate = async (overrides?: Partial<ReturnType<typeof payload>>) => {
    if (!activeSchoolId) return;
    setBusy(true); setError('');
    try {
      const response = await api<GeneratedArtifact>(`/api/v1/schools/${activeSchoolId}/reports/generate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload(), ...overrides }) });
      setGenerated(response); await download(response.artifact); setStep(6);
    } catch (cause) { setError(getUserSafeError(cause, language).message || c.error); }
    finally { setBusy(false); }
  };

  const toggleClass = (id: string) => setClassIds((current) => scopeType === 'SELECTED_SECTION' ? [id] : current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  const toggleStudent = (id: string) => setStudentIds((current) => scopeType === 'ONE_STUDENT' ? [id] : current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);

  return (
    <div id="export-center-view" className="space-y-6 max-w-6xl mx-auto pb-12">
      <header className="app-card p-6 border border-line rounded-3xl bg-surface">
        <h1 className="text-2xl font-extrabold text-ink flex items-center gap-2"><FileSpreadsheet className="w-7 h-7 text-forest-700" />{c.title}</h1>
        <p className="text-sm text-ink-muted mt-2">{c.subtitle} {activeSchoolName ? `— ${activeSchoolName}` : ''}</p>
      </header>

      <section className="app-card p-5 border border-line rounded-3xl bg-surface" aria-labelledby="one-click-heading">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div><h2 id="one-click-heading" className="font-bold text-ink">{c.oneClick}</h2><p className="text-sm text-ink-muted mt-1">{c.oneClickDesc}</p></div>
          <Button id="btn-one-click-monthly-export" variant="primary" className="min-h-[44px] min-w-[44px]" disabled={busy} onClick={() => generate({ reportType: 'monthly-register', scopeType: 'ALL_CLASSES', format: 'xlsx', periodType: 'CURRENT_MONTH', startDate: monthRange().start, endDate: monthRange().end })}>
            {busy ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}{c.oneClickButton}
          </Button>
        </div>
      </section>

      {/* Divider — visually separates the one-click fast path from the custom wizard */}
      <div className="flex items-center gap-3 text-xs text-ink-muted font-semibold uppercase tracking-wider">
        <div className="flex-1 border-t border-line" />
        <span className="px-2">{language === 'bn' ? 'বা কাস্টম রিপোর্ট তৈরি করুন' : language === 'hi' ? 'या custom report बनाएँ' : 'Or build a custom report'}</span>
        <div className="flex-1 border-t border-line" />
      </div>

      <section className="app-card border border-line rounded-3xl bg-surface overflow-hidden">
        <nav className="grid grid-cols-2 md:grid-cols-6 border-b border-line" aria-label="Report creation steps">
          {[c.stepType, c.stepScope, c.stepPeriod, c.stepFormat, c.stepValidate, c.stepDownload].map((label, index) => (
            <button key={label} type="button" className={`min-h-[44px] min-w-[44px] px-2 text-sm font-bold ${step === index + 1 ? 'bg-forest-50 text-forest-700' : 'text-ink-muted'}`} onClick={() => index + 1 < step && setStep(index + 1)} aria-current={step === index + 1 ? 'step' : undefined}>{label}</button>
          ))}
        </nav>

        <div className="p-6 space-y-5">
          {step === 1 && <>
            <h2 className="text-lg font-bold text-ink">{c.reportType}</h2>
            <div className="grid md:grid-cols-2 gap-3">{REPORTS.map(([id, label]) => <label key={id} className={`min-h-[56px] p-4 rounded-2xl border cursor-pointer flex items-center gap-3 ${reportType === id ? 'border-forest-700 bg-forest-50' : 'border-line'}`}><input type="radio" name="reportType" checked={reportType === id} onChange={() => setReportType(id)} /><span className="font-semibold text-sm">{c[label]}</span></label>)}</div>
            <div className="flex justify-end"><Button id="btn-wizard-next-step-1" variant="primary" className="min-h-[44px] min-w-[44px]" onClick={() => setStep(2)}>{c.continue}</Button></div>
          </>}

          {step === 2 && <>
            <h2 className="text-lg font-bold text-ink">{c.scope}</h2>
            <div className="grid md:grid-cols-3 gap-3">{([
              ['ALL_CLASSES', c.allClasses], ['WHOLE_SCHOOL', c.wholeSchool], ['SELECTED_CLASSES', c.selectedClasses], ['SELECTED_SECTION', c.selectedSection], ['SELECTED_STUDENTS', c.selectedStudents], ['ONE_STUDENT', c.oneStudent],
            ] as Array<[ScopeType, string]>).map(([id, label]) => <label key={id} className={`min-h-[56px] p-4 rounded-2xl border cursor-pointer flex items-center gap-3 ${scopeType === id ? 'border-forest-700 bg-forest-50' : 'border-line'}`}><input type="radio" name="scope" checked={scopeType === id} onChange={() => { setScopeType(id); setClassIds([]); setStudentIds([]); }} /><span className="font-semibold text-sm">{label}</span></label>)}</div>
            {['SELECTED_CLASSES', 'SELECTED_SECTION'].includes(scopeType) && <fieldset className="border border-line rounded-2xl p-4"><legend className="font-bold px-2">{c.chooseClasses}</legend><div className="grid grid-cols-2 md:grid-cols-4 gap-2">{classes.map((item) => <button type="button" key={item.id} onClick={() => toggleClass(item.id)} className={`min-h-[44px] min-w-[44px] rounded-xl border px-3 text-left ${classIds.includes(item.id) ? 'border-forest-700 bg-forest-50' : 'border-line'}`}>{item.className} — {item.sectionName}</button>)}</div><p className="text-sm text-ink-muted mt-2">{classIds.length} {c.selected}</p></fieldset>}
            {['SELECTED_STUDENTS', 'ONE_STUDENT'].includes(scopeType) && <fieldset className="border border-line rounded-2xl p-4"><legend className="font-bold px-2">{c.chooseStudents}</legend><div className="grid md:grid-cols-2 gap-2 max-h-72 overflow-auto">{studentList.length ? studentList.map((item) => <button type="button" key={item.id} onClick={() => toggleStudent(item.id)} className={`min-h-[52px] min-w-[44px] rounded-xl border px-3 text-left ${studentIds.includes(item.id) ? 'border-forest-700 bg-forest-50' : 'border-line'}`}><span className="block font-semibold">{item.name}</span><span className="text-sm text-ink-muted">{item.nameBn || item.studentCode}</span></button>) : <p>{c.noStudents}</p>}</div><p className="text-sm text-ink-muted mt-2">{studentIds.length} {c.selected}</p></fieldset>}
            {!selectionValid && <p className="text-sm text-red-700" role="alert">{c.selectRequired}</p>}
            <div className="flex justify-between"><Button variant="outline" className="min-h-[44px] min-w-[44px]" onClick={() => setStep(1)}>{c.back}</Button><Button id="btn-wizard-next-step-2" variant="primary" className="min-h-[44px] min-w-[44px]" disabled={!selectionValid} onClick={() => setStep(3)}>{c.continue}</Button></div>
          </>}

          {step === 3 && <>
            <h2 className="text-lg font-bold text-ink">{c.period}</h2>
            <div className="grid md:grid-cols-3 gap-3">{([['current-month', c.currentMonth], ['today', c.today], ['custom', c.custom]] as const).map(([id, label]) => <label key={id} className={`min-h-[56px] p-4 rounded-2xl border cursor-pointer flex items-center gap-3 ${periodType === id ? 'border-forest-700 bg-forest-50' : 'border-line'}`}><input type="radio" name="period" checked={periodType === id} onChange={() => setPeriodType(id)} />{label}</label>)}</div>
            {periodType === 'custom' && <div className="grid sm:grid-cols-2 gap-4"><label className="font-semibold text-sm">{c.startDate}<input type="date" className="block w-full min-h-[44px] mt-1 border border-line rounded-xl px-3" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label><label className="font-semibold text-sm">{c.endDate}<input type="date" className="block w-full min-h-[44px] mt-1 border border-line rounded-xl px-3" value={endDate} onChange={(event) => setEndDate(event.target.value)} /></label></div>}
            <div className="flex justify-between"><Button variant="outline" className="min-h-[44px] min-w-[44px]" onClick={() => setStep(2)}>{c.back}</Button><Button id="btn-wizard-next-step-3" variant="primary" className="min-h-[44px] min-w-[44px]" onClick={() => setStep(4)}>{c.continue}</Button></div>
          </>}

          {step === 4 && <>
            <h2 className="text-lg font-bold text-ink">{c.format}</h2>
            <div className="grid md:grid-cols-3 gap-3">{([['xlsx', c.excel], ['csv', c.csv], ['html', c.html]] as Array<[Format, string]>).map(([id, label]) => <label key={id} className={`min-h-[56px] p-4 rounded-2xl border cursor-pointer flex items-center gap-3 ${format === id ? 'border-forest-700 bg-forest-50' : 'border-line'}`}><input type="radio" name="format" checked={format === id} onChange={() => setFormat(id)} />{label}</label>)}</div>
            <label className="font-semibold text-sm block">{c.profile}<select className="block w-full min-h-[44px] mt-1 border border-line rounded-xl px-3 bg-surface" value={profileId} onChange={(event) => setProfileId(event.target.value)}><option value="">{c.noProfile}</option>{profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.profileName} — {profile.version}</option>)}</select></label>
            <p className="text-sm text-ink-muted">{c.internal}</p>
            <div className="flex justify-between"><Button variant="outline" className="min-h-[44px] min-w-[44px]" onClick={() => setStep(3)}>{c.back}</Button><Button id="btn-wizard-next-step-4" variant="primary" className="min-h-[44px] min-w-[44px]" disabled={busy} onClick={validate}>{busy ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <ShieldCheck className="w-4 h-4 mr-2" />}{c.validate}</Button></div>
          </>}

          {step === 5 && validation && <>
            <h2 className="text-lg font-bold text-ink flex items-center gap-2">{validation.isValid ? <CheckCircle2 className="text-green-700" /> : <AlertTriangle className="text-amber-700" />}{validation.isValid ? c.ready : c.blocking}</h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">{[[c.totalStudents, validation.summary.totalStudents], [c.totalClasses, validation.summary.totalClasses], [c.workingDays, validation.summary.workingDays], [c.finalized, validation.summary.finalizedSessions], [c.unmarked, validation.summary.unmarkedCount]].map(([label, value]) => <div key={String(label)} className="border border-line rounded-2xl p-3"><div className="text-sm text-ink-muted">{label}</div><div className="text-xl font-bold">{value}</div></div>)}</div>
            {validation.blockingErrors.length > 0 && <div className="bg-red-50 border border-red-200 rounded-2xl p-4"><h3 className="font-bold text-red-800">{c.blocking}</h3><ul className="list-disc pl-5 text-sm">{validation.blockingErrors.map((item) => <li key={item.code}>{item.message}</li>)}</ul></div>}
            {validation.warnings.length > 0 && <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4"><h3 className="font-bold text-amber-900">{c.warnings}</h3><ul className="list-disc pl-5 text-sm">{validation.warnings.map((item) => <li key={`${item.code}-${item.message}`}>{item.message}</li>)}</ul></div>}
            <p className="text-sm text-ink-muted">{c.internal}</p>
            <div className="flex justify-between"><Button variant="outline" className="min-h-[44px] min-w-[44px]" onClick={() => setStep(4)}>{c.back}</Button><Button id="btn-wizard-execute-download" variant="primary" className="min-h-[44px] min-w-[44px]" disabled={!validation.isValid || busy} onClick={() => generate()}>{busy ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}{c.generate}</Button></div>
          </>}

          {step === 6 && generated && <div className="text-center py-8 space-y-4"><CheckCircle2 className="w-14 h-14 text-green-700 mx-auto" /><h2 className="text-xl font-bold">{c.success}</h2><p className="font-mono text-sm break-all">{generated.artifact.filename}</p><dl className="max-w-xl mx-auto text-sm grid grid-cols-[auto_1fr] gap-2 text-left"><dt className="font-bold">{c.status}</dt><dd>{generated.status}</dd><dt className="font-bold">{c.fileSize}</dt><dd>{generated.artifact.byteSize.toLocaleString(locale)} bytes</dd><dt className="font-bold">{c.hash}</dt><dd className="font-mono break-all">{generated.artifact.sha256}</dd></dl><p className="text-sm text-ink-muted">{c.exactFile}</p><div className="flex flex-wrap justify-center gap-3"><Button variant="primary" className="min-h-[44px] min-w-[44px]" onClick={() => download(generated.artifact)}><Download className="w-4 h-4 mr-2" />{c.downloadAgain}</Button><Button variant="outline" className="min-h-[44px] min-w-[44px]" onClick={() => { setStep(1); setGenerated(null); setValidation(null); }}>{c.another}</Button></div></div>}
        </div>
      </section>

      {error && <div role="alert" className="p-4 rounded-2xl border border-red-200 bg-red-50 text-red-800">{error}</div>}
    </div>
  );
};

export default ExportCenter;
