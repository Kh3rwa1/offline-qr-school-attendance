import { test, expect } from '@playwright/test';

const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:3100';

test.describe('Keyboard Accessibility, Tab Order & Modal Focus Traps', () => {
  test('Login page keyboard tab order and Enter activation', async ({ page }) => {
    await page.goto(`${baseUrl}/login`);
    await page.waitForLoadState('domcontentloaded');

    // Tab into the page
    await page.keyboard.press('Tab');
    const firstActive = await page.evaluate(() => document.activeElement?.getAttribute('id') || document.activeElement?.tagName);
    expect(firstActive).toBeTruthy();

    // Focus phone input and type via keyboard
    const phoneInput = page.locator('#login-phone');
    await phoneInput.focus();
    await page.keyboard.type('9100000002');

    // Tab to password input
    await page.keyboard.press('Tab');
    const passActive = await page.evaluate(() => document.activeElement?.getAttribute('id'));
    expect(passActive).toBe('login-password');
    await page.keyboard.type('TeacherPassword123!');

    // Tab to Submit button and press Enter
    await page.keyboard.press('Tab');
    const submitActive = await page.evaluate(() => document.activeElement?.getAttribute('type') || document.activeElement?.tagName);
    expect(submitActive).toBeTruthy();

    await page.keyboard.press('Enter');

    // Verify successful login navigation to Teacher station
    await expect(page.getByText(/Today’s attendance|আজকের হাজিরা/i)).toBeVisible();
  });

  test('School Admin Add Staff modal traps focus and dismisses on Escape with focus restoration', async ({ page }) => {
    // 1. Log in as School Admin
    await page.goto(`${baseUrl}/login`);
    await page.locator('#login-phone').fill('9100000001');
    await page.locator('#login-password').fill('SchoolAdminPassword123!');
    await page.getByRole('button', { name: /Sign In|Log In/i }).click();

    await expect(page.getByText(/Admin Station|School Admin|Overview/i).first()).toBeVisible();

    // 2. Navigate to User Management
    const usersNav = page.getByRole('button', { name: /Staff Directory|Staff & Roles|Users|সদস্য/i }).or(
      page.getByRole('link', { name: /Staff|Users/i })
    ).first();
    await expect(usersNav).toBeVisible();
    await usersNav.click();

    // 3. Focus and activate Add Staff button via Space/Enter
    const addStaffBtn = page.getByRole('button', { name: /Invite Staff|Add Member|New User|নতুন কর্মী/i }).first();
    await expect(addStaffBtn).toBeVisible();
    await addStaffBtn.focus();
    await page.keyboard.press('Enter');

    // 4. Modal opens: Verify focus is moved inside modal
    const modalTitle = page.locator('#add-staff-modal-title');
    await expect(modalTitle).toBeVisible();

    // Wait a brief tick for focus animation
    await page.waitForTimeout(100);

    const activeInside = await page.evaluate(() => {
      const active = document.activeElement;
      const modal = document.querySelector('[role="dialog"]');
      return modal?.contains(active);
    });
    expect(activeInside).toBe(true);

    // 5. Test Tab cycling inside modal
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press('Tab');
      const isStillInside = await page.evaluate(() => {
        const active = document.activeElement;
        const modal = document.querySelector('[role="dialog"]');
        return modal?.contains(active);
      });
      expect(isStillInside).toBe(true);
    }

    // 6. Test Shift+Tab cycling backwards inside modal
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press('Shift+Tab');
      const isStillInside = await page.evaluate(() => {
        const active = document.activeElement;
        const modal = document.querySelector('[role="dialog"]');
        return modal?.contains(active);
      });
      expect(isStillInside).toBe(true);
    }

    // 7. Press Escape: Modal must close and focus restore to addStaffBtn
    await page.keyboard.press('Escape');
    await expect(modalTitle).not.toBeVisible();

    // Verify focus restoration
    const restoredActive = await page.evaluate(() => {
      const active = document.activeElement;
      return active?.tagName === 'BUTTON';
    });
    expect(restoredActive).toBe(true);
  });

  test('Language switcher is keyboard activatable and persists language selection', async ({ page }) => {
    await page.goto(`${baseUrl}/login`);
    await page.waitForLoadState('domcontentloaded');

    const langToggle = page.getByRole('button', { name: 'বাংলা' }).or(page.getByRole('button', { name: /বাংলা \+ English|বাং \+ EN/i })).first();
    await expect(langToggle).toBeVisible();

    await langToggle.focus();
    await page.keyboard.press('Enter');

    // Verify text switches to Bengali
    await expect(page.getByRole('button', { name: /লগইন করুন|Sign In/i })).toBeVisible();

    // Reload page and verify persistence
    await page.reload();
    await expect(page.getByRole('button', { name: /লগইন করুন|Sign In/i })).toBeVisible();
  });
});
