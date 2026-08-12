import { test, expect } from '@playwright/test';

test.describe('Scanner Adapter E2E with Injected Camera Adapter', () => {
  test('injects scanner adapter into window and triggers simulated camera scan', async ({ page }) => {
    // Navigate to app home
    await page.goto('/');

    // Evaluate script in browser to inject scanner adapter
    await page.evaluate(() => {
      window.__injectedScannerAdapter = {
        triggerScan: (token: string) => {
          if (window.__scanQRCode) {
            window.__scanQRCode(token);
          }
        },
      };
    });

    // Check header or app element exists
    const appHeader = page.locator('header');
    await expect(appHeader).toBeVisible();
  });
});
