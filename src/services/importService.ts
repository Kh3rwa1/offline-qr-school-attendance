import * as XLSX from 'xlsx';
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

export function generateXlsxTemplate(): Buffer {
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

  const sampleData = [
    [
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
    ],
    [
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
    ],
  ];

  const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleData]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Student Import Template');

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

export async function parseAndValidateXlsx(params: {
  schoolId: string;
  fileBuffer: Buffer;
  fileName: string;
  createdBy: string;
}) {
  const wb = XLSX.read(params.fileBuffer, { type: 'buffer' });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) {
    throw new Error('EMPTY_WORKBOOK');
  }

  const ws = wb.Sheets[sheetName];
  const rawRows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

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
    const rowNum = idx + 2; // header is row 1
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

    // Duplicate check within file
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

    // Duplicate check against DB
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

  // Save import job record
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
    validRows,
    academicYear: currentYear,
  };
}

export async function executeTransactionalImport(params: {
  schoolId: string;
  importJobId: string;
  validRows: ParsedStudentRow[];
  academicYearId: string;
  createdBy: string;
}) {
  if (!params.validRows || params.validRows.length === 0) {
    throw new Error('NO_VALID_ROWS_TO_IMPORT');
  }

  try {
    const result = await db.transaction(async (tx: any) => {
      // 1. Fetch or create all required class sections
      const existingSections = await tx
        .select()
        .from(classSections)
        .where(
          and(eq(classSections.schoolId, params.schoolId), eq(classSections.academicYearId, params.academicYearId))
        );

      const classSectionMap = new Map<string, string>(); // 'ClassName:SectionName' -> ID
      for (const cs of existingSections) {
        classSectionMap.set(`${cs.className.toUpperCase()}:${cs.sectionName.toUpperCase()}`, cs.id);
      }

      for (const row of params.validRows) {
        const key = `${row.className.toUpperCase()}:${row.sectionName.toUpperCase()}`;
        if (!classSectionMap.has(key)) {
          const [newCs] = await tx
            .insert(classSections)
            .values({
              schoolId: params.schoolId,
              academicYearId: params.academicYearId,
              className: row.className,
              sectionName: row.sectionName,
            })
            .returning();
          classSectionMap.set(key, newCs.id);
        }
      }

      const createdStudents: any[] = [];
      const issuedQrs: any[] = [];

      // 2. Insert students, guardians, enrollments, and QR credentials sequentially
      for (const row of params.validRows) {
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
            academicYearId: params.academicYearId,
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

        // Generate QR credential inside transaction
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
          successfulRows: params.validRows.length,
          failedRows: 0,
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
    // On error, mark import job as FAILED
    await db
      .update(importJobs)
      .set({
        status: 'FAILED',
        failedRows: params.validRows.length,
        errorSummary: { error: err.message },
      })
      .where(eq(importJobs.id, params.importJobId));

    throw new Error(`IMPORT_TRANSACTION_FAILED: ${err.message}`);
  }
}
