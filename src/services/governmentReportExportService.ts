import ExcelJS from 'exceljs';
import {
  buildGovernmentReadyExcelWorkbook,
  buildSecureCSVExport,
  sanitizeSheetName,
} from './excelExportService';
import {
  GovernmentReportType,
  ValidatedGovernmentReportPayload,
} from './governmentReportDataService';
import {
  REPORT_FORMAT_CONTRACT,
  ReportArtifactFormat,
} from './reportArtifactService';
import { ReportLocale } from './reportValidationService';

const labelSets = {
  en: {
    reportTitle: 'School Attendance Management Report',
    reportType: 'Report type',
    reportingPeriod: 'Reporting period',
    school: 'School',
    udise: 'UDISE code',
    generatedAt: 'Generated at',
    reportId: 'Report ID',
    profile: 'Reporting profile',
    warnings: 'Data-quality warnings',
    noData: 'No matching records',
    cover: 'Cover',
    summary: 'School Summary',
    registers: 'Attendance Register',
    absentees: 'Absentee Details',
    consecutive: 'Consecutive Absence',
    corrections: 'Corrections Log',
    missing: 'Missing Data',
    calendar: 'Academic Calendar',
    metadata: 'Export Metadata',
    date: 'Date',
    className: 'Class',
    sectionName: 'Section',
    roll: 'Roll',
    studentCode: 'Student ID',
    banglarShikshaId: 'Banglar Shiksha ID',
    nameEnglish: 'Student name',
    nameBengali: 'Student name (Bengali)',
    status: 'Status',
    present: 'Present',
    late: 'Late',
    absent: 'Absent',
    leave: 'Leave / excused',
    workingDays: 'Working days',
    rate: 'Attendance rate',
    previousStatus: 'Previous status',
    updatedStatus: 'Updated status',
    reason: 'Reason',
    updatedBy: 'Updated by',
    timestamp: 'Timestamp',
    consecutiveDays: 'Consecutive days',
    startDate: 'Start date',
    endDate: 'End date',
    issue: 'Issue',
    section: 'Report section',
    value: 'Value',
    signature: 'Signature',
    internalOnly: 'Internal management status only; not government certification or proof of portal submission.',
  },
  bn: {
    reportTitle: 'বিদ্যালয় হাজিরা ব্যবস্থাপনা রিপোর্ট',
    reportType: 'রিপোর্টের ধরন',
    reportingPeriod: 'রিপোর্টের সময়কাল',
    school: 'বিদ্যালয়',
    udise: 'UDISE কোড',
    generatedAt: 'তৈরির সময়',
    reportId: 'রিপোর্ট আইডি',
    profile: 'রিপোর্টিং প্রোফাইল',
    warnings: 'তথ্যের মান-সংক্রান্ত সতর্কতা',
    noData: 'মিল থাকা কোনো রেকর্ড নেই',
    cover: 'প্রচ্ছদ',
    summary: 'বিদ্যালয়ের সারাংশ',
    registers: 'হাজিরা রেজিস্টার',
    absentees: 'অনুপস্থিতির বিবরণ',
    consecutive: 'টানা অনুপস্থিতি',
    corrections: 'সংশোধনের নথি',
    missing: 'অসম্পূর্ণ তথ্য',
    calendar: 'শিক্ষাবর্ষ ক্যালেন্ডার',
    metadata: 'এক্সপোর্টের তথ্য',
    date: 'তারিখ',
    className: 'শ্রেণি',
    sectionName: 'বিভাগ',
    roll: 'রোল',
    studentCode: 'শিক্ষার্থী আইডি',
    banglarShikshaId: 'বাংলার শিক্ষা আইডি',
    nameEnglish: 'শিক্ষার্থীর নাম',
    nameBengali: 'শিক্ষার্থীর বাংলা নাম',
    status: 'অবস্থা',
    present: 'উপস্থিত',
    late: 'দেরিতে উপস্থিত',
    absent: 'অনুপস্থিত',
    leave: 'ছুটি / অনুমোদিত',
    workingDays: 'কর্মদিবস',
    rate: 'হাজিরার হার',
    previousStatus: 'আগের অবস্থা',
    updatedStatus: 'সংশোধিত অবস্থা',
    reason: 'কারণ',
    updatedBy: 'সংশোধনকারী',
    timestamp: 'সময়',
    consecutiveDays: 'টানা দিন',
    startDate: 'শুরুর তারিখ',
    endDate: 'শেষের তারিখ',
    issue: 'সমস্যা',
    section: 'রিপোর্ট অংশ',
    value: 'মান',
    signature: 'স্বাক্ষর',
    internalOnly: 'শুধু বিদ্যালয়ের অভ্যন্তরীণ ব্যবস্থাপনা অবস্থা; সরকারি সার্টিফিকেশন বা পোর্টালে জমার প্রমাণ নয়।',
  },
  hi: {
    reportTitle: 'विद्यालय उपस्थिति प्रबंधन रिपोर्ट',
    reportType: 'रिपोर्ट प्रकार',
    reportingPeriod: 'रिपोर्ट अवधि',
    school: 'विद्यालय',
    udise: 'UDISE कोड',
    generatedAt: 'तैयार करने का समय',
    reportId: 'रिपोर्ट आईडी',
    profile: 'रिपोर्टिंग प्रोफ़ाइल',
    warnings: 'डेटा गुणवत्ता चेतावनियाँ',
    noData: 'कोई संबंधित रिकॉर्ड नहीं',
    cover: 'आवरण',
    summary: 'विद्यालय सारांश',
    registers: 'उपस्थिति रजिस्टर',
    absentees: 'अनुपस्थिति विवरण',
    consecutive: 'लगातार अनुपस्थिति',
    corrections: 'सुधार अभिलेख',
    missing: 'अपूर्ण डेटा',
    calendar: 'शैक्षणिक कैलेंडर',
    metadata: 'निर्यात विवरण',
    date: 'तिथि',
    className: 'कक्षा',
    sectionName: 'अनुभाग',
    roll: 'रोल',
    studentCode: 'विद्यार्थी आईडी',
    banglarShikshaId: 'बांग्लार शिक्षा आईडी',
    nameEnglish: 'विद्यार्थी का नाम',
    nameBengali: 'विद्यार्थी का बंगाली नाम',
    status: 'स्थिति',
    present: 'उपस्थित',
    late: 'देर से उपस्थित',
    absent: 'अनुपस्थित',
    leave: 'अवकाश / स्वीकृत',
    workingDays: 'कार्यदिवस',
    rate: 'उपस्थिति दर',
    previousStatus: 'पिछली स्थिति',
    updatedStatus: 'नई स्थिति',
    reason: 'कारण',
    updatedBy: 'सुधारकर्ता',
    timestamp: 'समय',
    consecutiveDays: 'लगातार दिन',
    startDate: 'आरंभ तिथि',
    endDate: 'समाप्ति तिथि',
    issue: 'समस्या',
    section: 'रिपोर्ट भाग',
    value: 'मान',
    signature: 'हस्ताक्षर',
    internalOnly: 'केवल विद्यालय की आंतरिक प्रबंधन स्थिति; सरकारी प्रमाणन या पोर्टल जमा करने का प्रमाण नहीं।',
  },
} as const;

