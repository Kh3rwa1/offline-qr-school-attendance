import { test, expect } from '@playwright/test';

const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:3100';

test.describe('First-Run Browser Setup Wizard E2E Flow', () => {
  test('1. Verified locked state on already bootstrapped appliance', async ({ page }) => {
    // When the server already has super admins configured, visiting /setup presents the locked state
    await page.route('**/api/v1/setup/status', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          isBootstrapped: true,
          setupAllowed: false,
          systemInfo: {
            dbStatus: 'connected',
            backupConfigured: true,
            r2Configured: false,
            smsConfigured: true,
            smsProvider: 'console',
            workerAlive: true,
            serverDomain: 'localhost',
            featureRfid: false,
            version: '1.0.0',
            timestamp: new Date().toISOString(),
          },
        }),
      });
    });

    await page.goto(`${baseUrl}/setup`);
    await expect(page.getByText('Appliance Already Configured')).toBeVisible();
    await page.getByRole('button', { name: /Proceed to Login/i }).click();
    await expect(page).toHaveURL(new RegExp(`${baseUrl}/login`));
  });

  test('2. First-run operator 4-step initialization wizard flow', async ({ page }) => {
    // Mock the unbootstrapped state to test the complete 4-step wizard UI interaction
    await page.route('**/api/v1/setup/status', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          isBootstrapped: false,
          setupAllowed: true,
          systemInfo: {
            dbStatus: 'connected',
            backupConfigured: true,
            r2Configured: false,
            smsConfigured: true,
            smsProvider: 'console',
            workerAlive: true,
            serverDomain: 'localhost',
            featureRfid: false,
            version: '1.0.0',
            timestamp: new Date().toISOString(),
          },
        }),
      });
    });

    await page.route('**/api/v1/setup/initialize', async (route) => {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: 'System successfully initialized with Super Administrator account.',
          userId: 'test-admin-uuid-001',
          schoolId: 'test-school-uuid-001',
        }),
      });
    });

    // 1. Visit /setup
    await page.goto(`${baseUrl}/setup`);

    // Verify Step 1: Pre-flight Diagnostics
    await expect(page.getByText('AttendEase Appliance Setup')).toBeVisible();
    await expect(page.getByText('PostgreSQL Database')).toBeVisible();
    await expect(page.getByText('Encrypted Backups')).toBeVisible();

    // 2. Advance to Step 2: Administrator Creation
    await page.getByRole('button', { name: /Continue/i }).click();
    await expect(page.getByText('Step 2: Create Super Administrator')).toBeVisible();

    const adminPhone = '+919876543200';
    const adminPassword = 'SuperSecureSetupPassword123!';

    await page.locator('input[placeholder*="Trainer"]').fill('Master Trainer');
    await page.locator('input[type="tel"]').fill(adminPhone);
    const passwordInputs = page.locator('input[type="password"]');
    await passwordInputs.nth(0).fill(adminPassword);
    await passwordInputs.nth(1).fill(adminPassword);

    // 3. Advance to Step 3: School Setup
    await page.getByRole('button', { name: /Continue to School Setup/i }).click();
    await expect(page.getByText('Step 3: Primary School & Student Data')).toBeVisible();

    await page.locator('input[placeholder*="Khatra High School"]').fill('Joypur Model High School');

    // 4. Submit Initialization
    await page.getByRole('button', { name: /Complete Initialization/i }).click();

    // 5. Assert Step 4: Completion & Permanent Lockdown
    await expect(page.getByText('Appliance Setup Complete!')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('PERMANENTLY LOCKED', { exact: true })).toBeVisible();

    // 6. Click Proceed to Sign In
    await page.getByRole('button', { name: /Proceed to Secure Sign In|নিরাপদ লগইনে যান/i }).click();
    await expect(page).toHaveURL(new RegExp(`${baseUrl}/login`));
  });
});
