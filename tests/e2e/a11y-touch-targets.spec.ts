import { test, expect } from '@playwright/test';
import { assertAllInteractiveElementsTouchTarget } from './helpers/a11y-helpers';

const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:3100';

const viewports = [
  { name: 'Mobile 360px', width: 360, height: 800 },
  { name: 'Mobile 390px', width: 390, height: 844 },
  { name: 'Tablet 768px', width: 768, height: 1024 },
  { name: 'Desktop 1280px', width: 1280, height: 800 },
];

/** Helper: login with given credentials and await landing */
async function loginAs(page: import('@playwright/test').Page, phone: string, password: string) {
  await page.goto(`${baseUrl}/login`);
  await page.locator('#login-phone').fill(phone);
  await page.locator('#login-password').fill(password);
  await page.getByRole('button', { name: /Sign In|Log In|Login করুন|লগইন করুন/i }).click();
  await page.waitForLoadState('domcontentloaded');
}

test.describe('Exhaustive 44x44px Physical Touch-Target Verification Matrix Across All Routes & Viewports', () => {
  for (const vp of viewports) {
    test.describe(`Viewport: ${vp.name} (${vp.width}x${vp.height})`, () => {
      test.use({ viewport: { width: vp.width, height: vp.height } });

      test('Login page interactive controls satisfy >= 44x44px touch targets', async ({ page }) => {
        await page.goto(`${baseUrl}/login`);
        await page.waitForLoadState('domcontentloaded');

        await expect(page.locator('#login-phone')).toBeVisible();
        await expect(page.locator('#login-password')).toBeVisible();
        await expect(page.getByRole('button', { name: /Sign In|Log In|Login করুন|লগইন করুন/i })).toBeVisible();

        await assertAllInteractiveElementsTouchTarget(page, {
          minSize: 44,
          contextName: `Login Page [${vp.name}]`,
          minExpectedCount: 3,
        });
      });

      // ── Teacher Routes & Operational Controls ───────────────────────────────
      test('Teacher dashboard & camera HUD satisfy >= 44x44px', async ({ page }) => {
        await loginAs(page, '9100000002', 'TeacherPassword123!');
        await expect(page.locator('#teacher-dashboard-view')).toBeVisible();

        await assertAllInteractiveElementsTouchTarget(page, {
          minSize: 44,
          contextName: `Teacher Dashboard [${vp.name}]`,
          minExpectedCount: 3,
        });

        // Expand Camera HUD details
        const cameraSummary = page.locator('summary').filter({ hasText: /Camera|ক্যামেরা/i }).first();
        if (await cameraSummary.isVisible()) {
          await cameraSummary.click();
          await assertAllInteractiveElementsTouchTarget(page, {
            minSize: 44,
            contextName: `Teacher Camera HUD Expanded [${vp.name}]`,
            minExpectedCount: 3,
          });
        }
      });

      test('Teacher Assigned Classes satisfies >= 44x44px', async ({ page }) => {
        await loginAs(page, '9100000002', 'TeacherPassword123!');
        await expect(page.locator('#teacher-dashboard-view')).toBeVisible();
        await page.goto(`${baseUrl}/app/teacher/classes`);
        await expect(page.locator('#assigned-classes-view')).toBeVisible();

        await assertAllInteractiveElementsTouchTarget(page, {
          minSize: 44,
          contextName: `Teacher Assigned Classes [${vp.name}]`,
          minExpectedCount: 2,
        });
      });

      test('Teacher Offline Workspace satisfies >= 44x44px', async ({ page }) => {
        await loginAs(page, '9100000002', 'TeacherPassword123!');
        await expect(page.locator('#teacher-dashboard-view')).toBeVisible();
        await page.goto(`${baseUrl}/app/teacher/offline`);
        await expect(page.locator('#offline-workspace-view')).toBeVisible();

        await assertAllInteractiveElementsTouchTarget(page, {
          minSize: 44,
          contextName: `Teacher Offline Workspace [${vp.name}]`,
          minExpectedCount: 2,
        });
      });

      // ── School Admin Routes & Modals ────────────────────────────────────────
      test('School Admin overview dashboard satisfies >= 44x44px', async ({ page }) => {
        await loginAs(page, '9100000001', 'SchoolAdminPassword123!');
        await expect(page.locator('#school-admin-dashboard-view')).toBeVisible();

        await assertAllInteractiveElementsTouchTarget(page, {
          minSize: 44,
          contextName: `School Admin Overview [${vp.name}]`,
          minExpectedCount: 3,
        });
      });

      test('School Admin user management, modals & confirmation dialogs satisfy >= 44x44px', async ({ page }) => {
        await loginAs(page, '9100000001', 'SchoolAdminPassword123!');
        await expect(page.locator('#school-admin-dashboard-view')).toBeVisible();
        await page.goto(`${baseUrl}/app/school-admin/users`);
        await expect(page.locator('#user-management-view')).toBeVisible();

        // 1. User Directory controls
        const addStaffBtn = page.getByRole('button', { name: /Add Staff|Add Member|Invite Staff|New User|নতুন Staff|নতুন কর্মী/i }).first();
        await expect(addStaffBtn).toBeVisible();

        await assertAllInteractiveElementsTouchTarget(page, {
          minSize: 44,
          contextName: `School Admin Users Directory [${vp.name}]`,
          minExpectedCount: 3,
        });

        // 2. Open Add Staff Modal and inspect modal controls
        await addStaffBtn.click();
        const modal = page.locator('[role="dialog"]');
        await expect(modal).toBeVisible();
        await page.waitForTimeout(300);

        // Password reveal button inside modal must meet >= 44x44px (Mandatory check - NO silent skip)
        const pwdToggle = modal.getByRole('button', { name: /Password দেখুন|Show Password|Password/i }).first();
        await expect(pwdToggle).toBeVisible();
        const toggleBox = await pwdToggle.boundingBox();
        expect(toggleBox).not.toBeNull();
        expect(toggleBox!.width).toBeGreaterThanOrEqual(44);
        expect(toggleBox!.height).toBeGreaterThanOrEqual(44);

        await assertAllInteractiveElementsTouchTarget(page, {
          minSize: 44,
          contextName: `School Admin Add Staff Modal [${vp.name}]`,
          minExpectedCount: 3,
        });

        // Close modal
        await page.keyboard.press('Escape');
        await expect(modal).not.toBeVisible();

        // 3. Stop Access Confirmation Dialog touch-target check
        const stopAccessBtn = page.getByRole('button', { name: /Stop Access|Access বন্ধ করুন/i }).first();
        if (await stopAccessBtn.isVisible()) {
          await stopAccessBtn.click();
          const confirmDialog = page.locator('[role="dialog"]').or(page.locator('[role="alertdialog"]'));
          await expect(confirmDialog).toBeVisible();
          await assertAllInteractiveElementsTouchTarget(page, {
            minSize: 44,
            contextName: `School Admin Stop Access Confirmation Dialog [${vp.name}]`,
            minExpectedCount: 2,
          });
          const cancelBtn = confirmDialog.getByRole('button', { name: /Cancel|বাতিল/i }).first();
          await cancelBtn.click();
          await expect(confirmDialog).not.toBeVisible();
        }
      });

      test('School Admin Student Roster satisfies >= 44x44px', async ({ page }) => {
        await loginAs(page, '9100000001', 'SchoolAdminPassword123!');
        await expect(page.locator('#school-admin-dashboard-view')).toBeVisible();
        await page.goto(`${baseUrl}/app/school-admin/students`);
        await expect(page.locator('#student-roster-view')).toBeVisible();

        await assertAllInteractiveElementsTouchTarget(page, {
          minSize: 44,
          contextName: `School Admin Student Roster [${vp.name}]`,
          minExpectedCount: 2,
        });
      });

      test('School Admin Academic Management satisfies >= 44x44px', async ({ page }) => {
        await loginAs(page, '9100000001', 'SchoolAdminPassword123!');
        await expect(page.locator('#school-admin-dashboard-view')).toBeVisible();
        await page.goto(`${baseUrl}/app/school-admin/academics`);
        await expect(page.locator('#academic-management-view')).toBeVisible();

        await assertAllInteractiveElementsTouchTarget(page, {
          minSize: 44,
          contextName: `School Admin Academic Management [${vp.name}]`,
          minExpectedCount: 2,
        });
      });

      test('School Admin Attendance Operations satisfies >= 44x44px', async ({ page }) => {
        await loginAs(page, '9100000001', 'SchoolAdminPassword123!');
        await expect(page.locator('#school-admin-dashboard-view')).toBeVisible();
        await page.goto(`${baseUrl}/app/school-admin/attendance`);
        await expect(page.locator('#attendance-operations-view')).toBeVisible();

        await assertAllInteractiveElementsTouchTarget(page, {
          minSize: 44,
          contextName: `School Admin Attendance Operations [${vp.name}]`,
          minExpectedCount: 2,
        });
      });

      // ── RFID Operator Routes ────────────────────────────────────────────────
      test('RFID Operator dashboard & reader operations satisfy >= 44x44px', async ({ page }) => {
        test.skip(process.env.FEATURE_RFID !== 'true', 'RFID feature is disabled by default in QR pilot');
        await loginAs(page, '9100000003', 'RfidOpPassword123!');
        await expect(page.locator('#rfid-operator-dashboard-view')).toBeVisible();

        await assertAllInteractiveElementsTouchTarget(page, {
          minSize: 44,
          contextName: `RFID Operator Station [${vp.name}]`,
          minExpectedCount: 2,
        });

        // Card Operations
        await page.goto(`${baseUrl}/app/rfid/cards`);
        await expect(page.locator('#card-operations-view')).toBeVisible();
        await assertAllInteractiveElementsTouchTarget(page, {
          minSize: 44,
          contextName: `RFID Card Operations [${vp.name}]`,
          minExpectedCount: 2,
        });

        // Reader Management
        await page.goto(`${baseUrl}/app/rfid/readers`);
        await expect(page.locator('#reader-operations-view')).toBeVisible();
        await assertAllInteractiveElementsTouchTarget(page, {
          minSize: 44,
          contextName: `RFID Reader Management [${vp.name}]`,
          minExpectedCount: 2,
        });
      });

      // ── Report Viewer Routes ────────────────────────────────────────────────
      test('Report Viewer overview dashboard satisfies >= 44x44px', async ({ page }) => {
        await loginAs(page, '9100000004', 'ReportViewerPassword123!');
        await expect(page.locator('#report-viewer-dashboard-view')).toBeVisible();

        await assertAllInteractiveElementsTouchTarget(page, {
          minSize: 44,
          contextName: `Report Viewer Dashboard [${vp.name}]`,
          minExpectedCount: 3,
        });
      });

      test('Report Viewer Daily Reports satisfies >= 44x44px', async ({ page }) => {
        await loginAs(page, '9100000004', 'ReportViewerPassword123!');
        await expect(page.locator('#report-viewer-dashboard-view')).toBeVisible();
        await page.goto(`${baseUrl}/app/reports/daily`);
        await expect(page.locator('#daily-reports-view')).toBeVisible();

        await assertAllInteractiveElementsTouchTarget(page, {
          minSize: 44,
          contextName: `Report Viewer Daily Reports [${vp.name}]`,
          minExpectedCount: 2,
        });
      });

      test('Report Viewer Trend Reports satisfies >= 44x44px', async ({ page }) => {
        await loginAs(page, '9100000004', 'ReportViewerPassword123!');
        await expect(page.locator('#report-viewer-dashboard-view')).toBeVisible();
        await page.goto(`${baseUrl}/app/reports/trends`);
        await expect(page.locator('#trend-reports-view')).toBeVisible();

        await assertAllInteractiveElementsTouchTarget(page, {
          minSize: 44,
          contextName: `Report Viewer Trend Reports [${vp.name}]`,
          minExpectedCount: 2,
        });
      });

      test('Report Viewer Export Center satisfies >= 44x44px', async ({ page }) => {
        await loginAs(page, '9100000004', 'ReportViewerPassword123!');
        await expect(page.locator('#report-viewer-dashboard-view')).toBeVisible();
        await page.goto(`${baseUrl}/app/reports/exports`);
        await expect(page.locator('#export-center-view')).toBeVisible();

        await assertAllInteractiveElementsTouchTarget(page, {
          minSize: 44,
          contextName: `Report Viewer Export Center [${vp.name}]`,
          minExpectedCount: 2,
        });
      });
    });
  }
});
