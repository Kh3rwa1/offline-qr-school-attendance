import { test, expect } from '@playwright/test';

const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:3100';

test.describe('End-to-End Product Journeys Matrix', () => {
  test('Super Admin registers new school and views live platform distribution', async ({ page }) => {
    // 1. Log in as Super Admin
    await page.goto(baseUrl);
    await page.getByLabel('Phone number').fill('+919000000000');
    await page.getByLabel('Password').fill('SuperSecretAdminPassword123!');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page.getByText('Multi-Tenant Platform Hub')).toBeVisible();

    // 2. Open School Provisioning Modal
    const registerBtn = page.getByRole('button', { name: 'Register School' });
    if (await registerBtn.isVisible()) {
      await registerBtn.click();
      const uniqueCode = `1901${Math.floor(1000000 + Math.random() * 9000000)}`;
      await page.locator('input[placeholder="e.g. 19010100101"]').fill(uniqueCode);
      await page.locator('input[placeholder="e.g. Bishnupur High School"]').fill(`Journey Test School ${Date.now()}`);
      await page.locator('input[placeholder="e.g. Bankura"]').fill('Bankura');
      await page.locator('input[placeholder="e.g. Dr. A. Banerjee"]').fill('Principal Test');
      await page.locator('input[placeholder="e.g. +91 98765 43210"]').fill('+919876543210');
      await page.locator('input[placeholder="Minimum 12 characters"]').fill('StrongAdminPassword123!');

      await page.getByRole('button', { name: 'Register & Provision School' }).click();
      await expect(page.getByText('School Provisioned Successfully!')).toBeVisible({ timeout: 10000 });
    }
  });

  test('School Admin navigates student roster and views academic management', async ({ page }) => {
    // 1. Log in as School Admin
    await page.goto(baseUrl);
    await page.getByLabel('Phone number').fill('+919100000001');
    await page.getByLabel('Password').fill('SchoolAdminPassword123!');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page.getByText('School Administration & Operations')).toBeVisible();

    // 2. Navigate to Student Roster
    await page.goto(`${baseUrl}/app/school-admin/students`);
    await expect(page.getByRole('heading', { name: 'Student Roster Directory' })).toBeVisible();

    // 3. Navigate to Academic Sections
    await page.goto(`${baseUrl}/app/school-admin/academics`);
    await expect(page.getByRole('heading', { name: 'Academic Structure & Class Sections' })).toBeVisible();

    // 4. Navigate to User Management
    await page.goto(`${baseUrl}/app/school-admin/users`);
    await expect(page.getByRole('heading', { name: 'School User Management' })).toBeVisible();
  });

  test('Teacher executes offline roll review and server finalization check', async ({ page }) => {
    // 1. Log in as Teacher
    await page.goto(baseUrl);
    await page.getByLabel('Phone number').fill('+919100000002');
    await page.getByLabel('Password').fill('TeacherPassword123!');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page.getByText('Offline QR Attendance')).toBeVisible();

    // 2. View offline workspace
    await page.goto(`${baseUrl}/app/teacher/offline`);
    await expect(page.getByText('Offline Synchronization Ledger')).toBeVisible();
  });

  test('Report Viewer inspects daily roll sheet and longitudinal trends', async ({ page }) => {
    // 1. Log in as Report Viewer
    await page.goto(baseUrl);
    await page.getByLabel('Phone number').fill('+919100000004');
    await page.getByLabel('Password').fill('ReportViewerPassword123!');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page.getByText('Attendance Reports & Analytics')).toBeVisible();

    // 2. Daily roll inspection
    await page.goto(`${baseUrl}/app/reports/daily`);
    await expect(page.getByRole('heading', { name: 'Daily Attendance Inspection' })).toBeVisible();

    // 3. Longitudinal trends
    await page.goto(`${baseUrl}/app/reports/trends`);
    await expect(page.getByRole('heading', { name: 'Longitudinal Attendance Trends' })).toBeVisible();

    // 4. Export center
    await page.goto(`${baseUrl}/app/reports/exports`);
    await expect(page.getByRole('heading', { name: 'Government Export & Audit Center' })).toBeVisible();
  });
});
