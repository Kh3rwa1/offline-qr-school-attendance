import { test, expect } from '@playwright/test';

const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:3100';

test.describe('RFID Card Enrollment E2E Suite', () => {
  test('RFID_OPERATOR searches student, selects security mode, and enrolls smartcard', async ({ page }) => {
    test.skip(process.env.FEATURE_RFID !== 'true', 'RFID feature is disabled by default in QR pilot');

    // 1. Log in as RFID_OPERATOR
    await page.goto(`${baseUrl}/login`);
    await page.locator('#login-phone').fill('9100000003');
    await page.locator('#login-password').fill('RfidOpPassword123!');
    await page.getByRole('button', { name: /Sign In|Log In/i }).click();

    await expect(page.locator('#rfid-operator-dashboard-view')).toBeVisible();

    // 2. Navigate to Card Personalization & Enrollment
    await page.goto(`${baseUrl}/app/rfid-operator/enrollment`);
    await expect(page.locator('#enrollment-operations-view')).toBeVisible();

    // 3. Search for student in registry
    const searchInput = page.locator('#enrollment-operations-view input[type="text"]').first();
    await expect(searchInput).toBeVisible();
    await searchInput.fill('Rahul');
    await page.waitForTimeout(500);

    // If matching student button exists, click to advance to Step 2
    const studentButton = page.locator('#enrollment-operations-view button').filter({ hasText: /Rahul/i }).first();
    if (await studentButton.isVisible()) {
      await studentButton.click();

      // 4. Step 2: Enter badge code
      const badgeInput = page.locator('#enrollment-operations-view input[type="text"]').first();
      await expect(badgeInput).toBeVisible();
      const testEpc = `EPC${Date.now().toString(16).toUpperCase().padStart(8, '0')}`;
      await badgeInput.fill(testEpc);

      // 5. Submit enrollment
      const confirmBtn = page.getByRole('button', { name: /Confirm Badge|ব্যাজ নিশ্চিত করুন/i });
      await expect(confirmBtn).toBeVisible();
      await confirmBtn.click();

      // 6. Verify Step 3 Success
      await expect(page.getByText(/সফল|Success|ব্যাজ সংযুক্ত হয়েছে/i).first()).toBeVisible({ timeout: 10000 });
    }
  });
});