type Labels = (typeof labelSets)['en'];
type LabelKey = keyof Labels;

interface SectionIntent {
  cover: boolean;
  summary: boolean;
  registers: boolean;
  absentees: boolean;
  consecutiveAbsences: boolean;
  corrections: boolean;
  missing: boolean;
  calendar: boolean;
  metadata: boolean;
}

const reportIntents: Record<GovernmentReportType, SectionIntent> = {
  'monthly-register': { cover: true, summary: true, registers: true, absentees: false, consecutiveAbsences: false, corrections: false, missing: false, calendar: true, metadata: true },
  'daily-register': { cover: true, summary: false, registers: true, absentees: false, consecutiveAbsences: false, corrections: false, missing: false, calendar: false, metadata: true },
  'daily-school': { cover: true, summary: true, registers: false, absentees: false, consecutiveAbsences: false, corrections: false, missing: false, calendar: false, metadata: true },
  'academic-year': { cover: true, summary: true, registers: true, absentees: true, consecutiveAbsences: true, corrections: false, missing: false, calendar: true, metadata: true },
  'custom-range': { cover: true, summary: true, registers: true, absentees: false, consecutiveAbsences: false, corrections: false, missing: false, calendar: false, metadata: true },
  absentee: { cover: true, summary: false, registers: false, absentees: true, consecutiveAbsences: false, corrections: false, missing: false, calendar: false, metadata: true },
  'consecutive-absence': { cover: true, summary: false, registers: false, absentees: false, consecutiveAbsences: true, corrections: false, missing: false, calendar: false, metadata: true },
  corrections: { cover: true, summary: false, registers: false, absentees: false, consecutiveAbsences: false, corrections: true, missing: false, calendar: false, metadata: true },
  'missing-data': { cover: true, summary: false, registers: false, absentees: false, consecutiveAbsences: false, corrections: false, missing: true, calendar: false, metadata: true },
  'complete-package': { cover: true, summary: true, registers: true, absentees: true, consecutiveAbsences: true, corrections: true, missing: true, calendar: true, metadata: true },
};

