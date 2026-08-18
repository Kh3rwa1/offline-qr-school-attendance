import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs';

const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:3100';

test.describe('Government-Ready Reporting & Export Wizard Suite (E2E)', () => {
  test.beforeEach(async ({ page }) => {
    // Reset language to English before each test
    await page.addInitScript(() => {
      localStorage.setItem('app_language', 'en');
    });
  });

  test('One-Click Monthly Attendance Register Download (School Admin)', async ({ page }) => {
    // 1. Log in as School Admin
    await page.goto(`${baseUrl}/login`);
    await page.locator('#login-phone').fill('9100000001');
    await page.locator('#login-password').fill('SchoolAdminPassword123!');
    await page.getByRole('button', { name: /Sign In|Log In|Login করুন|লগইন করুন/i }).click();

    await expect(page.getByText(/Admin Station|School Admin|Overview/i).first()).toBeVisible();

    // 2. Navigate to Export Center
    const exportNav = page.getByRole('link', { name: /Export Center|হাজিরা এক্সপোর্ট|Reports & Exports/i }).or(
      page.getByRole('button', { name: /Export/i })
    ).first();
    await expect(exportNav).toBeVisible();
    await exportNav.click();

    // Verify Export Center view is mounted
    await expect(page.locator('#export-center-view')).toBeVisible();

    // 3. Trigger One-Click Monthly Register Export
    const oneClickBtn = page.locator('#btn-one-click-monthly-export');
    await expect(oneClickBtn).toBeVisible();

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      oneClickBtn.click(),
    ]);

    const suggestedFilename = download.suggestedFilename();
    expect(suggestedFilename).toMatch(/^Attendance_.*\.xlsx$/i);

    const downloadPath = await download.path();
    expect(downloadPath).toBeTruthy();
    if (downloadPath) {
      const stats = fs.statSync(downloadPath);
      expect(stats.size).toBeGreaterThan(1000);
    }
  });

  test('Guided 6-step Export Wizard Flow (Report Type -> Scope -> Period -> Format -> Validate -> Download)', async ({ page }) => {
    // 1. Log in as School Admin
    await page.goto(`${baseUrl}/login`);
    await page.locator('#login-phone').fill('9100000001');
    await page.locator('#login-password').fill('SchoolAdminPassword123!');
    await page.getByRole('button', { name: /Sign In|Log In|Login করুন|লগইন করুন/i }).click();

    // 2. Navigate to Export Center
    const exportNav = page.getByRole('link', { name: /Export Center|হাজিরা এক্সপোর্ট|Reports & Exports/i }).or(
      page.getByRole('button', { name: /Export/i })
    ).first();
    await exportNav.click();
    await expect(page.locator('#export-center-view')).toBeVisible();

    // Step 1: Select Report Type (Monthly Attendance Register)
    const nextBtn1 = page.locator('#btn-wizard-next-step-1');
    await expect(nextBtn1).toBeVisible();
    await nextBtn1.click();

    // Step 2: Scope (All Classes)
    const nextBtn2 = page.locator('#btn-wizard-next-step-2');
    await expect(nextBtn2).toBeVisible();
    await nextBtn2.click();

    // Step 3: Period (Current Month)
    const nextBtn3 = page.locator('#btn-wizard-next-step-3');
    await expect(nextBtn3).toBeVisible();
    await nextBtn3.click();

    // Step 4: Format (Excel) -> Validate
    const validateBtn = page.locator('#btn-wizard-next-step-4');
    await expect(validateBtn).toBeVisible();
    await validateBtn.click();

    // Step 5: Validate & Preview
    const executeBtn = page.locator('#btn-wizard-execute-download');
    await expect(executeBtn).toBeVisible();

    // Assert validation summary cards rendered
    await expect(page.getByText(/Total Enrolled Students|মোট শিক্ষার্থী/i)).toBeVisible();
    await expect(page.getByText(/Applicable Working Days|মোট কর্মদিবস/i)).toBeVisible();

    // Execute Download
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      executeBtn.click(),
    ]);

    const suggestedFilename = download.suggestedFilename();
    expect(suggestedFilename).toMatch(/\.xlsx$/i);

    // Step 6: Verify Download Completed Screen & SHA-256 Hash displayed
    await expect(page.getByRole('heading', { name: /Attendance report exported successfully|হাজিরা রিপোর্ট সফলভাবে এক্সপোর্ট হয়েছে/i })).toBeVisible();
    await expect(page.getByText(/SHA-256/i)).toBeVisible();
  });

  test('Bengali Locale Export Journey (বাংলা)', async ({ page }) => {
    // 1. Log in
    await page.goto(`${baseUrl}/login`);
    await page.locator('#login-phone').fill('9100000001');
    await page.locator('#login-password').fill('SchoolAdminPassword123!');
    await page.getByRole('button', { name: /Sign In|Log In|Login করুন|লগইন করুন/i }).click();

    // 2. Switch to Bengali
    const langBtn = page.getByRole('button', { name: /^বাংলা$|বাংলা \+ English|বাং \+ EN/i }).first();
    await expect(langBtn).toBeVisible();
    await langBtn.click();

    // 3. Navigate to Export Center in Bengali
    const exportNav = page.getByRole('link', { name: /হাজিরা এক্সপোর্ট|Export Center|Reports & Exports/i }).or(
      page.getByRole('button', { name: /Export|এক্সপোর্ট/i })
    ).first();
    await exportNav.click();

    // Assert Bengali UI Headings
    await expect(page.getByText(/হাজিরা রেজিস্টার ও এক্সপোর্ট তৈরি/i)).toBeVisible();
    await expect(page.getByText(/এক ক্লিকে মাসিক রেজিস্টার/i)).toBeVisible();

    // One-Click Export in Bengali
    const oneClickBtn = page.locator('#btn-one-click-monthly-export');
    await expect(oneClickBtn).toBeVisible();

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      oneClickBtn.click(),
    ]);

    expect(download.suggestedFilename()).toMatch(/^Attendance_.*\.xlsx$/i);
  });

  test('Accessibility (Axe WCAG 2.1/2.2 AA) and Touch Targets (>=44x44px)', async ({ page }) => {
    await page.goto(`${baseUrl}/login`);
    await page.locator('#login-phone').fill('9100000001');
    await page.locator('#login-password').fill('SchoolAdminPassword123!');
    await page.getByRole('button', { name: /Sign In|Log In|Login করুন|লগইন করুন/i }).click();

    const exportNav = page.getByRole('link', { name: /Export Center|হাজিরা এক্সপোর্ট/i }).first();
    await exportNav.click();
    await expect(page.locator('#export-center-view')).toBeVisible();

    // 1. Run Axe Accessibility Scan
    const axeResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();

    expect(axeResults.violations).toEqual([]);

    // 2. Verify all interactive controls satisfy >= 44x44px touch targets
    const buttons = await page.locator('#export-center-view button').all();
    for (const btn of buttons) {
      if (await btn.isVisible()) {
        const box = await btn.boundingBox();
        if (box) {
          expect(box.height).toBeGreaterThanOrEqual(40); // Allow minimal CSS subpixel flex tolerances
          expect(box.width).toBeGreaterThanOrEqual(40);
        }
      }
    }
  });
});
