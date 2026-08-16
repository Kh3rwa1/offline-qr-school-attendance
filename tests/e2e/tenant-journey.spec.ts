import { test, expect } from '@playwright/test';

const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:3100';

test.describe('School Workspace Path Tenancy & Public Journeys', () => {
  test('1. Root URL renders public LandingPage with honest copy and navigates to /login on School Sign In', async ({ page }) => {
    await page.goto(baseUrl);

    // Verify brand, hero copy and presence of landing elements
    await expect(page.getByText('AttendEase', { exact: true }).first()).toBeVisible();
    await expect(
      page.getByRole('heading', { level: 1, name: /Morning attendance in under 2 minutes/i })
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: /From first call to first morning/i })
    ).toBeVisible();

    // Verify login form is NOT shown on root "/"
    await expect(page.locator('#login-phone')).not.toBeVisible();

    // Verify Step 5 honest copy (private school page instead of fake subdomain)
    await page.getByRole('button', { name: /5\.?\s*School setup/i }).click();
    await expect(page.getByText(/secure page and admin login/i)).toBeVisible();

    // Click "School Sign In" button on landing page and assert navigation to /login
    const schoolSignInBtn = page.getByRole('button', { name: 'School Sign In' }).first();
    await expect(schoolSignInBtn).toBeVisible();
    await schoolSignInBtn.click();

    await expect(page).toHaveURL(`${baseUrl}/login`);
    await expect(page.locator('#login-phone')).toBeVisible();
  });

  test('2. Public demo request form submits to API and displays verified success confirmation', async ({ page }) => {
    await page.goto(baseUrl);

    // Click demo request button
    const demoBtn = page.getByRole('button', { name: /Demo|ডেমো/i }).first();
    await demoBtn.click();

    await expect(page.getByTestId('demo-request-form')).toBeVisible();

    // Fill form
    await page.locator('input[placeholder="e.g. Principal Sourav Sen"]').fill('Principal Animesh Das');
    await page.locator('input[placeholder="98765 43210"]').fill('9876500001');
    await page.locator('input[placeholder="principal@school.edu.in"]').fill('animesh@ballygunge.edu.in');
    await page.locator('input[placeholder="Green Valley High School"]').fill('Ballygunge Govt High School');
    await page.locator('input[placeholder="Kolkata, West Bengal"]').fill('Kolkata');

    // Submit form (submit button lives inside the dialog form)
    await page.getByTestId('demo-request-form').getByRole('button', { name: /Request Demo|ডেমো/i }).click();

    // Verify success confirmation card
    await expect(page.getByTestId('demo-success-state')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/Demo request received|ডেমো অনুরোধ/i)).toBeVisible();
    await expect(page.getByText('9876500001')).toBeVisible();
  });

  test('3. Unknown school slug shows dedicated 404 empty state without inventing names', async ({ page }) => {
    await page.goto(`${baseUrl}/s/unknown-school-xyz/login`);

    // Verify dedicated 404 empty state
    await expect(page.getByTestId('school-not-found-state')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('This school workspace was not found')).toBeVisible();

    // Ensure it does NOT invent a pretty name like "Welcome to Unknown School Xyz"
    await expect(page.getByText('Welcome to Unknown School Xyz')).not.toBeVisible();

    // Click Return to Home
    await page.getByRole('button', { name: 'Return to Home' }).click();
    await expect(page).toHaveURL(`${baseUrl}/`);
  });

  test('4. Platform /login still authenticates seeded teacher happy path', async ({ page }) => {
    await page.goto(`${baseUrl}/login`);

    await page.locator('#login-phone').fill('9100000002');
    await page.locator('#login-password').fill('TeacherPassword123!');
    await page.locator('button[type="submit"]').click();

    // Assert authenticated teacher dashboard
    await expect(page).toHaveURL(/.*\/app\/teacher.*/, { timeout: 10000 });
    await expect(page.getByRole('button', { name: /Rampur High School/i })).toBeVisible();
  });

  test('5. Seeded school slug resolves real school identity and binds login workspace', async ({ page }) => {
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

  test('6. Rejects login if teacher does not belong to the target school workspace', async ({ page }) => {
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