function effectiveLocale(data: ValidatedGovernmentReportPayload): ReportLocale {
  const configured = data.profileSnapshot.configuration.language;
  if (configured === 'ENGLISH') return 'en';
  if (configured === 'BENGALI') return 'bn';
  if (configured === 'HINDI') return 'hi';
  return data.locale;
}

function getLabels(data: ValidatedGovernmentReportPayload): Labels {
  return labelSets[effectiveLocale(data)] as unknown as Labels;
}

function effectiveIntent(data: ValidatedGovernmentReportPayload): SectionIntent {
  const requested = reportIntents[data.reportType];
  const configured = data.profileSnapshot.configuration.includeSheets;
  return {
    cover: requested.cover && configured.cover,
    summary: requested.summary && configured.summary,
    registers: requested.registers && configured.registers,
    absentees: requested.absentees && configured.absentees,
    consecutiveAbsences: requested.consecutiveAbsences && configured.consecutiveAbsences,
    corrections: requested.corrections && configured.corrections,
    missing: requested.missing,
    calendar: requested.calendar && configured.calendar,
    metadata: requested.metadata && configured.metadata,
  };
}

function csvText(value: unknown): string | number {
  if (value === null || value === undefined) return '';
  return typeof value === 'number' ? value : String(value);
}

function reportRows(data: ValidatedGovernmentReportPayload): {
  headers: string[];
  rows: (string | number)[][];
} {
  const l = getLabels(data);
  const columns = data.profileSnapshot.configuration.columns;
  const commonHeaders = [l.className, l.sectionName, l.roll];
  if (columns.studentCode) commonHeaders.push(l.studentCode);
  if (columns.banglarShikshaId) commonHeaders.push(l.banglarShikshaId);
  if (columns.nameEnglish) commonHeaders.push(l.nameEnglish);
  if (columns.nameBengali) commonHeaders.push(l.nameBengali);

  const studentIdentity = (student: any, className: string, sectionName: string): (string | number)[] => {
    const row: (string | number)[] = [className, sectionName, student.rollNumber];
    if (columns.studentCode) row.push(csvText(student.studentCode));
    if (columns.banglarShikshaId) row.push(csvText(student.banglarShikshaId));
    if (columns.nameEnglish) row.push(csvText(student.name || student.studentName));
    if (columns.nameBengali) row.push(csvText(student.nameBn));
    return row;
  };

  if (data.reportType === 'absentee') {
    const headers = [l.date, ...commonHeaders, l.status];
    const rows = (data.absentees || []).map((row: any) => [
      row.date,
      ...studentIdentity(row, row.className, row.sectionName),
      row.status,
    ]);
    return { headers, rows };
  }

  if (data.reportType === 'consecutive-absence') {
    const headers = [...commonHeaders, l.consecutiveDays, l.startDate, l.endDate];
    const rows = (data.consecutiveAbsences || []).map((row: any) => [
      ...studentIdentity(row, row.className, row.sectionName),
      row.consecutiveDays,
      row.startDate,
      row.endDate,
    ]);
    return { headers, rows };
  }

  if (data.reportType === 'corrections') {
    const headers = [l.date, l.className, l.roll, l.nameEnglish, l.previousStatus, l.updatedStatus, l.reason, l.updatedBy, l.timestamp];
    const rows = (data.corrections || []).map((row: any) => [
      row.date,
      row.className,
      row.rollNumber,
      row.studentName,
      row.previousStatus,
      row.newStatus,
      row.reason,
      row.updatedBy,
      row.timestamp,
    ]);
    return { headers, rows };
  }

  if (data.reportType === 'missing-data') {
    const headers = [l.issue, 'Code', l.value];
    const rows = data.missingData.map((row: any) => [row.issue, row.code, JSON.stringify(row.details || {})]);
    return { headers, rows };
  }

  if (data.reportType === 'daily-school') {
    const headers = [l.className, l.sectionName, 'Students', l.present, l.late, l.absent, l.leave, l.rate];
    const rows = data.classRegisters.map((register: any) => {
      const present = register.students.reduce((sum: number, student: any) => sum + student.presentCount, 0);
      const late = register.students.reduce((sum: number, student: any) => sum + student.lateCount, 0);
      const absent = register.students.reduce((sum: number, student: any) => sum + student.absentCount, 0);
      const leave = register.students.reduce((sum: number, student: any) => sum + student.leaveCount, 0);
      const working = register.students.reduce((sum: number, student: any) => sum + student.workingDays, 0);
      return [
        register.className,
        register.sectionName,
        register.students.length,
        present,
        late,
        absent,
        leave,
        working > 0 ? `${(((present + late) / working) * 100).toFixed(2)}%` : '0%',
      ];
    });
    return { headers, rows };
  }

  if (data.reportType === 'complete-package') {
    const headers = [l.section, l.date, ...commonHeaders, l.status, l.value, l.reason];
    const rows: (string | number)[][] = [];
    for (const register of data.classRegisters as any[]) {
      for (const student of register.students) {
        rows.push([
          l.registers,
          '',
          ...studentIdentity(student, register.className, register.sectionName),
          '',
          `${l.present}:${student.presentCount}; ${l.late}:${student.lateCount}; ${l.absent}:${student.absentCount}; ${l.rate}:${student.attendancePercentage}%`,
          '',
        ]);
      }
    }
    for (const absentee of data.absentees || []) {
      rows.push([l.absentees, absentee.date, ...studentIdentity(absentee, absentee.className, absentee.sectionName), absentee.status, '', '']);
    }
    for (const correction of data.corrections || []) {
      rows.push([l.corrections, correction.date, correction.className, '', correction.rollNumber, correction.studentName, correction.newStatus, correction.previousStatus, correction.reason].slice(0, headers.length));
    }
    for (const missing of data.missingData) {
      rows.push([l.missing, '', '', '', '', '', missing.code, '', missing.issue].slice(0, headers.length));
    }
    return { headers, rows };
  }

  const dates = columns.dailyGrid
    ? [...new Set(data.classRegisters.flatMap((register: any) => register.students.flatMap((student: any) => Object.keys(student.dailyStatus))))].sort()
    : [];
  const headers = [...commonHeaders, ...dates];
  if (columns.totals) headers.push(l.present, l.late, l.absent, l.leave, l.workingDays, l.rate);
  const rows: (string | number)[][] = [];
  for (const register of data.classRegisters as any[]) {
    for (const student of register.students) {
      const row = studentIdentity(student, register.className, register.sectionName);
      for (const date of dates) row.push(csvText(student.dailyStatus[date]));
      if (columns.totals) {
        row.push(student.presentCount, student.lateCount, student.absentCount, student.leaveCount, student.workingDays, `${student.attendancePercentage}%`);
      }
      rows.push(row);
    }
  }
  return { headers, rows };
}

