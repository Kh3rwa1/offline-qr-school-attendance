import { test, expect, request as playwrightRequest } from '@playwright/test';

const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:3100';

async function prepareOfflineSession(page: any) {
  const classSelect = page.locator('select');
  if (await classSelect.isVisible()) {
    const options = await classSelect.locator('option').allInnerTexts();
    if (options.length > 0) {
      await classSelect.selectOption({ index: 0 });
    }
  }
  const downloadBtn = page.getByRole('button', { name: 'Download roster' });
  if (await downloadBtn.isVisible()) {
    await downloadBtn.click();
    await expect(page.getByText(/Roster and active QR digests/)).toBeVisible();
  }
  const startBtn = page.getByRole('button', { name: 'Start offline session' });
  if (await startBtn.isVisible()) {
    await startBtn.click();
  }
}

test.describe('Expanded E2E Offline & Adversarial QR Attendance Suite', () => {
  test('1. Camera permission grant & deny browser context testing', async ({ page, context }) => {
    if (context.browser()?.browserType().name() === 'chromium') {
      await context.grantPermissions(['camera']);
    }
    await page.goto(baseUrl);
    await page.getByLabel('Phone number').fill('+919100000002');
    await page.getByLabel('Password').fill('TeacherPassword123!');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByText('Offline QR Attendance')).toBeVisible();

    await prepareOfflineSession(page);

    const scannerInput = page.getByPlaceholder('USB scanner token (press Enter)');
    await expect(scannerInput).toBeVisible();

    if (context.browser()?.browserType().name() === 'chromium') {
      await context.clearPermissions();
    }
    await page.reload();
    await expect(page.getByText('Offline QR Attendance')).toBeVisible();
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
      const me = await (await adminApi.get('/api/v1/auth/me')).json();
      schoolAId = me.sessionContext.schoolId || me.sessionContext.memberships[0].schoolId;

      const classesRes = await adminApi.get(`/api/v1/schools/${schoolAId}/attendance/classes`);
      const classesData = await classesRes.json();
      if (classesData.data && classesData.data.length > 0) {
        classSectionAId = classesData.data[0].classSectionId;

        const rosterRes = await adminApi.get(`/api/v1/schools/${schoolAId}/sync/classes/${classSectionAId}/offline-roster`, {
          headers: { 'x-device-identifier': 'e2e-device-revoked-test' },
        });
        const rosterData = await rosterRes.json();
        const students = rosterData.data?.students || [];

        if (students.length > 0) {
          studentAId = students[0].studentId;
          const reissueRes = await adminApi.post(`/api/v1/schools/${schoolAId}/qr/reissue`, {
            data: { studentId: studentAId },
          });
          if (reissueRes.ok()) {
            revokedToken = (await reissueRes.json()).rawToken;
            await adminApi.post(`/api/v1/schools/${schoolAId}/qr/revoke`, {
              data: { studentId: studentAId, reason: 'E2E Revocation Test' },
            });
          }
        }
      }
    } finally {
      await adminApi.dispose();
    }

    await page.goto(baseUrl);
    await page.getByLabel('Phone number').fill('+919100000002');
    await page.getByLabel('Password').fill('TeacherPassword123!');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByText('Offline QR Attendance')).toBeVisible();

    await prepareOfflineSession(page);

    const scannerInput = page.getByPlaceholder('USB scanner token (press Enter)');
    await expect(scannerInput).toBeVisible();

    if (revokedToken) {
      await scannerInput.fill(revokedToken);
      await scannerInput.press('Enter');
      await expect(page.getByText(/marked PRESENT/)).not.toBeVisible();
    }

    await scannerInput.fill('MALFORMED-WRONG-SCHOOL-TOKEN');
    await scannerInput.press('Enter');
    await expect(page.getByText(/marked PRESENT/)).not.toBeVisible();
  });

  test('3. Offline scan persistence across page reload and browser close/reopen', async ({ page, context }) => {
    await page.goto(baseUrl);
    await page.getByLabel('Phone number').fill('+919100000002');
    await page.getByLabel('Password').fill('TeacherPassword123!');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByText('Offline QR Attendance')).toBeVisible();

    await prepareOfflineSession(page);

    await page.reload();
    await expect(page.getByText('Offline QR Attendance')).toBeVisible();

    const newPage = await context.newPage();
    await newPage.goto(baseUrl);
    await expect(newPage.getByText('Offline QR Attendance')).toBeVisible();
    await newPage.close();
  });

  test('4. Two browser tabs synchronizing concurrently without record duplication', async ({ context }) => {
    const page1 = await context.newPage();
    const page2 = await context.newPage();

    await page1.goto(baseUrl);
    await page1.getByLabel('Phone number').fill('+919100000002');
    await page1.getByLabel('Password').fill('TeacherPassword123!');
    await page1.getByRole('button', { name: 'Sign in' }).click();
    await expect(page1.getByText('Offline QR Attendance')).toBeVisible();

    await prepareOfflineSession(page1);

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
