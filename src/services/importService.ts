import ExcelJS from 'exceljs';
import { eq, and } from 'drizzle-orm';
import { db } from '../db';
import {
  importJobs,
  students,
  guardians,
  studentGuardians,
  enrollments,
  classSections,
  academicYears,
} from '../db/schema';
import { createQrCredential } from './qrService';

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

export async function parseAndValidateXlsx(params: {
  schoolId: string;
  fileBuffer: Buffer;
  fileName: string;
  createdBy: string;
}) {
  // Safety checks to prevent ReDoS / zip-bomb expansion
  if (params.fileBuffer.length > 5 * 1024 * 1024) {
    throw new Error('FILE_SIZE_LIMIT_EXCEEDED');
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(params.fileBuffer);

  if (workbook.worksheets.length === 0) {
    throw new Error('EMPTY_WORKBOOK');
  }

  if (workbook.worksheets.length > 5) {
    throw new Error('MAX_WORKSHEETS_EXCEEDED');
  }

  const worksheet = workbook.worksheets[0];
  if (!worksheet || worksheet.rowCount <= 1) {
    throw new Error('EMPTY_SHEET');
  }

  if (worksheet.rowCount > 5001) {
    throw new Error('MAX_ROWS_EXCEEDED');
  }

  const headers: string[] = [];
  const headerRow = worksheet.getRow(1);
  headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    headers[colNumber] = String(cell.value || '').trim();
  });

  const rawRows: Record<string, any>[] = [];
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

  if (rawRows.length === 0) {
    throw new Error('EMPTY_SHEET');
  }

  // Get current academic year for school
  const [currentYear] = await db
    .select()
    .from(academicYears)
    .where(and(eq(academicYears.schoolId, params.schoolId), eq(academicYears.isCurrent, true)));

  if (!currentYear) {
    throw new Error('NO_CURRENT_ACADEMIC_YEAR');
  }

  // Fetch existing student codes and enrollments for DB collision checks
  const existingStudents = await db
    .select({ studentCode: students.studentCode })
    .from(students)
    .where(eq(students.schoolId, params.schoolId));

  const existingStudentCodes = new Set(existingStudents.map((s: { studentCode: string }) => s.studentCode));

  const existingClassSections = await db
    .select()
    .from(classSections)
    .where(
      and(eq(classSections.schoolId, params.schoolId), eq(classSections.academicYearId, currentYear.id))
    );

  const existingRolls = await db
    .select({
      classSectionId: enrollments.classSectionId,
      rollNumber: enrollments.rollNumber,
    })
    .from(enrollments)
    .where(
      and(
        eq(enrollments.schoolId, params.schoolId),
        eq(enrollments.academicYearId, currentYear.id),
        eq(enrollments.status, 'ACTIVE')
      )
    );

  const dbRollSet = new Set(existingRolls.map((r: { classSectionId: string; rollNumber: number }) => `${r.classSectionId}:${r.rollNumber}`));

  const validRows: ParsedStudentRow[] = [];
  const errors: RowValidationError[] = [];
  const seenFileCodes = new Set<string>();
  const seenFileRolls = new Set<string>();

  rawRows.forEach((row, idx) => {
    const rowNum = idx + 2;
    const studentCode = String(row['Student Code'] || '').trim();
    const name = String(row['Student Name (English)'] || '').trim();
    const nameBn = String(row['Bengali Name'] || '').trim();
    const banglarShikshaId = String(row['Banglar Shiksha ID'] || '').trim();
    const className = String(row['Class Name'] || '').trim();
    const sectionName = String(row['Section Name'] || '').trim();
    const rawRoll = row['Roll Number'];
    const rollNumber = parseInt(String(rawRoll), 10);
    const gender = String(row['Gender'] || 'OTHER').toUpperCase().trim();
    const dateOfBirth = String(row['Date of Birth (YYYY-MM-DD)'] || '').trim();
    const guardianName = String(row['Guardian Name'] || '').trim();
    const guardianPhone = String(row['Guardian Phone'] || '').trim();
    const guardianRelationship = String(row['Guardian Relationship'] || 'PARENT').trim();

    let rowHasError = false;

    if (!studentCode) {
      errors.push({ row: rowNum, column: 'Student Code', error: 'Student Code is required' });
      rowHasError = true;
    }
    if (!name) {
      errors.push({ row: rowNum, column: 'Student Name', error: 'Student Name is required' });
      rowHasError = true;
    }
    if (!className) {
      errors.push({ row: rowNum, column: 'Class Name', error: 'Class Name is required' });
      rowHasError = true;
    }
    if (!sectionName) {
      errors.push({ row: rowNum, column: 'Section Name', error: 'Section Name is required' });
      rowHasError = true;
    }
    if (isNaN(rollNumber) || rollNumber <= 0) {
      errors.push({ row: rowNum, column: 'Roll Number', error: 'Roll Number must be a positive integer' });
      rowHasError = true;
    }
    if (!guardianName) {
      errors.push({ row: rowNum, column: 'Guardian Name', error: 'Guardian Name is required' });
      rowHasError = true;
    }
    if (!guardianPhone || guardianPhone.replace(/\D/g, '').length < 10) {
      errors.push({ row: rowNum, column: 'Guardian Phone', error: 'Guardian Phone must be at least 10 digits' });
      rowHasError = true;
    }

    if (studentCode) {
      if (seenFileCodes.has(studentCode)) {
        errors.push({ row: rowNum, column: 'Student Code', error: `Duplicate Student Code '${studentCode}' in file` });
        rowHasError = true;
      } else {
        seenFileCodes.add(studentCode);
      }
    }

    const rollKey = `${className.toUpperCase()}:${sectionName.toUpperCase()}:${rollNumber}`;
    if (className && sectionName && !isNaN(rollNumber)) {
      if (seenFileRolls.has(rollKey)) {
        errors.push({
          row: rowNum,
          column: 'Roll Number',
          error: `Duplicate Roll Number ${rollNumber} in ${className} ${sectionName} within file`,
        });
        rowHasError = true;
      } else {
        seenFileRolls.add(rollKey);
      }
    }

    if (studentCode && existingStudentCodes.has(studentCode)) {
      errors.push({ row: rowNum, column: 'Student Code', error: `Student Code '${studentCode}' already exists in school` });
      rowHasError = true;
    }

    const matchedSection = existingClassSections.find(
      (c: any) => c.className.toLowerCase() === className.toLowerCase() && c.sectionName.toLowerCase() === sectionName.toLowerCase()
    );

    if (matchedSection) {
      const dbRollKey = `${matchedSection.id}:${rollNumber}`;
      if (dbRollSet.has(dbRollKey)) {
        errors.push({
          row: rowNum,
          column: 'Roll Number',
          error: `Roll Number ${rollNumber} already assigned in ${className} ${sectionName} in database`,
        });
        rowHasError = true;
      }
    }

    if (!rowHasError) {
      validRows.push({
        rowNumber: rowNum,
        studentCode,
        name,
        nameBn: nameBn || undefined,
        banglarShikshaId: banglarShikshaId || undefined,
        className,
        sectionName,
        rollNumber,
        gender: ['MALE', 'FEMALE'].includes(gender) ? gender : 'OTHER',
        dateOfBirth: dateOfBirth || undefined,
        guardianName,
        guardianPhone,
        guardianRelationship,
      });
    }
  });

  // Save import job record WITH server-staged data
  const [job] = await db
    .insert(importJobs)
    .values({
      schoolId: params.schoolId,
      fileName: params.fileName,
      status: errors.length === 0 ? 'VALIDATED' : 'PENDING',
      totalRows: rawRows.length,
      successfulRows: 0,
      failedRows: errors.length,
      errorSummary: { errors, validRowsCount: validRows.length },
      stagedData: validRows,
      createdBy: params.createdBy,
    })
    .returning();

  return {
    importJobId: job.id,
    status: job.status,
    totalRows: rawRows.length,
    validRowsCount: validRows.length,
    invalidRowsCount: errors.length,
    errors,
    validRowsPreview: validRows.slice(0, 50),
    academicYear: currentYear,
  };
}

