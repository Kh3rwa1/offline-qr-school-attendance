import crypto from 'crypto';
import QRCode from 'qrcode';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '../db';
import { qrCredentials, students, enrollments, classSections, schools } from '../db/schema';

export function generateSecureQrToken(): { rawToken: string; tokenDigest: string } {
  // Generate 256 bits (32 bytes) of cryptographic randomness (exceeding 128-bit requirement)
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenDigest = crypto.createHash('sha256').update(rawToken).digest('hex');
  return { rawToken, tokenDigest };
}

export async function createQrCredential(
  dbOrTx: any,
  params: { schoolId: string; studentId: string }
) {
  const { rawToken, tokenDigest } = generateSecureQrToken();

  // Get current max version for student if any
  const [latest] = await dbOrTx
    .select()
    .from(qrCredentials)
    .where(and(eq(qrCredentials.schoolId, params.schoolId), eq(qrCredentials.studentId, params.studentId)))
    .orderBy(desc(qrCredentials.version));

  const nextVersion = (latest?.version || 0) + 1;

  const [credential] = await dbOrTx
    .insert(qrCredentials)
    .values({
      schoolId: params.schoolId,
      studentId: params.studentId,
      tokenDigest,
      version: nextVersion,
      status: 'ACTIVE',
      issuedAt: new Date(),
    })
    .returning();

  return { credential, rawToken };
}

export async function revokeQrCredential(schoolId: string, studentId: string) {
  const [revoked] = await db
    .update(qrCredentials)
    .set({
      status: 'REVOKED',
      revokedAt: new Date(),
    })
    .where(
      and(
        eq(qrCredentials.schoolId, schoolId),
        eq(qrCredentials.studentId, studentId),
        eq(qrCredentials.status, 'ACTIVE')
      )
    )
    .returning();

  return revoked;
}

export async function reissueQrCredential(schoolId: string, studentId: string) {
  // 1. Revoke existing active
  await revokeQrCredential(schoolId, studentId);

  // 2. Create new credential
  return createQrCredential(db, { schoolId, studentId });
}

export async function verifyQrToken(schoolId: string, rawToken: string) {
  const tokenDigest = crypto.createHash('sha256').update(rawToken).digest('hex');

  const [credential] = await db
    .select({
      id: qrCredentials.id,
      schoolId: qrCredentials.schoolId,
      studentId: qrCredentials.studentId,
      version: qrCredentials.version,
      status: qrCredentials.status,
      studentName: students.name,
      studentNameBn: students.nameBn,
      studentCode: students.studentCode,
      photoUrl: students.photoUrl,
    })
    .from(qrCredentials)
    .innerJoin(students, eq(qrCredentials.studentId, students.id))
    .where(
      and(
        eq(qrCredentials.schoolId, schoolId),
        eq(qrCredentials.tokenDigest, tokenDigest),
        eq(qrCredentials.status, 'ACTIVE')
      )
    );

  if (!credential) {
    return { valid: false, message: 'INVALID_OR_REVOKED_QR' };
  }

  return {
    valid: true,
    credential,
  };
}

export async function bulkIssueQrsForClass(schoolId: string, classSectionId: string) {
  // Fetch active students in class section
  const classStudents = await db
    .select({
      studentId: students.id,
    })
    .from(students)
    .innerJoin(enrollments, and(eq(students.id, enrollments.studentId), eq(enrollments.status, 'ACTIVE')))
    .where(
      and(
        eq(students.schoolId, schoolId),
        eq(enrollments.classSectionId, classSectionId),
        eq(students.status, 'ACTIVE')
      )
    );

  const issuedList: { studentId: string; rawToken: string; version: number }[] = [];

  for (const s of classStudents) {
    // Check if already has active QR
    const [existing] = await db
      .select()
      .from(qrCredentials)
      .where(
        and(
          eq(qrCredentials.schoolId, schoolId),
          eq(qrCredentials.studentId, s.studentId),
          eq(qrCredentials.status, 'ACTIVE')
        )
      );

    if (!existing) {
      const created = await createQrCredential(db, { schoolId, studentId: s.studentId });
      issuedList.push({
        studentId: s.studentId,
        rawToken: created.rawToken,
        version: created.credential.version,
      });
    }
  }

  return issuedList;
}

