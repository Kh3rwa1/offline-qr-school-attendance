import ExcelJS from 'exceljs';
import { sanitizeSpreadsheetValue } from './excelExportService';
import { GovernmentReportType, ValidatedGovernmentReportPayload } from './governmentReportDataService';
import { REPORT_FORMAT_CONTRACT, ReportArtifactFormat } from './reportArtifactService';
import { ReportLocale } from './reportValidationService';

interface Labels {
  title: string;
  school: string;
  udise: string;
  period: string;
  type: string;
  profile: string;
  generated: string;
  reportId: string;
  summary: string;
  register: string;
  absentees: string;
  consecutive: string;
  corrections: string;
  missing: string;
  calendar: string;
  metadata: string;
  date: string;
  className: string;
  section: string;
  roll: string;
  studentId: string;
  banglarId: string;
  name: string;
  nameBn: string;
  status: string;
  present: string;
  late: string;
  absent: string;
  leave: string;
  workingDays: string;
  rate: string;
  reason: string;
  previous: string;
  updated: string;
  updatedBy: string;
  timestamp: string;
  start: string;
  end: string;
  consecutiveDays: string;
  issue: string;
  noData: string;
  warning: string;
  signature: string;
  disclaimer: string;
}

const LABELS: Record<ReportLocale, Labels> = {
  en: {
    title: 'School Attendance Management Report', school: 'School', udise: 'UDISE code', period: 'Reporting period', type: 'Report type', profile: 'Reporting profile', generated: 'Generated at', reportId: 'Report ID', summary: 'School Summary', register: 'Attendance Register', absentees: 'Absentee Details', consecutive: 'Consecutive Absence', corrections: 'Corrections Log', missing: 'Missing Data', calendar: 'Academic Calendar', metadata: 'Export Metadata', date: 'Date', className: 'Class', section: 'Section', roll: 'Roll', studentId: 'Student ID', banglarId: 'Banglar Shiksha ID', name: 'Student name', nameBn: 'Student name (Bengali)', status: 'Status', present: 'Present', late: 'Late', absent: 'Absent', leave: 'Leave / excused', workingDays: 'Working days', rate: 'Attendance rate', reason: 'Reason', previous: 'Previous status', updated: 'Updated status', updatedBy: 'Updated by', timestamp: 'Timestamp', start: 'Start date', end: 'End date', consecutiveDays: 'Consecutive days', issue: 'Issue', noData: 'No matching records', warning: 'Data-quality warnings', signature: 'Signature', disclaimer: 'Internal school-management report only. This is not government certification and is not proof of portal submission.',
  },
  bn: {
    title: 'বিদ্যালয় হাজিরা ব্যবস্থাপনা রিপোর্ট', school: 'বিদ্যালয়', udise: 'UDISE কোড', period: 'রিপোর্টের সময়কাল', type: 'রিপোর্টের ধরন', profile: 'রিপোর্টিং প্রোফাইল', generated: 'তৈরির সময়', reportId: 'রিপোর্ট আইডি', summary: 'বিদ্যালয়ের সারাংশ', register: 'হাজিরা রেজিস্টার', absentees: 'অনুপস্থিতির বিবরণ', consecutive: 'টানা অনুপস্থিতি', corrections: 'সংশোধনের নথি', missing: 'অসম্পূর্ণ তথ্য', calendar: 'শিক্ষাবর্ষ ক্যালেন্ডার', metadata: 'এক্সপোর্টের তথ্য', date: 'তারিখ', className: 'শ্রেণি', section: 'বিভাগ', roll: 'রোল', studentId: 'শিক্ষার্থী আইডি', banglarId: 'বাংলার শিক্ষা আইডি', name: 'শিক্ষার্থীর নাম', nameBn: 'শিক্ষার্থীর বাংলা নাম', status: 'অবস্থা', present: 'উপস্থিত', late: 'দেরিতে উপস্থিত', absent: 'অনুপস্থিত', leave: 'ছুটি / অনুমোদিত', workingDays: 'কর্মদিবস', rate: 'হাজিরার হার', reason: 'কারণ', previous: 'আগের অবস্থা', updated: 'সংশোধিত অবস্থা', updatedBy: 'সংশোধনকারী', timestamp: 'সময়', start: 'শুরুর তারিখ', end: 'শেষের তারিখ', consecutiveDays: 'টানা দিন', issue: 'সমস্যা', noData: 'মিল থাকা কোনো রেকর্ড নেই', warning: 'তথ্যের মান-সংক্রান্ত সতর্কতা', signature: 'স্বাক্ষর', disclaimer: 'শুধু বিদ্যালয়ের অভ্যন্তরীণ ব্যবস্থাপনা রিপোর্ট। এটি সরকারি সার্টিফিকেশন বা পোর্টালে জমার প্রমাণ নয়।',
  },
  hi: {
    title: 'विद्यालय उपस्थिति प्रबंधन रिपोर्ट', school: 'विद्यालय', udise: 'UDISE कोड', period: 'रिपोर्ट अवधि', type: 'रिपोर्ट प्रकार', profile: 'रिपोर्टिंग प्रोफ़ाइल', generated: 'तैयार करने का समय', reportId: 'रिपोर्ट आईडी', summary: 'विद्यालय सारांश', register: 'उपस्थिति रजिस्टर', absentees: 'अनुपस्थिति विवरण', consecutive: 'लगातार अनुपस्थिति', corrections: 'सुधार अभिलेख', missing: 'अपूर्ण डेटा', calendar: 'शैक्षणिक कैलेंडर', metadata: 'निर्यात विवरण', date: 'तिथि', className: 'कक्षा', section: 'अनुभाग', roll: 'रोल', studentId: 'विद्यार्थी आईडी', banglarId: 'बांग्लार शिक्षा आईडी', name: 'विद्यार्थी का नाम', nameBn: 'विद्यार्थी का बंगाली नाम', status: 'स्थिति', present: 'उपस्थित', late: 'देर से उपस्थित', absent: 'अनुपस्थित', leave: 'अवकाश / स्वीकृत', workingDays: 'कार्यदिवस', rate: 'उपस्थिति दर', reason: 'कारण', previous: 'पिछली स्थिति', updated: 'नई स्थिति', updatedBy: 'सुधारकर्ता', timestamp: 'समय', start: 'आरंभ तिथि', end: 'समाप्ति तिथि', consecutiveDays: 'लगातार दिन', issue: 'समस्या', noData: 'कोई संबंधित रिकॉर्ड नहीं', warning: 'डेटा गुणवत्ता चेतावनियाँ', signature: 'हस्ताक्षर', disclaimer: 'केवल विद्यालय की आंतरिक प्रबंधन रिपोर्ट। यह सरकारी प्रमाणन या पोर्टल जमा करने का प्रमाण नहीं है।',
  },
};

