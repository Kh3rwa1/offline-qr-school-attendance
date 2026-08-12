import { test, expect, request as playwrightRequest } from '@playwright/test';

const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:3100';

test('teacher can collect attendance offline, reopen, reconnect, and reconcile two scans', async ({ page, context }) => {
  // Create an isolated API context for administrative setup so admin cookies
  // do not contaminate the browser page context.
  const adminApi = await playwrightRequest.newContext({ baseURL: baseUrl });
  let schoolId: string;
  let classSectionId: string;
  const tokens = [] as string[];

  try {
    const adminLogin = await adminApi.post('/api/v1/auth/login', {
      data: { phoneNumber: '+919100000001', password: 'SchoolAdminPassword123!' },
    });
    expect(adminLogin.ok()).toBeTruthy();
    const adminMe = await (await adminApi.get('/api/v1/auth/me')).json();
    schoolId = adminMe.sessionContext.schoolId || adminMe.sessionContext.activeMembership.schoolId;
    const classesResponse = await adminApi.get(`/api/v1/schools/${schoolId}/attendance/classes`);
    classSectionId = (await classesResponse.json()).data[0].classSectionId;
    const deviceIdentifier = `e2e-${Date.now()}`;
    const deviceRegistration = await adminApi.post(`/api/v1/schools/${schoolId}/devices/register`, { data: { deviceIdentifier } });
    expect(deviceRegistration.ok()).toBeTruthy();
    const rosterResponse = await adminApi.get(`/api/v1/schools/${schoolId}/sync/classes/${classSectionId}/offline-roster`, { headers: { 'x-device-identifier': deviceIdentifier } });
    const students = (await rosterResponse.json()).data.students.slice(0, 2);
    for (const student of students) {
      const response = await adminApi.post(`/api/v1/schools/${schoolId}/qr/reissue`, { data: { studentId: student.studentId } });
      expect(response.ok()).toBeTruthy();
      tokens.push((await response.json()).rawToken);
    }
  } finally {
    await adminApi.dispose();
  }

  // Browser page context starts completely unauthenticated and clean
  await page.goto(baseUrl);
  await page.evaluate(() => navigator.serviceWorker?.ready);
  await page.getByLabel('Phone number').fill('+919100000002');
  await page.getByLabel('Password').fill('TeacherPassword123!');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText('Offline QR Attendance')).toBeVisible();
  await page.locator('select').selectOption(classSectionId);
  await page.getByRole('button', { name: 'Download roster' }).click();
  await expect(page.getByText(/Roster and active QR digests/)).toBeVisible();
  await page.getByRole('button', { name: 'Start offline session' }).click();
  await expect(page.getByRole('button', { name: 'Session open' })).toBeVisible();

  // Reload once online so service worker caches page shell
  await page.reload();
  await page.evaluate(() => navigator.serviceWorker?.ready);
  await expect(page.getByText('Offline QR Attendance')).toBeVisible();

  await context.setOffline(true);
  const scanner = page.getByPlaceholder('USB scanner token (press Enter)');
  await scanner.fill(tokens[0]);
  await scanner.press('Enter');
  await scanner.fill(tokens[1]);
  await scanner.press('Enter');
  await expect(page.getByText(/marked PRESENT/)).toBeVisible();

  await page.close();
  const reopened = await context.newPage();
  await reopened.goto(baseUrl);
  await expect(reopened.getByText('Offline QR Attendance')).toBeVisible();
  await context.setOffline(false);

  // Reconnect and synchronize
  await reopened.reload();
  await expect(reopened.getByText('Online')).toBeVisible();
  await reopened.getByRole('button', { name: 'Synchronize now' }).click();
  await expect(reopened.getByText(/synchronized/)).toBeVisible();

  // Verify server attendance records via isolated API client
  const verificationApi = await playwrightRequest.newContext({ baseURL: baseUrl });
  try {
    const teacherLogin = await verificationApi.post('/api/v1/auth/login', {
      data: { phoneNumber: '+919100000002', password: 'TeacherPassword123!' },
    });
    expect(teacherLogin.ok()).toBeTruthy();
    const sessionsResponse = await verificationApi.get(`/api/v1/schools/${schoolId}/attendance/sessions?classSectionId=${classSectionId}`);
    expect(sessionsResponse.ok()).toBeTruthy();
    const sessions = (await sessionsResponse.json()).data;
    expect(sessions).toHaveLength(1);
    const detailsResponse = await verificationApi.get(`/api/v1/schools/${schoolId}/attendance/sessions/${sessions[0].id}`);
    expect(detailsResponse.ok()).toBeTruthy();
    const details = (await detailsResponse.json()).data;
    expect(details.roster.filter((record: { status: string }) => record.status === 'PRESENT')).toHaveLength(2);
  } finally {
    await verificationApi.dispose();
  }
});
