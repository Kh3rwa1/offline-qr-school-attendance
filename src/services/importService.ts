import ExcelJS from 'exceljs';
import { eq, and, sql, inArray, or, desc } from 'drizzle-orm';
import { db } from '../db';
import {
  importJobs,
  students,
  guardians,
  studentGuardians,
  enrollments,
  classSections,
  academicYears,
  qrCredentials,
} from '../db/schema';
import { createQrCredential } from './qrService';
import crypto from 'node:crypto';

export type ImportMode = 'CREATE_ONLY' | 'UPDATE_EXISTING' | 'UPSERT';

export interface RowValidationError {
  row: number;
  column: string;
  error: string;
}

export interface ParsedStudentRow {
  rowNumber: number;
  studentCode: string;
  name: string;
  nameBn?: string;
  banglarShikshaId?: string;
  className: string;
  sectionName: string;
  rollNumber: number;
  gender: string;
  dateOfBirth?: string;
  guardianName: string;
  guardianPhone: string;
  guardianRelationship: string;
}

export function normalizePhone(phone: string): string {
  const digits = phone.replace(/[^0-9+]/g, '').trim();
  if (digits.startsWith('+91')) return digits;
  if (digits.length === 10) return `+91${digits}`;
  if (digits.startsWith('91') && digits.length === 12) return `+${digits}`;
  return digits;
}

export function sanitizeCell(val: any): string {
  if (val === null || val === undefined) return '';
  let str = String(val).trim();
  // Strip formula injection prefixes
  if (['=', '+', '-', '@', '\t', '\r'].some((char) => str.startsWith(char))) {
    str = str.replace(/^[=+\-@\t\r]+/, '');
  }
  return str;
}

/**
 * RFC 4180 compliant CSV parser supporting quoted commas, quoted newlines, escaped quotes (""), and UTF-8 BOM
 */
export function parseRfcCsv(content: string): string[][] {
  let str = content.startsWith('\uFEFF') ? content.slice(1) : content;
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;
  let i = 0;

  while (i < str.length) {
    const char = str[i];
    const nextChar = str[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          currentField += '"';
          i += 2;
          continue;
        } else {
          inQuotes = false;
          i++;
          continue;
        }
      } else {
        currentField += char;
        i++;
        continue;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
        i++;
        continue;
      } else if (char === ',') {
        currentRow.push(currentField.trim());
        currentField = '';
        i++;
        continue;
      } else if (char === '\r') {
        if (nextChar === '\n') {
          i += 2;
        } else {
          i++;
        }
        currentRow.push(currentField.trim());
        if (currentRow.some((c) => c !== '')) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentField = '';
        continue;
      } else if (char === '\n') {
        currentRow.push(currentField.trim());
        if (currentRow.some((c) => c !== '')) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentField = '';
        i++;
        continue;
      } else {
        currentField += char;
        i++;
        continue;
      }
    }
  }

  if (currentField !== '' || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some((c) => c !== '')) {
      rows.push(currentRow);
    }
  }

  return rows;
}

