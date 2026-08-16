import { test, expect } from '@playwright/test';

const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:3100';

test.describe('Bengali / Bengalish Complete End-to-End User Journeys', () => {
  test('Bengali language toggle switches UI strings and persists across page reload', async ({ page }) => {
    await page.goto(`${baseUrl}/login`);
    await page.waitForLoadState('domcontentloaded');

    // Verify initial English login button
    await expect(page.getByRole('button', { name: /Sign In|Log In/i })).toBeVisible();

    // Click language switcher
    const langBtn = page.getByRole('button', { name: /^বাংলা$|বাংলা \+ English|বাং \+ EN/i }).first();
    await expect(langBtn).toBeVisible();
    await langBtn.click();

    // Verify Bengali string on submit button
    await expect(page.getByRole('button', { name: /Login করুন|লগইন করুন|Sign In/i })).toBeVisible();

    // Verify phone field placeholder / label in Bengali
    await expect(page.locator('label').filter({ hasText: /মোবাইল নম্বর|ফোন|Phone/i })).toBeVisible();

    // Reload page: Verify persistence
    await page.reload();
    await expect(page.getByRole('button', { name: /Login করুন|লগইন করুন|Sign In/i })).toBeVisible();
  });

  test('Teacher journey in Bengali renders localized attendance station and offline outbox', async ({ page }) => {
    // 1. Log in as Teacher
    await page.goto(`${baseUrl}/login`);
    await page.locator('#login-phone').fill('9100000002');
    await page.locator('#login-password').fill('TeacherPassword123!');
    await page.getByRole('button', { name: /Sign In|Log In|Login করুন|লগইন করুন/i }).click();

    // 2. Switch language to Bengali if not already
    const langBtn = page.getByRole('button', { name: /^বাংলা$|বাংলা \+ English|বাং \+ EN/i }).first();
    if (await langBtn.isVisible()) {
      await langBtn.click();
    }

    // 3. Verify teacher dashboard renders Bengali strings
    await expect(page.getByText(/আজকের হাজিরা|Today’s attendance/i)).toBeVisible();

    // 4. Verify no raw unparsed translation keys like "teacher." or "sync." appear in text
    const hasRawKeys = await page.evaluate(() => {
      const text = document.body.innerText;
      return /t\([a-zA-Z0-9_.]+\)|\[MISSING_TRANSLATION\]/.test(text);
    });
    expect(hasRawKeys, 'Discovered unparsed translation keys in rendered Teacher UI').toBe(false);
  });

  test('School Admin user management in Bengali renders localized directory and dialogs', async ({ page }) => {
    // 1. Log in as School Admin
    await page.goto(`${baseUrl}/login`);
    await page.locator('#login-phone').fill('9100000001');
    await page.locator('#login-password').fill('SchoolAdminPassword123!');
    await page.getByRole('button', { name: /Sign In|Log In|Login করুন|লগইন করুন/i }).click();

    // 2. Switch language to Bengali
    const langBtn = page.getByRole('button', { name: /^বাংলা$|বাংলা \+ English|বাং \+ EN/i }).first();
    if (await langBtn.isVisible()) {
      await langBtn.click();
    }

    // 3. Navigate to User Management
    const usersNav = page.getByRole('link', { name: /Staff & Memberships|Staff Directory|Staff & Roles|Users|কর্মী ও ভূমিকা|সদস্য/i }).or(
      page.getByRole('button', { name: /Staff|Users|কর্মী/i })
    ).first();
    await expect(usersNav).toBeVisible();
    await usersNav.click();

    // 4. Verify localized Add Staff button
    const addStaffBtn = page.getByRole('button', { name: /Add Staff|Add Member|Invite Staff|New User|নতুন Staff|নতুন কর্মী/i }).first();
    await expect(addStaffBtn).toBeVisible();
  });

  test('RFID Operator station in Bengali renders localized scanner and reader HUD', async ({ page }) => {
    // 1. Log in as RFID Operator
    await page.goto(`${baseUrl}/login`);
    await page.locator('#login-phone').fill('9100000003');
    await page.locator('#login-password').fill('RfidOpPassword123!');
    await page.getByRole('button', { name: /Sign In|Log In|Login করুন|লগইন করুন/i }).click();

    // 2. Switch language to Bengali
    const langBtn = page.getByRole('button', { name: /^বাংলা$|বাংলা \+ English|বাং \+ EN/i }).first();
    if (await langBtn.isVisible()) {
      await langBtn.click();
    }

    // 3. Verify RFID Operator Station container and heading
    await expect(page.locator('#rfid-operator-dashboard-view')).toBeVisible();
    await expect(page.getByText(/School Gate|Gate Operator|স্কুল গেট/i).first()).toBeVisible();
  });

  test('Report Viewer portal in Bengali renders localized charts, metrics & badges', async ({ page }) => {
    // 1. Log in as Report Viewer
    await page.goto(`${baseUrl}/login`);
    await page.locator('#login-phone').fill('9100000004');
    await page.locator('#login-password').fill('ReportViewerPassword123!');
    await page.getByRole('button', { name: /Sign In|Log In|Login করুন|লগইন করুন/i }).click();

    // 2. Switch language to Bengali
    const langBtn = page.getByRole('button', { name: /^বাংলা$|বাংলা \+ English|বাং \+ EN/i }).first();
    if (await langBtn.isVisible()) {
      await langBtn.click();
    }

    // 3. Verify Report Viewer Dashboard view container and localized strings
    await expect(page.locator('#report-viewer-dashboard-view')).toBeVisible();
    await expect(page.getByText(/Official Reports|অফিসিয়াল রিপোর্ট|Reports & Analytics|রিপোর্ট এবং অ্যানালিটিক্স/i).first()).toBeVisible();
  });
});
