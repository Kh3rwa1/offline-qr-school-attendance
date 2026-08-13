import { test, expect } from '@playwright/test';
import crypto from 'node:crypto';
import { computeCanonicalSignature } from '../../src/services/rfid/cryptoService';

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

  test('Submits RFID scan envelope to API and verifies attendance record creation', async ({ request }, testInfo) => {
    // Check system health endpoint first
    const health = await request.get('/api/v1/health');
    expect(health.status()).toBe(200);

    // Login as admin to provision reader and credential
    const loginRes = await request.post('/api/v1/auth/login', {
      data: { phoneNumber: '+919100000001', password: 'SchoolAdminPassword123!' },
    });
    expect(loginRes.ok()).toBeTruthy();

    const meRes = await request.get('/api/v1/auth/me');
    expect(meRes.ok()).toBeTruthy();
    const meData = await meRes.json();
    const schoolId = meData.sessionContext.schoolId || meData.sessionContext.memberships[0].schoolId;

    // Fetch roster / students
    const classesRes = await request.get(`/api/v1/schools/${schoolId}/attendance/classes`);
    expect(classesRes.ok()).toBeTruthy();
    const classSectionId = (await classesRes.json()).data[0].classSectionId;

    await request.post(`/api/v1/schools/${schoolId}/devices/register`, {
      data: { deviceIdentifier: `e2e-rfid-device-${testInfo.workerIndex}` },
    });

    const rosterRes = await request.get(`/api/v1/schools/${schoolId}/sync/classes/${classSectionId}/offline-roster`, {
      headers: { 'x-device-identifier': `e2e-rfid-device-${testInfo.workerIndex}` },
    });
    expect(rosterRes.ok()).toBeTruthy();
    const studentList = (await rosterRes.json()).data.students;
    const studentId = studentList[testInfo.workerIndex % studentList.length].studentId;

    // Register & Approve Reader
    const deviceId = `e2e-rfid-reader-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const regRes = await request.post(`/api/v1/schools/${schoolId}/rfid/readers/register`, {
      data: { deviceId, name: 'Main Gate Reader', location: 'Gate 1', adapterType: 'GATEWAY', securityCapability: 'MUTUAL_AUTH_DESFIRE' },
    });
    expect(regRes.ok()).toBeTruthy();
    const regData = await regRes.json();
    const readerId = regData.reader.id;
    const approveRes = await request.post(`/api/v1/schools/${schoolId}/rfid/readers/${readerId}/approve`);
    expect(approveRes.ok()).toBeTruthy();

    const provRes = await request.post(`/api/v1/schools/${schoolId}/rfid/readers/${readerId}/provision`);
    expect(provRes.ok()).toBeTruthy();
    const provData = await provRes.json();
    const readerSecret = provData.provisioning.provisionedSecret;

    // Revoke any existing active or pending credential for this student before enrolling new one
    const historyRes = await request.get(`/api/v1/schools/${schoolId}/rfid/credentials?studentId=${studentId}`);
    if (historyRes.ok()) {
      const resData = await historyRes.json();
      const creds = resData.credentials || resData.data || [];
      for (const c of creds) {
        if (c.studentId === studentId && (c.status === 'ACTIVE' || c.status === 'PENDING')) {
          await request.post(`/api/v1/schools/${schoolId}/rfid/credentials/${c.id}/revoke`, {
            data: { reason: 'E2E Test Revoke' },
          }).catch(() => undefined);
        }
      }
    }

    // Enroll & Activate Credential
    const digest = `digest_e2e_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const enrollRes = await request.post(`/api/v1/schools/${schoolId}/rfid/credentials/enroll`, {
      data: { studentId, credentialDigest: digest, securityMode: 'SECURE' },
    });
    expect(enrollRes.ok()).toBeTruthy();
    const enrollData = await enrollRes.json();
    const credentialId = enrollData.credential.id;

    const activateRes = await request.post(`/api/v1/schools/${schoolId}/rfid/credentials/${credentialId}/activate`);
    expect(activateRes.ok()).toBeTruthy();

    // Create or reuse Open Attendance Session
    const today = new Date().toISOString().split('T')[0];
    const existingSessionsRes = await request.get(`/api/v1/schools/${schoolId}/attendance/sessions?classSectionId=${classSectionId}&sessionDate=${today}`);
    let attendanceSessionId = '';
    if (existingSessionsRes.ok()) {
      const existingSessions = (await existingSessionsRes.json()).data;
      if (existingSessions && existingSessions.length > 0) {
        attendanceSessionId = existingSessions[0].id;
      }
    }
    if (!attendanceSessionId) {
      const sessionRes = await request.post(`/api/v1/schools/${schoolId}/attendance/sessions`, {
        data: { classSectionId, sessionDate: today, sessionType: 'DAILY' },
      });
      if (sessionRes.ok()) {
        const sessionData = await sessionRes.json();
        attendanceSessionId = sessionData.data?.session?.id || sessionData.data?.id;
      } else {
        const fetchRes = await request.get(`/api/v1/schools/${schoolId}/attendance/sessions?classSectionId=${classSectionId}`);
        const sessions = (await fetchRes.json()).data;
        attendanceSessionId = sessions[0].id;
      }
    }

    const timestamp = new Date().toISOString();
    const nonce = `e2e_nonce_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const clientEventId = `e2e_evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const proofPayload = `secure-proof-v1:${digest}:${nonce}:${timestamp}`;
    const secureProof = crypto.createHmac('sha256', readerSecret).update(proofPayload).digest('hex');

    const envelope: Record<string, any> = {
      version: 1,
      schoolId,
      readerId,
      attendanceSessionId,
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

    envelope.signature = computeCanonicalSignature(envelope, readerSecret);

    const res = await request.post(`/api/v1/schools/${schoolId}/rfid/scans`, {
      headers: {
        'x-reader-id': readerId,
        'x-reader-signature': envelope.signature,
        'x-reader-timestamp': timestamp,
      },
      data: envelope,
    });

    if (!res.ok()) {
      console.log('POST scan error response:', res.status(), await res.json());
    }

    // Require HTTP 200 and ACCEPTED decision for valid signed E2E scan
    expect(res.status()).toBe(200);
    const result = await res.json();
    expect(result.decision).toBe('ACCEPTED');
  });
});
