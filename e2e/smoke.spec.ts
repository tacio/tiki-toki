import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  // Start from an empty ledger (no demo seed entries) and block any real network sync.
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('e2e-init')) {
      localStorage.setItem('tiki_toki_entries_v1', '[]');
      sessionStorage.setItem('e2e-init', '1');
    }
  });
  await page.route('https://script.google.com/**', route => route.abort());
});

test('carve a totem, drop it into the river, and keep it across reloads', async ({ page }) => {
  await page.goto('./');
  await expect(page).toHaveTitle(/Tiki-Toki/);

  await page.getByPlaceholder(/What are you carving right now/).fill('Write e2e tests #qa');
  await page.getByRole('button', { name: /Carve Totem & Begin/ }).click();

  await page.getByRole('button', { name: /Drop Totem/ }).click();
  await expect(page.getByText('Write e2e tests').first()).toBeVisible();

  await page.reload();
  await expect(page.getByText('Write e2e tests').first()).toBeVisible();
});

test('production build ships a Content-Security-Policy', async ({ page }) => {
  await page.goto('./');
  const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
  expect(csp).toContain("script-src 'self'");
  expect(csp).toContain('connect-src');
  expect(csp).not.toContain('unsafe-eval');
});

test('a hand-off link asks before connecting and strips the token from the URL', async ({ page }) => {
  const url = 'https://script.google.com/macros/s/AKfyE2E/exec';
  await page.goto(`./?syncUrl=${encodeURIComponent(url)}#t=secret`);
  await expect(page.getByText('Connect to this Google Sheet?')).toBeVisible();
  expect(page.url()).not.toContain('secret');
  expect(page.url()).not.toContain('syncUrl');
  await page.getByRole('button', { name: 'Ignore' }).click();
  await expect(page.getByText('Connect to this Google Sheet?')).toBeHidden();
});