type SectionKey = 'cover' | 'summary' | 'registers' | 'absentees' | 'consecutiveAbsences' | 'corrections' | 'missing' | 'calendar' | 'metadata';
const INTENTS: Record<GovernmentReportType, Set<SectionKey>> = {
  'monthly-register': new Set(['cover', 'summary', 'registers', 'calendar', 'metadata']),
  'daily-register': new Set(['cover', 'registers', 'metadata']),
  'daily-school': new Set(['cover', 'summary', 'metadata']),
  'academic-year': new Set(['cover', 'summary', 'registers', 'absentees', 'consecutiveAbsences', 'calendar', 'metadata']),
  'custom-range': new Set(['cover', 'summary', 'registers', 'metadata']),
  absentee: new Set(['cover', 'absentees', 'metadata']),
  'consecutive-absence': new Set(['cover', 'consecutiveAbsences', 'metadata']),
  corrections: new Set(['cover', 'corrections', 'metadata']),
  'missing-data': new Set(['cover', 'missing', 'metadata']),
  'complete-package': new Set(['cover', 'summary', 'registers', 'absentees', 'consecutiveAbsences', 'corrections', 'missing', 'calendar', 'metadata']),
};

function localeFor(data: ValidatedGovernmentReportPayload): ReportLocale {
  const configured = data.profileSnapshot.configuration.language;
  if (configured === 'ENGLISH') return 'en';
  if (configured === 'BENGALI') return 'bn';
  if (configured === 'HINDI') return 'hi';
  return data.locale;
}

function wants(data: ValidatedGovernmentReportPayload, section: SectionKey): boolean {
  if (!INTENTS[data.reportType].has(section)) return false;
  if (section === 'missing') return true;
  const configured = data.profileSnapshot.configuration.includeSheets;
  const key = section as keyof typeof configured;
  return configured[key] !== false;
}

function identityHeaders(data: ValidatedGovernmentReportPayload, l: Labels): string[] {
  const c = data.profileSnapshot.configuration.columns;
  const headers: string[] = [l.className, l.section, l.roll];
  if (c.studentCode) headers.push(l.studentId);
  if (c.banglarShikshaId) headers.push(l.banglarId);
  if (c.nameEnglish) headers.push(l.name);
  if (c.nameBengali) headers.push(l.nameBn);
  return headers;
}

