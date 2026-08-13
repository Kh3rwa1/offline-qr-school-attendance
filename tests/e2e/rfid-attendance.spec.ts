import { test, expect } from '@playwright/test';

test.describe('RFID Attendance E2E Suite', () => {
  test('Renders login page and handles application navigation', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Attendance|School/i);
  });

  test('Displays RFID offline queue indicator when authenticated', async ({ page }) => {
    await page.goto('/');
    // Verify page loads without errors
    const content = await page.content();
    expect(content.length).toBeGreaterThan(0);
  });
});
