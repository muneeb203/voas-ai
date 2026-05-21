import { test, expect } from '@playwright/test';

/**
 * Critical path E2E. Walks the marketing site → user signup (Studio shortcut)
 * → onboarding → ticket flow.
 *
 * NOTE: This test ASSUMES the local stack is running and a fresh test user
 * has been provisioned via Supabase Studio (Auth → Users → Add user, with
 * "Auto confirm" checked) OR via the create_admin script with a custom email.
 *
 * Run with:
 *   pnpm test:e2e
 * Or interactively:
 *   pnpm test:e2e:ui
 *
 * Set E2E_TEST_EMAIL + E2E_TEST_PASSWORD in your environment before running.
 */

const EMAIL = process.env.E2E_TEST_EMAIL ?? '';
const PASSWORD = process.env.E2E_TEST_PASSWORD ?? '';

test.describe('VOAS critical path', () => {
  test.beforeAll(() => {
    if (!EMAIL || !PASSWORD) {
      throw new Error(
        'E2E_TEST_EMAIL and E2E_TEST_PASSWORD must be set. ' +
          'Create the test user in Supabase Studio first (auto-confirm enabled).',
      );
    }
  });

  test('marketing site renders', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('link', { name: /sign in/i }).first()).toBeVisible();
  });

  test('full path: login → onboarding → dashboard → ticket flow', async ({ page }) => {
    // --- Sign in ---
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(EMAIL);
    await page.getByLabel(/password/i).fill(PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();

    // Either onboarding (new user) or dashboard (existing). We accept both.
    await page.waitForURL(/\/(onboarding|dashboard)/, { timeout: 10_000 });

    // --- Onboarding (skip if already onboarded) ---
    if (page.url().includes('/onboarding')) {
      await page.getByLabel(/business name/i).fill('E2E Test Cafe');
      await page.getByRole('button', { name: /continue/i }).click();

      // Vertical step — "Restaurant" is default & selected, just continue
      await page.getByRole('button', { name: /continue/i }).click();

      // Location
      await page.getByLabel(/location name/i).fill('Main');
      await page.getByRole('button', { name: /finish setup/i }).click();

      await page.waitForURL(/\/dashboard/, { timeout: 10_000 });
    }

    // --- Dashboard ---
    await expect(page.getByRole('heading', { name: /welcome/i })).toBeVisible();

    // --- Create a support ticket ---
    await page.getByRole('link', { name: /^support$/i }).click();
    await page.waitForURL(/\/support/);
    await page.getByRole('button', { name: /new ticket/i }).click();

    await page.getByLabel(/subject/i).fill('E2E test ticket');
    await page.getByLabel(/what's happening/i).fill(
      'This ticket was created by the Playwright E2E suite.',
    );
    await page.getByRole('button', { name: /create ticket/i }).click();

    await page.waitForURL(/\/support\/[a-f0-9-]+/);

    // We see our own message as a bubble
    await expect(page.getByText(/E2E test ticket/i).first()).toBeVisible();
    await expect(
      page.getByText(/created by the playwright e2e suite/i),
    ).toBeVisible();

    // --- Reply to the ticket ---
    await page.getByLabel(/add a reply/i).fill('Follow-up from E2E.');
    await page.getByRole('button', { name: /send reply/i }).click();
    await expect(page.getByText(/follow-up from e2e/i)).toBeVisible({
      timeout: 5_000,
    });

    // --- Mark as resolved ---
    await page.getByRole('button', { name: /mark as resolved/i }).click();
    await page.getByRole('button', { name: /^mark resolved$/i }).click();
    await expect(page.getByText(/resolved/i).first()).toBeVisible();
  });
});
