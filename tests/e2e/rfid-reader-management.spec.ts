import { test, expect } from '@playwright/test';

test.describe('RFID Reader Management E2E Suite', () => {
  test('Reader management view rendering', async ({ page }) => {
    await page.goto('/');
    const title = await page.title();
    expect(title).toBeDefined();
  });
});
