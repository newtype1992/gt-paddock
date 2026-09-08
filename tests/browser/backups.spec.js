import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('import from an empty library, durable details after reload, full backup export and duplicate error', async ({ page }) => {
  let stored;
  const bundle = { format: 'gt-paddock-session', version: 1,
    session: { id: 'portable-test', car_id: 82, source: 'console', started_at: 100,
      ended_at: 101, samples: 2, top_speed: 120, state: 'completed', laps: [] },
    annotation: { track: 'Example circuit', notes: 'Imported note' },
    samples: [{ captured_at: 100 }, { captured_at: 101 }] };
  await page.route('http://127.0.0.1:4181/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/import') {
      if (stored) return route.fulfill({ status: 409, json: { error: 'This session already exists. Nothing was overwritten.' } });
      stored = route.request().postDataJSON();
      return route.fulfill({ json: { ...stored.session, annotation: stored.annotation } });
    }
    if (path === '/annotations') {
      stored.annotation = route.request().postDataJSON().annotation;
      return route.fulfill({ json: stored.annotation });
    }
    return route.fulfill({ json: path === '/backup' ? stored : path === '/sessions'
      ? stored ? [{ ...stored.session, annotation: stored.annotation }] : []
      : { sample: null, session: null, recording_state: 'waiting' } });
  });
  async function connect() {
    await page.goto('/#Live%20telemetry');
    await page.getByLabel('Companion pairing code').fill('test-only');
    await page.getByRole('button', { name: 'Connect', exact: true }).click();
    await page.getByRole('button', { name: 'Sessions', exact: true }).click();
  }
  await connect();
  const input = page.getByLabel('Import session backup');
  await input.setInputFiles({ name: 'broken.json', mimeType: 'application/json', buffer: Buffer.from('{bad') });
  await expect(page.getByRole('alert')).toContainText('not valid JSON');
  await input.setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(bundle)) });
  await expect(page.getByLabel('Session notes')).toHaveValue('Imported note');
  await page.getByLabel('Session notes').fill('Saved with the recording');
  await page.getByRole('button', { name: 'Save session details' }).click();
  await expect(page.getByRole('status')).toContainText('Saved with recording');
  await page.reload();
  await connect();
  await page.getByRole('button', { name: 'Open session portable-test' }).click();
  await expect(page.getByLabel('Session notes')).toHaveValue('Saved with the recording');
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export recording' }).click();
  const file = await downloading;
  const exported = JSON.parse(await readFile(await file.path(), 'utf8'));
  expect(exported.samples).toHaveLength(2);
  expect(exported.version).toBe(1);
  expect(exported.annotation.notes).toBe('Saved with the recording');
  await page.getByRole('button', { name: 'Back to sessions' }).click();
  await input.setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(bundle)) });
  await expect(page.getByRole('alert')).toContainText('Nothing was overwritten');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/import-mobile.png', fullPage: true });
});
