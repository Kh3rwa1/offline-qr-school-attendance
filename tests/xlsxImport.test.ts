import { describe, it, expect, beforeEach } from 'vitest';
import * as XLSX from 'xlsx';
import { db } from '../src/db';
import { seedDatabase } from '../src/db/seed';
import {
  generateXlsxTemplate,
  parseAndValidateXlsx,
  executeTransactionalImport,
} from '../src/services/importService';
import { listStudents } from '../src/services/studentService';

describe('XLSX Import Validation & Transactional Execution Tests', () => {
  let seeded: any;

  beforeEach(async () => {
    seeded = await seedDatabase();
  });

  it('generates valid XLSX template buffer', () => {
    const buffer = generateXlsxTemplate();
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);

    const wb = XLSX.read(buffer, { type: 'buffer' });
    expect(wb.SheetNames.length).toBeGreaterThan(0);
  });

  it('detects missing fields, bad phone numbers, and duplicate entries in XLSX file', async () => {
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

    const invalidData = [
      // Row 2: Missing Student Code & Bad Phone Number
      ['', 'Invalid Student 1', '', '', 'Class 10', 'B', 1, 'MALE', '2010-01-01', 'Guardian 1', '123', 'FATHER'],
      // Row 3: Duplicate Student Code within file
      ['STU-DUP-1', 'Valid Name 1', '', '', 'Class 10', 'B', 2, 'MALE', '2010-01-01', 'Guardian 2', '+919876543210', 'FATHER'],
      // Row 4: Duplicate Student Code in file
      ['STU-DUP-1', 'Valid Name 2', '', '', 'Class 10', 'B', 3, 'FEMALE', '2010-01-01', 'Guardian 3', '+919876543211', 'MOTHER'],
    ];

    const ws = XLSX.utils.aoa_to_sheet([headers, ...invalidData]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Test');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const result = await parseAndValidateXlsx({
      schoolId: seeded.schoolA.id,
      fileBuffer: buffer,
      fileName: 'invalid.xlsx',
      createdBy: seeded.teacherUser.id,
    });

    expect(result.totalRows).toBe(3);
    expect(result.invalidRowsCount).toBeGreaterThan(0);
    expect(result.errors.some((e) => e.column === 'Student Code')).toBe(true);
    expect(result.errors.some((e) => e.column === 'Guardian Phone')).toBe(true);
  });

  it('executes transactional import atomically and rolls back on failure', async () => {
    const validRows = [
      {
        rowNumber: 2,
        studentCode: 'STU-TX-1',
        name: 'Valid Student 1',
        className: 'Class 5',
        sectionName: 'A',
        rollNumber: 50,
        gender: 'MALE',
        guardianName: 'Guardian 1',
        guardianPhone: '+919876543210',
        guardianRelationship: 'FATHER',
      },
      {
        rowNumber: 3,
        studentCode: 'STU-TX-2',
        name: 'Valid Student 2',
        className: 'Class 5',
        sectionName: 'A',
        rollNumber: 51,
        gender: 'FEMALE',
        guardianName: 'Guardian 2',
        guardianPhone: '+919876543211',
        guardianRelationship: 'MOTHER',
      },
    ];

    // Create staged job result and execute
    const parsed = await parseAndValidateXlsx({
      schoolId: seeded.schoolA.id,
      fileBuffer: generateXlsxTemplate(),
      fileName: 'test.xlsx',
      createdBy: seeded.teacherUser.id,
    });

    const result = await executeTransactionalImport({
      schoolId: seeded.schoolA.id,
      importJobId: parsed.importJobId,
      validRows,
      academicYearId: seeded.academicYearA.id,
      createdBy: seeded.teacherUser.id,
    });

    expect(result.importedCount).toBe(2);

    // Verify students exist in DB
    const schoolAStudents = await listStudents({ schoolId: seeded.schoolA.id, status: 'ALL' });
    expect(schoolAStudents.some((s) => s.studentCode === 'STU-TX-1')).toBe(true);
    expect(schoolAStudents.some((s) => s.studentCode === 'STU-TX-2')).toBe(true);
  });
});
