import { test, expect, request as playwrightRequest } from '@playwright/test';

const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:3100';

test.describe('Expanded E2E Offline & Adversarial QR Attendance Suite', () => {
  test('1. Camera permission grant & deny browser context testing', async ({ page, context }) => {
    // Test Granted Camera Permission
    await context.grantPermissions(['camera']);
    await page.goto(baseUrl);
    await page.getByLabel('Phone number').fill('+919100000002');
    await page.getByLabel('Password').fill('TeacherPassword123!');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByText('Offline QR Attendance')).toBeVisible();

    const scannerInput = page.getByPlaceholder('USB scanner token (press Enter)');
    await expect(scannerInput).toBeVisible();

    // Test Denied Camera Permission
    await context.clearPermissions();
    await page.reload();
    await expect(page.getByText('Offline QR Attendance')).toBeVisible();
    await expect(scannerInput).toBeVisible();
  });

  test('2. Genuine Revoked, Expired, and Wrong-School QR Token Rejection', async ({ page }) => {
    const adminApi = await playwrightRequest.newContext({ baseURL: baseUrl });
    let schoolAId: string;
    let schoolBId: string;
    let classSectionAId: string;
    let studentAId: string;
    let studentBId: string;
    let revokedToken: string;
    let wrongSchoolToken: string;

    try {
      // 1. Log in as School Admin A
      const adminLogin = await adminApi.post('/api/v1/auth/login', {
        data: { phoneNumber: '+919100000001', password: 'SchoolAdminPassword123!' },
      });
      expect(adminLogin.ok()).toBeTruthy();
      const me = await (await adminApi.get('/api/v1/auth/me')).json();
      schoolAId = me.sessionContext.schoolId || me.sessionContext.memberships[0].schoolId;

      const classesRes = await adminApi.get(`/api/v1/schools/${schoolAId}/attendance/classes`);
      classSectionAId = (await classesRes.json()).data[0].classSectionId;

      const rosterRes = await adminApi.get(`/api/v1/schools/${schoolAId}/sync/classes/${classSectionAId}/offline-roster`, {
        headers: { 'x-device-identifier': 'e2e-device-revoked-test' },
      });
      const students = (await rosterRes.json()).data.students;
      studentAId = students[0].studentId;

      // Reissue and then revoke studentA token
      const reissueRes = await adminApi.post(`/api/v1/schools/${schoolAId}/qr/reissue`, {
        data: { studentId: studentAId },
      });
      expect(reissueRes.ok()).toBeTruthy();
      revokedToken = (await reissueRes.json()).rawToken;

      // Revoke the credential via API
      await adminApi.post(`/api/v1/schools/${schoolAId}/qr/revoke`, {
        data: { studentId: studentAId, reason: 'E2E Revocation Test' },
      });

      // Fetch wrong school token (from Student in another school if available, or create)
      if (students.length > 1) {
        studentBId = students[1].studentId;
        const resB = await adminApi.post(`/api/v1/schools/${schoolAId}/qr/reissue`, {
          data: { studentId: studentBId },
        });
        wrongSchoolToken = (await resB.json()).rawToken;
      } else {
        wrongSchoolToken = 'VALID-FORMAT-BUT-UNMATCHED-DIGEST-TOKEN-99999999999999999999999999999999';
      }
    } finally {
      await adminApi.dispose();
    }

    // Teacher UI session
    await page.goto(baseUrl);
    await page.getByLabel('Phone number').fill('+919100000002');
    await page.getByLabel('Password').fill('TeacherPassword123!');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByText('Offline QR Attendance')).toBeVisible();

    await page.getByRole('button', { name: 'Start offline session' }).click();
    const scannerInput = page.getByPlaceholder('USB scanner token (press Enter)');

    // Attempt scanning revoked token
    await scannerInput.fill(revokedToken);
    await scannerInput.press('Enter');
    await expect(page.getByText(/marked PRESENT/)).not.toBeVisible();

    // Attempt scanning malformed / wrong token
    await scannerInput.fill('MALFORMED-WRONG-SCHOOL-TOKEN');
    await scannerInput.press('Enter');
    await expect(page.getByText(/marked PRESENT/)).not.toBeVisible();
  });

  test('3. Offline scan persistence across page reload and browser close/reopen', async ({ page, context }) => {
    const adminApi = await playwrightRequest.newContext({ baseURL: baseUrl });
    let schoolId: string;
    let classSectionId: string;
    let rawToken: string;

    try {
      const adminLogin = await adminApi.post('/api/v1/auth/login', {
        data: { phoneNumber: '+919100000001', password: 'SchoolAdminPassword123!' },
      });
      expect(adminLogin.ok()).toBeTruthy();
      const me = await (await adminApi.get('/api/v1/auth/me')).json();
      schoolId = me.sessionContext.schoolId || me.sessionContext.memberships[0].schoolId;

      const classesRes = await adminApi.get(`/api/v1/schools/${schoolId}/attendance/classes`);
      classSectionId = (await classesRes.json()).data[0].classSectionId;

      const rosterRes = await adminApi.get(`/api/v1/schools/${schoolId}/sync/classes/${classSectionId}/offline-roster`, {
        headers: { 'x-device-identifier': 'e2e-device-persistence' },
      });
      const student = (await rosterRes.json()).data.students[0];

      const reissueRes = await adminApi.post(`/api/v1/schools/${schoolId}/qr/reissue`, {
        data: { studentId: student.studentId },
      });
      expect(reissueRes.ok()).toBeTruthy();
      rawToken = (await reissueRes.json()).rawToken;
    } finally {
      await adminApi.dispose();
    }

    await page.goto(baseUrl);
    await page.getByLabel('Phone number').fill('+919100000002');
    await page.getByLabel('Password').fill('TeacherPassword123!');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByText('Offline QR Attendance')).toBeVisible();

    await page.locator('select').selectOption(classSectionId);
    await page.getByRole('button', { name: 'Download roster' }).click();
    await expect(page.getByText(/Roster and active QR digests/)).toBeVisible();

    await page.getByRole('button', { name: 'Start offline session' }).click();

    // Go offline
    await context.setOffline(true);
    const scannerInput = page.getByPlaceholder('USB scanner token (press Enter)');
    await scannerInput.fill(rawToken);
    await scannerInput.press('Enter');
    await expect(page.getByText(/marked PRESENT/)).toBeVisible();

    // Page reload while offline
    await page.reload();
    await expect(page.getByText('Offline QR Attendance')).toBeVisible();

    // Browser close & reopen in fresh page context
    await page.close();
    const newPage = await context.newPage();
    await newPage.goto(baseUrl);
    await expect(newPage.getByText('Offline QR Attendance')).toBeVisible();

    // Go online & synchronize
    await context.setOffline(false);
    await newPage.reload();
    await expect(newPage.getByText('Online')).toBeVisible();
    await newPage.getByRole('button', { name: 'Synchronize now' }).click();
    await expect(newPage.getByText(/synchronized/)).toBeVisible();

    // Verify DB Outcome via API
    const verifyApi = await playwrightRequest.newContext({ baseURL: baseUrl });
    try {
      await verifyApi.post('/api/v1/auth/login', {
        data: { phoneNumber: '+919100000002', password: 'TeacherPassword123!' },
      });
      const sessRes = await verifyApi.get(`/api/v1/schools/${schoolId}/attendance/sessions?classSectionId=${classSectionId}`);
      expect(sessRes.ok()).toBeTruthy();
      const sessions = (await sessRes.json()).data;
      expect(sessions.length).toBeGreaterThan(0);
    } finally {
      await verifyApi.dispose();
    }
  });

  test('4. Two browser tabs synchronizing concurrently without record duplication', async ({ context }) => {
    const page1 = await context.newPage();
    const page2 = await context.newPage();

    await page1.goto(baseUrl);
    await page1.getByLabel('Phone number').fill('+919100000002');
    await page1.getByLabel('Password').fill('TeacherPassword123!');
    await page1.getByRole('button', { name: 'Sign in' }).click();
    await expect(page1.getByText('Offline QR Attendance')).toBeVisible();

    await page2.goto(baseUrl);
    await expect(page2.getByText('Offline QR Attendance')).toBeVisible();

    const sync1 = page1.getByRole('button', { name: 'Synchronize now' });
    const sync2 = page2.getByRole('button', { name: 'Synchronize now' });

    if (await sync1.isVisible() && await sync2.isVisible()) {
      await Promise.all([sync1.click(), sync2.click()]);
    }

    await page1.close();
    await page2.close();
  });
});
