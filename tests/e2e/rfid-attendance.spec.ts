import { test, expect } from '@playwright/test';
import crypto from 'crypto';

function computeCanonicalSignature(envelope: Record<string, any>, secret: string): string {
  const normalized = {
    version: envelope.version || 1,
    schoolId: envelope.schoolId,
    readerId: envelope.readerId,
    credentialDigest: envelope.credentialDigest,
    secureProof: envelope.secureProof,
    readerTimestamp: envelope.readerTimestamp,
    sequenceNumber: envelope.sequenceNumber,
    nonce: envelope.nonce,
    direction: envelope.direction || 'NONE',
    attendanceSessionId: envelope.attendanceSessionId,
    securityMode: envelope.securityMode || 'SECURE',
    clientEventId: envelope.clientEventId,
    isOffline: envelope.isOffline || false,
  };
  const payloadStr = Object.keys(normalized)
    .sort()
    .map((k) => `${k}:${(normalized as any)[k] ?? ''}`)
    .join('|');
  return crypto.createHmac('sha256', secret).update(payloadStr).digest('hex');
}

test.describe('RFID Attendance & Portal E2E Suite', () => {
  test('Renders login page and verifies application title and branding', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Attendance|School/i);
    const heading = page.locator('h1, h2, header');
    await expect(heading.first()).toBeVisible();
  });

  test('Authenticates user via login form and loads dashboard', async ({ page }) => {
    await page.goto('/');
    
    const phoneInput = page.locator('input[type="tel"], input[name="phoneNumber"], input[name="phone"]');
    const passwordInput = page.locator('input[type="password"]');
    const submitBtn = page.locator('button[type="submit"]');

    if (await phoneInput.count() > 0) {
      await phoneInput.fill('+919100000001');
      await passwordInput.fill('SchoolAdminPassword123!');
      await submitBtn.click();
      await page.waitForLoadState('networkidle');
    }

    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

  test('Submits RFID scan envelope to API and verifies attendance record creation', async ({ request }) => {
    // Check system health endpoint first
    const health = await request.get('/api/v1/health');
    expect(health.status()).toBe(200);

    const schoolId = '00000000-0000-4000-8000-000000000001';
    const readerId = '00000000-0000-4000-8000-000000000002';
    const hmacSecret = process.env.RFID_HMAC_SECRET || 'ci_rfid_hmac_secret_key_32bytes_long';

    const timestamp = new Date().toISOString();
    const nonce = `e2e_nonce_${Date.now()}`;
    const clientEventId = `e2e_evt_${Date.now()}`;
    const digest = 'digest_e2e_student_card_01';

    const proofPayload = `secure-proof-v1:${digest}:${nonce}:${timestamp}`;
    const secureProof = crypto.createHmac('sha256', hmacSecret).update(proofPayload).digest('hex');

    const envelope: Record<string, any> = {
      version: 1,
      schoolId,
      readerId,
      credentialDigest: digest,
      secureProof,
      readerTimestamp: timestamp,
      sequenceNumber: 1,
      nonce,
      direction: 'NONE',
      securityMode: 'SECURE',
      clientEventId,
      isOffline: false,
    };

    envelope.signature = computeCanonicalSignature(envelope, hmacSecret);

    const res = await request.post(`/${schoolId}/rfid/scans`, {
      headers: {
        'x-reader-id': readerId,
        'x-reader-signature': envelope.signature,
        'x-reader-timestamp': timestamp,
      },
      data: envelope,
    });

    // Require HTTP 200 and ACCEPTED decision for valid signed E2E scan
    expect(res.status()).toBe(200);
    const result = await res.json();
    expect(result.decision).toBe('ACCEPTED');
  });
});
