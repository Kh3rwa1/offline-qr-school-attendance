import ExcelJS from 'exceljs';
import { getWorkingDaysMap, DayWorkingStatus } from './calendarService';

/**
 * Formula Injection Sanitization (RFC & OWASP standard)
 * Ensures spreadsheet formulas are never interpreted when opening files.
 */
export function sanitizeSpreadsheetValue(val: any): any {
  if (val === null || val === undefined) return '';
  if (typeof val === 'number' || typeof val === 'boolean') return val;
  if (typeof val === 'string') {
    if (['=', '+', '-', '@', '\t', '\r'].some((char) => val.startsWith(char) || val.trim().startsWith(char))) {
      return `'${val}`;
    }
    return val;
  }
  return String(val);
}

/**
 * Clean & Deduplicate Sheet Names within Excel 31-character limit
 */
export function sanitizeSheetName(name: string, existingNames: Set<string>): string {
  let cleaned = name.replace(/[:\\/?*\[\]]/g, '_').trim().slice(0, 31);
  if (!cleaned) cleaned = 'Sheet';

  if (!existingNames.has(cleaned.toLowerCase())) {
    existingNames.add(cleaned.toLowerCase());
    return cleaned;
  }

  let counter = 2;
  while (true) {
    const suffix = ` (${counter})`;
    const candidate = cleaned.slice(0, 31 - suffix.length) + suffix;
    if (!existingNames.has(candidate.toLowerCase())) {
      existingNames.add(candidate.toLowerCase());
      return candidate;
    }
    counter++;
  }
}

/**
 * Safe Filename Generator
 */
export function generateSafeExportFilename(params: {
  udiseCode?: string | null;
  scope: string;
  period: string;
  reportVersion?: number | string;
  format: 'xlsx' | 'csv' | 'html';
}): string {
  const udise = params.udiseCode ? params.udiseCode.replace(/[^a-zA-Z0-9]/g, '') : 'SCHOOL';
  const scope = params.scope.replace(/[^a-zA-Z0-9_-]/g, '_');
  const period = params.period.replace(/[^a-zA-Z0-9_-]/g, '_');
  const dateStr = new Date().toISOString().split('T')[0];
  const version = params.reportVersion ? `_v${params.reportVersion}` : '';

  return `Attendance_${udise}_${scope}_${period}_${dateStr}${version}.${params.format}`;
}

export interface WorkbookDataPayload {
  school: {
    id: string;
    name: string;
    udiseCode?: string | null;
    schoolCode?: string | null;
    district: string;
    block?: string | null;
    circle?: string | null;
    address?: string | null;
    headmasterName?: string | null;
    contactNumber?: string | null;
    reportFooterText?: string | null;
  };
  period: {
    startDate: string;
    endDate: string;
    periodLabel: string;
  };
  academicYear?: string;
  profileVersion?: string;
  reportVersion?: number;
  internalApprovalStatus?: string;
  workingDaysMap: Map<string, DayWorkingStatus>;
  classRegisters: Array<{
    classSectionId: string;
    className: string;
    sectionName: string;
    students: Array<{
      studentId: string;
      studentCode: string;
      banglarShikshaId?: string | null;
      name: string;
      nameBn?: string | null;
      rollNumber: number;
      gender?: string | null;
      dailyStatus: Record<string, 'PRESENT' | 'LATE' | 'ABSENT' | 'LEAVE' | 'EXCUSED' | 'HOLIDAY' | 'WEEKEND' | 'UNMARKED' | 'NO_SESSION'>;
      presentCount: number;
      lateCount: number;
      absentCount: number;
      leaveCount: number;
      workingDays: number;
      attendancePercentage: number;
    }>;
  }>;
  absentees?: Array<{
    date: string;
    className: string;
    sectionName: string;
    rollNumber: number;
    studentName: string;
    studentCode: string;
    banglarShikshaId?: string | null;
    status: string;
  }>;
  consecutiveAbsences?: Array<{
    className: string;
    sectionName: string;
    rollNumber: number;
    studentName: string;
    studentCode: string;
    consecutiveDays: number;
    startDate: string;
    endDate: string;
  }>;
  corrections?: Array<{
    date: string;
    studentName: string;
    rollNumber: number;
    className: string;
    previousStatus: string;
    newStatus: string;
    reason: string;
    updatedBy: string;
    timestamp: string;
  }>;
  missingData?: Array<{
    date: string;
    className: string;
    sectionName: string;
    issue: string;
  }>;
}

