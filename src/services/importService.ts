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

  const rawRows: Record<string, any>[] = [];
  const format = params.format || (params.fileName.endsWith('.csv') ? 'csv' : params.fileName.endsWith('.json') ? 'json' : 'xlsx');

  if (format === 'json') {
    try {
      const jsonParsed = JSON.parse(params.fileBuffer.toString('utf8'));
      const studentArray = Array.isArray(jsonParsed) ? jsonParsed : jsonParsed.students || [];
      for (const s of studentArray) {
        rawRows.push({
          'Student Code': s.studentCode || s['Student Code'],
          'Student Name (English)': s.name || s.studentName || s['Student Name (English)'],
          'Bengali Name': s.nameBn || s['Bengali Name'] || '',
          'Banglar Shiksha ID': s.banglarShikshaId || s['Banglar Shiksha ID'] || '',
          'Class Name': s.className || s['Class Name'] || 'General',
          'Section Name': s.sectionName || s['Section Name'] || 'A',
          'Roll Number': s.rollNumber || s['Roll Number'] || 1,
          'Gender': s.gender || s['Gender'] || 'MALE',
          'Date of Birth (YYYY-MM-DD)': s.dateOfBirth || s['Date of Birth (YYYY-MM-DD)'] || '',
          'Guardian Name': s.guardianName || s['Guardian Name'] || 'Guardian',
          'Guardian Phone': s.guardianPhone || s['Guardian Phone'] || '+919999999999',
          'Guardian Relationship': s.guardianRelationship || s['Guardian Relationship'] || 'PARENT',
        });
      }
    } catch {
      throw new Error('INVALID_JSON_PAYLOAD');
    }
  } else if (format === 'csv') {
    const text = params.fileBuffer.toString('utf8');
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length <= 1) throw new Error('EMPTY_SHEET');
    if (lines.length > 5001) throw new Error('MAX_ROWS_EXCEEDED');

    const headers = lines[0].split(',').map((h) => h.replace(/^["']|["']$/g, '').trim());
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map((c) => c.replace(/^["']|["']$/g, '').trim());
      const rowData: Record<string, any> = {};
      headers.forEach((h, idx) => {
        rowData[h] = cols[idx] || '';
      });
      if (Object.values(rowData).some((v) => v !== '')) {
        rawRows.push(rowData);
      }
    }
  } else {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(params.fileBuffer);

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

  // Set-based indexed conflict checks in Database for CREATE_ONLY mode
  const mode = params.mode || 'CREATE_ONLY';
  if (mode === 'CREATE_ONLY' && validRows.length > 0) {
    const codes = validRows.map((r) => r.studentCode);
    // Batch in chunks of 500
    for (let c = 0; c < codes.length; c += 500) {
      const chunk = codes.slice(c, c + 500);
      const existingInDb = await db
        .select({ studentCode: students.studentCode })
        .from(students)
        .where(and(eq(students.schoolId, params.schoolId), inArray(students.studentCode, chunk)));

      for (const ex of existingInDb) {
        errors.push({
          row: 0,
          column: 'Student Code',
          error: `Student Code already exists in school database: ${ex.studentCode}`,
        });
      }
    }
  }

  // Create staging job record with confirmation token
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
      stagedData: errors.length === 0 ? validRows : null,
      metadata: {
        confirmToken,
        mode,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 3600000).toISOString(), // 1h validity
      },
    })
    .returning();

  return {
    importJobId: job.id,
    status: job.status,
    confirmToken: errors.length === 0 ? confirmToken : undefined,
    mode,
    totalRows: rawRows.length,
    validRowsCount: validRows.length,
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
}) {
  return parseAndValidateFile({
    schoolId: params.schoolId,
    fileBuffer: params.fileBuffer,
    fileName: params.fileName,
    createdBy: params.createdBy,
    format: 'xlsx',
  });
}

/**
 * Executes the validated import transaction in chunked batches with guardian deduplication
 */
export async function executeTransactionalImport(params: {
  schoolId: string;
  importJobId: string;
  createdBy: string;
  confirmToken?: string;
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

  const jobMeta = (job.metadata || {}) as Record<string, any>;
  if (params.confirmToken && jobMeta.confirmToken && params.confirmToken !== jobMeta.confirmToken) {
    throw new Error('INVALID_CONFIRMATION_TOKEN');
  }

  const stagedRows = job.stagedData as ParsedStudentRow[];
  if (!stagedRows || !Array.isArray(stagedRows) || stagedRows.length === 0) {
    throw new Error('STAGED_DATA_EXPIRED_OR_NOT_FOUND');
  }

  const [currentYear] = await db
    .select()
    .from(academicYears)
    .where(and(eq(academicYears.schoolId, params.schoolId), eq(academicYears.isCurrent, true)));

  if (!currentYear) {
    throw new Error('NO_CURRENT_ACADEMIC_YEAR');
  }
  const academicYearId = currentYear.id;

  // Mark job as PROCESSING
  await db
    .update(importJobs)
    .set({ status: 'PROCESSING' })
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
      // Query existing guardians for these phone numbers in this school
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

      // Create new guardians for phone numbers not yet in DB
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

      // 3. Batch Inserts for Students & Enrollments in Chunks of 100
      const CHUNK_SIZE = 100;
      const createdStudents: any[] = [];

      for (let i = 0; i < stagedRows.length; i += CHUNK_SIZE) {
        const chunk = stagedRows.slice(i, i + CHUNK_SIZE);

        // Insert Student chunk
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

        // Build Enrollments & StudentGuardians & QRs
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

        // Generate QR credentials for students
        for (let j = 0; j < insertedStudents.length; j++) {
          const s = insertedStudents[j];
          const qr = await createQrCredential(tx, {
            schoolId: params.schoolId,
            studentId: s.id,
          });

          createdStudents.push({
            student: s,
            enrollment: insertedEnrollments[j],
            guardianId: guardianMap.get(chunk[j].guardianPhone),
            qrSecretToken: qr.rawToken,
          });
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
        importedCount: createdStudents.length,
        students: createdStudents,
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