export async function generateXlsxTemplate(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Student Import Template');

  const headers = [
    'Student Code',
    'Student Name (English)',
    'Bengali Name',
    'Banglar Shiksha ID',
    'Class Name',
    'Section Name',
    'Roll Number',
    'Gender',
    'Date of Birth (YYYY-MM-DD)',
    'Guardian Name',
    'Guardian Phone',
    'Guardian Relationship',
  ];

  worksheet.addRow(headers);
  worksheet.addRow([
    'STU-1001',
    'Anirban Das',
    'অনির্বাণ দাস',
    'WB191001001',
    'Class 8',
    'A',
    1,
    'MALE',
    '2012-05-15',
    'Subhash Das',
    '+919876543210',
    'FATHER',
  ]);
  worksheet.addRow([
    'STU-1002',
    'Priya Banerjee',
    'প্রিয়া ব্যানার্জী',
    'WB191001002',
    'Class 8',
    'A',
    2,
    'FEMALE',
    '2012-08-22',
    'Sujit Banerjee',
    '+919876543211',
    'FATHER',
  ]);

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/**
 * Checks and acquires an anti-concurrency lock for school imports
 */
export async function acquireImportLock(schoolId: string): Promise<void> {
  // Auto-clean stale jobs (> 1 hour in PROCESSING/VALIDATING)
  const oneHourAgo = new Date(Date.now() - 3600000);
  await db
    .update(importJobs)
    .set({ status: 'FAILED', stagedData: null, errorSummary: { error: 'STALE_IMPORT_TIMED_OUT' } })
    .where(
      and(
        eq(importJobs.schoolId, schoolId),
        inArray(importJobs.status, ['PROCESSING', 'VALIDATING']),
        sql`${importJobs.createdAt} < ${oneHourAgo}`
      )
    );

  const [activeJob] = await db
    .select({ id: importJobs.id, status: importJobs.status })
    .from(importJobs)
    .where(
      and(
        eq(importJobs.schoolId, schoolId),
        inArray(importJobs.status, ['PROCESSING', 'VALIDATING'])
      )
    )
    .limit(1);

  if (activeJob) {
    throw new Error('ANOTHER_IMPORT_IN_PROGRESS');
  }
}

/**
 * Parses and validates CSV, XLSX, or JSON buffers
 */
export async function parseAndValidateFile(params: {
  schoolId: string;
  fileBuffer: Buffer;
  fileName: string;
  createdBy: string;
  format?: 'xlsx' | 'csv' | 'json';
  mode?: ImportMode;
}) {
  await acquireImportLock(params.schoolId);

  if (params.fileBuffer.length > 10 * 1024 * 1024) {
    throw new Error('FILE_SIZE_LIMIT_EXCEEDED');
  }

  const fileHash = crypto.createHash('sha256').update(params.fileBuffer).digest('hex');
  const mode: ImportMode = params.mode || 'CREATE_ONLY';
  let format = params.format;

  if (!format) {
    if (params.fileName.endsWith('.csv')) format = 'csv';
    else if (params.fileName.endsWith('.json')) format = 'json';
    else format = 'xlsx';
  }

  let rawRows: Record<string, any>[] = [];

  if (format === 'json') {
    try {
      const parsed = JSON.parse(params.fileBuffer.toString('utf8'));
      if (Array.isArray(parsed)) {
        rawRows = parsed;
      } else if (parsed && Array.isArray(parsed.students)) {
        rawRows = parsed.students;
      } else {
        throw new Error('INVALID_JSON_FORMAT');
      }
    } catch (e: any) {
      throw new Error(`MALFORMED_JSON_IMPORT: ${e.message}`);
    }
  } else if (format === 'csv') {
    const csvContent = params.fileBuffer.toString('utf8');
    const parsedMatrix = parseRfcCsv(csvContent);
    if (parsedMatrix.length < 2) {
      throw new Error('EMPTY_SHEET');
    }
    const headers = parsedMatrix[0].map((h) => h.trim());
    for (let r = 1; r < parsedMatrix.length; r++) {
      const row = parsedMatrix[r];
      const rowData: Record<string, any> = {};
      headers.forEach((h, colIdx) => {
        rowData[h] = row[colIdx] != null ? row[colIdx] : '';
      });
      if (Object.values(rowData).some((v) => v !== '')) {
        rawRows.push(rowData);
      }
    }
  } else {
    // XLSX parsing with sheet size & bomb protection
    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(params.fileBuffer);
    } catch (err: any) {
      throw new Error(`MALFORMED_XLSX_FILE: ${err.message}`);
    }

    if (workbook.worksheets.length === 0) throw new Error('EMPTY_WORKBOOK');
    if (workbook.worksheets.length > 5) throw new Error('MAX_WORKSHEETS_EXCEEDED');

    const worksheet = workbook.worksheets[0];
    if (!worksheet || worksheet.rowCount <= 1) throw new Error('EMPTY_SHEET');
    if (worksheet.rowCount > 5001) throw new Error('MAX_ROWS_EXCEEDED');

    const headers: string[] = [];
    const headerRow = worksheet.getRow(1);
    headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      headers[colNumber] = String(cell.value || '').trim();
    });

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const rowData: Record<string, any> = {};
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const h = headers[colNumber];
        if (h) {
          rowData[h] = cell.value != null ? String(cell.value).trim() : '';
        }
      });
      if (Object.values(rowData).some((val) => val !== '')) {
        rawRows.push(rowData);
      }
    });
  }

  if (rawRows.length === 0) {
    throw new Error('EMPTY_SHEET');
  }

  // Get current academic year
  const [currentYear] = await db
    .select()
    .from(academicYears)
    .where(and(eq(academicYears.schoolId, params.schoolId), eq(academicYears.isCurrent, true)));

  if (!currentYear) {
    throw new Error('NO_CURRENT_ACADEMIC_YEAR');
  }

  const errors: RowValidationError[] = [];
  const validRows: ParsedStudentRow[] = [];
  const seenStudentCodes = new Set<string>();
  const seenRollNumbersInClass = new Set<string>();

  const validGenders = ['MALE', 'FEMALE', 'TRANSGENDER', 'OTHER'];
  const validRelationships = ['FATHER', 'MOTHER', 'GUARDIAN', 'PARENT', 'OTHER'];

  for (let i = 0; i < rawRows.length; i++) {
    const r = rawRows[i];
    const rowNum = i + 2;

    const studentCode = sanitizeCell(r['Student Code'] || r['studentCode']);
    const name = sanitizeCell(r['Student Name (English)'] || r['name'] || r['Student Name']);
    const nameBn = sanitizeCell(r['Bengali Name'] || r['nameBn']);
    const banglarShikshaId = sanitizeCell(r['Banglar Shiksha ID'] || r['banglarShikshaId']);
    const className = sanitizeCell(r['Class Name'] || r['className']);
    const sectionName = sanitizeCell(r['Section Name'] || r['sectionName']);
    const rollRaw = r['Roll Number'] || r['rollNumber'];
    const gender = sanitizeCell(r['Gender'] || r['gender']).toUpperCase();
    const dob = sanitizeCell(r['Date of Birth (YYYY-MM-DD)'] || r['dateOfBirth']);
    const guardianName = sanitizeCell(r['Guardian Name'] || r['guardianName']);
    const guardianPhoneRaw = sanitizeCell(r['Guardian Phone'] || r['guardianPhone']);
    const guardianRelationship = sanitizeCell(r['Guardian Relationship'] || r['guardianRelationship']).toUpperCase() || 'PARENT';

    if (!studentCode) {
      errors.push({ row: rowNum, column: 'Student Code', error: 'Student Code is required' });
    } else if (seenStudentCodes.has(studentCode.toUpperCase())) {
      errors.push({ row: rowNum, column: 'Student Code', error: `Duplicate Student Code in upload: ${studentCode}` });
    } else {
      seenStudentCodes.add(studentCode.toUpperCase());
    }

    if (!name) {
      errors.push({ row: rowNum, column: 'Student Name', error: 'Student Name is required' });
    }

    if (!className) {
      errors.push({ row: rowNum, column: 'Class Name', error: 'Class Name is required' });
    }

    if (!sectionName) {
      errors.push({ row: rowNum, column: 'Section Name', error: 'Section Name is required' });
    }

    const rollNumber = parseInt(String(rollRaw), 10);
    if (isNaN(rollNumber) || rollNumber < 1) {
      errors.push({ row: rowNum, column: 'Roll Number', error: 'Valid positive Roll Number is required' });
    } else if (className && sectionName) {
      const classRollKey = `${className.toUpperCase()}:${sectionName.toUpperCase()}:${rollNumber}`;
      if (seenRollNumbersInClass.has(classRollKey)) {
        errors.push({ row: rowNum, column: 'Roll Number', error: `Duplicate Roll Number ${rollNumber} in ${className} ${sectionName}` });
      } else {
        seenRollNumbersInClass.add(classRollKey);
      }
    }

    if (!gender || !validGenders.includes(gender)) {
      errors.push({ row: rowNum, column: 'Gender', error: `Gender must be one of: ${validGenders.join(', ')}` });
    }

    if (dob && !/^\d{4}-\d{2}-\d{2}$/.test(dob)) {
      errors.push({ row: rowNum, column: 'Date of Birth', error: 'Date of Birth must be in YYYY-MM-DD format' });
    }

    if (!guardianName) {
      errors.push({ row: rowNum, column: 'Guardian Name', error: 'Guardian Name is required' });
    }

    const normalizedPhone = normalizePhone(guardianPhoneRaw);
    if (!normalizedPhone || !/^\+91[6-9]\d{9}$/.test(normalizedPhone)) {
      errors.push({ row: rowNum, column: 'Guardian Phone', error: 'Valid 10-digit Indian phone number is required (+91)' });
    }

    if (guardianRelationship && !validRelationships.includes(guardianRelationship)) {
      errors.push({ row: rowNum, column: 'Guardian Relationship', error: `Relationship must be one of: ${validRelationships.join(', ')}` });
    }

    if (errors.filter((e) => e.row === rowNum).length === 0) {
      validRows.push({
        rowNumber: rowNum,
        studentCode,
        name,
        nameBn: nameBn || undefined,
        banglarShikshaId: banglarShikshaId || undefined,
        className,
        sectionName,
        rollNumber,
        gender,
        dateOfBirth: dob || undefined,
        guardianName,
        guardianPhone: normalizedPhone,
        guardianRelationship: guardianRelationship || 'PARENT',
      });
    }
  }

  // --------------------------------------------------------------------------
  // Mode-Specific Validation (CREATE_ONLY, UPDATE_EXISTING, UPSERT)
  // --------------------------------------------------------------------------
  if (validRows.length > 0) {
    const codes = validRows.map((r) => r.studentCode);
    const existingCodeSet = new Set<string>();

    for (let c = 0; c < codes.length; c += 500) {
      const chunk = codes.slice(c, c + 500);
      const existingInDb = await db
        .select({ studentCode: students.studentCode })
        .from(students)
        .where(and(eq(students.schoolId, params.schoolId), inArray(students.studentCode, chunk)));

      for (const ex of existingInDb) {
        existingCodeSet.add(ex.studentCode.toUpperCase());
      }
    }

    if (mode === 'CREATE_ONLY') {
      for (const r of validRows) {
        if (existingCodeSet.has(r.studentCode.toUpperCase())) {
          errors.push({
            row: r.rowNumber,
            column: 'Student Code',
            error: `Student Code already exists in database (CREATE_ONLY mode): ${r.studentCode}`,
          });
        }
      }
    } else if (mode === 'UPDATE_EXISTING') {
      for (const r of validRows) {
        if (!existingCodeSet.has(r.studentCode.toUpperCase())) {
          errors.push({
            row: r.rowNumber,
            column: 'Student Code',
            error: `Student Code does not exist in database (UPDATE_EXISTING mode): ${r.studentCode}`,
          });
        }
      }
    }
  }

  // Create staging job record with timing-safe confirmation token
  const confirmToken = crypto.randomBytes(24).toString('hex');
  const [job] = await db
    .insert(importJobs)
    .values({
      schoolId: params.schoolId,
      createdBy: params.createdBy,
      fileName: params.fileName,
      totalRows: rawRows.length,
      successfulRows: 0,
      failedRows: errors.length,
      status: errors.length === 0 ? 'VALIDATED' : 'FAILED',
      errorSummary: errors.length > 0 ? { errors: errors.slice(0, 100), totalErrors: errors.length } : null,
      stagedData: errors.length === 0 ? {
        rows: validRows,
        confirmToken,
        mode,
        fileHash,
        userId: params.createdBy,
        schoolId: params.schoolId,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 3600000).toISOString(), // 1h validity
      } : null,
    })
    .returning();

  return {
    importJobId: job.id,
    status: job.status,
    confirmToken: errors.length === 0 ? confirmToken : undefined,
    mode,
    fileHash,
    totalRows: rawRows.length,
    validRowsCount: errors.length === 0 ? validRows.length : 0,
    invalidRowsCount: errors.length,
    errors,
    validRowsPreview: validRows.slice(0, 50),
    academicYear: currentYear,
  };
}

