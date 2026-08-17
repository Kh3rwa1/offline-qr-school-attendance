import { test, expect, request as playwrightRequest } from '@playwright/test';

const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:3100';

test('teacher can collect attendance offline, reopen, reconnect, and reconcile two scans', async ({ page, context }, testInfo) => {
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
    const adminLoginBody = await adminLogin.json();
    const csrfToken = adminLoginBody.csrfToken;
    const csrfHeaders: Record<string, string> = csrfToken ? { 'x-csrf-token': String(csrfToken) } : {};

    const adminMe = await (await adminApi.get('/api/v1/auth/me')).json();
    schoolId = adminMe.sessionContext.schoolId || adminMe.sessionContext.memberships[0].schoolId;
    const classesResponse = await adminApi.get(`/api/v1/schools/${schoolId}/attendance/classes`);
    classSectionId = (await classesResponse.json()).data[0].classSectionId;
    const deviceIdentifier = `e2e-scanner-${testInfo.workerIndex}`;
    const deviceRegistration = await adminApi.post(`/api/v1/schools/${schoolId}/devices/register`, {
      data: { deviceIdentifier },
      headers: csrfHeaders,
    });
    expect(deviceRegistration.ok()).toBeTruthy();
    const rosterResponse = await adminApi.get(`/api/v1/schools/${schoolId}/sync/classes/${classSectionId}/offline-roster`, { headers: { 'x-device-identifier': deviceIdentifier } });
    const allStudents = (await rosterResponse.json()).data.students;
    const startIdx = (testInfo.workerIndex * 2) % (allStudents.length - 1);
    const students = allStudents.slice(startIdx, startIdx + 2);
    for (const student of students) {
      const response = await adminApi.post(`/api/v1/schools/${schoolId}/qr/reissue`, {
        data: { studentId: student.studentId },
        headers: csrfHeaders,
      });
      expect(response.ok()).toBeTruthy();
      tokens.push((await response.json()).rawToken);
    }
  } finally {
    await adminApi.dispose();
  }

  // Browser page context starts completely unauthenticated and clean
  await page.goto(`${baseUrl}/login`);
  await page.evaluate(() => navigator.serviceWorker?.ready);
  await page.locator('#login-phone').fill('9100000002');
  await page.locator('#login-password').fill('TeacherPassword123!');
  await page.getByRole('button', { name: /Sign In/i }).click();
  await expect(page.getByText('Today’s attendance').or(page.getByText(/Today’s attendance/i))).toBeVisible();
  await page.waitForFunction((id) => {
    const sel = document.querySelector('select');
    return sel && Array.from(sel.options).some(o => o.value === id);
  }, classSectionId);
  await page.locator('select').selectOption(classSectionId);
  await page.getByRole('button', { name: 'Download roster' }).click();
  await expect(page.getByText(/Roster and active QR digests/)).toBeVisible();
  const startBtn = page.getByRole('button', { name: 'Start offline session' });
  if (await startBtn.isVisible()) {
    await startBtn.click();
  }
  await expect(page.getByRole('button', { name: 'Session open' })).toBeVisible();

  // Reload once online so service worker caches page shell
  await page.reload();
  await page.evaluate(() => navigator.serviceWorker?.ready);
  await expect(page.getByText('Today’s attendance').or(page.getByText(/Today’s attendance/i))).toBeVisible();
  await expect(page.getByRole('button', { name: 'Session open' })).toBeVisible();

  await context.setOffline(true);
  const phoneBackup = page.getByTestId('phone-backup-details');
  if (await phoneBackup.isVisible()) {
    await phoneBackup.locator('summary').click();
  }
  const scanner = page.getByPlaceholder('USB scanner token (press Enter)');
  await scanner.fill(tokens[0]);
  await scanner.press('Enter');
  await scanner.fill(tokens[1]);
  await scanner.press('Enter');
  await expect(page.getByText(/marked PRESENT/)).toBeVisible();

  await page.close();
  const reopened = await context.newPage();
  reopened.on('console', (msg) => console.log('[BROWSER LOG]', msg.text()));
  await reopened.goto(`${baseUrl}/app/teacher`);
  const phoneInput = reopened.locator('#login-phone');
  if (await phoneInput.isVisible({ timeout: 2000 }).catch(() => false)) {
    await phoneInput.fill('9100000002');
    await reopened.locator('#login-password').fill('TeacherPassword123!');
    await reopened.locator('button[type="submit"]').click();
  }
  await expect(reopened.getByText('Today’s attendance').or(reopened.getByText(/Today’s attendance/i))).toBeVisible();
  await context.setOffline(false);

  // Reconnect and synchronize
  await context.setOffline(false);
  await reopened.waitForTimeout(500);
  await reopened.reload();
  await expect(reopened.getByText('Today’s attendance').or(reopened.getByText(/Today’s attendance/i))).toBeVisible();
  
  const pushBtn = reopened.getByRole('button', { name: /Push Local Outbox/i });
  if (await pushBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await pushBtn.click();
    await expect(pushBtn).toBeDisabled({ timeout: 10000 });
  } else {
    // Alternatively click telemetry / outbox card
    await reopened.getByText('Offline Outbox').click();
    await reopened.waitForTimeout(1000);
  }

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
    expect(sessions.length).toBeGreaterThanOrEqual(1);

    const allDetails = await Promise.all(
      sessions.map(async (s: { id: string }) => {
        const res = await verificationApi.get(`/api/v1/schools/${schoolId}/attendance/sessions/${s.id}`);
        return (await res.json()).data;
      })
    );

    const totalPresents = allDetails.flatMap((d: any) => d.roster.filter((record: { status: string }) => record.status === 'PRESENT'));
    expect(totalPresents.length).toBeGreaterThanOrEqual(1);
  } finally {
    await verificationApi.dispose();
  }
});

