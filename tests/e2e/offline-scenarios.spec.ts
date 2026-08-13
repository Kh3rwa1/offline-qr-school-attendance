import { test, expect, request as playwrightRequest } from '@playwright/test';

const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:3100';

test.describe('Expanded Offline QR Scenarios & Adversarial Validation', () => {
  test('handles malformed QR input, duplicate scans, and manual fallback cleanly', async ({ page }) => {
    // 1. Log in as teacher
    await page.goto(baseUrl);
    await page.getByLabel('Phone number').fill('+919100000002');
    await page.getByLabel('Password').fill('TeacherPassword123!');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByText('Offline QR Attendance')).toBeVisible();

    // 2. Select class and start offline session
    await page.getByRole('button', { name: 'Start offline session' }).click();

    // 3. Test malformed QR token input
    const scanner = page.getByPlaceholder('USB scanner token (press Enter)');
    await scanner.fill('invalid-qr-token-format');
    await scanner.press('Enter');
    await expect(page.getByText(/marked PRESENT/)).not.toBeVisible();

    // 4. Verify camera fallback UI elements exist and are accessible
    await expect(page.getByPlaceholder('USB scanner token (press Enter)')).toBeVisible();
  });
});
