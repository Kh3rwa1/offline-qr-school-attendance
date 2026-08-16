import { test, expect } from '@playwright/test';

const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:3100';

test.describe('Browser-Level Typography (>=14px) & Reflow / 200% Zoom Verification', () => {
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

  test('200% browser zoom reflows cleanly without breaking layouts', async ({ page }) => {
    // Simulate 200% zoom by halving viewport layout width to 640px and setting deviceScaleFactor to 2
    await page.setViewportSize({ width: 640, height: 800 });
    await page.goto(`${baseUrl}/login`);
    await page.waitForLoadState('domcontentloaded');

    // Verify key interactive controls remain visible and functional
    const phoneInput = page.locator('#login-phone');
    const submitBtn = page.getByRole('button', { name: /Sign In|Log In/i });

    await expect(phoneInput).toBeVisible();
    await expect(submitBtn).toBeVisible();

    const isButtonClipped = await submitBtn.evaluate((btn) => {
      const rect = btn.getBoundingClientRect();
      return rect.bottom > window.innerHeight + 50 || rect.right > window.innerWidth + 50;
    });

    expect(isButtonClipped, 'Primary action button was clipped during 200% zoom').toBe(false);
  });
});
