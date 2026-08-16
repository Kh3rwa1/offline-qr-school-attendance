import { test, expect } from '@playwright/test';
import { assertAllInteractiveElementsTouchTarget } from './helpers/a11y-helpers';

const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:3100';

const viewports = [
  { name: 'Mobile 360px', width: 360, height: 800 },
  { name: 'Mobile 390px', width: 390, height: 844 },
  { name: 'Tablet 768px', width: 768, height: 1024 },
  { name: 'Desktop 1280px', width: 1280, height: 800 },
];

test.describe('Exhaustive 44x44px Physical Touch-Target Verification Matrix', () => {
  for (const vp of viewports) {
    test.describe(`Viewport: ${vp.name} (${vp.width}x${vp.height})`, () => {
      test.use({ viewport: { width: vp.width, height: vp.height } });

      test('Login page interactive controls satisfy >= 44x44px touch targets', async ({ page }) => {
        await page.goto(`${baseUrl}/login`);
        await page.waitForLoadState('domcontentloaded');

        await expect(page.locator('#login-phone')).toBeVisible();
        await expect(page.locator('#login-password')).toBeVisible();
        await expect(page.getByRole('button', { name: /Sign In|Log In/i })).toBeVisible();

        await assertAllInteractiveElementsTouchTarget(page, {
          minSize: 44,
          contextName: `Login Page [${vp.name}]`,
          minExpectedCount: 3,
        });
      });

      test('Teacher dashboard, attendance station & offline workspace satisfy >= 44x44px', async ({ page }) => {
        await page.goto(`${baseUrl}/login`);
        await page.locator('#login-phone').fill('9100000002');
        await page.locator('#login-password').fill('TeacherPassword123!');
        await page.getByRole('button', { name: /Sign In|Log In/i }).click();

        await expect(page.getByText(/Today’s attendance|আজকের হাজিরা/i)).toBeVisible();

        // 1. Test main teacher dashboard touch targets
        await assertAllInteractiveElementsTouchTarget(page, {
          minSize: 44,
          contextName: `Teacher Dashboard [${vp.name}]`,
          minExpectedCount: 3,
        });

        // 2. Open Offline Workspace if tab/link is present
        const offlineTab = page.getByRole('button', { name: /Offline Logs|Offline Workspace|আউটবক্স/i }).or(
          page.getByRole('link', { name: /Offline/i })
        ).first();

        if (await offlineTab.isVisible()) {
          await offlineTab.click();
          await expect(page.getByText(/Offline Outbox|অফলাইন আউটবক্স|Sync Outbox/i).first()).toBeVisible();

          await assertAllInteractiveElementsTouchTarget(page, {
            minSize: 44,
            contextName: `Teacher Offline Workspace [${vp.name}]`,
            minExpectedCount: 2,
          });
        }
      });

      test('School Admin user management, modals & controls satisfy >= 44x44px', async ({ page }) => {
        await page.goto(`${baseUrl}/login`);
        await page.locator('#login-phone').fill('9100000001');
        await page.locator('#login-password').fill('SchoolAdminPassword123!');
        await page.getByRole('button', { name: /Sign In|Log In/i }).click();

        await expect(page.getByText(/Admin Station|School Admin|Overview/i).first()).toBeVisible();

        // 1. Navigate to User Management
        const usersNav = page.getByRole('link', { name: /Staff & Memberships|Staff Directory|Staff & Roles|Users|সদস্য/i }).or(
          page.getByRole('button', { name: /Staff|Users/i })
        ).first();

        await expect(usersNav).toBeVisible();
        await usersNav.click();

        // 2. Test User Directory page interactive targets
        const addStaffBtn = page.getByRole('button', { name: /Invite Staff|Add Member|New User|নতুন কর্মী/i }).first();
        await expect(addStaffBtn).toBeVisible();

        await assertAllInteractiveElementsTouchTarget(page, {
          minSize: 44,
          contextName: `School Admin Users Directory [${vp.name}]`,
          minExpectedCount: 4,
        });

        // 3. Open Add Staff Modal and inspect modal controls
        await addStaffBtn.click();
        const fullNameInput = page.locator('#add-staff-modal-title');
        await expect(fullNameInput).toBeVisible();

        // Check password reveal button inside modal
        const pwdToggle = page.getByRole('button', { name: /Show Password|Hide Password|Password|পাসওয়ার্ড/i }).first();
        if (await pwdToggle.isVisible()) {
          const toggleBox = await pwdToggle.boundingBox();
          expect(toggleBox).not.toBeNull();
          expect(toggleBox!.width).toBeGreaterThanOrEqual(44);
          expect(toggleBox!.height).toBeGreaterThanOrEqual(44);
        }

        await assertAllInteractiveElementsTouchTarget(page, {
          minSize: 44,
          contextName: `School Admin Add Staff Modal [${vp.name}]`,
          minExpectedCount: 3,
        });

        // Close modal via Close button
        const closeBtn = page.getByRole('button', { name: /Close|বন্ধ/i }).first();
        await closeBtn.click();
      });

      test('RFID Operator dashboard & reader operations satisfy >= 44x44px', async ({ page }) => {
        await page.goto(`${baseUrl}/login`);
        await page.locator('#login-phone').fill('9100000003');
        await page.locator('#login-password').fill('RfidOpPassword123!');
        await page.getByRole('button', { name: /Sign In|Log In/i }).click();

        await expect(page.getByText(/Gate Operator Station|Operator Station|RFID Operator/i).first()).toBeVisible();

        await assertAllInteractiveElementsTouchTarget(page, {
          minSize: 44,
          contextName: `RFID Operator Station [${vp.name}]`,
          minExpectedCount: 2,
        });
      });

      test('Report Viewer intelligence dashboard, gauges & reports satisfy >= 44x44px', async ({ page }) => {
        await page.goto(`${baseUrl}/login`);
        await page.locator('#login-phone').fill('9100000004');
        await page.locator('#login-password').fill('ReportViewerPassword123!');
        await page.getByRole('button', { name: /Sign In|Log In/i }).click();

        await expect(page.locator('#report-viewer-dashboard-view')).toBeVisible();

        await assertAllInteractiveElementsTouchTarget(page, {
          minSize: 44,
          contextName: `Report Viewer Dashboard [${vp.name}]`,
          minExpectedCount: 3,
        });
      });
    });
  }
});
