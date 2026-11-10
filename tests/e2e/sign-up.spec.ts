import { expect, test } from '@playwright/test';
import { TEST_ACCOUNTS } from '../../lib/auth/test-credentials';

const baseURL = process.env.BASE_URL;
test.use({
  baseURL,
  storageState: { cookies: [], origins: [] },
});

const requiredFieldCases = [
  { label: 'First name' },
  { label: 'Last name' },
  { label: 'Email' },
  { label: 'Password' },
];

const validValues: Record<string, string> = {
  'First name': 'QA',
  'Last name': 'Test',
  Email: 'qa-validation@example.com',
  Password: 'Unspecified-policy-password',
};

for (const { label } of requiredFieldCases) {
  test(`blocks sign-up when ${label.toLowerCase()} is empty`, async ({ page }) => {
    await page.goto('/sign-up');

    for (const [fieldLabel, value] of Object.entries(validValues)) {
      if (fieldLabel !== label) await page.getByLabel(fieldLabel).fill(value);
    }

    const missingField = page.getByLabel(label);
    await page.getByRole('button', { name: 'Create Account' }).click();

    expect(
      await missingField.evaluate(
        (element: HTMLInputElement) => element.validity.valueMissing,
      ),
    ).toBe(true);
    await expect(page.getByRole('heading', { name: 'Create your account!' })).toBeVisible();
  });
}

test('blocks sign-up when the email format is malformed', async ({ page }) => {
  await page.goto('/sign-up');
  await page.getByLabel('First name').fill(validValues['First name']);
  await page.getByLabel('Last name').fill(validValues['Last name']);
  await page.getByLabel('Email').fill('not-an-email');
  await page.getByLabel('Password').fill(validValues.Password);
  await page.getByRole('button', { name: 'Create Account' }).click();

  expect(
    await page.getByLabel('Email').evaluate(
      (element: HTMLInputElement) => element.validity.typeMismatch,
    ),
  ).toBe(true);
  await expect(page.getByRole('heading', { name: 'Create your account!' })).toBeVisible();
});

test('rejects an email already in use', async ({ page }) => {
  await page.goto('/sign-up');
  await page.getByLabel('First name').fill('QA');
  await page.getByLabel('Last name').fill('Duplicate');
  await page.getByLabel('Email').fill(TEST_ACCOUNTS['guest-user'].email);
  await page.getByLabel('Password').fill('Unspecified-policy-password');
  await page.getByRole('button', { name: 'Create Account' }).click();

  await expect(page.getByText('Email already in use.', { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/sign-up(?:\/|$)/);
});
