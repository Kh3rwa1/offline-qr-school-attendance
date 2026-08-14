import { test, expect } from '@playwright/test';

const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:3100';

test.describe('RFID Reader Management E2E Suite', () => {
  test('RFID_OPERATOR views reader fleet and provisions new gate reader', async ({ page }) => {
    // 1. Log in as RFID_OPERATOR
    await page.goto(baseUrl);
    await page.getByLabel('Phone number').fill('+919100000003');
    await page.getByLabel('Password').fill('RfidOpPassword123!');
    await page.getByRole('button', { name: 'Sign in' }).click();

    // 2. Navigate to Readers Console
    await page.goto(`${baseUrl}/app/rfid-operator/readers`);
    await expect(page.getByRole('heading', { name: 'Physical Gate Readers' })).toBeVisible();

    // 3. Open Provision Reader Modal
    const provisionBtn = page.getByRole('button', { name: 'Provision New Reader' });
    if (await provisionBtn.isVisible()) {
      await provisionBtn.click();
      await expect(page.getByText('Register Gate Reader Terminal')).toBeVisible();

      // 4. Fill in hardware details
      const uniqueDeviceId = `ESP32-GATE-${Date.now()}`;
      await page.locator('input[placeholder="e.g. ESP32-GATE-01"]').fill(uniqueDeviceId);

      // 5. Submit registration
      await page.getByRole('button', { name: 'Register Reader' }).click();

      // 6. Verify reader appears in list
      await expect(page.getByText(uniqueDeviceId)).toBeVisible({ timeout: 5000 });
    }
  });
});
