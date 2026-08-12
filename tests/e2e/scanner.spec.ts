import { test, expect } from '@playwright/test';

const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:3100';

test('teacher can collect attendance offline, reopen, reconnect, and reconcile two scans', async ({ page, request, context }) => {
  // Prepare two real credentials through the admin API. Raw QR secrets are
  // never present in the roster download; this mirrors an administrator
  // explicitly reissuing cards for a controlled test fixture.
  const adminLogin = await request.post(`${baseUrl}/api/v1/auth/login`, {
    data: { phoneNumber: '+919100000001', password: 'SchoolAdminPassword123!' },
  });
  expect(adminLogin.ok()).toBeTruthy();
  const adminMe = await (await request.get(`${baseUrl}/api/v1/auth/me`)).json();
  const schoolId = adminMe.sessionContext.schoolId || adminMe.sessionContext.activeMembership.schoolId;
  const classesResponse = await request.get(`${baseUrl}/api/v1/schools/${schoolId}/attendance/classes`);
  const classSectionId = (await classesResponse.json()).data[0].classSectionId;
  const deviceIdentifier = `e2e-${Date.now()}`;
  const deviceRegistration = await request.post(`${baseUrl}/api/v1/schools/${schoolId}/devices/register`, { data: { deviceIdentifier } });
  expect(deviceRegistration.ok()).toBeTruthy();
  const rosterResponse = await request.get(`${baseUrl}/api/v1/schools/${schoolId}/sync/classes/${classSectionId}/offline-roster`, { headers: { 'x-device-identifier': deviceIdentifier } });
  const students = (await rosterResponse.json()).data.students.slice(0, 2);
  const tokens = [] as string[];
  for (const student of students) {
    const response = await request.post(`${baseUrl}/api/v1/schools/${schoolId}/qr/reissue`, { data: { studentId: student.studentId } });
    expect(response.ok()).toBeTruthy();
    tokens.push((await response.json()).rawToken);
  }

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

  // The first service-worker install cannot control the page that installed
  // it. Reload once while online so the app shell and its module assets are
  // cached before the browser is taken offline.
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
  // Reconnect before revalidating the cached session; this also exercises the
  // browser's normal online restoration path after the offline reopen.
  await reopened.reload();
  await expect(reopened.getByText('Online')).toBeVisible();
  await reopened.getByRole('button', { name: 'Synchronize now' }).click();
  await expect(reopened.getByText(/synchronized/)).toBeVisible();

  const sessionsResponse = await reopened.request.get(`${baseUrl}/api/v1/schools/${schoolId}/attendance/sessions?classSectionId=${classSectionId}`);
  expect(sessionsResponse.ok()).toBeTruthy();
  const sessions = (await sessionsResponse.json()).data;
  expect(sessions).toHaveLength(1);
  const detailsResponse = await reopened.request.get(`${baseUrl}/api/v1/schools/${schoolId}/attendance/sessions/${sessions[0].id}`);
  expect(detailsResponse.ok()).toBeTruthy();
  const details = (await detailsResponse.json()).data;
  expect(details.roster.filter((record: { status: string }) => record.status === 'PRESENT')).toHaveLength(2);
});
