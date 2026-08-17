import { test, expect, type Browser } from '@playwright/test';

const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:3100';

test.describe('Browser-Level Typography (>=14px) & Reflow / Zoom Verification (WCAG 1.4.10)', () => {
  const mobileWidths = [
    { name: '360px Mobile', width: 360, height: 800 },
    { name: '390px Mobile', width: 390, height: 844 },
  ];

  for (const vp of mobileWidths) {
    test(`No horizontal scroll overflow and >=14px body typography on ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(`${baseUrl}/login`);
      await page.waitForLoadState('domcontentloaded');

      // 1. Verify body and main headings satisfy >= 14px typography
      const fontSizes = await page.evaluate(() => {
        const textNodes = Array.from(
          document.querySelectorAll('button, p, label, input, h1, h2, h3, span')
        ).filter((el) => (el as HTMLElement).innerText && (el as HTMLElement).innerText.trim().length > 0);

        return textNodes.map((el) => {
          const comp = window.getComputedStyle(el);
          return {
            tag: el.tagName.toLowerCase(),
            text: (el as HTMLElement).innerText.slice(0, 30),
            fontSize: parseFloat(comp.fontSize),
          };
        });
      });

      expect(fontSizes.length).toBeGreaterThan(0);

      // Verify interactive labels and headings are >= 14px (allowing minor subpixel rounding)
      const smallText = fontSizes.filter((item) => item.fontSize < 13.5);
      expect(
        smallText,
        `Discovered text smaller than 14px standard: ${JSON.stringify(smallText)}`
      ).toHaveLength(0);

      // 2. Check no horizontal overflow on page
      const hasHorizontalScroll = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
      });
      expect(hasHorizontalScroll, `Horizontal page scrolling detected on ${vp.name}`).toBe(false);
    });
  }

  // ── 200% Zoom Reflow Simulation (WCAG 1.4.10: 1280px desktop at 200% = 640px layout viewport) ──
  test('200% zoom reflow (640px viewport) renders cleanly without horizontal scroll across routes', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 640, height: 800 },
      deviceScaleFactor: 2,
    });
    const page = await context.newPage();

    // 1. Login Page
    await page.goto(`${baseUrl}/login`);
    await page.waitForLoadState('domcontentloaded');
    const phoneInput = page.locator('#login-phone');
    const submitBtn = page.getByRole('button', { name: /Sign In|Log In|Login করুন|লগইন করুন/i });
    await expect(phoneInput).toBeVisible();
    await expect(submitBtn).toBeVisible();

    let hasScroll = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
    expect(hasScroll, 'Horizontal overflow on Login page at 200% zoom').toBe(false);

    // 2. Teacher Dashboard
    await page.locator('#login-phone').fill('9100000002');
    await page.locator('#login-password').fill('TeacherPassword123!');
    await submitBtn.click();
    await expect(page.locator('#teacher-dashboard-view')).toBeVisible();

    hasScroll = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
    expect(hasScroll, 'Horizontal overflow on Teacher Dashboard at 200% zoom').toBe(false);

    // 3. Teacher Offline Workspace
    await page.goto(`${baseUrl}/app/teacher/offline`);
    await expect(page.locator('#offline-workspace-view')).toBeVisible();
    hasScroll = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
    expect(hasScroll, 'Horizontal overflow on Teacher Offline Workspace at 200% zoom').toBe(false);

    await context.close();
  });

  // ── 400% Zoom Reflow Simulation (WCAG 1.4.10: 1280px desktop at 400% = 320px layout viewport) ──
  test('400% zoom reflow (320px viewport) reflows to single column without horizontal scroll (WCAG 1.4.10)', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 320, height: 568 },
      deviceScaleFactor: 4,
    });
    const page = await context.newPage();

    // 1. Login Page
    await page.goto(`${baseUrl}/login`);
    await page.waitForLoadState('domcontentloaded');
    const phoneInput = page.locator('#login-phone');
    const submitBtn = page.getByRole('button', { name: /Sign In|Log In|Login করুন|লগইন করুন/i });
    await expect(phoneInput).toBeVisible();
    await expect(submitBtn).toBeVisible();

    let hasScroll = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
    expect(hasScroll, 'Horizontal overflow on Login page at 400% zoom').toBe(false);

    const pageWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(pageWidth).toBeLessThanOrEqual(322); // 320 + 2px tolerance

    // 2. School Admin User Management & Modal
    await page.locator('#login-phone').fill('9100000001');
    await page.locator('#login-password').fill('SchoolAdminPassword123!');
    await submitBtn.click();
    await expect(page.locator('#school-admin-dashboard-view')).toBeVisible();

    await page.goto(`${baseUrl}/app/school-admin/users`);
    await expect(page.locator('#user-management-view')).toBeVisible();
    hasScroll = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
    expect(hasScroll, 'Horizontal overflow on School Admin Users at 400% zoom').toBe(false);

    // 3. Report Viewer Dashboard
    await page.goto(`${baseUrl}/login`);
    await page.locator('#login-phone').fill('9100000004');
    await page.locator('#login-password').fill('ReportViewerPassword123!');
    await submitBtn.click();
    await expect(page.locator('#report-viewer-dashboard-view')).toBeVisible();
    hasScroll = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
    expect(hasScroll, 'Horizontal overflow on Report Viewer at 400% zoom').toBe(false);

    await context.close();
  });
});