function identityRow(data: ValidatedGovernmentReportPayload, value: any, className: string, sectionName: string): (string | number)[] {
  const c = data.profileSnapshot.configuration.columns;
  const row: (string | number)[] = [className || '', sectionName || '', Number(value.rollNumber || value.roll || 0)];
  if (c.studentCode) row.push(String(value.studentCode || ''));
  if (c.banglarShikshaId) row.push(String(value.banglarShikshaId || ''));
  if (c.nameEnglish) row.push(String(value.name || value.studentName || ''));
  if (c.nameBengali) row.push(String(value.nameBn || ''));
  return row;
}

function tabularData(data: ValidatedGovernmentReportPayload): { headers: string[]; rows: (string | number)[][] } {
  const l = LABELS[localeFor(data)];
  const identity = identityHeaders(data, l);
  if (data.reportType === 'absentee') {
    return { headers: [l.date, ...identity, l.status], rows: (data.absentees || []).map((item: any) => [item.date, ...identityRow(data, item, item.className, item.sectionName), item.status]) };
  }
  if (data.reportType === 'consecutive-absence') {
    return { headers: [...identity, l.consecutiveDays, l.start, l.end], rows: (data.consecutiveAbsences || []).map((item: any) => [...identityRow(data, item, item.className, item.sectionName), item.consecutiveDays, item.startDate, item.endDate]) };
  }
  if (data.reportType === 'corrections') {
    return { headers: [l.date, l.className, l.roll, l.name, l.previous, l.updated, l.reason, l.updatedBy, l.timestamp], rows: (data.corrections || []).map((item: any) => [item.date, item.className, item.rollNumber, item.studentName, item.previousStatus, item.newStatus, item.reason, item.updatedBy, item.timestamp]) };
  }
  if (data.reportType === 'missing-data') {
    return { headers: [l.issue, 'Code', 'Details'], rows: data.missingData.map((item: any) => [item.issue, item.code, JSON.stringify(item.details || {})]) };
  }
  if (data.reportType === 'daily-school') {
    return {
      headers: [l.className, l.section, 'Students', l.present, l.late, l.absent, l.leave, l.rate],
      rows: data.classRegisters.map((register: any) => {
        const sum = (key: string) => register.students.reduce((total: number, student: any) => total + Number(student[key] || 0), 0);
        const present = sum('presentCount');
        const late = sum('lateCount');
        const working = sum('workingDays');
        return [register.className, register.sectionName, register.students.length, present, late, sum('absentCount'), sum('leaveCount'), working ? `${(((present + late) / working) * 100).toFixed(2)}%` : '0%'];
      }),
    };
  }

  const dates = data.profileSnapshot.configuration.columns.dailyGrid
    ? [...new Set(data.classRegisters.flatMap((register: any) => register.students.flatMap((student: any) => Object.keys(student.dailyStatus))))].sort()
    : [];
  const headers: string[] = [...identity, ...dates];
  if (data.profileSnapshot.configuration.columns.totals) headers.push(l.present, l.late, l.absent, l.leave, l.workingDays, l.rate);
  const rows: (string | number)[][] = [];
  for (const register of data.classRegisters as any[]) {
    for (const student of register.students) {
      const row = identityRow(data, student, register.className, register.sectionName);
      dates.forEach((date) => row.push(String(student.dailyStatus[date] || '')));
      if (data.profileSnapshot.configuration.columns.totals) row.push(student.presentCount, student.lateCount, student.absentCount, student.leaveCount, student.workingDays, `${student.attendancePercentage}%`);
      rows.push(row);
    }
  }
  return { headers, rows };
}

function safeRows(table: { headers: string[]; rows: (string | number)[][] }, noData: string) {
  if (table.rows.length) return table;
  return { ...table, rows: [[noData, ...Array(Math.max(0, table.headers.length - 1)).fill('')]] };
}

function styleSheet(sheet: ExcelJS.Worksheet, orientation: 'portrait' | 'landscape') {
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A2B' } };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.pageSetup = { orientation, fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
  sheet.columns.forEach((column) => { column.width = Math.max(10, Math.min(32, column.width || 18)); });
}

function addTable(workbook: ExcelJS.Workbook, name: string, table: { headers: string[]; rows: (string | number)[][] }, orientation: 'portrait' | 'landscape', noData: string) {
  const sheet = workbook.addWorksheet(name.slice(0, 31));
  const safe = safeRows(table, noData);
  sheet.addRow(safe.headers.map(sanitizeSpreadsheetValue));
  safe.rows.forEach((row) => sheet.addRow(row.map(sanitizeSpreadsheetValue)));
  styleSheet(sheet, orientation);
  return sheet;
}

