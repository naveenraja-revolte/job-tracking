import { test as publicTest, expect as publicExpect } from '@playwright/test';
import { TEST_ACCOUNTS } from '../../lib/auth/test-credentials';
import { test, expect } from './fixtures';

const baseURL = process.env.BASE_URL ?? 'http://localhost:3000';
publicTest.use({ baseURL });
test.use({ baseURL });

publicTest('unauthenticated session endpoint returns JSON null', async ({ request }) => {
  const response = await request.get(`${baseURL}/api/auth/session`);

  publicExpect(response.status()).toBe(200);
  publicExpect(response.headers()['content-type']).toContain('application/json');
  publicExpect(await response.json()).toBeNull();
});

test('authenticated session endpoint returns the signed-in identity', async ({ page }) => {
  await page.goto('/dashboard');
  const response = await page.request.get('/api/auth/session');

  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toContain('application/json');
  const session = await response.json();
  expect(session).toMatchObject({
    user: {
      email: TEST_ACCOUNTS['guest-user'].email,
      id: expect.any(String),
    },
  });
  expect(session.user).not.toHaveProperty('password');
  expect(session.user).not.toHaveProperty('hash');
});
