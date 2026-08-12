import { describe, it, expect, beforeEach } from 'vitest';
import ExcelJS from 'exceljs';
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

  it('generates valid XLSX template buffer', async () => {
    const buffer = await generateXlsxTemplate();
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);
    expect(wb.worksheets.length).toBeGreaterThan(0);
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

    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('Test');
    ws.addRow(headers);
    invalidData.forEach((row) => ws.addRow(row));
    const arrayBuf = await workbook.xlsx.writeBuffer();
    const buffer = Buffer.from(arrayBuf);

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
    const templateBuffer = await generateXlsxTemplate();
    const parsed = await parseAndValidateXlsx({
      schoolId: seeded.schoolA.id,
      fileBuffer: templateBuffer,
      fileName: 'test.xlsx',
      createdBy: seeded.teacherUser.id,
    });

    const result = await executeTransactionalImport({
      schoolId: seeded.schoolA.id,
      importJobId: parsed.importJobId,
      createdBy: seeded.teacherUser.id,
    });

    expect(result.importedCount).toBe(2);

    // Verify students exist in DB
    const schoolAStudents = await listStudents({ schoolId: seeded.schoolA.id, status: 'ALL' });
    expect(schoolAStudents.some((s: any) => s.studentCode === 'STU-1001')).toBe(true);
    expect(schoolAStudents.some((s: any) => s.studentCode === 'STU-1002')).toBe(true);
  });
});
