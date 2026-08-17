import { test, expect } from '@playwright/test';

const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:3100';

test.describe('RFID Reader Management E2E Suite', () => {
  test('RFID_OPERATOR views reader fleet and provisions new gate reader', async ({ page }) => {
    test.skip(process.env.FEATURE_RFID !== 'true', 'RFID feature is disabled by default in QR pilot');

    // 1. Log in as RFID_OPERATOR
    await page.goto(`${baseUrl}/login`);
    await page.locator('#login-phone').fill('9100000003');
    await page.locator('#login-password').fill('RfidOpPassword123!');
    await page.getByRole('button', { name: /Sign In|Log In/i }).click();

    await expect(page.locator('#rfid-operator-dashboard-view')).toBeVisible();

    // 2. Navigate to Readers Console
    await page.goto(`${baseUrl}/app/rfid-operator/readers`);
    await expect(page.locator('#reader-operations-view')).toBeVisible();

    // 3. Open Provision Reader Modal
    const provisionBtn = page.getByRole('button', { name: /Add Gate Box|গেট ডিভাইস যোগ করুন/i }).first();
    await expect(provisionBtn).toBeVisible();
    await provisionBtn.click();

    // 4. Fill in hardware details
    const uniqueDeviceId = `GATE-BOX-${Date.now()}`;
    const deviceIdInput = page.locator('input[placeholder*="GATE-BOX"]').first();
    await expect(deviceIdInput).toBeVisible();
    await deviceIdInput.fill(uniqueDeviceId);

    // 5. Submit registration
    const submitBtn = page.getByRole('button', { name: /Save|সংরক্ষণ করুন/i }).first();
    await expect(submitBtn).toBeVisible();
    await submitBtn.click();

    // 6. Verify reader appears in list
    await expect(page.getByText(uniqueDeviceId).first()).toBeVisible({ timeout: 10000 });
  });
});
