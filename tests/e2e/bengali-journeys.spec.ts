import { test, expect } from '@playwright/test';

const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:3100';

test.describe('Strict Bengali & Bengalish End-to-End User Journeys (Zero English Fallbacks)', () => {
  // ── 1. Login Journey & Persistence ──────────────────────────────────────────
  test('1. Bengali language toggle switches login UI and persists across reload and navigation', async ({ page }) => {
    await page.goto(`${baseUrl}/login`);
    await page.waitForLoadState('domcontentloaded');

    // Ensure English starting state
    const enBtn = page.getByRole('button', { name: 'English' }).first();
    await expect(enBtn).toBeVisible();
    await enBtn.click();
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();

    // Click language switcher to switch to Bengali
    const bnBtn = page.getByRole('button', { name: 'বাংলা' }).first();
    await expect(bnBtn).toBeVisible();
    await bnBtn.click();

    // Strict Bengali assertions — ZERO English alternatives
    await expect(page.getByRole('button', { name: 'Login করুন' })).toBeVisible();

    // Verify persistence across page reload
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('button', { name: 'Login করুন' })).toBeVisible();

    // Navigate to root and back to login — confirm language remains selected
    await page.goto(baseUrl);
    await page.waitForLoadState('domcontentloaded');
    await page.goto(`${baseUrl}/login`);
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('button', { name: 'Login করুন' })).toBeVisible();
  });

  // ── 2. Teacher Complete Journey ─────────────────────────────────────────────
  test('2. Teacher journey in Bengali renders localized attendance station, class selector & offline workspace', async ({ page }) => {
    // Switch to Bengali on login page
    await page.goto(`${baseUrl}/login`);
    await page.waitForLoadState('domcontentloaded');
    const bnBtn = page.getByRole('button', { name: 'বাংলা' }).first();
    await expect(bnBtn).toBeVisible();
    await bnBtn.click();

    // Log in as Teacher in Bengali
    await page.locator('#login-phone').fill('9100000002');
    await page.locator('#login-password').fill('TeacherPassword123!');
    await expect(page.getByRole('button', { name: 'Login করুন' })).toBeVisible();
    await page.getByRole('button', { name: 'Login করুন' }).click();

    // Wait for teacher dashboard view container
    await expect(page.locator('#teacher-dashboard-view')).toBeVisible();

    // Strict Bengali assertions on Teacher Dashboard
    await expect(page.getByText('আজকের Attendance').first()).toBeVisible();

    // Check Class selector prompt
    const classSelect = page.locator('select');
    await expect(classSelect).toBeVisible();

    // Navigate to Assigned Classes subroute
    await page.goto(`${baseUrl}/app/teacher/classes`);
    await expect(page.locator('#assigned-classes-view')).toBeVisible();

    // Navigate to Offline Workspace
    await page.goto(`${baseUrl}/app/teacher/offline`);
    await expect(page.locator('#offline-workspace-view')).toBeVisible();

    // Translation integrity: Verify zero raw unparsed translation keys
    const hasRawKeys = await page.evaluate(() => {
      const text = document.body.innerText;
      return /t\([a-zA-Z0-9_.]+\)|\[MISSING_TRANSLATION\]|undefined\.undefined/.test(text);
    });
    expect(hasRawKeys, 'Discovered unparsed translation keys in rendered Teacher UI').toBe(false);
  });

  // ── 3. School Admin Complete Journey ────────────────────────────────────────
  test('3. School Admin user management, roster & academic management in Bengali', async ({ page }) => {
    // Switch to Bengali on login page
    await page.goto(`${baseUrl}/login`);
    await page.waitForLoadState('domcontentloaded');
    const bnBtn = page.getByRole('button', { name: 'বাংলা' }).first();
    await expect(bnBtn).toBeVisible();
    await bnBtn.click();

    // Log in as School Admin in Bengali
    await page.locator('#login-phone').fill('9100000001');
    await page.locator('#login-password').fill('SchoolAdminPassword123!');
    await expect(page.getByRole('button', { name: 'Login করুন' })).toBeVisible();
    await page.getByRole('button', { name: 'Login করুন' }).click();

    // Wait for admin dashboard
    await expect(page.locator('#school-admin-dashboard-view')).toBeVisible();

    // 1. User Management
    await page.goto(`${baseUrl}/app/school-admin/users`);
    await expect(page.locator('#user-management-view')).toBeVisible();

    // Assert strictly localized Add Staff button (NO English fallback)
    const addStaffBtn = page.getByRole('button', { name: 'নতুন Staff Add করুন' }).first();
    await expect(addStaffBtn).toBeVisible();

    // Open Add Staff Modal
    await addStaffBtn.click();
    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible();

    // Password visibility toggle strictly localized (NO English fallback)
    const pwdToggle = modal.getByRole('button', { name: 'Password দেখুন' }).first();
    await expect(pwdToggle).toBeVisible();

    // Close modal
    await page.keyboard.press('Escape');
    await expect(modal).not.toBeVisible();

    // 2. Student Roster
    await page.goto(`${baseUrl}/app/school-admin/students`);
    await expect(page.locator('#student-roster-view')).toBeVisible();

    // 3. Academic Management
    await page.goto(`${baseUrl}/app/school-admin/academics`);
    await expect(page.locator('#academic-management-view')).toBeVisible();

    // 4. Attendance Operations
    await page.goto(`${baseUrl}/app/school-admin/attendance`);
    await expect(page.locator('#attendance-operations-view')).toBeVisible();

    // Translation integrity check
    const hasRawKeys = await page.evaluate(() => {
      const text = document.body.innerText;
      return /t\([a-zA-Z0-9_.]+\)|\[MISSING_TRANSLATION\]/.test(text);
    });
    expect(hasRawKeys, 'Discovered unparsed translation keys in rendered School Admin UI').toBe(false);
  });

  // ── 4. RFID Operator Journey (Executed when FEATURE_RFID=true) ──────────────
  test('4. RFID Operator station in Bengali renders localized gate and reader HUD', async ({ page }) => {
    test.skip(process.env.FEATURE_RFID !== 'true', 'RFID feature is disabled by default in QR pilot');

    // Switch to Bengali on login page
    await page.goto(`${baseUrl}/login`);
    await page.waitForLoadState('domcontentloaded');
    const bnBtn = page.getByRole('button', { name: 'বাংলা' }).first();
    await expect(bnBtn).toBeVisible();
    await bnBtn.click();

    // Log in as RFID Operator in Bengali
    await page.locator('#login-phone').fill('9100000003');
    await page.locator('#login-password').fill('RfidOpPassword123!');
    await expect(page.getByRole('button', { name: 'Login করুন' })).toBeVisible();
    await page.getByRole('button', { name: 'Login করুন' }).click();

    // Wait for RFID operator dashboard
    await expect(page.locator('#rfid-operator-dashboard-view')).toBeVisible();

    // Card Operations subroute
    await page.goto(`${baseUrl}/app/rfid/cards`);
    await expect(page.locator('#card-operations-view')).toBeVisible();

    // Reader Management subroute
    await page.goto(`${baseUrl}/app/rfid/readers`);
    await expect(page.locator('#reader-operations-view')).toBeVisible();

    // Translation integrity check
    const hasRawKeys = await page.evaluate(() => {
      const text = document.body.innerText;
      return /t\([a-zA-Z0-9_.]+\)|\[MISSING_TRANSLATION\]/.test(text);
    });
    expect(hasRawKeys, 'Discovered unparsed translation keys in rendered RFID Operator UI').toBe(false);
  });

  // ── 5. Report Viewer Complete Journey ───────────────────────────────────────
  test('5. Report Viewer portal in Bengali renders localized daily log, trends & export center', async ({ page }) => {
    // Switch to Bengali on login page
    await page.goto(`${baseUrl}/login`);
    await page.waitForLoadState('domcontentloaded');
    const bnBtn = page.getByRole('button', { name: 'বাংলা' }).first();
    await expect(bnBtn).toBeVisible();
    await bnBtn.click();

    // Log in as Report Viewer in Bengali
    await page.locator('#login-phone').fill('9100000004');
    await page.locator('#login-password').fill('ReportViewerPassword123!');
    await expect(page.getByRole('button', { name: 'Login করুন' })).toBeVisible();
    await page.getByRole('button', { name: 'Login করুন' }).click();

    // Wait for report viewer dashboard
    await expect(page.locator('#report-viewer-dashboard-view')).toBeVisible();

    // 2. Daily Reports subroute
    await page.goto(`${baseUrl}/app/reports/daily`);
    await expect(page.locator('#daily-reports-view')).toBeVisible();

    // 3. Trend Reports subroute
    await page.goto(`${baseUrl}/app/reports/trends`);
    await expect(page.locator('#trend-reports-view')).toBeVisible();

    // 4. Export Center subroute
    await page.goto(`${baseUrl}/app/reports/exports`);
    await expect(page.locator('#export-center-view')).toBeVisible();

    // Translation integrity check
    const hasRawKeys = await page.evaluate(() => {
      const text = document.body.innerText;
      return /t\([a-zA-Z0-9_.]+\)|\[MISSING_TRANSLATION\]/.test(text);
    });
    expect(hasRawKeys, 'Discovered unparsed translation keys in rendered Report Viewer UI').toBe(false);
  });
});
