import { test, expect } from '@playwright/test';

const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:3100';

test.describe('RFID Card Enrollment E2E Suite', () => {
  test('RFID_OPERATOR searches student, selects security mode, and enrolls smartcard', async ({ page }) => {
    test.skip(process.env.FEATURE_RFID !== 'true', 'RFID feature is disabled by default in QR pilot');
    // 1. Log in as RFID_OPERATOR
    await page.goto(`${baseUrl}/login`);
    await page.locator('#login-phone').fill('9100000003');
    await page.locator('#login-password').fill('RfidOpPassword123!');
    await page.getByRole('button', { name: /Sign In/i }).click();

    await expect(page.getByText('MIFARE DESFire EV2 Operator Console')).toBeVisible();

    // 2. Navigate to Card Personalization & Enrollment
    await page.goto(`${baseUrl}/app/rfid-operator/enrollment`);
    await expect(page.getByRole('heading', { name: 'Card Personalization & Key Injection' })).toBeVisible();

    // 3. Search for student in registry
    const searchInput = page.getByPlaceholder('Type student name or roll number');
    await searchInput.fill('Rahul');
    await page.waitForTimeout(500);

    // If students are present, select first student
    const studentButton = page.locator('button:has-text("Rahul")').first();
    if (await studentButton.isVisible()) {
      await studentButton.click();
      await page.getByRole('button', { name: 'Next: Security Mode' }).click();

      // 4. Select SECURE mode
      await expect(page.getByText('2. Select Smartcard Cryptographic Standard')).toBeVisible();
      await page.getByRole('button', { name: 'SECURE (AES-CMAC)' }).click();
      await page.getByRole('button', { name: 'Next: Read Card' }).click();

      // 5. Input card digest
      await expect(page.getByText('3. Transceive Card Digest')).toBeVisible();
      const digestInput = page.locator('input[placeholder="e.g. 7F3A9C8E4D2B1A0F"]');
      const testDigest = `TEST_CARD_${Date.now()}`;
      await digestInput.fill(testDigest);

      // 6. Submit Enrollment
      await page.getByRole('button', { name: 'Enroll Smartcard' }).click();

      // 7. Verify Success
      await expect(page.getByText('Card Enrolled Successfully!')).toBeVisible({ timeout: 5000 });
    }
  });
});
