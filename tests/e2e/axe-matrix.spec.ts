import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:3100';

test.describe('Axe Automated WCAG 2.1/2.2 AA Accessibility Matrix', () => {
  test('Login Page passes Axe scan in English and Bengali', async ({ page }) => {
    // English
    await page.goto(`${baseUrl}/login`);
    await page.waitForLoadState('domcontentloaded');

    const enResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    const enViolations = enResults.violations.filter((v) =>
      ['critical', 'serious'].includes(v.impact || '')
    );
    expect(enViolations, `Axe violations on English Login page: ${JSON.stringify(enViolations, null, 2)}`).toEqual([]);

    // Bengali
    const langToggle = page.getByRole('button', { name: 'বাংলা' }).or(page.getByRole('button', { name: /বাংলা \+ English|বাং \+ EN/i })).first();
    if (await langToggle.isVisible()) {
      await langToggle.click();
      await page.waitForTimeout(100);

      const bnResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

      const bnViolations = bnResults.violations.filter((v) =>
        ['critical', 'serious'].includes(v.impact || '')
      );
      expect(bnViolations, `Axe violations on Bengali Login page: ${JSON.stringify(bnViolations, null, 2)}`).toEqual([]);
    }
  });

  test('Teacher Dashboard & Offline Workspace pass Axe scan', async ({ page }) => {
    await page.goto(`${baseUrl}/login`);
    await page.locator('#login-phone').fill('9100000002');
    await page.locator('#login-password').fill('TeacherPassword123!');
    await page.getByRole('button', { name: /Sign In|Log In/i }).click();

    await expect(page.getByText(/Today’s attendance|আজকের হাজিরা/i)).toBeVisible();

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    const violations = results.violations.filter((v) =>
      ['critical', 'serious'].includes(v.impact || '')
    );
    expect(violations, `Axe violations on Teacher Dashboard: ${JSON.stringify(violations, null, 2)}`).toEqual([]);
  });

  test('School Admin User Management & Modals pass Axe scan', async ({ page }) => {
    await page.goto(`${baseUrl}/login`);
    await page.locator('#login-phone').fill('9100000001');
    await page.locator('#login-password').fill('SchoolAdminPassword123!');
    await page.getByRole('button', { name: /Sign In|Log In/i }).click();

    await expect(page.getByText(/Admin Station|School Admin|Overview/i).first()).toBeVisible();

    // Navigate to User Management
    const usersNav = page.getByRole('button', { name: /Staff Directory|Staff & Roles|Users|সদস্য/i }).or(
      page.getByRole('link', { name: /Staff|Users/i })
    ).first();
    await usersNav.click();

    await expect(page.getByRole('button', { name: /Invite Staff|Add Member|New User|নতুন কর্মী/i }).first()).toBeVisible();

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    const violations = results.violations.filter((v) =>
      ['critical', 'serious'].includes(v.impact || '')
    );
    expect(violations, `Axe violations on School Admin User Management: ${JSON.stringify(violations, null, 2)}`).toEqual([]);
  });

  test('RFID Operator Station passes Axe scan', async ({ page }) => {
    await page.goto(`${baseUrl}/login`);
    await page.locator('#login-phone').fill('9100000003');
    await page.locator('#login-password').fill('RfidOpPassword123!');
    await page.getByRole('button', { name: /Sign In|Log In/i }).click();

    await expect(page.getByText(/Gate Operator Station|Operator Station|RFID Operator/i).first()).toBeVisible();

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    const violations = results.violations.filter((v) =>
      ['critical', 'serious'].includes(v.impact || '')
    );
    expect(violations, `Axe violations on RFID Operator Station: ${JSON.stringify(violations, null, 2)}`).toEqual([]);
  });

  test('Report Viewer Dashboard passes Axe scan', async ({ page }) => {
    await page.goto(`${baseUrl}/login`);
    await page.locator('#login-phone').fill('9100000004');
    await page.locator('#login-password').fill('ReportViewerPassword123!');
    await page.getByRole('button', { name: /Sign In|Log In/i }).click();

    await expect(page.locator('#report-viewer-dashboard-view')).toBeVisible();

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    const violations = results.violations.filter((v) =>
      ['critical', 'serious'].includes(v.impact || '')
    );
    expect(violations, `Axe violations on Report Viewer Dashboard: ${JSON.stringify(violations, null, 2)}`).toEqual([]);
  });
});
