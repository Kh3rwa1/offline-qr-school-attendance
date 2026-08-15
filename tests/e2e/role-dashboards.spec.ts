import { test, expect } from '@playwright/test';

const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:3100';

test.describe('Role-Aware Dashboards E2E Matrix', () => {
  test('SUPER_ADMIN logs in and accesses multi-tenant platform hub', async ({ page }) => {
    await page.goto(`${baseUrl}/login`);
    await page.locator('#login-phone').fill('9000000000');
    await page.locator('#login-password').fill('SuperSecretAdminPassword123!');
    await page.getByRole('button', { name: /Sign In/i }).click();

    await expect(page.getByText('Multi-Tenant Platform Hub')).toBeVisible();
  });

  test('SCHOOL_ADMIN logs in and accesses school operations console', async ({ page }) => {
    await page.goto(`${baseUrl}/login`);
    await page.locator('#login-phone').fill('9100000001');
    await page.locator('#login-password').fill('SchoolAdminPassword123!');
    await page.getByRole('button', { name: /Sign In/i }).click();

    await expect(page.getByRole('heading', { name: 'School Administration & Operations' })).toBeVisible();
  });

  test('TEACHER logs in and lands directly on Offline QR Attendance station', async ({ page }) => {
    await page.goto(`${baseUrl}/login`);
    await page.locator('#login-phone').fill('9100000002');
    await page.locator('#login-password').fill('TeacherPassword123!');
    await page.getByRole('button', { name: /Sign In/i }).click();

    await expect(page.getByText('Offline QR Attendance')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Download roster' })).toBeVisible();
  });

  test('REPORT_VIEWER logs in and accesses read-only intelligence portal', async ({ page }) => {
    await page.goto(`${baseUrl}/login`);
    await page.locator('#login-phone').fill('9100000004');
    await page.locator('#login-password').fill('ReportViewerPassword123!');
    await page.getByRole('button', { name: /Sign In/i }).click();

    await expect(page.getByText('Attendance Reports & Analytics')).toBeVisible();
    await expect(page.getByText('AUDITOR ACCESS: READ ONLY')).toBeVisible();
  });

  test('RFID_OPERATOR logs in and accesses DESFire EV2 operator station', async ({ page }) => {
    await page.goto(`${baseUrl}/login`);
    await page.locator('#login-phone').fill('9100000003');
    await page.locator('#login-password').fill('RfidOpPassword123!');
    await page.getByRole('button', { name: /Sign In/i }).click();

    await expect(page.getByText('MIFARE DESFire EV2 Operator Console')).toBeVisible();
  });

  test('Teacher navigating to super-admin dashboard receives 403 Forbidden page', async ({ page }) => {
    await page.goto(`${baseUrl}/login`);
    await page.locator('#login-phone').fill('9100000002');
    await page.locator('#login-password').fill('TeacherPassword123!');
    await page.getByRole('button', { name: /Sign In/i }).click();

    await expect(page.getByText('Offline QR Attendance')).toBeVisible();

    await page.goto(`${baseUrl}/app/super-admin`);
    await expect(page.locator('#unauthorized-403-heading')).toBeVisible();
  });
});

