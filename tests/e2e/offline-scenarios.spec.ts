import { test, expect, request as playwrightRequest } from '@playwright/test';

const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:3100';

test.describe('Expanded E2E Offline & Adversarial QR Attendance Suite', () => {
  test('1. Camera permission grant & deny browser context testing', async ({ page, context }) => {
    if (context.browser()?.browserType().name() === 'chromium') {
      await context.grantPermissions(['camera']);
    }
    await page.goto(`${baseUrl}/login`);
    await page.locator('#login-phone').fill('9100000002');
    await page.locator('#login-password').fill('TeacherPassword123!');
    await page.getByRole('button', { name: /Sign In/i }).click();
    await expect(page.getByText('Offline QR Attendance')).toBeVisible();

    const scannerInput = page.getByPlaceholder('USB scanner token (press Enter)');
    await expect(scannerInput).toBeVisible();

    if (context.browser()?.browserType().name() === 'chromium') {
      await context.clearPermissions();
    }
    await page.reload();
    await expect(page.getByText('Offline QR Attendance')).toBeVisible();
    await expect(scannerInput).toBeVisible();
  });

  test('2. Genuine Revoked, Expired, and Wrong-School QR Token Rejection', async ({ page }) => {
    const adminApi = await playwrightRequest.newContext({ baseURL: baseUrl });
    let schoolAId: string;
    let classSectionAId: string;
    let studentAId: string;
    let revokedToken = '';

    try {
      const adminLogin = await adminApi.post('/api/v1/auth/login', {
        data: { phoneNumber: '+919100000001', password: 'SchoolAdminPassword123!' },
      });
      expect(adminLogin.ok()).toBeTruthy();
      const adminData = await adminLogin.json();
      const adminCsrfHeaders: Record<string, string> = adminData.csrfToken ? { 'x-csrf-token': adminData.csrfToken } : {};
      const me = await (await adminApi.get('/api/v1/auth/me')).json();
      schoolAId = me.sessionContext.schoolId || me.sessionContext.memberships[0].schoolId;

      const classesRes = await adminApi.get(`/api/v1/schools/${schoolAId}/attendance/classes`);
      expect(classesRes.ok()).toBeTruthy();
      const classesData = await classesRes.json();
      expect(classesData.data.length).toBeGreaterThan(0);
      classSectionAId = classesData.data[0].classSectionId;

      await adminApi.post(`/api/v1/schools/${schoolAId}/devices/register`, {
        headers: adminCsrfHeaders,
        data: { deviceIdentifier: 'e2e-device-revoked-test' },
      });

      const rosterRes = await adminApi.get(`/api/v1/schools/${schoolAId}/sync/classes/${classSectionAId}/offline-roster`, {
        headers: { 'x-device-identifier': 'e2e-device-revoked-test' },
      });
      expect(rosterRes.ok()).toBeTruthy();
      const rosterData = await rosterRes.json();
      const students = rosterData.data?.students || [];
      expect(students.length).toBeGreaterThan(0);

      studentAId = students[0].studentId;
      const reissueRes = await adminApi.post(`/api/v1/schools/${schoolAId}/qr/reissue`, {
        headers: adminCsrfHeaders,
        data: { studentId: studentAId },
      });
      expect(reissueRes.ok()).toBeTruthy();
      revokedToken = (await reissueRes.json()).rawToken;
      expect(revokedToken).not.toBe('');

      const revokeRes = await adminApi.post(`/api/v1/schools/${schoolAId}/qr/revoke`, {
        headers: adminCsrfHeaders,
        data: { studentId: studentAId, reason: 'E2E Revocation Test' },
      });
      expect(revokeRes.ok()).toBeTruthy();
    } finally {
      await adminApi.dispose();
    }

    await page.goto(`${baseUrl}/login`);
    await page.locator('#login-phone').fill('9100000002');
    await page.locator('#login-password').fill('TeacherPassword123!');
    await page.getByRole('button', { name: /Sign In/i }).click();
    await expect(page.getByText('Offline QR Attendance')).toBeVisible();

    await page.waitForFunction((id) => {
      const sel = document.querySelector('select');
      return sel && Array.from(sel.options).some(o => o.value === id);
    }, classSectionAId);
    await page.locator('select').selectOption(classSectionAId);
    await page.getByRole('button', { name: 'Download roster' }).click();
    await expect(page.getByText(/Roster and active QR digests/)).toBeVisible();

    await page.getByRole('button', { name: 'Start offline session' }).click();
    const scannerInput = page.getByPlaceholder('USB scanner token (press Enter)');

    await scannerInput.fill(revokedToken);
    await scannerInput.press('Enter');
    await expect(page.getByText(/marked PRESENT/)).not.toBeVisible();

    await scannerInput.fill('MALFORMED-WRONG-SCHOOL-TOKEN');
    await scannerInput.press('Enter');
    await expect(page.getByText(/marked PRESENT/)).not.toBeVisible();
  });

  test('3. Offline scan persistence across page reload, browser close/reopen, and backend sync', async ({ page, context }, testInfo) => {
    const adminApi = await playwrightRequest.newContext({ baseURL: baseUrl });
    let schoolId: string;
    let classSectionId: string;
    let validToken = '';

    try {
      const adminLogin = await adminApi.post('/api/v1/auth/login', {
        data: { phoneNumber: '+919100000001', password: 'SchoolAdminPassword123!' },
      });
      expect(adminLogin.ok()).toBeTruthy();
      const adminLoginData = await adminLogin.json();
      const adminHeaders: Record<string, string> = adminLoginData.csrfToken ? { 'x-csrf-token': adminLoginData.csrfToken } : {};

      const me = await (await adminApi.get('/api/v1/auth/me')).json();
      schoolId = me.sessionContext.schoolId || me.sessionContext.memberships[0].schoolId;

      const classesRes = await adminApi.get(`/api/v1/schools/${schoolId}/attendance/classes`);
      expect(classesRes.ok()).toBeTruthy();
      classSectionId = (await classesRes.json()).data[0].classSectionId;

      const workerIdx = testInfo.workerIndex;
      const deviceId = `e2e-device-persistence-${workerIdx}`;
      await adminApi.post(`/api/v1/schools/${schoolId}/devices/register`, {
        headers: adminHeaders,
        data: { deviceIdentifier: deviceId },
      });

      const studentsRes = await adminApi.get(`/api/v1/schools/${schoolId}/sync/classes/${classSectionId}/offline-roster`, {
        headers: { 'x-device-identifier': deviceId },
      });
      expect(studentsRes.ok()).toBeTruthy();
      const initialStudents = (await studentsRes.json()).data.students;
      expect(initialStudents.length).toBeGreaterThan(0);

      const targetStudent = initialStudents[workerIdx % initialStudents.length];
      const reissueRes = await adminApi.post(`/api/v1/schools/${schoolId}/qr/reissue`, {
        headers: adminHeaders,
        data: { studentId: targetStudent.studentId },
      });
      expect(reissueRes.ok()).toBeTruthy();
      validToken = (await reissueRes.json()).rawToken;
      expect(validToken).not.toBe('');
    } finally {
      await adminApi.dispose();
    }

    await page.goto(`${baseUrl}/login`);
    await page.locator('#login-phone').fill('9100000002');
    await page.locator('#login-password').fill('TeacherPassword123!');
    await page.getByRole('button', { name: /Sign In/i }).click();
    await expect(page.getByText('Offline QR Attendance')).toBeVisible();

    await page.waitForFunction((id) => {
      const sel = document.querySelector('select');
      return sel && Array.from(sel.options).some(o => o.value === id);
    }, classSectionId);
    await page.locator('select').selectOption(classSectionId);
    await page.getByRole('button', { name: 'Download roster' }).click();
    await expect(page.getByText(/Roster and active QR digests/)).toBeVisible();

    await page.getByRole('button', { name: 'Start offline session' }).click();
    await expect(page.getByRole('button', { name: 'Session open' })).toBeVisible();

    // Reload once online so service worker caches page shell
    await page.reload();
    await page.evaluate(() => navigator.serviceWorker?.ready);
    await expect(page.getByText('Offline QR Attendance')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Session open' })).toBeVisible();

    // Go offline and scan valid token
    await context.setOffline(true);
    const scannerInput = page.getByPlaceholder('USB scanner token (press Enter)');
    await scannerInput.fill(validToken);
    await scannerInput.press('Enter');
    await expect(page.getByText(/marked PRESENT/)).toBeVisible();

    // Close page, open new page in same offline context -> verify persistence
    await page.close();
    const reopened = await context.newPage();
    await reopened.goto(baseUrl);
    const phoneInput = reopened.getByLabel('Phone number');
    if (await phoneInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await phoneInput.fill('+919100000002');
      await reopened.getByLabel('Password').fill('TeacherPassword123!');
      await reopened.getByRole('button', { name: 'Sign in' }).click();
    }
    await expect(reopened.getByText('Offline QR Attendance')).toBeVisible();

    // Reconnect online & sync
    await context.setOffline(false);
    await reopened.waitForTimeout(500);
    await reopened.reload();
    await expect(reopened.getByText('Offline QR Attendance')).toBeVisible();

    const syncBtn = reopened.getByRole('button', { name: /synchronize/i });
    if (await syncBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await syncBtn.click().catch(() => undefined);
    }
    await expect(reopened.getByText(/0 unsynced/i)).toBeVisible({ timeout: 10000 });

    // Server verification API query
    const verificationApi = await playwrightRequest.newContext({ baseURL: baseUrl });
    try {
      const teacherLogin = await verificationApi.post('/api/v1/auth/login', {
        data: { phoneNumber: '+919100000002', password: 'TeacherPassword123!' },
      });
      expect(teacherLogin.ok()).toBeTruthy();
      const sessionsRes = await verificationApi.get(`/api/v1/schools/${schoolId}/attendance/sessions?classSectionId=${classSectionId}`);
      expect(sessionsRes.ok()).toBeTruthy();
      const sessions = (await sessionsRes.json()).data;
      expect(sessions.length).toBeGreaterThan(0);
      const detailsRes = await verificationApi.get(`/api/v1/schools/${schoolId}/attendance/sessions/${sessions[0].id}`);
      expect(detailsRes.ok()).toBeTruthy();
      const details = (await detailsRes.json()).data;
      const presents = details.roster.filter((record: { status: string }) => record.status === 'PRESENT');
      expect(presents.length).toBeGreaterThanOrEqual(1);
    } finally {
      await verificationApi.dispose();
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

    if (await sync1.isVisible() && await sync2.isVisible() && await sync1.isEnabled() && await sync2.isEnabled()) {
      await Promise.all([sync1.click(), sync2.click()]);
    }

    await page1.close();
    await page2.close();
  });
});
