import { test, expect, type Browser } from '@playwright/test';

const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:3100';

test.describe('Browser-Level Typography (>=14px) & Reflow / Zoom Verification', () => {
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

      // Verify that major interactive labels and headings are >= 14px
      const smallText = fontSizes.filter((item) => item.fontSize < 13.5); // Allow minor subpixel rounding
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

  test('200% browser zoom reflows cleanly without breaking layouts', async ({ browser }) => {
    // Create a genuine 200% zoom context with deviceScaleFactor: 2
    // WCAG 1.4.10: 1280px desktop at 200% zoom = 640px layout viewport
    const context = await browser.newContext({
      viewport: { width: 640, height: 800 },
      deviceScaleFactor: 2,
    });
    const page = await context.newPage();

    await page.goto(`${baseUrl}/login`);
    await page.waitForLoadState('domcontentloaded');

    // Verify key interactive controls remain visible and functional
    const phoneInput = page.locator('#login-phone');
    const submitBtn = page.getByRole('button', { name: /Sign In|Log In|Login করুন|লগইন করুন/i });

    await expect(phoneInput).toBeVisible();
    await expect(submitBtn).toBeVisible();

    await submitBtn.scrollIntoViewIfNeeded();
    await expect(submitBtn).toBeInViewport();

    // Check no horizontal overflow at 200% zoom
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth + 2;
    });
    expect(hasHorizontalScroll, 'Horizontal overflow detected under 200% zoom').toBe(false);

    // Verify typography remains >= 14px at 200% zoom
    const fontSizes = await page.evaluate(() => {
      const textNodes = Array.from(
        document.querySelectorAll('button, p, label, input, h1, h2, h3, span')
      ).filter((el) => (el as HTMLElement).innerText && (el as HTMLElement).innerText.trim().length > 0);
      return textNodes.map((el) => ({
        tag: el.tagName.toLowerCase(),
        text: (el as HTMLElement).innerText.slice(0, 30),
        fontSize: parseFloat(window.getComputedStyle(el).fontSize),
      }));
    });
    expect(fontSizes.length).toBeGreaterThan(0);
    const smallText = fontSizes.filter((item) => item.fontSize < 13.5);
    expect(smallText, `Text < 14px at 200% zoom: ${JSON.stringify(smallText)}`).toHaveLength(0);

    await context.close();
  });

  test('400% browser zoom reflows to single column without horizontal scroll (WCAG 1.4.10)', async ({ browser }) => {
    // WCAG 1.4.10: 1280px desktop at 400% zoom = 320px layout viewport
    const context = await browser.newContext({
      viewport: { width: 320, height: 568 },
      deviceScaleFactor: 4,
    });
    const page = await context.newPage();

    await page.goto(`${baseUrl}/login`);
    await page.waitForLoadState('domcontentloaded');

    // Verify key interactive controls remain visible
    const phoneInput = page.locator('#login-phone');
    const submitBtn = page.getByRole('button', { name: /Sign In|Log In|Login করুন|লগইন করুন/i });

    await expect(phoneInput).toBeVisible();
    await expect(submitBtn).toBeVisible();

    // No horizontal overflow at 400% zoom
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth + 2;
    });
    expect(hasHorizontalScroll, 'Horizontal overflow detected under 400% zoom (WCAG 1.4.10)').toBe(false);

    // Typography >= 14px at 400% zoom
    const fontSizes = await page.evaluate(() => {
      const textNodes = Array.from(
        document.querySelectorAll('button, p, label, input, h1, h2, h3, span')
      ).filter((el) => (el as HTMLElement).innerText && (el as HTMLElement).innerText.trim().length > 0);
      return textNodes.map((el) => ({
        tag: el.tagName.toLowerCase(),
        text: (el as HTMLElement).innerText.slice(0, 30),
        fontSize: parseFloat(window.getComputedStyle(el).fontSize),
      }));
    });
    expect(fontSizes.length).toBeGreaterThan(0);
    const smallText = fontSizes.filter((item) => item.fontSize < 13.5);
    expect(smallText, `Text < 14px at 400% zoom: ${JSON.stringify(smallText)}`).toHaveLength(0);

    // Verify content reflows — page width should not exceed viewport
    const pageWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(pageWidth).toBeLessThanOrEqual(322); // 320 + 2px tolerance

    await context.close();
  });
});