async function buildXlsx(data: ValidatedGovernmentReportPayload): Promise<Buffer> {
  const locale = localeFor(data);
  const l = LABELS[locale];
  const orientation = data.profileSnapshot.configuration.layout === 'PORTRAIT' ? 'portrait' : 'landscape';
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'AttendEase Attendance Reporting';
  workbook.created = new Date(data.generatedAt);
  workbook.modified = new Date(data.generatedAt);

  if (wants(data, 'cover')) {
    const cover = workbook.addWorksheet(l.title.slice(0, 31));
    cover.addRow([l.title]);
    cover.addRow([l.school, data.school.name]);
    cover.addRow([l.udise, data.school.udiseCode || '—']);
    cover.addRow([l.type, data.reportType]);
    cover.addRow([l.period, data.period.periodLabel]);
    cover.addRow([l.reportId, data.reportId]);
    cover.addRow([l.profile, `${data.profileSnapshot.profileName} ${data.profileSnapshot.version}`]);
    cover.addRow([l.generated, data.generatedAt]);
    cover.addRow([]);
    cover.addRow([l.warning]);
    data.validationSnapshot.warnings.forEach((warning) => cover.addRow([warning.code, warning.message]));
    cover.addRow([]);
    cover.addRow([l.disclaimer]);
    cover.addRow([data.profileSnapshot.configuration.disclaimer[locale]]);
    data.profileSnapshot.configuration.signatureBlocks.forEach((signature) => cover.addRow([signature, `________________ ${l.signature}`]));
    styleSheet(cover, orientation);
  }

  if (wants(data, 'summary')) {
    const rows = data.classRegisters.map((register: any) => {
      const sum = (key: string) => register.students.reduce((total: number, student: any) => total + Number(student[key] || 0), 0);
      const present = sum('presentCount');
      const late = sum('lateCount');
      const working = sum('workingDays');
      return [register.className, register.sectionName, register.students.length, present, late, sum('absentCount'), sum('leaveCount'), working ? `${(((present + late) / working) * 100).toFixed(2)}%` : '0%'];
    });
    addTable(workbook, l.summary, { headers: [l.className, l.section, 'Students', l.present, l.late, l.absent, l.leave, l.rate], rows }, orientation, l.noData);
  }

  if (wants(data, 'registers')) {
    const originalType = data.reportType;
    for (const register of data.classRegisters as any[]) {
      const scoped = { ...data, reportType: originalType, classRegisters: [register] } as ValidatedGovernmentReportPayload;
      addTable(workbook, `${l.register} ${register.className}-${register.sectionName}`, tabularData(scoped), orientation, l.noData);
    }
  }
  if (wants(data, 'absentees')) {
    const scoped = { ...data, reportType: 'absentee' as const };
    addTable(workbook, l.absentees, tabularData(scoped), orientation, l.noData);
  }
  if (wants(data, 'consecutiveAbsences')) {
    const scoped = { ...data, reportType: 'consecutive-absence' as const };
    addTable(workbook, l.consecutive, tabularData(scoped), orientation, l.noData);
  }
  if (wants(data, 'corrections')) {
    const scoped = { ...data, reportType: 'corrections' as const };
    addTable(workbook, l.corrections, tabularData(scoped), orientation, l.noData);
  }
  if (wants(data, 'missing')) {
    const scoped = { ...data, reportType: 'missing-data' as const };
    addTable(workbook, l.missing, tabularData(scoped), orientation, l.noData);
  }
  if (wants(data, 'calendar')) {
    const rows = [...data.workingDaysMap.entries()].map(([date, value]: [string, any]) => [date, value.classification, value.isWorkingDay ? 'YES' : 'NO', value.reason || '']);
    addTable(workbook, l.calendar, { headers: [l.date, l.status, l.workingDays, l.reason], rows }, orientation, l.noData);
  }
  if (wants(data, 'metadata')) {
    addTable(workbook, l.metadata, {
      headers: ['Property', 'Value'],
      rows: [[l.reportId, data.reportId], [l.type, data.reportType], [l.profile, `${data.profileSnapshot.profileName} ${data.profileSnapshot.version}`], [l.generated, data.generatedAt], ['Integrity', 'SHA-256 is stored beside the immutable artifact and verified before every download.'], ['Scope', data.scopeType]],
    }, orientation, l.noData);
  }
  const output = await workbook.xlsx.writeBuffer();
  return Buffer.from(output);
}