export async function executeTransactionalImport(params: {
  schoolId: string;
  importJobId: string;
  createdBy: string;
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

  try {
    const result = await db.transaction(async (tx: any) => {
      // Re-check uniqueness inside transaction to prevent race conditions
      const existingStudents = await tx
        .select({ studentCode: students.studentCode })
        .from(students)
        .where(eq(students.schoolId, params.schoolId));
      const existingCodes = new Set(existingStudents.map((s: { studentCode: string }) => s.studentCode));

      for (const r of stagedRows) {
        if (existingCodes.has(r.studentCode)) {
          throw new Error(`STUDENT_CODE_COLLISION: ${r.studentCode}`);
        }
      }

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

      const createdStudents: any[] = [];
      const issuedQrs: any[] = [];

      for (const row of stagedRows) {
        const classSectionId = classSectionMap.get(`${row.className.toUpperCase()}:${row.sectionName.toUpperCase()}`)!;

        const [student] = await tx
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

        const [enrollment] = await tx
          .insert(enrollments)
          .values({
            schoolId: params.schoolId,
            studentId: student.id,
            classSectionId,
            academicYearId,
            rollNumber: row.rollNumber,
            startDate: new Date().toISOString().split('T')[0],
            status: 'ACTIVE',
          })
          .returning();

        const [guardian] = await tx
          .insert(guardians)
          .values({
            schoolId: params.schoolId,
            name: row.guardianName,
            phoneNumber: row.guardianPhone,
            relationship: row.guardianRelationship || 'PARENT',
          })
          .returning();

        await tx.insert(studentGuardians).values({
          studentId: student.id,
          guardianId: guardian.id,
          isPrimary: true,
        });

        const qr = await createQrCredential(tx, {
          schoolId: params.schoolId,
          studentId: student.id,
        });

        createdStudents.push({
          student,
          enrollment,
          guardian,
          qrSecretToken: qr.rawToken,
        });
        issuedQrs.push(qr);
      }

      // Update import job record
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
