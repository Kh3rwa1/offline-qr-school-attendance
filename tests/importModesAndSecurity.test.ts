import { describe, it, expect, beforeAll } from 'vitest';
import { db, withTenantContext } from '../src/db';
import { eq } from 'drizzle-orm';
import {
  schools,
  academicYears,
  classSections,
  students,
  guardians,
  studentGuardians,
  enrollments,
  users,
  schoolMemberships,
} from '../src/db/schema';
import {
  parseAndValidateFile,
  executeTransactionalImport,
  parseRfcCsv,
} from '../src/services/importService';
import { runMigrations } from '../src/db/migrate';
import crypto from 'node:crypto';

describe('Student Import Modes, Token Security & RFC CSV Suite', () => {
  let schoolId: string;
  let adminUserId: string;

  beforeAll(async () => {
    await runMigrations();

    const [user] = await db
      .insert(users)
      .values({
        fullName: 'Import Admin Test',
        phoneNumber: `+9196${String(Date.now()).slice(-8)}`,
        passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$dummyimporthashforadminuser',
        status: 'ACTIVE',
      })
      .returning();
    adminUserId = user.id;

    const [school] = await db
      .insert(schools)
      .values({
        name: 'Import Mode Test High School',
        slug: `import-test-${Date.now()}`,
        district: 'Bankura',
        status: 'ACTIVE',
      })
      .returning();
    schoolId = school.id;

    await db.insert(schoolMemberships).values({
      schoolId,
      userId: adminUserId,
      role: 'SCHOOL_ADMIN',
      status: 'ACTIVE',
    });

    await withTenantContext(schoolId, async (tx) => {
      const [ay] = await tx
        .insert(academicYears)
        .values({
          schoolId,
          name: 'Academic Year 2026-2027',
          startDate: '2026-01-01',
          endDate: '2026-12-31',
          isCurrent: true,
        })
        .returning();

      const [cs] = await tx
        .insert(classSections)
        .values({
          schoolId,
          academicYearId: ay.id,
          className: 'Class 10',
          sectionName: 'A',
          medium: 'BENGALI',
        })
        .returning();

      const [s] = await tx
        .insert(students)
        .values({
          schoolId,
          studentCode: 'EXISTING-001',
          name: 'Original Name',
          gender: 'MALE',
          status: 'ACTIVE',
        })
        .returning();

      await tx.insert(enrollments).values({
        schoolId,
        studentId: s.id,
        classSectionId: cs.id,
        academicYearId: ay.id,
        rollNumber: 1,
        startDate: '2026-01-01',
        status: 'ACTIVE',
      });
    });
  });

  it('correctly parses RFC 4180 CSV with quotes, newlines, escaped quotes and UTF-8 BOM', () => {
    const csvWithBom =
      '\uFEFF"Student Code","Student Name (English)","Bengali Name","Class Name","Section Name","Roll Number","Gender","Guardian Name","Guardian Phone"\r\n' +
      '"STU-01","Anirban, Jr.","অনির্বাণ","Class 10","A","10","MALE","Subhash ""The Father"" Das","+919876543210"\r\n' +
      '"STU-02","Priya\nBanerjee","প্রিয়া","Class 10","A","11","FEMALE","Sujit Banerjee","+919876543211"\r\n';

    const parsed = parseRfcCsv(csvWithBom);
    expect(parsed.length).toBe(3);
    expect(parsed[0][0]).toBe('Student Code');
    expect(parsed[1][1]).toBe('Anirban, Jr.');
    expect(parsed[1][7]).toBe('Subhash "The Father" Das');
    expect(parsed[2][1]).toBe('Priya\nBanerjee');
  });

  it('CREATE_ONLY mode: rejects existing student codes during validation', async () => {
    const csvData =
      'Student Code,Student Name (English),Bengali Name,Class Name,Section Name,Roll Number,Gender,Guardian Name,Guardian Phone\n' +
      'EXISTING-001,New Name Attempt,নতুন নাম,Class 10,A,15,MALE,Guardian Name,+919876543210\n';

    const res = await parseAndValidateFile({
      schoolId,
      fileBuffer: Buffer.from(csvData, 'utf8'),
      fileName: 'create-conflict.csv',
      createdBy: adminUserId,
      format: 'csv',
      mode: 'CREATE_ONLY',
    });

    expect(res.status).toBe('FAILED');
    expect(res.errors.length).toBeGreaterThan(0);
    expect(res.errors.some((e) => e.error.includes('already exists'))).toBe(true);
    expect(res.confirmToken).toBeUndefined();
  });

  it('UPDATE_EXISTING mode: validates and updates existing student without creating new entities', async () => {
    const csvData =
      'Student Code,Student Name (English),Bengali Name,Class Name,Section Name,Roll Number,Gender,Guardian Name,Guardian Phone\n' +
      'EXISTING-001,Updated Student Name,আপডেটেড নাম,Class 10,A,5,MALE,Original Guardian,+919876543210\n';

    const valRes = await parseAndValidateFile({
      schoolId,
      fileBuffer: Buffer.from(csvData, 'utf8'),
      fileName: 'update.csv',
      createdBy: adminUserId,
      format: 'csv',
      mode: 'UPDATE_EXISTING',
    });

    expect(valRes.status).toBe('VALIDATED');
    expect(valRes.validRowsCount).toBe(1);
    expect(valRes.confirmToken).toBeDefined();

    const execRes = await executeTransactionalImport({
      schoolId,
      importJobId: valRes.importJobId,
      createdBy: adminUserId,
      confirmToken: valRes.confirmToken!,
    });

    expect(execRes.importedCount).toBe(1);
    expect(execRes.students[0].mode).toBe('UPDATED');

    // Verify DB update
    const [updated] = await db.select().from(students).where(eq(students.studentCode, 'EXISTING-001'));
    expect(updated.name).toBe('Updated Student Name');
    expect(updated.nameBn).toBe('আপডেটেড নাম');
  });

  it('UPDATE_EXISTING mode: fails when student code does NOT exist in DB', async () => {
    const csvData =
      'Student Code,Student Name (English),Bengali Name,Class Name,Section Name,Roll Number,Gender,Guardian Name,Guardian Phone\n' +
      'NON-EXISTENT-999,Ghost Student,,Class 10,A,20,MALE,Guardian Name,+919876543210\n';

    const valRes = await parseAndValidateFile({
      schoolId,
      fileBuffer: Buffer.from(csvData, 'utf8'),
      fileName: 'update-missing.csv',
      createdBy: adminUserId,
      format: 'csv',
      mode: 'UPDATE_EXISTING',
    });

    expect(valRes.status).toBe('FAILED');
    expect(valRes.errors.some((e) => e.error.includes('does not exist'))).toBe(true);
  });

  it('UPSERT mode: updates existing and creates missing students atomically', async () => {
    const newCode = `UPSERT-NEW-${Date.now()}`;
    const csvData =
      `Student Code,Student Name (English),Bengali Name,Class Name,Section Name,Roll Number,Gender,Guardian Name,Guardian Phone\n` +
      `EXISTING-001,Upserted Name 2,আপডেটেড ২,Class 10,A,2,MALE,Original Guardian,+919876543210\n` +
      `${newCode},Brand New Student,নতুন ছাত্র,Class 10,A,3,FEMALE,New Guardian,+919876543299\n`;

    const valRes = await parseAndValidateFile({
      schoolId,
      fileBuffer: Buffer.from(csvData, 'utf8'),
      fileName: 'upsert.csv',
      createdBy: adminUserId,
      format: 'csv',
      mode: 'UPSERT',
    });

    expect(valRes.status).toBe('VALIDATED');
    expect(valRes.validRowsCount).toBe(2);

    const execRes = await executeTransactionalImport({
      schoolId,
      importJobId: valRes.importJobId,
      createdBy: adminUserId,
      confirmToken: valRes.confirmToken!,
    });

    expect(execRes.importedCount).toBe(2);
    expect(execRes.students.some((s: any) => s.mode === 'UPDATED')).toBe(true);
    expect(execRes.students.some((s: any) => s.mode === 'CREATED')).toBe(true);
  });

  it('rejects invalid or replayed confirmation tokens', async () => {
    const newCode = `TOKEN-TEST-${Date.now()}`;
    const csvData =
      `Student Code,Student Name (English),Bengali Name,Class Name,Section Name,Roll Number,Gender,Guardian Name,Guardian Phone\n` +
      `${newCode},Token Test Student,ছাত্র,Class 10,A,50,MALE,Guardian,+919876543210\n`;

    const valRes = await parseAndValidateFile({
      schoolId,
      fileBuffer: Buffer.from(csvData, 'utf8'),
      fileName: 'token-test.csv',
      createdBy: adminUserId,
      format: 'csv',
      mode: 'CREATE_ONLY',
    });

    // 1. Wrong token
    await expect(
      executeTransactionalImport({
        schoolId,
        importJobId: valRes.importJobId,
        createdBy: adminUserId,
        confirmToken: 'wrong-fake-token-0123456789abcdef',
      })
    ).rejects.toThrow(/INVALID_CONFIRMATION_TOKEN/);

    // 2. Successful execution with real token
    await executeTransactionalImport({
      schoolId,
      importJobId: valRes.importJobId,
      createdBy: adminUserId,
      confirmToken: valRes.confirmToken!,
    });

    // 3. Replay attack with same token (single-use)
    await expect(
      executeTransactionalImport({
        schoolId,
        importJobId: valRes.importJobId,
        createdBy: adminUserId,
        confirmToken: valRes.confirmToken!,
      })
    ).rejects.toThrow(/INVALID_JOB_STATUS/);
  });
});
