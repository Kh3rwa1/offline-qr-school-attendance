import { test, expect } from '@playwright/test';

const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:3100';

test.describe('Genuine Keyboard-Only Navigation, Tab Traversal & Focus Traps', () => {
  // ── 1. Login Page Keyboard Traversal ─────────────────────────────────────────
  test('1. Login page sequential Tab traversal, typing, and Enter activation', async ({ page }) => {
    await page.goto(`${baseUrl}/login`);
    await page.waitForLoadState('domcontentloaded');

    // Click body background to ensure initial state before keyboard Tab
    await page.locator('body').click({ position: { x: 1, y: 1 } });

    const phoneInput = page.locator('#login-phone');
    const passwordInput = page.locator('#login-password');
    const submitBtn = page.getByRole('button', { name: /Sign In|Log In|Login করুন|লগইন করুন/i });

    // 1. Tab into the page to reach phone input
    // In modern browsers, initial tab enters interactive controls in DOM order
    await page.keyboard.press('Tab');
    
    // If language toggle or first interactive element is focused, Tab forward until reaching phoneInput
    let maxTabs = 10;
    while (!(await phoneInput.evaluate((el) => el === document.activeElement)) && maxTabs > 0) {
      await page.keyboard.press('Tab');
      maxTabs--;
    }
    await expect(phoneInput).toBeFocused();

    // Type phone number via keyboard
    await page.keyboard.type('9100000002');

    // Tab to password input
    await page.keyboard.press('Tab');
    await expect(passwordInput).toBeFocused();
    await page.keyboard.type('TeacherPassword123!');

    // Tab to Submit button
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
    await page.waitForLoadState('domcontentloaded');

    const phoneInput = page.locator('#login-phone');
    const passwordInput = page.locator('#login-password');

    // Tab into phone and password
    await page.locator('body').click({ position: { x: 1, y: 1 } });
    let maxTabs = 10;
    while (!(await passwordInput.evaluate((el) => el === document.activeElement)) && maxTabs > 0) {
      await page.keyboard.press('Tab');
      maxTabs--;
    }
    await expect(passwordInput).toBeFocused();

    // Shift+Tab back to phone input
    await page.keyboard.press('Shift+Tab');
    await expect(phoneInput).toBeFocused();
  });

  // ── 3. Modal Focus Trap & Exact Trigger Restoration ──────────────────────────
  test('3. School Admin Add Staff modal traps focus and restores focus to exact trigger on Escape', async ({ page }) => {
    // 1. Log in as School Admin
    await page.goto(`${baseUrl}/login`);
    await page.locator('#login-phone').fill('9100000001');
    await page.locator('#login-password').fill('SchoolAdminPassword123!');
    await page.getByRole('button', { name: /Sign In|Log In|Login করুন|লগইন করুন/i }).click();

    await expect(page.locator('#school-admin-dashboard-view')).toBeVisible();

    // 2. Navigate to User Management
    await page.goto(`${baseUrl}/app/school-admin/users`);
    await expect(page.locator('#user-management-view')).toBeVisible();

    // 3. Find and focus Add Staff button via keyboard Tab
    const addStaffBtn = page.getByRole('button', { name: /Add Staff|Add Member|Invite Staff|New User|নতুন Staff|নতুন কর্মী/i }).first();
    await expect(addStaffBtn).toBeVisible();
    
    // Tab until Add Staff button is focused
    let maxTabs = 20;
    while (!(await addStaffBtn.evaluate((el) => el === document.activeElement)) && maxTabs > 0) {
      await page.keyboard.press('Tab');
      maxTabs--;
    }

    // Activate Add Staff button via Enter
    await page.keyboard.press('Enter');

    // 4. Modal opens: Verify focus moves inside modal
    const modalDialog = page.locator('[role="dialog"]');
    await expect(modalDialog).toBeVisible();
    await page.waitForTimeout(300); // allow focus trap animation to settle

    // 5. Test Tab cycling: 10 tabs all stay inside modal
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
        const active = document.activeElement;
        const modal = document.querySelector('[role="dialog"]');
        return modal ? modal.contains(active) : false;
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
    await page.waitForLoadState('domcontentloaded');

    const langToggle = page.getByRole('button', { name: /^বাংলা$|বাংলা \+ English|বাং \+ EN/i }).first();
    await expect(langToggle).toBeVisible();

    // Tab until langToggle is reached
    await page.locator('body').click({ position: { x: 1, y: 1 } });
    let maxTabs = 10;
    while (!(await langToggle.evaluate((el) => el === document.activeElement)) && maxTabs > 0) {
      await page.keyboard.press('Tab');
      maxTabs--;
    }

    // Press Enter on language toggle
    await page.keyboard.press('Enter');

    // Verify text switches to Bengali
    await expect(page.getByRole('button', { name: /Login করুন|লগইন করুন/i })).toBeVisible();

    // Reload page and verify persistence
    await page.reload();
    await expect(page.getByRole('button', { name: /Login করুন|লগইন করুন/i })).toBeVisible();
  });
});
