import { test, expect } from '@playwright/test';

for (const provider of ['google', 'apple']) {
  test(`${provider} starts OAuth with a fixed application return origin`, async ({ page }) => {
    await page.route('https://*.supabase.co/auth/v1/settings', route => route.fulfill({ json: { external: { google: true, apple: true } } }));
    await page.route('https://*.supabase.co/auth/v1/authorize?**', route => route.fulfill({ contentType: 'text/html', body: '<h1>Mock provider authorization</h1>' }));
    await page.goto('/#Settings');
    await page.getByRole('button', { name: 'Sign in / Create account', exact: true }).click();
    await page.getByRole('button', { name: `Continue with ${provider === 'google' ? 'Google' : 'Apple'}` }).click();
    await expect(page.getByRole('heading', { name: 'Mock provider authorization' })).toBeVisible();
    const url = new URL(page.url());
    expect(url.searchParams.get('provider')).toBe(provider);
    expect(url.searchParams.get('redirect_to')).toBe('http://127.0.0.1:4178');
  });
}
test('unconfigured providers are disabled and no fake PlayStation login is offered', async ({ page }) => {
  await page.route('https://*.supabase.co/auth/v1/settings', route => route.fulfill({ json: { external: { google: false, apple: false } } }));
  await page.goto('/#Settings');
  await page.getByRole('button', { name: 'Sign in / Create account', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeDisabled();
  await expect(page.getByText('Not configured', { exact: true })).toHaveCount(2);
  await expect(page.getByRole('button', { name: /Continue with (PlayStation|PSN)/ })).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'test-results/social-signin-mobile.png', fullPage: true });
});
test('provider availability failure supports retry without blocking email', async ({ page }) => {
  let count = 0;
  await page.route('https://*.supabase.co/auth/v1/settings', route => ++count === 1 ? route.fulfill({ status: 503, json: {} }) : route.fulfill({ json: { external: { google: true, apple: false } } }));
  await page.goto('/#Settings');
  await page.getByRole('button', { name: 'Sign in / Create account', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Email sign-in is still available');
  await page.getByRole('button', { name: 'Retry providers' }).click();
  await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeEnabled();
});
