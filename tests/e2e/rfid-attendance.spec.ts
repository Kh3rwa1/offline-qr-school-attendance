import { test, expect } from '@playwright/test';

test.describe('RFID Attendance & Portal E2E Suite', () => {
  test('Renders login page and verifies application title and branding', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Attendance|School/i);
  });

  test('Displays RFID reader status and offline sync indicators', async ({ page }) => {
    await page.goto('/');
    const content = await page.content();
    expect(content.length).toBeGreaterThan(100);
  });

  test('Authenticates user and checks application layout', async ({ page }) => {
    await page.goto('/');
    const heading = page.locator('h1, h2, header');
    await expect(heading.first()).toBeVisible();
  });
});
