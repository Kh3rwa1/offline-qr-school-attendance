import { test, expect } from '@playwright/test';

const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:3100';

test.describe('School Workspace Path Tenancy & Public Journeys', () => {
  test('1. Root URL renders public LandingPage with honest onboarding journey copy', async ({ page }) => {
    await page.goto(baseUrl);

    // Verify brand and hero typography
    await expect(page.getByText('AttendEase', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('From Discovery to Morning Rollout')).toBeVisible();

    // Click Stage 5 in stepper
    await page.getByRole('button', { name: /5 Provision School/i }).click();

    // Verify Stage 5 honest copy (workspace path instead of fake subdomain)
    await expect(page.getByText('Generate a stable workspace path /s/green-valley')).toBeVisible();
  });

  test('2. Public demo request form submits to API and displays verified success confirmation', async ({ page }) => {
    await page.goto(baseUrl);

    // Click demo request button
    const demoBtn = page.getByRole('button', { name: /Demo/i }).first();
    await demoBtn.click();

    await expect(page.getByTestId('demo-request-form')).toBeVisible();

    // Fill form
    await page.locator('input[placeholder="e.g. Principal Sourav Sen"]').fill('Principal Animesh Das');
    await page.locator('input[placeholder="98765 43210"]').fill('9876500001');
    await page.locator('input[placeholder="principal@school.edu.in"]').fill('animesh@ballygunge.edu.in');
    await page.locator('input[placeholder="Green Valley High School"]').fill('Ballygunge Govt High School');
    await page.locator('input[placeholder="Kolkata, West Bengal"]').fill('Kolkata');

    // Submit form
    await page.getByRole('button', { name: 'Submit Request' }).click();

    // Verify success confirmation card
    await expect(page.getByTestId('demo-success-state')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Demo Request Received')).toBeVisible();
    await expect(page.getByText('Principal Animesh Das')).toBeVisible();
  });

  test('3. Unknown school slug shows dedicated 404 empty state without inventing names', async ({ page }) => {
    await page.goto(`${baseUrl}/s/non-existent-school-xyz/login`);

    await expect(page.getByTestId('school-not-found-state')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('This school workspace was not found')).toBeVisible();

    // Click Return to Home
    await page.getByRole('button', { name: 'Return to Home' }).click();
    await expect(page).toHaveURL(`${baseUrl}/`);
  });

  test('4. Seeded school slug resolves real school identity and binds login workspace', async ({ page }) => {
    // Navigate to path-based school workspace
    await page.goto(`${baseUrl}/s/rampur-high-school-0101/login`);

    // Verify resolved school name
    await expect(page.getByText('Welcome to Rampur High School')).toBeVisible({ timeout: 10000 });

    // Sign in as Teacher
    await page.locator('#login-phone').fill('9100000002');
    await page.locator('#login-password').fill('TeacherPassword123!');
    await page.locator('button[type="submit"]').click();

    // Assert authenticated teacher dashboard
    await expect(page).toHaveURL(/.*\/app\/teacher.*/, { timeout: 10000 });
    await expect(page.getByRole('button', { name: /Rampur High School/i })).toBeVisible();
  });

  test('5. Rejects login if teacher does not belong to the target school workspace', async ({ page }) => {
    // Teacher A belongs to Rampur High School, but accesses Haripur High School
    await page.goto(`${baseUrl}/s/haripur-high-school-0102/login`);

    await expect(page.getByText('Welcome to Haripur High School')).toBeVisible({ timeout: 10000 });

    await page.locator('#login-phone').fill('9100000002');
    await page.locator('#login-password').fill('TeacherPassword123!');
    await page.locator('button[type="submit"]').click();

    // Assert school membership access denial message
    await expect(
      page.getByText('This mobile number is not a member of Haripur High School.')
    ).toBeVisible({ timeout: 10000 });
  });
});
