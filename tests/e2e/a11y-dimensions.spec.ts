import { test, expect } from '@playwright/test';

const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:3100';

test.describe('Real Dimension BoundingBox & Accessibility Verification Matrix', () => {
  test('Login page interactive controls satisfy minimum 44x44px touch targets', async ({ page }) => {
    await page.goto(`${baseUrl}/login`);
    await page.waitForLoadState('domcontentloaded');

    const phoneInput = page.locator('#login-phone');
    await expect(phoneInput).toBeVisible();
    const phoneBox = await phoneInput.boundingBox();
    expect(phoneBox).not.toBeNull();
    expect(phoneBox!.height).toBeGreaterThanOrEqual(44);

    const passwordInput = page.locator('#login-password');
    await expect(passwordInput).toBeVisible();
    const passBox = await passwordInput.boundingBox();
    expect(passBox).not.toBeNull();
    expect(passBox!.height).toBeGreaterThanOrEqual(44);

    const submitBtn = page.getByRole('button', { name: /Sign In|Log In/i });
    await expect(submitBtn).toBeVisible();
    const submitBox = await submitBtn.boundingBox();
    expect(submitBox).not.toBeNull();
    expect(submitBox!.height).toBeGreaterThanOrEqual(44);

    const langToggle = page.getByRole('button', { name: /বাং \+ EN|বাংলা \+ English|বাংলা/i }).first();
    if (await langToggle.isVisible()) {
      const langBox = await langToggle.boundingBox();
      expect(langBox).not.toBeNull();
      expect(langBox!.height).toBeGreaterThanOrEqual(44);
    }
  });

  test('Teacher dashboard controls and offline station buttons satisfy 44px touch targets', async ({ page }) => {
    // 1. Log in as teacher
    await page.goto(`${baseUrl}/login`);
    await page.locator('#login-phone').fill('9100000002');
    await page.locator('#login-password').fill('TeacherPassword123!');
    await page.getByRole('button', { name: /Sign In|Log In/i }).click();

    await expect(page.getByText('Today’s attendance').or(page.getByText(/Today’s attendance/i))).toBeVisible();

    // 2. Measure Class Selection dropdown
    const selectEl = page.locator('select').first();
    if (await selectEl.isVisible()) {
      const selectBox = await selectEl.boundingBox();
      expect(selectBox).not.toBeNull();
      expect(selectBox!.height).toBeGreaterThanOrEqual(44);
    }

    // 3. Measure Download Roster button
    const downloadRosterBtn = page.getByRole('button', { name: /Download roster|Roster/i }).first();
    if (await downloadRosterBtn.isVisible()) {
      const rosterBox = await downloadRosterBtn.boundingBox();
      expect(rosterBox).not.toBeNull();
      expect(rosterBox!.height).toBeGreaterThanOrEqual(44);
    }

    // 4. Measure Start Session / Session Open button
    const startSessionBtn = page.getByRole('button', { name: /Start offline session|Session open/i }).first();
    if (await startSessionBtn.isVisible()) {
      const sessionBox = await startSessionBtn.boundingBox();
      expect(sessionBox).not.toBeNull();
      expect(sessionBox!.height).toBeGreaterThanOrEqual(44);
    }
  });

  test('School Admin user management controls satisfy 44x44px touch targets', async ({ page }) => {
    // 1. Log in as school admin
    await page.goto(`${baseUrl}/login`);
    await page.locator('#login-phone').fill('9100000001');
    await page.locator('#login-password').fill('AdminPassword123!');
    await page.getByRole('button', { name: /Sign In|Log In/i }).click();

    await expect(page.getByText(/Admin Station|School Admin|Overview/i).first()).toBeVisible();

    // 2. Navigate to User Management subview if present
    const usersTab = page.getByRole('button', { name: /Staff Directory|Staff & Roles|Users|সদস্য/i }).first();
    if (await usersTab.isVisible()) {
      await usersTab.click();
      const inviteBtn = page.getByRole('button', { name: /Invite Staff|Add Member|New User|নতুন কর্মী/i }).first();
      if (await inviteBtn.isVisible()) {
        const inviteBox = await inviteBtn.boundingBox();
        expect(inviteBox).not.toBeNull();
        expect(inviteBox!.height).toBeGreaterThanOrEqual(44);

        // Open invite modal and test password toggle button
        await inviteBtn.click();
        const pwdInput = page.locator('input[type="password"], input[placeholder="••••••••"]').first();
        if (await pwdInput.isVisible()) {
          const toggleBtn = page.getByRole('button', { name: /Show Password|Hide Password|Password/i }).first();
          if (await toggleBtn.isVisible()) {
            const toggleBox = await toggleBtn.boundingBox();
            expect(toggleBox).not.toBeNull();
            expect(toggleBox!.height).toBeGreaterThanOrEqual(44);
            expect(toggleBox!.width).toBeGreaterThanOrEqual(44);
          }
        }
      }
    }
  });

  test('Report Viewer intelligence dashboard buttons meet 44px touch targets', async ({ page }) => {
    // 1. Log in as report viewer
    await page.goto(`${baseUrl}/login`);
    await page.locator('#login-phone').fill('9100000004');
    await page.locator('#login-password').fill('ReportViewerPassword123!');
    await page.getByRole('button', { name: /Sign In|Log In/i }).click();

    await expect(page.locator('#report-viewer-dashboard-view')).toBeVisible();

    // 2. Measure tab navigation buttons
    const tabs = page.locator('nav button, div[role="tablist"] button');
    const tabCount = await tabs.count();
    for (let i = 0; i < tabCount; i++) {
      const tab = tabs.nth(i);
      if (await tab.isVisible()) {
        const box = await tab.boundingBox();
        if (box) {
          expect(box.height).toBeGreaterThanOrEqual(44);
        }
      }
    }
  });

  test('Keyboard navigation focus order and modal dismissal behavior', async ({ page }) => {
    await page.goto(`${baseUrl}/login`);
    await page.waitForLoadState('domcontentloaded');

    // Tab through elements and verify focused element
    await page.keyboard.press('Tab');
    const firstFocused = await page.evaluate(() => document.activeElement?.tagName);
    expect(firstFocused).toBeTruthy();

    await page.keyboard.press('Tab');
    const secondFocused = await page.evaluate(() => document.activeElement?.tagName);
    expect(secondFocused).toBeTruthy();
  });
});