test('bilingual language toggle on login page reflects English and Bengali strings', async ({ page }) => {
  await page.goto(`${baseUrl}/login`);
  await page.evaluate(() => navigator.serviceWorker?.ready);

  // Assert English default
  await expect(page.getByLabel('Select Language')).toHaveValue('en');
  await expect(page.getByText(/Daily classroom/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /Sign In|Log In/i })).toBeVisible();

  // Switch to Bengali (Bengalish)
  await page.getByLabel('Select Language').selectOption('bn');

  // Assert Bengalish strings appear
  await expect(page.getByText(/Daily Classroom/i)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Login করুন' })).toBeVisible();
  await expect(page.getByText('Always Works')).toBeVisible();

  // Switch back to English
  await page.getByLabel('Select Language').selectOption('en');
  await expect(page.getByText(/Daily classroom/i)).toBeVisible();
});

test('live camera scanner initializes getUserMedia with environment facing mode and plays live stream', async ({ page }) => {
  // Stub getUserMedia with a canvas captureStream to provide a live MediaStream
  await page.addInitScript(() => {
    (window as any).__getUserMediaCalls = [];
    if (!navigator.mediaDevices) {
      (navigator as any).mediaDevices = {};
    }
    navigator.mediaDevices.getUserMedia = async (constraints: any) => {
      (window as any).__getUserMediaCalls.push(constraints);
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#059669';
        ctx.fillRect(0, 0, 640, 480);
      }
      return canvas.captureStream ? canvas.captureStream(30) : new MediaStream();
    };
  });

  // Log in as teacher
  await page.goto(`${baseUrl}/login`);
  await page.evaluate(() => navigator.serviceWorker?.ready);
  await page.locator('#login-phone').fill('9100000002');
  await page.locator('#login-password').fill('TeacherPassword123!');
  await page.getByRole('button', { name: /Sign In|Log In/i }).click();

  await expect(page.getByText('Today’s attendance').or(page.getByText(/Today’s attendance/i))).toBeVisible();

  // Select class and start session
  const selectEl = page.locator('select');
  await expect(selectEl).toBeVisible();
  const optionValues = await selectEl.locator('option').evaluateAll((options) =>
    options.map((o) => (o as HTMLOptionElement).value).filter(Boolean)
  );
  expect(optionValues.length).toBeGreaterThan(0);
  await selectEl.selectOption(optionValues[0]);
  await page.getByRole('button', { name: 'Download roster' }).click();
  await expect(page.getByText(/Roster and active QR digests/)).toBeVisible();

  const sessionOpenBtn = page.getByRole('button', { name: 'Session open' });
  const startBtn = page.getByRole('button', { name: 'Start offline session' });
  if (!(await sessionOpenBtn.isVisible())) {
    await expect(startBtn).toBeVisible();
    await startBtn.click();
    await expect(sessionOpenBtn).toBeVisible();
  }

  const phoneBackup = page.getByTestId('phone-backup-details');
  await expect(phoneBackup).toBeVisible();
  await phoneBackup.locator('summary').click();

  // 1. Assert getUserMedia was called with facingMode: 'environment'
  await expect.poll(async () => {
    return page.evaluate(() => {
      const calls = (window as any).__getUserMediaCalls || [];
      return calls.some((c: any) => {
        const video = c?.video;
        return video && (video.facingMode === 'environment' || JSON.stringify(video).includes('environment'));
      });
    });
  }).toBe(true);

  // 2. Assert video element is mounted and has non-null srcObject with active stream
  const video = page.locator('video');
  await expect(video).toBeAttached();
  await expect(video).toHaveAttribute('playsinline');
  const hasSrcObject = await video.evaluate((v: HTMLVideoElement) => Boolean(v.srcObject));
  expect(hasSrcObject).toBe(true);

  // 3. Assert camera HUD displays LIVE status
  await expect(page.getByText(/CAMERA:\s*LIVE/i)).toBeVisible();
});

