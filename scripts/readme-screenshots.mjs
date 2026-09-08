import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

// Isolated, synthetic data only: never contact the user's companion or cloud.
const browser = await chromium.launch({ channel: 'chrome' });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  const page = await context.newPage();
  const start = Date.parse('2026-09-01T18:00:00Z') / 1000;
  const durations = [90000, 91400];
  const samples = [];
  for (let lap = 1; lap <= 2; lap++) {
    const duration = durations[lap - 1] / 1000;
    for (let tick = 0; tick < durations[lap - 1] / 100; tick++) {
      const t = tick / 10;
      const phase = t / duration;
      const speed = 165 + 75 * Math.sin(phase * Math.PI * 8);
      samples.push({ packet_id: samples.length, car_id: 82, lap,
        captured_at: start + (lap === 2 ? 90 : 0) + t,
        speed, rpm: 3500 + speed * 17, gear: speed > 190 ? 5 : speed > 130 ? 4 : 3,
        throttle: speed > 130 ? 85 : 25, brake: speed < 110 ? 65 : 0,
        fuel: 43.8, tyres: [84, 86, 81, 83], on_track: true, paused: false, loading: false });
    }
  }
  samples.push({ ...samples.at(-1), packet_id: samples.length, lap: 3, captured_at: start + 181.4 });
  const session = { id: 'demo-supra-session', car_id: 82, source: 'console',
    started_at: start, ended_at: start + 181.4, samples: samples.length,
    top_speed: 240, state: 'completed', gaps: 0,
    laps: durations.map((time_ms, i) => ({ lap: i + 1, time_ms })) };
  let frame = 0;
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin === 'http://127.0.0.1:4181') {
      const sample = samples[(frame++ * 7) % 850];
      await route.fulfill({ json: url.pathname === '/export' ? samples
        : url.pathname === '/sessions' ? [session]
        : { source: 'console', stale: false, recording_state: 'recording',
            session: { ...session, state: 'recording' },
            sample: { ...sample, packet_id: frame, captured_at: Date.now() / 1000, last_lap_ms: 90000 },
            diagnostics: { silence_seconds: 0.1 } },
        headers: { 'Access-Control-Allow-Origin': 'http://127.0.0.1:4178' } });
    } else if (url.origin === 'http://127.0.0.1:4178' || url.hostname === 'www.gran-turismo.com') {
      await route.continue();
    } else await route.abort();
  });
  await page.goto('http://127.0.0.1:4178/#Live%20telemetry');
  await page.getByLabel('Companion pairing code').fill('demo-only-not-a-real-code');
  await page.getByRole('button', { name: 'Connect', exact: true }).click();
  await page.getByRole('region', { name: 'Current car' }).getByRole('heading', { name: "Toyota Supra RZ '97" }).waitFor();
  await mkdir('docs/images', { recursive: true });
  // Allow the rolling trace to acquire a useful demo window.
  await page.waitForTimeout(32000);
  await page.screenshot({ path: 'docs/images/live-telemetry.png', fullPage: true });
  await page.getByRole('button', { name: 'Sessions', exact: true }).click();
  await page.getByRole('button', { name: 'Open session demo-supra-session' }).click();
  await page.getByLabel('Track (manual)').fill('Trial Mountain');
  await page.getByLabel('Layout / variation').fill('Full circuit');
  await page.getByLabel('Direction', { exact: true }).selectOption('Forward');
  await page.getByLabel('Session notes').fill('Demo session: compare braking consistency across two synthetic laps.');
  await page.getByRole('button', { name: 'Save session details' }).click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'docs/images/sessions.png', fullPage: true });
  await page.getByRole('button', { name: 'Analyze laps' }).click();
  await page.getByRole('img', { name: 'Time delta by estimated distance' }).waitFor();
  await page.getByLabel('Distance cursor').fill('60');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'docs/images/lap-analysis.png', fullPage: true });
  console.log('Captured three README screenshots using isolated synthetic data.');
} finally {
  await browser.close();
}