function ensureRows(result: { headers: string[]; rows: (string | number)[][] }, noData: string) {
  return result.rows.length > 0 ? result : { ...result, rows: [[noData, ...Array(Math.max(0, result.headers.length - 1)).fill('')]] };
}

function translateWorkbookValues(workbook: ExcelJS.Workbook, locale: ReportLocale) {
  const l = labelSets[locale] as unknown as Labels;
  const replacements: Record<string, string> = {
    'GOVERNMENT-READY ATTENDANCE REGISTER': l.reportTitle,
    'West Bengal School Education Management Attendance Export': l.internalOnly,
    'INTERNAL MANAGEMENT APPROVAL & VERIFICATION': l.internalOnly,
    'School Name / বিদ্যালয়': l.school,
    'UDISE Code': l.udise,
    'Reporting Period': l.reportingPeriod,
    'Data Generated At': l.generatedAt,
    'School Summary': l.summary,
    'Absentee Details': l.absentees,
    'Consecutive Absence': l.consecutive,
    'Corrections Log': l.corrections,
    'Academic Calendar': l.calendar,
    'Export Metadata': l.metadata,
    Date: l.date,
    Class: l.className,
    Section: l.sectionName,
    Roll: l.roll,
    'Student ID': l.studentCode,
    'Banglar Shiksha ID': l.banglarShikshaId,
    'Student Name (EN)': l.nameEnglish,
    'Student Name (BN)': l.nameBengali,
    Status: l.status,
    'Present (P)': l.present,
    'Late (L)': l.late,
    'Absent (A)': l.absent,
    'Leave (E)': l.leave,
    'Working Days': l.workingDays,
    'Rate %': l.rate,
    'Previous Status': l.previousStatus,
    'Updated Status': l.updatedStatus,
    'Correction Reason': l.reason,
    'Updated By': l.updatedBy,
    Timestamp: l.timestamp,
    'Consecutive Days': l.consecutiveDays,
    'Period Start': l.startDate,
    'Period End': l.endDate,
  };
  for (const worksheet of workbook.worksheets) {
    worksheet.eachRow((row) => {
      row.eachCell((cell) => {
        if (typeof cell.value === 'string' && replacements[cell.value]) cell.value = replacements[cell.value];
      });
    });
  }
}

