import { test, expect } from './extension.fixture';

test.describe.configure({ mode: 'serial' });

test('extension debug page opens', async ({ openExtensionPage }) => {
  const page = await openExtensionPage('debug.html');
  await expect(page.getByText('Debug', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Linux\.do Reader/i })).toBeVisible();
});

test('side panel page opens', async ({ openExtensionPage }) => {
  const page = await openExtensionPage('sidepanel.html');
  await expect(page.getByRole('heading', { name: /Linux\.do 搜索增强/i })).toBeVisible();
});