export interface PrintableQrCard {
  studentId: string;
  studentCode: string;
  name: string;
  nameBn?: string | null;
  className: string;
  sectionName: string;
  rollNumber: number;
  photoUrl?: string | null;
  rawToken: string;
}

export async function generateA4PrintSheetHtml(params: {
  schoolName: string;
  cards: PrintableQrCard[];
}): Promise<string> {
  const cardsHtml = await Promise.all(
    params.cards.map(async (card) => {
      const qrDataUrl = await QRCode.toDataURL(card.rawToken, {
        margin: 1,
        width: 140,
        color: { dark: '#000000', light: '#ffffff' },
      });

      return `
        <div class="qr-card">
          <div class="card-header">
            <div class="school-title">${params.schoolName}</div>
            <div class="card-badge">STUDENT IDENTITY CARD</div>
          </div>
          <div class="card-body">
            <div class="photo-box">
              ${
                card.photoUrl
                  ? `<img src="${card.photoUrl}" alt="Student Photo" class="student-photo" />`
                  : `<div class="photo-placeholder">PHOTO</div>`
              }
            </div>
            <div class="student-details">
              <div class="student-name">${card.name}</div>
              ${card.nameBn ? `<div class="student-name-bn">${card.nameBn}</div>` : ''}
              <div class="meta-row"><strong>Code:</strong> ${card.studentCode}</div>
              <div class="meta-row"><strong>Class:</strong> ${card.className} - ${card.sectionName}</div>
              <div class="meta-row"><strong>Roll No:</strong> ${card.rollNumber}</div>
            </div>
            <div class="qr-box">
              <img src="${qrDataUrl}" alt="QR Code" class="qr-code-img" />
            </div>
          </div>
        </div>
      `;
    })
  );

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <title>QR Cards Print Sheet - ${params.schoolName}</title>
      <style>
        @page {
          size: A4 portrait;
          margin: 10mm;
        }
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          margin: 0;
          padding: 0;
          background: #ffffff;
          color: #111827;
        }
        .sheet-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
        }
        .qr-card {
          border: 1.5px solid #1e293b;
          border-radius: 8px;
          padding: 10px;
          background: #fafafa;
          box-shadow: none;
          page-break-inside: avoid;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          height: 180px;
          box-sizing: border-box;
        }
        .card-header {
          border-bottom: 1px solid #cbd5e1;
          padding-bottom: 4px;
          margin-bottom: 6px;
          text-align: center;
        }
        .school-title {
          font-size: 13px;
          font-weight: 700;
          color: #0f172a;
          text-transform: uppercase;
        }
        .card-badge {
          font-size: 9px;
          letter-spacing: 0.5px;
          color: #475569;
        }
        .card-body {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }
        .photo-box {
          width: 50px;
          height: 60px;
          border: 1px dashed #94a3b8;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          background: #f1f5f9;
        }
        .student-photo {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .photo-placeholder {
          font-size: 8px;
          color: #64748b;
          font-weight: 600;
        }
        .student-details {
          flex: 1;
          font-size: 11px;
          line-height: 1.3;
        }
        .student-name {
          font-weight: 700;
          font-size: 13px;
          color: #0284c7;
        }
        .student-name-bn {
          font-size: 11px;
          color: #334155;
          margin-bottom: 2px;
        }
        .meta-row {
          color: #334155;
        }
        .qr-box {
          width: 80px;
          height: 80px;
        }
        .qr-code-img {
          width: 100%;
          height: 100%;
        }
      </style>
    </head>
    <body>
      <div class="sheet-grid">
        ${cardsHtml.join('')}
      </div>
    </body>
    </html>
  `;
}
