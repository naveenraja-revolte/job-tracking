import { test, expect, type Page } from '@playwright/test';

const baseURL = process.env.BASE_URL;
test.use({ baseURL });

/**
 * Auth smoke tests — verify NextAuth route protection.
 *
 * These tests run without any NextAuth session cookie.
 * Each protected route must redirect to /sign-in (configured in auth.ts pages).
 * No dev server credentials required — redirect is server-side middleware.
 */

const PROTECTED_ROUTES = [
  '/dashboard',
  '/stats',
  '/discover',
  '/timeline',
  '/profile',
  '/team',
];

for (const route of PROTECTED_ROUTES) {
  test(`unauthenticated ${route} redirects to /sign-in`, async ({ page }) => {
    await page.goto(route, { waitUntil: 'domcontentloaded' });
    // NextAuth redirects synchronously via middleware — URL must contain /sign-in
    await expect(page).toHaveURL(/\/sign-in/, { timeout: 8_000 });
  });
}

function trackCredentialSubmissions(page: Page) {
  const submissions: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/auth/callback/credentials') {
      submissions.push(request.method());
    }
  });
  return submissions;
}

test('email is required and prevents credential submission', async ({ page }) => {
  const submissions = trackCredentialSubmissions(page);
  await page.goto('/sign-in');
  await page.getByLabel('Password').fill('validation-only');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page.getByLabel('Email')).toBeInvalid();
  await expect(page).toHaveURL(/\/sign-in$/);
  expect(submissions).toEqual([]);
});

test('password is required and prevents credential submission', async ({ page }) => {
  const submissions = trackCredentialSubmissions(page);
  await page.goto('/sign-in');
  await page.getByLabel('Email').fill('validation@example.test');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page.getByLabel('Password')).toBeInvalid();
  await expect(page).toHaveURL(/\/sign-in$/);
  expect(submissions).toEqual([]);
});

test('malformed email is rejected without credential submission', async ({ page }) => {
  const submissions = trackCredentialSubmissions(page);
  await page.goto('/sign-in');
  await page.getByLabel('Email').fill('not-an-email');
  await page.getByLabel('Password').fill('validation-only');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page.getByLabel('Email')).toBeInvalid();
  await expect(page).toHaveURL(/\/sign-in$/);
  expect(submissions).toEqual([]);
});

test('root / loads without 500', async ({ page }) => {
  const res = await page.goto('/', { waitUntil: 'domcontentloaded' });
  expect(res?.status()).not.toBe(500);
});

test('wrong password stays on /sign-in', async ({ page }) => {
  await page.goto('/sign-in');
  await page.getByLabel('Email').fill('test@user.com');
  await page.getByLabel('Password').fill('definitely-wrong-password');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page.getByRole('alert').or(page.getByText(/invalid|incorrect/i)).first()).toBeVisible({ timeout: 10_000 });
  await expect(page).toHaveURL(/\/sign-in/);
});