function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function buildHtml(data: ValidatedGovernmentReportPayload): Buffer {
  const locale = localeFor(data);
  const l = LABELS[locale];
  const table = safeRows(tabularData(data), l.noData);
  const headers = table.headers.map((header) => `<th scope="col">${escapeHtml(header)}</th>`).join('');
  const rows = table.rows.map((row) => `<tr>${table.headers.map((_, index) => `<td>${escapeHtml(row[index] || '')}</td>`).join('')}</tr>`).join('');
  const warnings = data.validationSnapshot.warnings.map((warning) => `<li><strong>${escapeHtml(warning.code)}</strong>: ${escapeHtml(warning.message)}</li>`).join('');
  const signatures = data.profileSnapshot.configuration.signatureBlocks.map((name) => `<div class="signature">${escapeHtml(name)}<span>${escapeHtml(l.signature)}</span></div>`).join('');
  const html = `<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(l.title)}</title><style>body{font:12px Inter,"Noto Sans Bengali","Noto Sans Devanagari",Arial,sans-serif;color:#17251d;margin:24px}header{border:2px solid #1e3a2b;padding:18px}h1{margin:0 0 12px}.meta{display:grid;grid-template-columns:1fr 1fr;gap:6px 20px}.notice{background:#fff8c5;border-left:4px solid #9a6700;padding:10px;margin:14px 0}.wrap{overflow-x:auto}table{border-collapse:collapse;width:100%;font-size:10px}th,td{border:1px solid #aeb9b2;padding:5px;text-align:left}th{background:#1e3a2b;color:#fff}.signatures{display:grid;grid-template-columns:repeat(3,1fr);gap:24px;margin-top:50px}.signature{border-top:1px solid;padding-top:4px}.signature span{display:block;color:#64748b}.disclaimer{margin-top:24px;border-top:1px solid;padding-top:8px}@page{size:${orientationForHtml(data)};margin:12mm}@media print{body{margin:0}.wrap{overflow:visible}}</style></head><body><header><h1>${escapeHtml(l.title)}</h1><div class="meta"><div><b>${escapeHtml(l.school)}:</b> ${escapeHtml(data.school.name)}</div><div><b>${escapeHtml(l.udise)}:</b> ${escapeHtml(data.school.udiseCode || '—')}</div><div><b>${escapeHtml(l.type)}:</b> ${escapeHtml(data.reportType)}</div><div><b>${escapeHtml(l.period)}:</b> ${escapeHtml(data.period.periodLabel)}</div><div><b>${escapeHtml(l.reportId)}:</b> ${escapeHtml(data.reportId)}</div><div><b>${escapeHtml(l.generated)}:</b> ${escapeHtml(data.generatedAt)}</div></div></header>${warnings ? `<section class="notice"><h2>${escapeHtml(l.warning)}</h2><ul>${warnings}</ul></section>` : ''}<main class="wrap"><table><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table></main><section class="signatures">${signatures}</section><footer class="disclaimer"><strong>${escapeHtml(l.disclaimer)}</strong><br>${escapeHtml(data.profileSnapshot.configuration.disclaimer[locale])}</footer></body></html>`;
  return Buffer.from(html, 'utf8');
}

function orientationForHtml(data: ValidatedGovernmentReportPayload): string {
  return data.profileSnapshot.configuration.layout === 'PORTRAIT' ? 'A4 portrait' : 'A4 landscape';
}

function buildCsv(data: ValidatedGovernmentReportPayload): Buffer {
  const l = LABELS[localeFor(data)];
  const table = safeRows(tabularData(data), l.noData);
  const escape = (value: unknown) => `"${String(sanitizeSpreadsheetValue(value)).replace(/"/g, '""')}"`;
  return Buffer.from(`\uFEFF${[table.headers, ...table.rows].map((row) => row.map(escape).join(',')).join('\r\n')}`, 'utf8');
}

function filename(data: ValidatedGovernmentReportPayload, format: ReportArtifactFormat): string {
  const school = String(data.school.udiseCode || data.school.schoolCode || 'SCHOOL').replace(/[^a-zA-Z0-9_-]/g, '') || 'SCHOOL';
  const type = data.reportType.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `Attendance_${school}_${type}_${data.period.startDate}_${data.period.endDate}_v${Number(data.reportVersion || 1)}.${format}`;
}

export async function buildGovernmentReportArtifact(data: ValidatedGovernmentReportPayload, format: ReportArtifactFormat) {
  const contract = REPORT_FORMAT_CONTRACT[format];
  if (!contract) throw new Error('REPORT_FORMAT_UNSUPPORTED');
  const content = format === 'xlsx' ? await buildXlsx(data) : format === 'csv' ? buildCsv(data) : buildHtml(data);
  return { format, filename: filename(data, format), contentType: contract.contentType, content };
}
