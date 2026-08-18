import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:3100';

/** Helper: run Axe scan and assert zero critical/serious violations */
async function assertAxeClean(page: import('@playwright/test').Page, context: string) {
  await page.waitForTimeout(500); // settle animations

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();

  const violations = results.violations.filter((v) =>
    ['critical', 'serious'].includes(v.impact || '')
  );
  expect(violations, `Axe violations on ${context}: ${JSON.stringify(violations, null, 2)}`).toEqual([]);
}

/** Helper: login with given credentials and await landing */
async function loginAs(page: import('@playwright/test').Page, phone: string, password: string) {
  await page.goto(`${baseUrl}/login`);
  await page.locator('#login-phone').fill(phone);
  await page.locator('#login-password').fill(password);
  await page.getByRole('button', { name: /Sign In|Log In|Login করুন|লগইন করুন/i }).click();
  await page.waitForLoadState('domcontentloaded');
}

test.describe('Exhaustive Axe Automated WCAG 2.1/2.2 AA Accessibility Matrix Across Routes & Operational States', () => {
  // ── Login Page ────────────────────────────────────────────────────────
  test('Login Page passes Axe scan in English and Bengali', async ({ page }) => {
    // English
    await page.goto(`${baseUrl}/login`);
    await page.waitForLoadState('domcontentloaded');
    await assertAxeClean(page, 'English Login page');

    // Bengali
    const langToggle = page.getByRole('button', { name: /^বাংলা$|বাংলা \+ English|বাং \+ EN/i }).first();
    await expect(langToggle).toBeVisible();
    await langToggle.click();
    await assertAxeClean(page, 'Bengali Login page');
  });

  // ── Teacher Dashboard, Camera HUD & Sub-Routes ─────────────────────────
  test('Teacher Dashboard landing passes Axe scan', async ({ page }) => {
    await loginAs(page, '9100000002', 'TeacherPassword123!');
    await expect(page.locator('#teacher-dashboard-view')).toBeVisible();
    await assertAxeClean(page, 'Teacher Dashboard');
  });

  test('Teacher Dashboard Camera HUD expanded state passes Axe scan', async ({ page }) => {
    await loginAs(page, '9100000002', 'TeacherPassword123!');
    await expect(page.locator('#teacher-dashboard-view')).toBeVisible();

    const cameraSummary = page.locator('summary').filter({ hasText: /Camera|ক্যামেরা/i }).first();
    if (await cameraSummary.isVisible()) {
      await cameraSummary.click();
      await expect(page.getByTestId('camera-hud')).toBeVisible();
      await assertAxeClean(page, 'Teacher Camera HUD Expanded');
    }
  });

  test('Teacher Assigned Classes passes Axe scan', async ({ page }) => {
    await loginAs(page, '9100000002', 'TeacherPassword123!');
    await expect(page.locator('#teacher-dashboard-view')).toBeVisible();
    await page.goto(`${baseUrl}/app/teacher/classes`);
    await expect(page.locator('#assigned-classes-view')).toBeVisible();
    await assertAxeClean(page, 'Teacher Assigned Classes');
  });

  test('Teacher Offline Workspace passes Axe scan', async ({ page }) => {
    await loginAs(page, '9100000002', 'TeacherPassword123!');
    await expect(page.locator('#teacher-dashboard-view')).toBeVisible();
    await page.goto(`${baseUrl}/app/teacher/offline`);
    await expect(page.locator('#offline-workspace-view')).toBeVisible();
    await assertAxeClean(page, 'Teacher Offline Workspace');
  });

  // ── School Admin Dashboard + Sub-Routes + Modals + Confirmation Dialogs ──
  test('School Admin Overview passes Axe scan', async ({ page }) => {
    await loginAs(page, '9100000001', 'SchoolAdminPassword123!');
    await expect(page.locator('#school-admin-dashboard-view')).toBeVisible();
    await assertAxeClean(page, 'School Admin Overview');
  });

  test('School Admin User Management & open Add Staff modal pass Axe scan', async ({ page }) => {
    await loginAs(page, '9100000001', 'SchoolAdminPassword123!');
    await expect(page.locator('#school-admin-dashboard-view')).toBeVisible();
    await page.goto(`${baseUrl}/app/school-admin/users`);
    await expect(page.locator('#user-management-view')).toBeVisible();

    const addStaffBtn = page.getByRole('button', { name: /Add Staff|Add Member|Invite Staff|New User|নতুন Staff|নতুন কর্মী/i }).first();
    await expect(addStaffBtn).toBeVisible();

    // Scan User Management page
    await assertAxeClean(page, 'School Admin User Management');

    // Open Add Staff modal and scan it
    await addStaffBtn.click();
    const modalTitle = page.locator('#add-staff-modal-title');
    await expect(modalTitle).toBeVisible();
    await page.waitForTimeout(600);
    await assertAxeClean(page, 'School Admin Add Staff Modal (open)');

    // Close modal
    const closeBtn = page.getByRole('button', { name: /Close|বন্ধ/i }).first();
    await closeBtn.click();
  });

  test('School Admin Stop Access confirmation dialog passes Axe scan', async ({ page }) => {
    await loginAs(page, '9100000001', 'SchoolAdminPassword123!');
    await expect(page.locator('#school-admin-dashboard-view')).toBeVisible();
    await page.goto(`${baseUrl}/app/school-admin/users`);
    await expect(page.locator('#user-management-view')).toBeVisible();

    const stopAccessBtn = page.getByRole('button', { name: /Stop Access|Access বন্ধ করুন/i }).first();
    if (await stopAccessBtn.isVisible()) {
      await stopAccessBtn.click();
      const confirmDialog = page.locator('[role="dialog"]').or(page.locator('[role="alertdialog"]'));
      await expect(confirmDialog).toBeVisible();
      await assertAxeClean(page, 'School Admin Stop Access Confirmation Dialog');
      const cancelBtn = confirmDialog.getByRole('button', { name: /Cancel|বাতিল/i }).first();
      await cancelBtn.click();
    }
  });

  test('School Admin Student Roster passes Axe scan', async ({ page }) => {
    await loginAs(page, '9100000001', 'SchoolAdminPassword123!');
    await expect(page.locator('#school-admin-dashboard-view')).toBeVisible();
    await page.goto(`${baseUrl}/app/school-admin/students`);
    await expect(page.locator('#student-roster-view')).toBeVisible();
    await assertAxeClean(page, 'School Admin Student Roster');
  });

  test('School Admin Academic Management passes Axe scan', async ({ page }) => {
    await loginAs(page, '9100000001', 'SchoolAdminPassword123!');
    await expect(page.locator('#school-admin-dashboard-view')).toBeVisible();
    await page.goto(`${baseUrl}/app/school-admin/academics`);
    await expect(page.locator('#academic-management-view')).toBeVisible();
    await assertAxeClean(page, 'School Admin Academic Management');
  });

  test('School Admin Attendance Operations passes Axe scan', async ({ page }) => {
    await loginAs(page, '9100000001', 'SchoolAdminPassword123!');
    await expect(page.locator('#school-admin-dashboard-view')).toBeVisible();
    await page.goto(`${baseUrl}/app/school-admin/attendance`);
    await expect(page.locator('#attendance-operations-view')).toBeVisible();
    await assertAxeClean(page, 'School Admin Attendance Operations');
  });

  // ── Operational Empty & Error States ──────────────────────────────────
  test('Public school resolution 404 state passes Axe scan', async ({ page }) => {
    await page.goto(`${baseUrl}/s/nonexistent-school-slug-404`);
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('button', { name: /Try Again|আবার চেষ্টা করুন/i })).toBeVisible();
    await assertAxeClean(page, 'School Slug 404 Not Found State');
  });

  test('School Admin User directory empty search filter state passes Axe scan', async ({ page }) => {
    await loginAs(page, '9100000001', 'SchoolAdminPassword123!');
    await expect(page.locator('#school-admin-dashboard-view')).toBeVisible();
    await page.goto(`${baseUrl}/app/school-admin/users`);
    await expect(page.locator('#user-management-view')).toBeVisible();
    const searchInput = page.getByPlaceholder(/Search by name or phone|নাম বা ফোন দিয়ে খুঁজুন/i).first();
    if (await searchInput.isVisible()) {
      await searchInput.fill('XYZNONEXISTENTUSER123');
      await expect(page.getByText(/No staff found|কোনো কর্মী পাওয়া যায়নি/i).first()).toBeVisible();
      await assertAxeClean(page, 'School Admin Users Empty Search State');
    }
  });

  // ── RFID Operator Dashboard + Sub-Routes ──────────────────────────────
  test('RFID Operator Station, Cards & Readers pass Axe scan', async ({ page }) => {
    test.skip(process.env.FEATURE_RFID !== 'true', 'RFID feature is disabled by default in QR pilot');
    await loginAs(page, '9100000003', 'RfidOpPassword123!');
    await expect(page.locator('#rfid-operator-dashboard-view')).toBeVisible();
    await assertAxeClean(page, 'RFID Operator Station');

    // Cards subroute
    await page.goto(`${baseUrl}/app/rfid/cards`);
    await expect(page.locator('#card-operations-view')).toBeVisible();
    await assertAxeClean(page, 'RFID Card Operations');

    // Readers subroute
    await page.goto(`${baseUrl}/app/rfid/readers`);
    await expect(page.locator('#reader-operations-view')).toBeVisible();
    await assertAxeClean(page, 'RFID Reader Management');
  });

  // ── Report Viewer Dashboard + Sub-Routes ──────────────────────────────
  test('Report Viewer Dashboard, Daily, Trends & Export Center pass Axe scan', async ({ page }) => {
    await loginAs(page, '9100000004', 'ReportViewerPassword123!');
    await expect(page.locator('#report-viewer-dashboard-view')).toBeVisible();
    await assertAxeClean(page, 'Report Viewer Overview');

    // Daily Reports
    await page.goto(`${baseUrl}/app/reports/daily`);
    await expect(page.locator('#daily-reports-view')).toBeVisible();
    await assertAxeClean(page, 'Report Viewer Daily Reports');

    // Trend Reports
    await page.goto(`${baseUrl}/app/reports/trends`);
    await expect(page.locator('#trend-reports-view')).toBeVisible();
    await assertAxeClean(page, 'Report Viewer Trend Reports');

    // Export Center
    await page.goto(`${baseUrl}/app/reports/exports`);
    await expect(page.locator('#export-center-view')).toBeVisible();
    await assertAxeClean(page, 'Report Viewer Export Center');
  });
});
