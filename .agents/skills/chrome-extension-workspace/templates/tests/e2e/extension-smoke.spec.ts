import { test, expect } from './extension.fixture';

test('extension debug page opens', async ({ openExtensionPage }) => {
  const page = await openExtensionPage('debug.html');
  await expect(page.getByText(/debug|diagnostics|诊断/i)).toBeVisible();
});

test('side panel page opens', async ({ openExtensionPage }) => {
  const page = await openExtensionPage('sidepanel.html');
  await expect(page.locator('body')).toBeVisible();
});
