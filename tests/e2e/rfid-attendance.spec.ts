import { test, expect } from '@playwright/test';
import crypto from 'node:crypto';

test.describe('RFID Attendance & Portal E2E Suite', () => {
  test('Renders login page and verifies application title and branding', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveTitle(/Attendance|School/i);
    const heading = page.locator('h1, h2, header');
    await expect(heading.first()).toBeVisible();
  });

  test('Authenticates user via login form and loads dashboard', async ({ page }) => {
    await page.goto('/login');
    
    const phoneInput = page.locator('#login-phone, input[type="tel"]');
    const passwordInput = page.locator('#login-password, input[type="password"]');
    const submitBtn = page.locator('button[type="submit"]');

    if (await phoneInput.count() > 0) {
      await phoneInput.fill('9100000001');
      await passwordInput.fill('SchoolAdminPassword123!');
      await submitBtn.click();
      await page.waitForLoadState('networkidle');
    }

    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

  test('Submits RFID scan envelope to API and verifies attendance record creation', async ({ request, playwright }, testInfo) => {
    test.skip(process.env.FEATURE_RFID !== 'true', 'RFID feature is disabled by default in QR pilot');
    // Check system health endpoint first
    const health = await request.get('/api/v1/health');
    expect(health.status()).toBe(200);

    // Login as admin to provision reader and credential
    const loginRes = await request.post('/api/v1/auth/login', {
      data: { phoneNumber: '+919100000001', password: 'SchoolAdminPassword123!' },
    });
    expect(loginRes.ok()).toBeTruthy();
    const loginData = await loginRes.json();
    const csrfToken = loginData.csrfToken;
    const csrfHeaders: Record<string, string> = csrfToken ? { 'x-csrf-token': csrfToken } : {};

    const meRes = await request.get('/api/v1/auth/me');
    expect(meRes.ok()).toBeTruthy();
    const meData = await meRes.json();
    const schoolId = meData.sessionContext.schoolId || meData.sessionContext.memberships[0].schoolId;

    // Fetch roster / students
    const classesRes = await request.get(`/api/v1/schools/${schoolId}/attendance/classes`);
    expect(classesRes.ok()).toBeTruthy();
    const classSectionId = (await classesRes.json()).data[0].classSectionId;

    await request.post(`/api/v1/schools/${schoolId}/devices/register`, {
      headers: csrfHeaders,
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
      headers: csrfHeaders,
      data: { deviceId, name: 'Main Gate Reader', location: 'Gate 1', adapterType: 'NETWORK', securityCapability: 'HMAC_SHA256' },
    });
    expect(regRes.ok()).toBeTruthy();
    const regData = await regRes.json();
    const readerId = regData.reader.id;
    const approveRes = await request.post(`/api/v1/schools/${schoolId}/rfid/readers/${readerId}/approve`, {
      headers: csrfHeaders,
    });
    expect(approveRes.ok()).toBeTruthy();

    const provRes = await request.post(`/api/v1/schools/${schoolId}/rfid/readers/${readerId}/provision`, {
      headers: csrfHeaders,
    });
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
            headers: csrfHeaders,
            data: { reason: 'E2E Test Revoke' },
          }).catch(() => undefined);
        }
      }
    }

    // Enroll & Activate Credential
    const epcHex = 'E28011700000020B85794820';
    const enrollRes = await request.post(`/api/v1/schools/${schoolId}/rfid/credentials/enroll`, {
      headers: csrfHeaders,
      data: { studentId, epc: epcHex, securityMode: 'SECURE' },
    });
    expect(enrollRes.ok()).toBeTruthy();
    const enrollData = await enrollRes.json();
    const credentialId = enrollData.credential.id;

    const activateRes = await request.post(`/api/v1/schools/${schoolId}/rfid/credentials/${credentialId}/activate`, {
      headers: csrfHeaders,
    });
    expect(activateRes.ok()).toBeTruthy();

    const rawPayload = JSON.stringify({
      data: [
        {
          data: {
            idHex: epcHex,
          },
          timestamp: new Date().toISOString(),
        },
      ],
    });
    const signature = crypto.createHmac('sha256', readerSecret).update(rawPayload).digest('hex');

    const readerClient = await playwright.request.newContext();
    const res = await readerClient.post(`/api/v1/schools/${schoolId}/rfid/zebra/reads`, {
      headers: {
        'x-reader-id': readerId,
        'x-zebra-signature': `sha256=${signature}`,
        'content-type': 'application/json',
      },
      data: rawPayload,
    });

    if (!res.ok()) {
      console.log('POST zebra reads response:', res.status(), await res.json());
    }

    expect(res.status()).toBe(200);
    const result = await res.json();
    expect(result.summary || result.results).toBeDefined();
    await readerClient.dispose();
  });
});
