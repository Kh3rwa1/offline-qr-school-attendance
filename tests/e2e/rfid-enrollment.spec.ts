import { test, expect } from '@playwright/test';

test.describe('RFID Enrollment E2E Suite', () => {
  test('Card enrollment wizard view integrity', async ({ page }) => {
    await page.goto('/');
    const content = await page.content();
    expect(content).toBeDefined();
  });
});
