import { test, expect } from '@playwright/test';
import { TEST_ACCOUNTS } from '../../lib/auth/test-credentials';

const baseURL = process.env.BASE_URL ?? 'http://localhost:3000';
test.use({ baseURL, storageState: { cookies: [], origins: [] } });

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

test('required email blocks an empty sign-in submission', async ({ page }) => {
  await page.goto('/sign-in');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page.getByLabel('Email')).toBeFocused();
  await expect(page).toHaveURL(/\/sign-in/);
});

test('required password blocks a submission with a valid email only', async ({ page }) => {
  await page.goto('/sign-in');
  await page.getByLabel('Email').fill(TEST_ACCOUNTS['guest-user'].email);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page.getByLabel('Password')).toBeFocused();
  await expect(page).toHaveURL(/\/sign-in/);
});

test('malformed email is rejected by native form validation', async ({ page }) => {
  await page.goto('/sign-in');
  await page.getByLabel('Email').fill('not-an-email');
  await page.getByLabel('Password').fill('irrelevant-password');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page.getByLabel('Email')).toBeFocused();
  await expect(page).toHaveURL(/\/sign-in/);
});

test('test account can sign in, sign out, and loses protected access', async ({ page }) => {
  const account = TEST_ACCOUNTS['guest-user'];
  await page.goto('/sign-in');
  await page.getByLabel('Email').fill(account.email);
  await page.getByLabel('Password').fill(account.password);
  await page.getByRole('button', { name: 'Sign In' }).click();

  await expect(page).toHaveURL(/\/dashboard(?:\/|$)/);
  await expect(page.getByRole('heading', { name: 'Application Pipeline' })).toBeVisible();

  await page.getByRole('button', { name: 'Account menu' }).click();
  await page.getByRole('menuitem', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(new URL('/', baseURL).href);

  const sessionResponse = await page.request.get('/api/auth/session');
  expect(sessionResponse.status()).toBe(200);
  expect(await sessionResponse.json()).toBeNull();

  await page.goto('/profile', { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(/\/sign-in/);
});
