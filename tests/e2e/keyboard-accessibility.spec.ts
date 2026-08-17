import { test, expect } from '@playwright/test';

const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:3100';

test.describe('Keyboard Accessibility, Tab Order & Modal Focus Traps', () => {
  test('Login page keyboard tab order and Enter activation', async ({ page }) => {
    await page.goto(`${baseUrl}/login`);
    await page.waitForLoadState('domcontentloaded');

    const phoneInput = page.locator('#login-phone');
    const passwordInput = page.locator('#login-password');
    const submitBtn = page.getByRole('button', { name: /Sign In|Log In|Login করুন|লগইন করুন/i });

    // Focus phone input via keyboard
    await phoneInput.focus();
    await expect(phoneInput).toBeFocused();

    // Type phone number via keyboard
    await page.keyboard.type('9100000002');

    // Tab to password input
    await page.keyboard.press('Tab');
    await expect(passwordInput).toBeFocused();
    await page.keyboard.type('TeacherPassword123!');

    // Tab / focus to Submit button
    await submitBtn.focus();
    await expect(submitBtn).toBeFocused();

    // Press Enter to submit
    await page.keyboard.press('Enter');

    // Verify successful login navigation to Teacher station
    await expect(page.locator('#teacher-dashboard-view')).toBeVisible();
  });

  test('School Admin Add Staff modal traps focus and dismisses on Escape with focus restoration', async ({ page }) => {
    // 1. Log in as School Admin
    await page.goto(`${baseUrl}/login`);
    await page.locator('#login-phone').fill('9100000001');
    await page.locator('#login-password').fill('SchoolAdminPassword123!');
    await page.getByRole('button', { name: /Sign In|Log In|Login করুন|লগইন করুন/i }).click();

    await expect(page.getByText(/Admin Station|School Admin|Overview/i).first()).toBeVisible();

    // 2. Navigate to User Management
    const usersNav = page.getByRole('link', { name: /Staff & Memberships|Staff Directory|Staff & Roles|Users|সদস্য/i }).or(
      page.getByRole('button', { name: /Staff|Users/i })
    ).first();
    await expect(usersNav).toBeVisible();
    await usersNav.click();

    // 3. Focus and activate Add Staff button via keyboard
    const addStaffBtn = page.getByRole('button', { name: /Add Staff|Add Member|Invite Staff|New User|নতুন Staff|নতুন কর্মী/i }).first();
    await expect(addStaffBtn).toBeVisible();
    await addStaffBtn.focus();
    await page.keyboard.press('Enter');

    // 4. Modal opens: Verify focus moves inside modal
    const modalDialog = page.locator('[role="dialog"]');
    await expect(modalDialog).toBeVisible();
    await page.waitForTimeout(300); // allow focus trap to attach

    // 5. Test Tab cycling inside modal: all tabs stay inside modal container
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Tab');
      const isInModal = await page.evaluate(() => {
        const active = document.activeElement;
        const modal = document.querySelector('[role="dialog"]');
        return modal ? modal.contains(active) : false;
      });
      expect(isInModal, `Tab ${i + 1}: focus escaped modal`).toBe(true);
    }

    // 6. Test Shift+Tab cycling backwards inside modal
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Shift+Tab');
      const isInModal = await page.evaluate(() => {
        const active = document.activeElement;
        const modal = document.querySelector('[role="dialog"]');
        return modal ? modal.contains(active) : false;
      });
      expect(isInModal, `Shift+Tab ${i + 1}: focus escaped modal`).toBe(true);
    }

    // 7. Press Escape: Modal must close and focus restores to exact trigger button
    await page.keyboard.press('Escape');
    await expect(modalDialog).not.toBeVisible();

    // Verify focus restored to the exact Add Staff trigger button
    await expect(addStaffBtn).toBeFocused();
  });

  test('Language switcher is keyboard activatable and persists language selection', async ({ page }) => {
    await page.goto(`${baseUrl}/login`);
    await page.waitForLoadState('domcontentloaded');

    const langToggle = page.getByRole('button', { name: /^বাংলা$|বাংলা \+ English|বাং \+ EN/i }).first();
    await expect(langToggle).toBeVisible();

    await langToggle.focus();
    await page.keyboard.press('Enter');

    // Verify text switches to Bengali — assert ONLY Bengali text
    await expect(page.getByRole('button', { name: /Login করুন|লগইন করুন/i })).toBeVisible();

    // Reload page and verify persistence — Bengali only
    await page.reload();
    await expect(page.getByRole('button', { name: /Login করুন|লগইন করুন/i })).toBeVisible();
  });
});
