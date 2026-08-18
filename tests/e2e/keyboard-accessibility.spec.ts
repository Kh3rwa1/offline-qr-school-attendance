import { test, expect } from '@playwright/test';

const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:3100';

test.describe('Genuine Keyboard-Only Navigation, Tab Traversal & Focus Traps (Zero Programmatic Focus)', () => {
  // ── 1. Login Page Keyboard Traversal ─────────────────────────────────────────
  test('1. Login page sequential Tab traversal, typing, and Enter activation', async ({ page }) => {
    await page.goto(`${baseUrl}/login`);
    await page.evaluate(() => {
      localStorage.setItem('attendease.language', 'en');
      localStorage.setItem('app_language', 'en');
    });
    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    const phoneInput = page.locator('#login-phone');
    const passwordInput = page.locator('#login-password');
    const submitBtn = page.getByRole('button', { name: 'Sign In' });

    // Natural sequential Tab traversal from top of page — zero programmatic .focus()
    // Tab 1: Bengali language toggle button
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'বাংলা' })).toBeFocused();

    // Tab 2: Hindi language toggle button
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'हिन्दी' })).toBeFocused();

    // Tab 3: English language toggle button
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'English' })).toBeFocused();

    // Tab 4: Phone number input
    await page.keyboard.press('Tab');
    await expect(phoneInput).toBeFocused();

    // Type phone number via keyboard
    await page.keyboard.type('9100000002');

    // Tab 5: Password input
    await page.keyboard.press('Tab');
    await expect(passwordInput).toBeFocused();

    // Type password via keyboard
    await page.keyboard.type('TeacherPassword123!');

    // Tab 6: Remember me checkbox
    await page.keyboard.press('Tab');
    await expect(page.getByRole('checkbox')).toBeFocused();

    // Tab 7: Forgot password button
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: /forgot password/i })).toBeFocused();

    // Tab 8: Submit button
    await page.keyboard.press('Tab');
    await expect(submitBtn).toBeFocused();

    // Press Enter to submit
    await page.keyboard.press('Enter');

    // Verify successful login navigation to Teacher station
    await expect(page.locator('#teacher-dashboard-view')).toBeVisible();
  });

  // ── 2. Reverse Shift+Tab Navigation ──────────────────────────────────────────
  test('2. Shift+Tab reverse navigation moves focus backwards through form', async ({ page }) => {
    await page.goto(`${baseUrl}/login`);
    await page.evaluate(() => {
      localStorage.setItem('attendease.language', 'en');
      localStorage.setItem('app_language', 'en');
    });
    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    const phoneInput = page.locator('#login-phone');
    const passwordInput = page.locator('#login-password');

    // Tab forward 5 times to reach Password input
    await page.keyboard.press('Tab'); // 1: বাংলা
    await page.keyboard.press('Tab'); // 2: हिन्दी
    await page.keyboard.press('Tab'); // 3: English
    await page.keyboard.press('Tab'); // 4: Phone
    await page.keyboard.press('Tab'); // 5: Password
    await expect(passwordInput).toBeFocused();

    // Shift+Tab back to Phone input
    await page.keyboard.press('Shift+Tab');
    await expect(phoneInput).toBeFocused();

    // Shift+Tab back to English button
    await page.keyboard.press('Shift+Tab');
    await expect(page.getByRole('button', { name: 'English' })).toBeFocused();

    // Shift+Tab back to Hindi button
    await page.keyboard.press('Shift+Tab');
    await expect(page.getByRole('button', { name: 'हिन्दी' })).toBeFocused();

    // Shift+Tab back to Bengali button
    await page.keyboard.press('Shift+Tab');
    await expect(page.getByRole('button', { name: 'বাংলা' })).toBeFocused();
  });

  // ── 3. Modal Focus Trap & Exact Trigger Restoration ──────────────────────────
  test('3. School Admin Add Staff modal traps focus and restores focus to exact trigger on Escape', async ({ page }) => {
    // 1. Log in as School Admin
    await page.goto(`${baseUrl}/login`);
    await page.locator('#login-phone').fill('9100000001');
    await page.locator('#login-password').fill('SchoolAdminPassword123!');
    await page.getByRole('button', { name: /Sign In|Login করুন/i }).click();

    await expect(page.locator('#school-admin-dashboard-view')).toBeVisible();

    // 2. Navigate to User Management
    await page.goto(`${baseUrl}/app/school-admin/users`);
    await expect(page.locator('#user-management-view')).toBeVisible();

    const addStaffBtn = page.getByRole('button', { name: /Add Staff|নতুন Staff/i }).first();
    await expect(addStaffBtn).toBeVisible();

    // Natural Tab traversal from document top to reach Add Staff button
    let maxTabs = 35;
    while (maxTabs > 0) {
      await page.keyboard.press('Tab');
      const isFocused = await addStaffBtn.evaluate((el) => el === document.activeElement);
      if (isFocused) break;
      maxTabs--;
    }
    await expect(addStaffBtn).toBeFocused();

    // Activate Add Staff button via Enter key
    await page.keyboard.press('Enter');

    // 4. Modal opens: Verify focus moves inside modal automatically
    const modalDialog = page.locator('[role="dialog"]');
    await expect(modalDialog).toBeVisible();
    await page.waitForTimeout(300); // allow focus trap animation to settle

    const initialFocusedInModal = await page.evaluate(() => {
      const active = document.activeElement;
      const modal = document.querySelector('[role="dialog"]');
      return modal ? modal.contains(active) : false;
    });
    expect(initialFocusedInModal, 'Initial focus did not enter modal').toBe(true);

    // 5. Test Tab cycling: 10 sequential tabs all stay inside modal
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Tab');
      const isInModal = await page.evaluate(() => {
        const active = document.activeElement;
        const modal = document.querySelector('[role="dialog"]');
        return modal ? modal.contains(active) : false;
      });
      expect(isInModal, `Tab ${i + 1}: focus escaped modal`).toBe(true);
    }

    // 6. Test Shift+Tab cycling backwards: all stay inside modal
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Shift+Tab');
      const isInModal = await page.evaluate(() => {
        const active = document.querySelector('[role="dialog"]')?.contains(document.activeElement) ?? false;
        return active;
      });
      expect(isInModal, `Shift+Tab ${i + 1}: focus escaped modal`).toBe(true);
    }

    // 7. Press Escape: Modal dismisses and focus restores to exact Add Staff trigger button
    await page.keyboard.press('Escape');
    await expect(modalDialog).not.toBeVisible();

    // Verify focus restored to the exact Add Staff trigger button
    await expect(addStaffBtn).toBeFocused();
  });

  // ── 4. Language Switcher Keyboard Activation & Persistence ──────────────────
  test('4. Language switcher is keyboard activatable and persists language selection', async ({ page }) => {
    await page.goto(`${baseUrl}/login`);
    await page.evaluate(() => {
      localStorage.setItem('attendease.language', 'en');
      localStorage.setItem('app_language', 'en');
    });
    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    // Tab 1 from page top focuses Bengali button
    await page.keyboard.press('Tab');
    const bnBtn = page.getByRole('button', { name: 'বাংলা' });
    await expect(bnBtn).toBeFocused();

    // Press Enter to activate Bengali
    await page.keyboard.press('Enter');

    // Verify text switches to Bengali
    await expect(page.getByRole('button', { name: 'Login করুন' })).toBeVisible();

    // Reload page and verify persistence
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('button', { name: 'Login করুন' })).toBeVisible();
  });
});
