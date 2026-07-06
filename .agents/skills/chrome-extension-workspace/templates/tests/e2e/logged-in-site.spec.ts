import { test, expect } from './extension.fixture';

const siteUrl = process.env.E2E_SITE_URL ?? '';
const email = process.env.E2E_SITE_EMAIL ?? '';
const password = process.env.E2E_SITE_PASSWORD ?? '';

async function ensureLoggedIn(page: import('@playwright/test').Page) {
  await page.goto(siteUrl, { waitUntil: 'domcontentloaded' });

  const isAlreadyLoggedIn = await page
    .locator('[data-testid="dashboard"], [data-app-root], main')
    .first()
    .isVisible()
    .catch(() => false);

  if (isAlreadyLoggedIn) return;

  if (!email || !password) {
    throw new Error('Missing E2E_SITE_EMAIL/E2E_SITE_PASSWORD. Use a dedicated test account or bootstrap profile manually.');
  }

  await page.getByLabel(/email|邮箱/i).fill(email);
  await page.getByLabel(/password|密码/i).fill(password);
  await page.getByRole('button', { name: /log in|sign in|登录/i }).click();
  await page.waitForLoadState('domcontentloaded');
}

test('extension works on logged-in target site', async ({ context }) => {
  test.skip(!siteUrl, 'Set E2E_SITE_URL to run logged-in site smoke test.');

  const page = await context.newPage();
  const consoleErrors: string[] = [];

  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });

  await ensureLoggedIn(page);
  await page.goto(siteUrl, { waitUntil: 'domcontentloaded' });

  await expect(page.locator('html[data-my-extension-ready="true"]')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('html[data-my-extension-logged-in="true"]')).toBeVisible({ timeout: 15_000 });

  expect(consoleErrors.filter((error) => !error.includes('favicon'))).toEqual([]);
});
