import { test, expect } from '@playwright/test';

test('keyboard skips navigation and follows page and history changes', async ({ page }) => {
  await page.goto('/#Overview');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Skip to main content' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Overview', exact: true })).toBeFocused();
  await page.getByRole('navigation', { name: 'Workspace' }).getByRole('button', { name: 'Sessions', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Sessions', exact: true })).toBeFocused();
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Overview', exact: true })).toBeFocused();
});

test('mobile navigation announces state, supports Escape and focuses destinations', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#Overview');
  const toggle = page.getByRole('button', { name: 'Toggle navigation' });
  await toggle.focus();
  await page.keyboard.press('Enter');
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  const nav = page.getByRole('navigation', { name: 'Workspace' });
  await expect(nav.getByRole('button', { name: 'Overview', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(toggle).toBeFocused();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Overview', exact: true })).toBeFocused();
  await toggle.click();
  await nav.getByRole('button', { name: 'Race engineer', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(nav).toBeHidden();
  await expect(page.getByRole('heading', { name: 'Race engineer', exact: true, level: 1 })).toBeFocused();
  await page.getByRole('button', { name: 'Connect companion', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Live telemetry', exact: true })).toBeFocused();
  for (const width of [320, 390, 760]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/navigation-${width}.png`, fullPage: true });
  }
  await page.screenshot({ path: 'test-results/navigation-mobile.png', fullPage: true });
});