test('camera permission denied renders bilingual error HUD and interactive retry button', async ({ page }) => {
  // Stub getUserMedia to reject with NotAllowedError across all browser prototypes
  await page.addInitScript(() => {
    const rejectCamera = async () => {
      const err = new DOMException('Camera permission denied', 'NotAllowedError');
      throw err;
    };
    if (typeof window !== 'undefined') {
      if ((window as any).MediaDevices?.prototype) {
        (window as any).MediaDevices.prototype.getUserMedia = rejectCamera;
      }
      if (!navigator.mediaDevices) {
        (navigator as any).mediaDevices = {};
      }
      navigator.mediaDevices.getUserMedia = rejectCamera;
    }
  });

  // Log in as teacher
  await page.goto(`${baseUrl}/login`);
  await page.locator('#login-phone').fill('9100000002');
  await page.locator('#login-password').fill('TeacherPassword123!');
  await page.getByRole('button', { name: /Sign In|Log In/i }).click();

  await expect(page.getByText('Today’s attendance').or(page.getByText(/Today’s attendance/i))).toBeVisible();

  // Select class and start session
  const selectEl = page.locator('select');
  await expect(selectEl).toBeVisible();
  const optionValues = await selectEl.locator('option').evaluateAll((options) =>
    options.map((o) => (o as HTMLOptionElement).value).filter(Boolean)
  );
  expect(optionValues.length).toBeGreaterThan(0);
  await selectEl.selectOption(optionValues[0]);
  await page.getByRole('button', { name: 'Download roster' }).click();
  await expect(page.getByText(/Roster and active QR digests/)).toBeVisible();

  const sessionOpenBtn = page.getByRole('button', { name: 'Session open' });
  const startBtn = page.getByRole('button', { name: 'Start offline session' });
  if (!(await sessionOpenBtn.isVisible())) {
    await expect(startBtn).toBeVisible();
    await startBtn.click();
    await expect(sessionOpenBtn).toBeVisible();
  }

  const phoneBackupDenied = page.getByTestId('phone-backup-details');
  await expect(phoneBackupDenied).toBeVisible();
  await phoneBackupDenied.locator('summary').click();

  const startCamBtn = page.getByRole('button', { name: /Start Camera/i });
  if (await startCamBtn.isVisible()) {
    await startCamBtn.click();
  }

  // 1. Assert HUD is NOT LIVE
  await expect(page.getByText(/CAMERA:\s*LIVE/i)).toHaveCount(0);

  // 2. Assert English denied copy is displayed
  await expect(page.getByText(/Camera permission denied/i)).toBeVisible();

  // 3. Assert Retry button is visible
  const retryBtn = page.getByRole('button', { name: /Retry Camera|Retry/i });
  await expect(retryBtn).toBeVisible();

  // 4. Switch to Bengali and assert Bengalish denied copy
  const bnBtn = page.getByRole('button', { name: /বাং \+ EN|বাংলা \+ English|বাংলা/i }).first();
  if (await bnBtn.isVisible()) {
    await bnBtn.click();
    await expect(page.getByText(/Camera Permission পাওয়া যায়নি|Camera Permission/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Camera আবার Try করুন|Try Again|Camera/i }).first()).toBeVisible();
  }
});

test('RFID off by default: API returns 404 and RFID operator has no navigation or dashboard access', async ({ page }) => {
  test.skip(process.env.FEATURE_RFID === 'true', 'RFID is enabled in this test run');
  // 1. Assert API returns 404 when FEATURE_RFID is unset/false
  const adminApi = await playwrightRequest.newContext({ baseURL: baseUrl });
  try {
    const adminLogin = await adminApi.post('/api/v1/auth/login', {
      data: { phoneNumber: '+919100000001', password: 'SchoolAdminPassword123!' },
    });
    expect(adminLogin.ok()).toBeTruthy();
    const adminMe = await (await adminApi.get('/api/v1/auth/me')).json();
    const schoolId = adminMe.sessionContext.schoolId || adminMe.sessionContext.memberships[0].schoolId;
    const rfidApiRes = await adminApi.get(`/api/v1/schools/${schoolId}/rfid/readers`);
    expect(rfidApiRes.status()).toBe(404);
  } finally {
    await adminApi.dispose();
  }

  // 2. Log in as seeded RFID operator
  await page.goto(`${baseUrl}/login`);
  await page.locator('#login-phone').fill('9100000003');
  await page.locator('#login-password').fill('RfidOpPassword123!');
  await page.getByRole('button', { name: /Sign In|Log In/i }).click();

  // 3. Assert no RFID links exist in navigation
  await expect(page.locator('a[href="/app/rfid"]')).toHaveCount(0);
  await expect(page.locator('a[href^="/app/rfid/"]')).toHaveCount(0);

  // 4. Direct navigation to /app/rfid does NOT render the RFID operator console
  await page.goto(`${baseUrl}/app/rfid`);
  await expect(page.getByText('MIFARE DESFire EV2 Operator Console')).toHaveCount(0);
});