/**
 * Generate Comprehensive Multi-Sheet Excel Workbook
 */
export async function buildGovernmentReadyExcelWorkbook(data: WorkbookDataPayload): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'AttendEase Government-Ready Attendance System';
  workbook.created = new Date();
  workbook.properties.date1904 = false;

  const existingSheetNames = new Set<string>();

  // ──────────────────────────────────────────────────────────────────────────
  // Sheet 1: Cover & Certification
  // ──────────────────────────────────────────────────────────────────────────
  const coverSheet = workbook.addWorksheet(
    sanitizeSheetName('Cover & Certification', existingSheetNames)
  );
  coverSheet.views = [{ showGridLines: true }];

  // Styling helpers
  const primaryHeaderFill: ExcelJS.Fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1E3A2B' }, // Forest green
  };
  const secondaryHeaderFill: ExcelJS.Fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF2D5A3F' },
  };
  const titleFont: Partial<ExcelJS.Font> = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
  const subHeaderFont: Partial<ExcelJS.Font> = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
  const boldFont: Partial<ExcelJS.Font> = { name: 'Calibri', size: 11, bold: true };
  const regularFont: Partial<ExcelJS.Font> = { name: 'Calibri', size: 11 };

  coverSheet.columns = [
    { width: 5 },
    { width: 28 },
    { width: 45 },
    { width: 5 },
  ];

  coverSheet.mergeCells('B2:C2');
  const titleCell = coverSheet.getCell('B2');
  titleCell.value = 'GOVERNMENT-READY ATTENDANCE REGISTER';
  titleCell.font = titleFont;
  titleCell.fill = primaryHeaderFill;
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  coverSheet.getRow(2).height = 35;

  coverSheet.mergeCells('B3:C3');
  const subTitleCell = coverSheet.getCell('B3');
  subTitleCell.value = 'West Bengal School Education Management Attendance Export';
  subTitleCell.font = { name: 'Calibri', size: 12, italic: true, color: { argb: 'FFFFFFFF' } };
  subTitleCell.fill = secondaryHeaderFill;
  subTitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  coverSheet.getRow(3).height = 24;

  const metadataRows = [
    ['School Name / বিদ্যালয়', data.school.name],
    ['UDISE Code', data.school.udiseCode || '—'],
    ['School Internal Code', data.school.schoolCode || '—'],
    ['District / জেলা', data.school.district],
    ['Block / ব্লক', data.school.block || '—'],
    ['Circle / চক্র', data.school.circle || '—'],
    ['School Address', data.school.address || '—'],
    ['Headmaster / Principal', data.school.headmasterName || '—'],
    ['Academic Year', data.academicYear || '2026'],
    ['Reporting Period', data.period.periodLabel],
    ['Report Version', `Version ${data.reportVersion || 1}`],
    ['Profile Standard', data.profileVersion || 'West Bengal Management Register v1.0.0'],
    ['Internal Approval Status', data.internalApprovalStatus || 'VALIDATED'],
    ['Data Generated At', new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })],
  ];

  let currentCoverRow = 5;
  for (const [lbl, val] of metadataRows) {
    const row = coverSheet.getRow(currentCoverRow);
    row.getCell(2).value = sanitizeSpreadsheetValue(lbl);
    row.getCell(2).font = boldFont;
    row.getCell(2).border = { bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } } };

    row.getCell(3).value = sanitizeSpreadsheetValue(val);
    row.getCell(3).font = regularFont;
    row.getCell(3).border = { bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } } };
    currentCoverRow++;
  }

  currentCoverRow += 2;
  coverSheet.mergeCells(`B${currentCoverRow}:C${currentCoverRow}`);
  const certHeader = coverSheet.getCell(`B${currentCoverRow}`);
  certHeader.value = 'INTERNAL MANAGEMENT APPROVAL & VERIFICATION';
  certHeader.font = subHeaderFont;
  certHeader.fill = secondaryHeaderFill;
  certHeader.alignment = { horizontal: 'center', vertical: 'middle' };
  coverSheet.getRow(currentCoverRow).height = 24;

  currentCoverRow += 2;
  coverSheet.getCell(`B${currentCoverRow}`).value = 'Headmaster Signature: _______________________';
  coverSheet.getCell(`B${currentCoverRow}`).font = boldFont;
  coverSheet.getCell(`C${currentCoverRow}`).value = 'School Seal: [                      ]';
  coverSheet.getCell(`C${currentCoverRow}`).font = boldFont;

  currentCoverRow += 3;
  coverSheet.mergeCells(`B${currentCoverRow}:C${currentCoverRow}`);
  const disclaimerCell = coverSheet.getCell(`B${currentCoverRow}`);
  disclaimerCell.value =
    'DISCLAIMER: This document is a standardized, government-ready management report generated from verified school attendance telemetry. It does not claim direct automated submission to government web portals without official departmental upload protocols.';
  disclaimerCell.font = { name: 'Calibri', size: 9, italic: true, color: { argb: 'FF64748B' } };
  disclaimerCell.alignment = { wrapText: true, horizontal: 'center' };

  // ──────────────────────────────────────────────────────────────────────────
  // Sheet 2: School Summary
  // ──────────────────────────────────────────────────────────────────────────
  const summarySheet = workbook.addWorksheet(
    sanitizeSheetName('School Summary', existingSheetNames)
  );
  summarySheet.columns = [
    { header: 'Class & Section', key: 'classSection', width: 22 },
    { header: 'Enrolled Students', key: 'enrolled', width: 18 },
    { header: 'Present Counts', key: 'present', width: 16 },
    { header: 'Late Counts', key: 'late', width: 14 },
    { header: 'Absent Counts', key: 'absent', width: 16 },
    { header: 'Leave Counts', key: 'leave', width: 14 },
    { header: 'Working Days', key: 'workingDays', width: 16 },
    { header: 'Attendance Rate', key: 'attendanceRate', width: 18 },
  ];

  summarySheet.getRow(1).font = subHeaderFont;
  summarySheet.getRow(1).fill = primaryHeaderFill;
  summarySheet.getRow(1).height = 28;

  let totalEnrolled = 0;
  let totalPresent = 0;
  let totalLate = 0;
  let totalAbsent = 0;
  let totalLeave = 0;
  let maxWorkingDays = 0;

  for (const cr of data.classRegisters) {
    const enrolled = cr.students.length;
    const present = cr.students.reduce((acc, s) => acc + s.presentCount, 0);
    const late = cr.students.reduce((acc, s) => acc + s.lateCount, 0);
    const absent = cr.students.reduce((acc, s) => acc + s.absentCount, 0);
    const leave = cr.students.reduce((acc, s) => acc + s.leaveCount, 0);
    const workingDays = cr.students[0]?.workingDays || 0;
    if (workingDays > maxWorkingDays) maxWorkingDays = workingDays;

    totalEnrolled += enrolled;
    totalPresent += present;
    totalLate += late;
    totalAbsent += absent;
    totalLeave += leave;

    const rate = workingDays * enrolled > 0 ? (present + late) / (workingDays * enrolled) : 0;

    summarySheet.addRow({
      classSection: `${cr.className} - ${cr.sectionName}`,
      enrolled,
      present,
      late,
      absent,
      leave,
      workingDays,
      attendanceRate: rate,
    });
  }

  // School Total Row
  const schoolRate = maxWorkingDays * totalEnrolled > 0 ? (totalPresent + totalLate) / (maxWorkingDays * totalEnrolled) : 0;
  const totalRow = summarySheet.addRow({
    classSection: 'TOTAL SCHOOL',
    enrolled: totalEnrolled,
    present: totalPresent,
    late: totalLate,
    absent: totalAbsent,
    leave: totalLeave,
    workingDays: maxWorkingDays,
    attendanceRate: schoolRate,
  });
  totalRow.font = boldFont;

  summarySheet.getColumn('attendanceRate').numFmt = '0.0%';

  // ──────────────────────────────────────────────────────────────────────────
  // Sheet 3..N: Monthly Register Sheets (1 per Class Section)
  // ──────────────────────────────────────────────────────────────────────────
  const daysList: string[] = [];
  const startD = new Date(data.period.startDate);
  const endD = new Date(data.period.endDate);
  const curD = new Date(startD);
  while (curD <= endD) {
    daysList.push(curD.toISOString().split('T')[0]);
    curD.setDate(curD.getDate() + 1);
  }

  for (const cr of data.classRegisters) {
    const sheetTitle = sanitizeSheetName(`Class ${cr.className}-${cr.sectionName}`, existingSheetNames);
    const regSheet = workbook.addWorksheet(sheetTitle);

    // Columns setup: Identification + Daily columns + Summary columns
    const columns: Partial<ExcelJS.Column>[] = [
      { header: 'Roll', key: 'roll', width: 8 },
      { header: 'Student ID', key: 'studentCode', width: 16 },
      { header: 'Banglar Shiksha ID', key: 'banglarShikshaId', width: 20 },
      { header: 'Student Name (EN)', key: 'name', width: 24 },
      { header: 'Student Name (BN)', key: 'nameBn', width: 24 },
    ];

    for (let i = 0; i < daysList.length; i++) {
      const dStr = daysList[i];
      const dNum = parseInt(dStr.split('-')[2], 10);
      columns.push({
        header: String(dNum),
        key: `day_${dStr}`,
        width: 5,
      });
    }

    columns.push(
      { header: 'Present (P)', key: 'totPresent', width: 12 },
      { header: 'Late (L)', key: 'totLate', width: 10 },
      { header: 'Absent (A)', key: 'totAbsent', width: 11 },
      { header: 'Leave (E)', key: 'totLeave', width: 10 },
      { header: 'Working Days', key: 'totWorking', width: 14 },
      { header: 'Rate %', key: 'rate', width: 10 }
    );

    regSheet.columns = columns as any;
    regSheet.getRow(1).font = subHeaderFont;
    regSheet.getRow(1).fill = primaryHeaderFill;
    regSheet.getRow(1).height = 28;

    // Freeze panes on identification columns
    regSheet.views = [{ state: 'frozen', xSplit: 5, ySplit: 1 }];

    for (const stu of cr.students) {
      const rowData: Record<string, any> = {
        roll: stu.rollNumber,
        studentCode: sanitizeSpreadsheetValue(stu.studentCode),
        banglarShikshaId: sanitizeSpreadsheetValue(stu.banglarShikshaId || '—'),
        name: sanitizeSpreadsheetValue(stu.name),
        nameBn: sanitizeSpreadsheetValue(stu.nameBn || '—'),
      };

      for (const dStr of daysList) {
        const status = stu.dailyStatus[dStr];
        let code = '—';
        if (status === 'PRESENT') code = 'P';
        else if (status === 'LATE') code = 'L';
        else if (status === 'ABSENT') code = 'A';
        else if (status === 'LEAVE' || status === 'EXCUSED') code = 'E';
        else if (status === 'HOLIDAY') code = 'H';
        else if (status === 'WEEKEND') code = 'W';
        else if (status === 'UNMARKED') code = 'U';

        rowData[`day_${dStr}`] = code;
      }

      rowData['totPresent'] = stu.presentCount;
      rowData['totLate'] = stu.lateCount;
      rowData['totAbsent'] = stu.absentCount;
      rowData['totLeave'] = stu.leaveCount;
      rowData['totWorking'] = stu.workingDays;
      rowData['rate'] = stu.workingDays > 0 ? (stu.presentCount + stu.lateCount) / stu.workingDays : 0;

      const addedRow = regSheet.addRow(rowData);
      addedRow.getCell('rate').numFmt = '0.0%';
    }

    regSheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: cr.students.length + 1, column: columns.length },
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Sheet N+1: Absentee Details (if present)
  // ──────────────────────────────────────────────────────────────────────────
  if (data.absentees && data.absentees.length > 0) {
    const absSheet = workbook.addWorksheet(
      sanitizeSheetName('Absentee Details', existingSheetNames)
    );
    absSheet.columns = [
      { header: 'Date', key: 'date', width: 14 },
      { header: 'Class', key: 'className', width: 12 },
      { header: 'Section', key: 'sectionName', width: 10 },
      { header: 'Roll', key: 'rollNumber', width: 8 },
      { header: 'Student Name', key: 'studentName', width: 24 },
      { header: 'Student ID', key: 'studentCode', width: 18 },
      { header: 'Banglar Shiksha ID', key: 'banglarShikshaId', width: 20 },
      { header: 'Status', key: 'status', width: 12 },
    ];
    absSheet.getRow(1).font = subHeaderFont;
    absSheet.getRow(1).fill = primaryHeaderFill;
    absSheet.getRow(1).height = 26;

    for (const a of data.absentees) {
      absSheet.addRow({
        date: a.date,
        className: a.className,
        sectionName: a.sectionName,
        rollNumber: a.rollNumber,
        studentName: sanitizeSpreadsheetValue(a.studentName),
        studentCode: sanitizeSpreadsheetValue(a.studentCode),
        banglarShikshaId: sanitizeSpreadsheetValue(a.banglarShikshaId || '—'),
        status: a.status,
      });
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Sheet N+2: Consecutive Absences (if present)
  // ──────────────────────────────────────────────────────────────────────────
  if (data.consecutiveAbsences && data.consecutiveAbsences.length > 0) {
    const conSheet = workbook.addWorksheet(
      sanitizeSheetName('Consecutive Absence', existingSheetNames)
    );
    conSheet.columns = [
      { header: 'Class', key: 'className', width: 12 },
      { header: 'Section', key: 'sectionName', width: 10 },
      { header: 'Roll', key: 'rollNumber', width: 8 },
      { header: 'Student Name', key: 'studentName', width: 24 },
      { header: 'Student ID', key: 'studentCode', width: 18 },
      { header: 'Consecutive Days', key: 'consecutiveDays', width: 18 },
      { header: 'Period Start', key: 'startDate', width: 14 },
      { header: 'Period End', key: 'endDate', width: 14 },
    ];
    conSheet.getRow(1).font = subHeaderFont;
    conSheet.getRow(1).fill = primaryHeaderFill;
    conSheet.getRow(1).height = 26;

    for (const c of data.consecutiveAbsences) {
      conSheet.addRow({
        className: c.className,
        sectionName: c.sectionName,
        rollNumber: c.rollNumber,
        studentName: sanitizeSpreadsheetValue(c.studentName),
        studentCode: sanitizeSpreadsheetValue(c.studentCode),
        consecutiveDays: c.consecutiveDays,
        startDate: c.startDate,
        endDate: c.endDate,
      });
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Sheet N+3: Attendance Corrections (Audit Log)
  // ──────────────────────────────────────────────────────────────────────────
  if (data.corrections && data.corrections.length > 0) {
    const corSheet = workbook.addWorksheet(
      sanitizeSheetName('Corrections Log', existingSheetNames)
    );
    corSheet.columns = [
      { header: 'Date', key: 'date', width: 14 },
      { header: 'Class', key: 'className', width: 12 },
      { header: 'Roll', key: 'rollNumber', width: 8 },
      { header: 'Student Name', key: 'studentName', width: 22 },
      { header: 'Previous Status', key: 'previousStatus', width: 16 },
      { header: 'Updated Status', key: 'newStatus', width: 16 },
      { header: 'Correction Reason', key: 'reason', width: 30 },
      { header: 'Updated By', key: 'updatedBy', width: 20 },
      { header: 'Timestamp', key: 'timestamp', width: 22 },
    ];
    corSheet.getRow(1).font = subHeaderFont;
    corSheet.getRow(1).fill = primaryHeaderFill;
    corSheet.getRow(1).height = 26;

    for (const cr of data.corrections) {
      corSheet.addRow({
        date: cr.date,
        className: cr.className,
        rollNumber: cr.rollNumber,
        studentName: sanitizeSpreadsheetValue(cr.studentName),
        previousStatus: cr.previousStatus,
        newStatus: cr.newStatus,
        reason: sanitizeSpreadsheetValue(cr.reason),
        updatedBy: sanitizeSpreadsheetValue(cr.updatedBy),
        timestamp: cr.timestamp,
      });
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Sheet N+4: Academic Calendar Reference
  // ──────────────────────────────────────────────────────────────────────────
  const calSheet = workbook.addWorksheet(
    sanitizeSheetName('Academic Calendar', existingSheetNames)
  );
  calSheet.columns = [
    { header: 'Date', key: 'date', width: 14 },
    { header: 'Day of Week', key: 'dayOfWeek', width: 16 },
    { header: 'Classification', key: 'classification', width: 24 },
    { header: 'Working Day?', key: 'isWorkingDay', width: 16 },
    { header: 'Holiday / Event Reason', key: 'reason', width: 36 },
  ];
  calSheet.getRow(1).font = subHeaderFont;
  calSheet.getRow(1).fill = primaryHeaderFill;
  calSheet.getRow(1).height = 26;

  for (const [dStr, dayInfo] of data.workingDaysMap) {
    const d = new Date(dStr);
    const dayName = d.toLocaleDateString('en-IN', { weekday: 'long' });

    calSheet.addRow({
      date: dStr,
      dayOfWeek: dayName,
      classification: dayInfo.classification,
      isWorkingDay: dayInfo.isWorkingDay ? 'YES' : 'NO',
      reason: sanitizeSpreadsheetValue(dayInfo.reason || '—'),
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Sheet N+5: Export Metadata & Calculation Formulas
  // ──────────────────────────────────────────────────────────────────────────
  const metaSheet = workbook.addWorksheet(
    sanitizeSheetName('Export Metadata', existingSheetNames)
  );
  metaSheet.columns = [
    { header: 'Property / Metric', key: 'prop', width: 32 },
    { header: 'Definition / Formula / Value', key: 'val', width: 55 },
  ];
  metaSheet.getRow(1).font = subHeaderFont;
  metaSheet.getRow(1).fill = primaryHeaderFill;
  metaSheet.getRow(1).height = 26;

  const metadataInfo = [
    ['Attendance Rate Formula', '(Present Records + Late Records) / Applicable Working Days * 100%'],
    ['Holiday Treatment Rule', 'Gazetted & School Holidays are excluded from Working Days (Never counted as Absent)'],
    ['Sunday / Weekend Rule', 'Sundays are classified as SUNDAY_WEEKEND and excluded from Working Days'],
    ['Present Status Code (P)', 'Student verified present via QR code, RFID tap, or teacher manual roll call'],
    ['Late Status Code (L)', 'Student verified present after official morning cutoff time'],
    ['Absent Status Code (A)', 'Student unverified on an applicable school working day'],
    ['Excused / Leave Code (E)', 'Authorized medical, sports, or family leave recorded by school authority'],
    ['Report Engine Version', 'AttendEase Government-Ready Exporter v1.3.0'],
    ['Security Standard', 'RFC 4180 / OWASP Formula Injection Sanitized'],
    ['Regional Localization', 'West Bengal (English & Bengali Unicode UTF-8)'],
  ];

  for (const [p, v] of metadataInfo) {
    metaSheet.addRow({
      prop: sanitizeSpreadsheetValue(p),
      val: sanitizeSpreadsheetValue(v),
    });
  }

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/**
 * Generate Secure UTF-8 RFC 4180 CSV Export
 */
export function buildSecureCSVExport(headers: string[], rows: (string | number)[][]): Buffer {
  const BOM = '\uFEFF'; // UTF-8 BOM for Bengali Excel compatibility

  const escapeCSVCell = (cell: any): string => {
    if (cell === null || cell === undefined) return '""';
    const sanitized = sanitizeSpreadsheetValue(cell);
    const str = String(sanitized).replace(/"/g, '""');
    return `"${str}"`;
  };

  const headerLine = headers.map(escapeCSVCell).join(',');
  const rowLines = rows.map((r) => r.map(escapeCSVCell).join(','));

  const csvContent = BOM + [headerLine, ...rowLines].join('\r\n');
  return Buffer.from(csvContent, 'utf-8');
}