export async function parseAndValidateXlsx(params: {
  schoolId: string;
  fileBuffer: Buffer;
  fileName: string;
  createdBy: string;
  mode?: ImportMode;
}) {
  return parseAndValidateFile({
    schoolId: params.schoolId,
    fileBuffer: params.fileBuffer,
    fileName: params.fileName,
    createdBy: params.createdBy,
    format: 'xlsx',
    mode: params.mode,
  });
}

/**
 * Timing-safe confirmation token verification
 */
function verifyConfirmationToken(provided: string, expected: string): boolean {
  if (!provided || !expected) return false;
  const pBuf = Buffer.from(provided);
  const eBuf = Buffer.from(expected);
  if (pBuf.length !== eBuf.length) return false;
  return crypto.timingSafeEqual(pBuf, eBuf);
}

/**
 * Executes the validated import transaction in chunked batches with guardian deduplication
 * Supports CREATE_ONLY, UPDATE_EXISTING, and UPSERT modes.
 */
export async function executeTransactionalImport(params: {
  schoolId: string;
  importJobId: string;
  createdBy: string;
  confirmToken: string;
}) {
  const [job] = await db
    .select()
    .from(importJobs)
    .where(and(eq(importJobs.schoolId, params.schoolId), eq(importJobs.id, params.importJobId)));

  if (!job) {
    throw new Error('IMPORT_JOB_NOT_FOUND');
  }

  if (job.status !== 'VALIDATED') {
    throw new Error('INVALID_JOB_STATUS');
  }

  const stagedContainer = job.stagedData as any;
  if (!stagedContainer) {
    throw new Error('STAGED_DATA_EXPIRED_OR_NOT_FOUND');
  }

  const stagedRows: ParsedStudentRow[] = Array.isArray(stagedContainer) ? stagedContainer : (stagedContainer.rows || []);
  const expectedToken = Array.isArray(stagedContainer) ? (job as any).metadata?.confirmToken : stagedContainer.confirmToken;
  const mode: ImportMode = (Array.isArray(stagedContainer) ? 'CREATE_ONLY' : stagedContainer.mode) || 'CREATE_ONLY';
  const expiresAt = stagedContainer?.expiresAt;
  const tokenSchoolId = stagedContainer?.schoolId;

  if (!params.confirmToken || !expectedToken || !verifyConfirmationToken(params.confirmToken, expectedToken)) {
    throw new Error('INVALID_CONFIRMATION_TOKEN');
  }

  // Verify token binding
  if (tokenSchoolId && tokenSchoolId !== params.schoolId) {
    throw new Error('TOKEN_TENANT_MISMATCH');
  }

  // Check token expiration
  if (expiresAt && new Date(expiresAt).getTime() < Date.now()) {
    await db
      .update(importJobs)
      .set({ status: 'FAILED', stagedData: null, errorSummary: { error: 'CONFIRMATION_TOKEN_EXPIRED' } })
      .where(eq(importJobs.id, params.importJobId));
    throw new Error('CONFIRMATION_TOKEN_EXPIRED');
  }

  const [currentYear] = await db
    .select()
    .from(academicYears)
    .where(and(eq(academicYears.schoolId, params.schoolId), eq(academicYears.isCurrent, true)));

  if (!currentYear) {
    throw new Error('NO_CURRENT_ACADEMIC_YEAR');
  }
  const academicYearId = currentYear.id;

  // Invalidate single-use token and mark job as PROCESSING
  await db
    .update(importJobs)
    .set({
      status: 'PROCESSING',
      stagedData: {
        ...stagedContainer,
        confirmToken: null, // Token consumed
        processedAt: new Date().toISOString(),
      },
    })
    .where(eq(importJobs.id, params.importJobId));

  try {
    const result = await db.transaction(async (tx: any) => {
      // 1. Fetch or create all required class sections
      const existingSections = await tx
        .select()
        .from(classSections)
        .where(
          and(eq(classSections.schoolId, params.schoolId), eq(classSections.academicYearId, academicYearId))
        );

      const classSectionMap = new Map<string, string>();
      for (const cs of existingSections) {
        classSectionMap.set(`${cs.className.toUpperCase()}:${cs.sectionName.toUpperCase()}`, cs.id);
      }

      for (const row of stagedRows) {
        const key = `${row.className.toUpperCase()}:${row.sectionName.toUpperCase()}`;
        if (!classSectionMap.has(key)) {
          const [newCs] = await tx
            .insert(classSections)
            .values({
              schoolId: params.schoolId,
              academicYearId,
              className: row.className,
              sectionName: row.sectionName,
            })
            .returning();
          classSectionMap.set(key, newCs.id);
        }
      }

      // 2. Tenant-scoped Guardian Deduplication
      const uniquePhones = Array.from(new Set(stagedRows.map((r) => r.guardianPhone)));
      const existingGuardians = await tx
        .select()
        .from(guardians)
        .where(and(eq(guardians.schoolId, params.schoolId), inArray(guardians.phoneNumber, uniquePhones)));

      const guardianMap = new Map<string, string>();
      for (const g of existingGuardians) {
        if (g.phoneNumber) {
          guardianMap.set(g.phoneNumber, g.id);
        }
      }

      for (const row of stagedRows) {
        if (!guardianMap.has(row.guardianPhone)) {
          const [newG] = await tx
            .insert(guardians)
            .values({
              schoolId: params.schoolId,
              name: row.guardianName,
              phoneNumber: row.guardianPhone,
              relationship: row.guardianRelationship || 'PARENT',
            })
            .returning();
          guardianMap.set(row.guardianPhone, newG.id);
        }
      }

      // 3. Process Students according to Mode
      const processedStudents: any[] = [];
      const CHUNK_SIZE = 100;

      if (mode === 'UPDATE_EXISTING') {
        // UPDATE_EXISTING: Update student attributes & enrollments
        for (const row of stagedRows) {
          const [existingStudent] = await tx
            .select()
            .from(students)
            .where(and(eq(students.schoolId, params.schoolId), eq(students.studentCode, row.studentCode)));

          if (existingStudent) {
            await tx
              .update(students)
              .set({
                name: row.name,
                nameBn: row.nameBn || existingStudent.nameBn,
                banglarShikshaId: row.banglarShikshaId || existingStudent.banglarShikshaId,
                gender: row.gender,
                dateOfBirth: row.dateOfBirth || existingStudent.dateOfBirth,
                updatedAt: new Date(),
              })
              .where(eq(students.id, existingStudent.id));

            const classSectionId = classSectionMap.get(`${row.className.toUpperCase()}:${row.sectionName.toUpperCase()}`)!;
            // Update enrollment roll number and section
            await tx
              .update(enrollments)
              .set({
                classSectionId,
                rollNumber: row.rollNumber,
                updatedAt: new Date(),
              })
              .where(
                and(
                  eq(enrollments.schoolId, params.schoolId),
                  eq(enrollments.studentId, existingStudent.id),
                  eq(enrollments.academicYearId, academicYearId)
                )
              );

            processedStudents.push({
              student: existingStudent,
              mode: 'UPDATED',
              qrProvisioned: true,
            });
          }
        }
      } else if (mode === 'UPSERT') {
        // UPSERT: Update matches, insert new students
        for (const row of stagedRows) {
          const [existingStudent] = await tx
            .select()
            .from(students)
            .where(and(eq(students.schoolId, params.schoolId), eq(students.studentCode, row.studentCode)));

          const classSectionId = classSectionMap.get(`${row.className.toUpperCase()}:${row.sectionName.toUpperCase()}`)!;
          const guardianId = guardianMap.get(row.guardianPhone)!;

          if (existingStudent) {
            await tx
              .update(students)
              .set({
                name: row.name,
                nameBn: row.nameBn || existingStudent.nameBn,
                banglarShikshaId: row.banglarShikshaId || existingStudent.banglarShikshaId,
                gender: row.gender,
                dateOfBirth: row.dateOfBirth || existingStudent.dateOfBirth,
                updatedAt: new Date(),
              })
              .where(eq(students.id, existingStudent.id));

            await tx
              .update(enrollments)
              .set({
                classSectionId,
                rollNumber: row.rollNumber,
                updatedAt: new Date(),
              })
              .where(
                and(
                  eq(enrollments.schoolId, params.schoolId),
                  eq(enrollments.studentId, existingStudent.id),
                  eq(enrollments.academicYearId, academicYearId)
                )
              );

            processedStudents.push({
              student: existingStudent,
              mode: 'UPDATED',
              qrProvisioned: true,
            });
          } else {
            const [newStudent] = await tx
              .insert(students)
              .values({
                schoolId: params.schoolId,
                studentCode: row.studentCode,
                name: row.name,
                nameBn: row.nameBn || null,
                banglarShikshaId: row.banglarShikshaId || null,
                gender: row.gender,
                dateOfBirth: row.dateOfBirth || null,
                status: 'ACTIVE',
              })
              .returning();

            await tx.insert(enrollments).values({
              schoolId: params.schoolId,
              studentId: newStudent.id,
              classSectionId,
              academicYearId,
              rollNumber: row.rollNumber,
              startDate: new Date().toISOString().split('T')[0],
              status: 'ACTIVE',
            });

            await tx.insert(studentGuardians).values({
              studentId: newStudent.id,
              guardianId,
              isPrimary: true,
            });

            await createQrCredential(tx, {
              schoolId: params.schoolId,
              studentId: newStudent.id,
            });

            processedStudents.push({
              student: newStudent,
              mode: 'CREATED',
              qrProvisioned: true,
            });
          }
        }
      } else {
        // CREATE_ONLY: Batch inserts in chunks of 100
        for (let i = 0; i < stagedRows.length; i += CHUNK_SIZE) {
          const chunk = stagedRows.slice(i, i + CHUNK_SIZE);

          const studentValues = chunk.map((r) => ({
            schoolId: params.schoolId,
            studentCode: r.studentCode,
            name: r.name,
            nameBn: r.nameBn || null,
            banglarShikshaId: r.banglarShikshaId || null,
            gender: r.gender,
            dateOfBirth: r.dateOfBirth || null,
            status: 'ACTIVE',
          }));

          const insertedStudents = await tx
            .insert(students)
            .values(studentValues)
            .returning();

          const enrollmentValues = [];
          const studentGuardianValues = [];

          for (let j = 0; j < insertedStudents.length; j++) {
            const s = insertedStudents[j];
            const r = chunk[j];
            const classSectionId = classSectionMap.get(`${r.className.toUpperCase()}:${r.sectionName.toUpperCase()}`)!;
            const guardianId = guardianMap.get(r.guardianPhone)!;

            enrollmentValues.push({
              schoolId: params.schoolId,
              studentId: s.id,
              classSectionId,
              academicYearId,
              rollNumber: r.rollNumber,
              startDate: new Date().toISOString().split('T')[0],
              status: 'ACTIVE',
            });

            studentGuardianValues.push({
              studentId: s.id,
              guardianId,
              isPrimary: true,
            });
          }

          const insertedEnrollments = await tx
            .insert(enrollments)
            .values(enrollmentValues)
            .returning();

          await tx.insert(studentGuardians).values(studentGuardianValues);

          for (let j = 0; j < insertedStudents.length; j++) {
            const s = insertedStudents[j];
            await createQrCredential(tx, {
              schoolId: params.schoolId,
              studentId: s.id,
            });

            processedStudents.push({
              student: s,
              enrollment: insertedEnrollments[j],
              guardianId: guardianMap.get(chunk[j].guardianPhone),
              mode: 'CREATED',
              qrProvisioned: true,
            });
          }
        }
      }

      // Update import job to COMPLETED and purge staging data
      await tx
        .update(importJobs)
        .set({
          status: 'COMPLETED',
          successfulRows: stagedRows.length,
          failedRows: 0,
          stagedData: null,
        })
        .where(eq(importJobs.id, params.importJobId));

      return {
        importJobId: params.importJobId,
        importedCount: processedStudents.length,
        students: processedStudents,
      };
    });

    return result;
  } catch (err: any) {
    await db
      .update(importJobs)
      .set({
        status: 'FAILED',
        failedRows: stagedRows.length,
        stagedData: null,
        errorSummary: { error: err.message },
      })
      .where(eq(importJobs.id, params.importJobId));

    throw new Error(`IMPORT_TRANSACTION_FAILED: ${err.message}`);
  }
}
