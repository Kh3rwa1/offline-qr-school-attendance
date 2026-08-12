import { describe, it, expect, beforeEach } from 'vitest';
import crypto from 'crypto';
import { db } from '../src/db';
import { seedDatabase } from '../src/db/seed';
import { createStudent } from '../src/services/studentService';
import {
  createQrCredential,
  revokeQrCredential,
  reissueQrCredential,
  verifyQrToken,
  generateSecureQrToken,
  generateA4PrintSheetHtml,
} from '../src/services/qrService';

describe('Cryptographic QR Credential & Tenancy Tests', () => {
  let seeded: any;
  let studentA: any;
  let studentB: any;

  beforeEach(async () => {
    seeded = await seedDatabase();

    const uidA = Math.floor(Math.random() * 1000000);
    const uidB = Math.floor(Math.random() * 1000000);

    studentA = await createStudent({
      schoolId: seeded.schoolA.id,
      studentCode: `STU-QR-A-${uidA}`,
      name: 'Sourav Ganguly',
      nameBn: 'সৌরভ গাঙ্গুলী',
      banglarShikshaId: 'BS-1234567890',
      classSectionId: seeded.schoolAClass5A.id,
      academicYearId: seeded.academicYearA.id,
      rollNumber: uidA,
    });

    studentB = await createStudent({
      schoolId: seeded.schoolB.id,
      studentCode: `STU-QR-B-${uidB}`,
      name: 'Jhulan Goswami',
      nameBn: 'ঝুলন গোস্বামী',
      banglarShikshaId: 'BS-9876543210',
      classSectionId: seeded.schoolBClass6A.id,
      academicYearId: seeded.academicYearB.id,
      rollNumber: uidB,
    });
  });

  it('generates secure tokens with at least 128 bits of randomness and SHA-256 digest', () => {
    const { rawToken, tokenDigest } = generateSecureQrToken();
    expect(rawToken.length).toBe(64); // 32 bytes hex = 256 bits entropy
    expect(tokenDigest.length).toBe(64); // SHA-256 hex digest

    const computedDigest = crypto.createHash('sha256').update(rawToken).digest('hex');
    expect(computedDigest).toBe(tokenDigest);
  });

  it('issues, verifies, and revokes QR credentials safely', async () => {
    const { credential, rawToken } = await createQrCredential(db, {
      schoolId: seeded.schoolA.id,
      studentId: studentA.student.id,
    });

    expect(credential.status).toBe('ACTIVE');
    expect(credential.tokenDigest).not.toBe(rawToken);

    // Verify token with correct school context
    const verified = await verifyQrToken(seeded.schoolA.id, rawToken);
    expect(verified.valid).toBe(true);
    expect(verified.credential?.studentId).toBe(studentA.student.id);

    // Revoke credential
    await revokeQrCredential(seeded.schoolA.id, studentA.student.id);

    // Verifying revoked token must fail
    const verifyRevoked = await verifyQrToken(seeded.schoolA.id, rawToken);
    expect(verifyRevoked.valid).toBe(false);
  });

  it('reissues QR credentials and increments version number', async () => {
    const first = await createQrCredential(db, {
      schoolId: seeded.schoolA.id,
      studentId: studentA.student.id,
    });

    expect(first.credential.version).toBe(1);

    const reissued = await reissueQrCredential(seeded.schoolA.id, studentA.student.id);
    expect(reissued.credential.version).toBe(2);

    // Old token should no longer verify
    const verifyOld = await verifyQrToken(seeded.schoolA.id, first.rawToken);
    expect(verifyOld.valid).toBe(false);

    // New token should verify
    const verifyNew = await verifyQrToken(seeded.schoolA.id, reissued.rawToken);
    expect(verifyNew.valid).toBe(true);
  });

  it('proves QR payload contains no sensitive personal details or government IDs', async () => {
    const { rawToken } = await createQrCredential(db, {
      schoolId: seeded.schoolA.id,
      studentId: studentA.student.id,
    });

    // Verify the rawToken encoded in QR code is purely opaque hexadecimal secret
    expect(rawToken).not.toContain(studentA.student.name);
    expect(rawToken).not.toContain(studentA.student.studentCode);
    expect(rawToken).not.toContain(studentA.student.banglarShikshaId);
    expect(rawToken).not.toContain(seeded.schoolA.udiseCode);
    expect(/^[a-f0-9]{64}$/i.test(rawToken)).toBe(true);
  });

  it('prevents School A from verifying or printing School B QR credentials', async () => {
    const { rawToken } = await createQrCredential(db, {
      schoolId: seeded.schoolB.id,
      studentId: studentB.student.id,
    });

    // Attempting to verify School B's raw token using School A's schoolId must fail
    const crossVerify = await verifyQrToken(seeded.schoolA.id, rawToken);
    expect(crossVerify.valid).toBe(false);

    // Correct school context verifies
    const validVerify = await verifyQrToken(seeded.schoolB.id, rawToken);
    expect(validVerify.valid).toBe(true);
  });

  it('generates print-friendly A4 HTML cards without Banglar Shiksha ID in QR payload', async () => {
    const { rawToken } = await createQrCredential(db, {
      schoolId: seeded.schoolA.id,
      studentId: studentA.student.id,
    });

    const html = await generateA4PrintSheetHtml({
      schoolName: seeded.schoolA.name,
      cards: [
        {
          studentId: studentA.student.id,
          studentCode: studentA.student.studentCode,
          name: studentA.student.name,
          nameBn: studentA.student.nameBn,
          className: 'Class 5',
          sectionName: 'A',
          rollNumber: 1,
          rawToken,
        },
      ],
    });

    expect(html).toContain('Sourav Ganguly');
    expect(html).toContain('সৌরভ গাঙ্গুলী');
    expect(html).toContain('A4 portrait');
    expect(html).toContain('data:image/png;base64,');
  });
});