function createDataSheet(
  workbook: ExcelJS.Workbook,
  name: string,
  headers: string[],
  rows: (string | number)[][],
  noData: string
) {
  const existing = new Set(workbook.worksheets.map((sheet) => sheet.name.toLowerCase()));
  const sheet = workbook.addWorksheet(sanitizeSheetName(name, existing));
  sheet.addRow(headers);
  const safeRows = rows.length > 0 ? rows : [[noData, ...Array(Math.max(0, headers.length - 1)).fill('')]];
  safeRows.forEach((row) => sheet.addRow(row));
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A2B' } };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.columns.forEach((column) => { column.width = Math.max(12, Math.min(36, column.width || 18)); });
  return sheet;
}

async function buildXlsx(data: ValidatedGovernmentReportPayload): Promise<Buffer> {
  const base = await buildGovernmentReadyExcelWorkbook(data);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(base);
  workbook.creator = 'AttendEase Attendance Reporting';
  workbook.created = new Date(data.generatedAt);
  workbook.modified = new Date(data.generatedAt);

  const l = getLabels(data);
  const locale = effectiveLocale(data);
  const intent = effectiveIntent(data);
  const rows = ensureRows(reportRows(data), l.noData);

  if (intent.missing) createDataSheet(workbook, l.missing, rows.headers, rows.rows, l.noData);
  if (intent.absentees && !workbook.worksheets.some((sheet) => sheet.name === 'Absentee Details')) {
    createDataSheet(workbook, l.absentees, rows.headers, rows.rows, l.noData);
  }
  if (intent.consecutiveAbsences && !workbook.worksheets.some((sheet) => sheet.name === 'Consecutive Absence')) {
    createDataSheet(workbook, l.consecutive, rows.headers, rows.rows, l.noData);
  }
  if (intent.corrections && !workbook.worksheets.some((sheet) => sheet.name === 'Corrections Log')) {
    createDataSheet(workbook, l.corrections, rows.headers, rows.rows, l.noData);
  }

  for (const worksheet of [...workbook.worksheets]) {
    const original = worksheet.name;
    const keep =
      (original === 'Cover & Certification' && intent.cover) ||
      (original === 'School Summary' && intent.summary) ||
      (original.startsWith('Class ') && intent.registers) ||
      (original === 'Absentee Details' && intent.absentees) ||
      (original === 'Consecutive Absence' && intent.consecutiveAbsences) ||
      (original === 'Corrections Log' && intent.corrections) ||
      (original === 'Academic Calendar' && intent.calendar) ||
      (original === 'Export Metadata' && intent.metadata) ||
      original === l.missing || original === l.absentees || original === l.consecutive || original === l.corrections;
    if (!keep) workbook.removeWorksheet(worksheet.id);
  }

  const columnConfig = data.profileSnapshot.configuration.columns;
  for (const worksheet of workbook.worksheets.filter((sheet) => sheet.name.startsWith('Class '))) {
    if (!columnConfig.studentCode) worksheet.getColumn(2).hidden = true;
    if (!columnConfig.banglarShikshaId) worksheet.getColumn(3).hidden = true;
    if (!columnConfig.nameEnglish) worksheet.getColumn(4).hidden = true;
    if (!columnConfig.nameBengali) worksheet.getColumn(5).hidden = true;
    const totalColumns = worksheet.columnCount;
    if (!columnConfig.dailyGrid) {
      for (let index = 6; index <= Math.max(5, totalColumns - 6); index += 1) worksheet.getColumn(index).hidden = true;
    }
    if (!columnConfig.totals) {
      for (let index = Math.max(1, totalColumns - 5); index <= totalColumns; index += 1) worksheet.getColumn(index).hidden = true;
    }
  }

  for (const worksheet of workbook.worksheets) {
    worksheet.pageSetup.orientation = data.profileSnapshot.configuration.layout === 'PORTRAIT' ? 'portrait' : 'landscape';
    worksheet.pageSetup.fitToPage = true;
    worksheet.pageSetup.fitToWidth = 1;
    worksheet.pageSetup.fitToHeight = 0;
  }

  const cover = workbook.worksheets.find((sheet) => sheet.name === 'Cover & Certification');
  if (cover) {
    const disclaimer = data.profileSnapshot.configuration.disclaimer[locale];
    cover.addRow([]);
    cover.addRow([l.internalOnly]);
    cover.addRow([disclaimer]);
    cover.getRow(cover.rowCount).alignment = { wrapText: true };
  }
  const metadata = workbook.worksheets.find((sheet) => sheet.name === 'Export Metadata');
  if (metadata) {
    metadata.addRow({ prop: l.reportId, val: data.reportId });
    metadata.addRow({ prop: l.reportType, val: data.reportType });
    metadata.addRow({ prop: l.profile, val: `${data.profileSnapshot.profileName} ${data.profileSnapshot.version}` });
    metadata.addRow({ prop: l.generatedAt, val: data.generatedAt });
    metadata.addRow({ prop: 'Artifact integrity', val: 'SHA-256 is stored beside the immutable artifact and verified on every download.' });
  }

  translateWorkbookValues(workbook, locale);
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildHtml(data: ValidatedGovernmentReportPayload): Buffer {
  const locale = effectiveLocale(data);
  const l = getLabels(data);
  const table = ensureRows(reportRows(data), l.noData);
  const warningItems = data.validationSnapshot.warnings
    .map((warning) => `<li><strong>${escapeHtml(warning.code)}</strong>: ${escapeHtml(warning.message)}</li>`)
    .join('');
  const signatures = data.profileSnapshot.configuration.signatureBlocks
    .map((block) => `<div class="signature"><span>${escapeHtml(block)}</span><div></div><small>${escapeHtml(l.signature)}</small></div>`)
    .join('');
  const headerHtml = table.headers.map((header) => `<th scope="col">${escapeHtml(header)}</th>`).join('');
  const rowHtml = table.rows
    .map((row) => `<tr>${table.headers.map((_, index) => `<td>${escapeHtml(row[index] ?? '')}</td>`).join('')}</tr>`)
    .join('');
  const disclaimer = data.profileSnapshot.configuration.disclaimer[locale];

  const html = `<!doctype html>
<html lang="${locale}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(l.reportTitle)} — ${escapeHtml(data.school.name)}</title>
<style>
:root{font-family:Inter,"Noto Sans Bengali","Noto Sans Devanagari",Arial,sans-serif;color:#17251d;background:#fff}*{box-sizing:border-box}body{margin:0;padding:24px;font-size:12px}header{border:2px solid #1e3a2b;padding:20px;margin-bottom:18px}h1{font-size:24px;margin:0 0 8px}h2{font-size:16px;margin:20px 0 8px}.meta{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px 24px}.notice{border-left:4px solid #9a6700;background:#fff8c5;padding:10px;margin:14px 0}.table-wrap{overflow-x:auto}table{width:100%;border-collapse:collapse;font-size:10px}th,td{border:1px solid #aeb9b2;padding:5px;text-align:left;vertical-align:top}th{background:#1e3a2b;color:#fff;position:sticky;top:0}.signatures{display:grid;grid-template-columns:repeat(3,1fr);gap:30px;margin-top:50px}.signature div{border-top:1px solid #17251d;margin-top:36px}.disclaimer{margin-top:28px;font-size:10px;color:#536159;border-top:1px solid #aeb9b2;padding-top:10px}@page{size:${data.profileSnapshot.configuration.layout === 'PORTRAIT' ? 'A4 portrait' : 'A4 landscape'};margin:12mm}@media print{body{padding:0}.table-wrap{overflow:visible}th{position:static}.no-print{display:none}}
</style>
</head>
<body>
<header>
<h1>${escapeHtml(l.reportTitle)}</h1>
<div class="meta">
<div><strong>${escapeHtml(l.school)}:</strong> ${escapeHtml(data.school.name)}</div>
<div><strong>${escapeHtml(l.udise)}:</strong> ${escapeHtml(data.school.udiseCode || '—')}</div>
<div><strong>${escapeHtml(l.reportType)}:</strong> ${escapeHtml(data.reportType)}</div>
<div><strong>${escapeHtml(l.reportingPeriod)}:</strong> ${escapeHtml(data.period.periodLabel)}</div>
<div><strong>${escapeHtml(l.reportId)}:</strong> ${escapeHtml(data.reportId)}</div>
<div><strong>${escapeHtml(l.profile)}:</strong> ${escapeHtml(data.profileSnapshot.profileName)} ${escapeHtml(data.profileSnapshot.version)}</div>
<div><strong>${escapeHtml(l.generatedAt)}:</strong> ${escapeHtml(data.generatedAt)}</div>
</div>
</header>
${warningItems ? `<section class="notice"><h2>${escapeHtml(l.warnings)}</h2><ul>${warningItems}</ul></section>` : ''}
<main>
<h2>${escapeHtml(l[({ absentee: 'absentees', 'consecutive-absence': 'consecutive', corrections: 'corrections', 'missing-data': 'missing' } as Partial<Record<GovernmentReportType, LabelKey>>)[data.reportType] || 'registers'])}</h2>
<div class="table-wrap"><table><thead><tr>${headerHtml}</tr></thead><tbody>${rowHtml}</tbody></table></div>
</main>
<section class="signatures">${signatures}</section>
<footer class="disclaimer"><strong>${escapeHtml(l.internalOnly)}</strong><br>${escapeHtml(disclaimer)}</footer>
</body>
</html>`;
  return Buffer.from(html, 'utf8');
}

function safeFilename(data: ValidatedGovernmentReportPayload, format: ReportArtifactFormat): string {
  const identifier = (data.school.udiseCode || data.school.schoolCode || 'SCHOOL').replace(/[^a-zA-Z0-9_-]/g, '');
  const type = data.reportType.replace(/[^a-zA-Z0-9_-]/g, '_');
  const period = `${data.period.startDate}_${data.period.endDate}`.replace(/[^a-zA-Z0-9_-]/g, '_');
  const version = Number(data.reportVersion || 1);
  return `Attendance_${identifier || 'SCHOOL'}_${type}_${period}_v${version}.${format}`;
}

export async function buildGovernmentReportArtifact(
  data: ValidatedGovernmentReportPayload,
  format: ReportArtifactFormat
) {
  const contract = REPORT_FORMAT_CONTRACT[format];
  if (!contract) throw new Error('REPORT_FORMAT_UNSUPPORTED');
  let content: Buffer;
  if (format === 'xlsx') content = await buildXlsx(data);
  else if (format === 'csv') {
    const l = getLabels(data);
    const result = ensureRows(reportRows(data), l.noData);
    content = buildSecureCSVExport(result.headers, result.rows);
  } else content = buildHtml(data);

  return {
    format,
    filename: safeFilename(data, format),
    contentType: contract.contentType,
    content,
  };
}
