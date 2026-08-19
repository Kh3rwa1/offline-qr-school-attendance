import { test, expect } from '@playwright/test';

const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:3100';

test.describe('School Workspace Path Tenancy & Public Journeys', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try {
        localStorage.setItem('app_language', 'en');
      } catch {}
    });
  });

  test('1. Root URL renders public LandingPage with honest copy and navigates to /login on School Sign In', async ({ page }) => {
    await page.goto(baseUrl);

    // Verify brand, hero copy and presence of landing elements
    await expect(page.getByText('AttendEase', { exact: true }).first()).toBeVisible();
    await expect(
      page.getByRole('heading', { level: 1, name: /Morning attendance in minutes/i })
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: /From setup to first morning/i })
    ).toBeVisible();

    // Verify login form is NOT shown on root "/"
    await expect(page.locator('#login-phone')).not.toBeVisible();

    // Verify Step 5 honest copy (private school portal instead of fake subdomain)
    const step5Tab = page.getByRole('tab', { name: /5\.?\s*School portal/i });
    if (await step5Tab.isVisible()) {
      await step5Tab.click();
      await expect(page.getByText(/School portal & administrator credentials/i)).toBeVisible();
    }

    // Click "School Sign In" button on landing page and assert navigation to /login
    const schoolSignInBtn = page.getByRole('button', { name: 'School Sign In' }).first();
    await expect(schoolSignInBtn).toBeVisible();
    await schoolSignInBtn.click();

    await expect(page).toHaveURL(`${baseUrl}/login`);
    await expect(page.locator('#login-phone')).toBeVisible();
  });

  test('2. Public demo request form submits to API and displays verified success confirmation', async ({ page }) => {
    await page.goto(baseUrl);
    await page.waitForLoadState('domcontentloaded');

    // Click demo request button via data-testid
    const demoBtn = page.getByTestId('header-book-demo-btn');
    await expect(demoBtn).toBeVisible({ timeout: 10000 });
    await demoBtn.click();

    const form = page.getByTestId('demo-request-form');
    await expect(form).toBeVisible({ timeout: 10000 });

    const testPhone = `98765${Math.floor(10000 + Math.random() * 90000)}`;

    // Fill form using deterministic ID selectors
    await form.locator('#demo-form-name').fill('Principal Animesh Das');
    await form.locator('#demo-form-phone').fill(testPhone);
    await form.locator('#demo-form-email').fill(`animesh_${Date.now()}@ballygunge.edu.in`);
    await form.locator('#demo-form-school').fill('Ballygunge Govt High School');
    await form.locator('#demo-form-district').fill('Kolkata');

    // Check mandatory explicit consent checkbox
    await form.locator('#demo-consent-checkbox').check();

    // Submit form and wait for the API response before asserting success state.
    // Firefox on CI can render networkidle before the dialog's React state settles;
    // waitForResponse pins the assertion to the actual network round-trip.
    const submitBtn = form.locator('#demo-form-submit');
    await submitBtn.scrollIntoViewIfNeeded();

    const [response] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('/api/v1/public/demo-requests') && r.request().method() === 'POST',
        { timeout: 20000 }
      ),
      submitBtn.click(),
    ]);
    // If the API itself failed, surface the status in the error message.
    if (!response.ok()) {
      throw new Error(`Demo request API returned ${response.status()}: ${await response.text()}`);
    }

    // Verify success confirmation card
    await expect(page.getByTestId('demo-success-state')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/Demo request successfully received|ডেমোর অনুরোধ/i)).toBeVisible();
    await expect(page.getByText(testPhone)).toBeVisible();
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
