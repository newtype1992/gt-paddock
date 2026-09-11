import { test, expect } from '@playwright/test';

test('time trial compares previous laps and reports entered-target streaks', async ({page}) => {
  const laps = [];
  await page.addInitScript(() => Object.defineProperty(window,'speechSynthesis',{value:undefined}));
  await page.route('http://127.0.0.1:4181/**', route => {
    const session = {id:'trial-streak',car_id:82,started_at:Date.now()/1000,source:'console',laps};
    return route.fulfill({json:route.request().url().endsWith('/sessions') ? [session] : {
      source:'console',stale:false,session,
      sample:{captured_at:Date.now()/1000,car_id:82,on_track:true,paused:false,loading:false,lap:laps.length+1,
        speed:100,rpm:4000,gear:3,fuel:50,tyres:[80,80,80,80],throttle:60,brake:0},
    }});
  });
  await page.goto('/#Live%20telemetry');
  await page.getByLabel('Companion pairing code').fill('testing-pair-code');
  await page.getByRole('button',{name:'Connect',exact:true}).click();
  await expect(page.getByText('Live',{exact:true}).first()).toBeVisible();
  await page.getByRole('button',{name:'Race engineer',exact:true}).click();
  await expect(page.getByLabel('Previous-lap comparison')).toHaveCount(0);
  await page.getByRole('radio',{name:'Time trial',exact:true}).check();
  await expect(page.getByLabel('Engineer voice')).not.toBeVisible();
  await page.getByText('Advanced settings',{exact:true}).click();
  await expect(page.getByLabel('Previous-lap comparison')).toBeChecked();
  await expect(page.getByLabel('Target streaks (entered target)')).toBeChecked();
  await page.getByLabel('Target lap time').fill('1:30');
  await page.getByRole('button',{name:'Start engineer'}).click();
  await expect(page.getByText('Listening to live telemetry')).toBeVisible();
  await page.waitForTimeout(400);
  laps.push({lap:1,time_ms:89000});
  await expect(page.locator('.engineer-history li')).toHaveCount(1);
  await page.waitForTimeout(6200);
  laps.push({lap:2,time_ms:88500});
  await expect(page.locator('.engineer-history li').first()).toContainText('0.500 seconds quicker than your previous recorded lap.');
  await page.waitForTimeout(6200);
  laps.push({lap:3,time_ms:88000});
  await expect(page.locator('.engineer-history li').first()).toContainText('3 consecutive recorded laps at or below your target.');
  await page.getByRole('main').getByRole('button',{name:'Settings',exact:true}).click();
  await page.getByRole('dialog').getByText('Advanced settings',{exact:true}).click();
  await expect(page.getByLabel('Previous-lap comparison')).toBeDisabled();
  await expect(page.getByLabel('Target streaks (entered target)')).toBeDisabled();
  await page.screenshot({path:'test-results/trial-callouts-desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  expect(await page.getByRole('dialog').evaluate(el=>el.scrollWidth <= el.clientWidth)).toBe(true);
  await page.screenshot({path:'test-results/trial-callouts-mobile.png',fullPage:true});
});

test('engineer speaks once, survives navigation, cancels off track and fits mobile', async ({ page }) => {
  await page.addInitScript(() => {
    window.engineerSpeech = { spoken: [], cancellations: 0 };
    window.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
    Object.defineProperty(window, 'speechSynthesis', { value: {
      getVoices: () => [{ voiceURI: 'local', name: 'Local test voice', lang: 'en-US', localService: true }],
      addEventListener() {}, removeEventListener() {},
      cancel() { window.engineerSpeech.cancellations++; },
      speak(u) { window.engineerSpeech.spoken.push(u.text); window.currentUtterance = u; u.onstart?.(); },
    } });
  });
  let paused = false;
  let stale = false;
  const laps = [];
  await page.route('http://127.0.0.1:4181/**', route => {
    const session = { id:'engineer-test', car_id:82, started_at:Date.now()/1000, source:'console', laps };
    return route.fulfill({ json: route.request().url().endsWith('/sessions') ? [session] : {
      source:'console', stale, session,
      sample:{ captured_at:Date.now()/1000, car_id:82, packet_id:1, speed:100, rpm:4000, gear:3,
        on_track:true, paused, loading:false, lap:laps.length+1, fuel:60, tyres:[80,80,80,80], throttle:60, brake:0 },
    } });
  });
  await page.goto('/#Live%20telemetry');
  await page.getByLabel('Companion pairing code').fill('testing-pair-code');
  await page.getByRole('button', {name:'Connect',exact:true}).click();
  await expect(page.getByText('Live',{exact:true}).first()).toBeVisible();
  await page.getByRole('button',{name:'Race engineer',exact:true}).click();
  await page.getByRole('radio',{name:'Time trial',exact:true}).check();
  await expect(page.getByLabel('Connection alerts (including off-track)')).not.toBeChecked();
  await page.getByText('Advanced settings',{exact:true}).click();
  await page.getByLabel('Connection alerts (including off-track)').check();
  await page.getByRole('button',{name:'Start engineer'}).click();
  await expect(page.getByText('Listening to live telemetry')).toBeVisible();
  await page.waitForTimeout(400);
  laps.push({lap:1,time_ms:90000});
  await expect(page.locator('.engineer-history').getByText('Lap 1, 1 minute 30.0 seconds.',{exact:true})).toBeVisible();
  await expect(page.getByRole('region',{name:'Pit radio console'})).toHaveAttribute('data-speaking','true');
  await expect(page.getByLabel('Target lap time')).not.toBeVisible();
  await page.getByRole('main').getByRole('button',{name:'Settings',exact:true}).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('radio',{name:'Time trial',exact:true})).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.getByRole('main').getByRole('button',{name:'Settings',exact:true})).toBeFocused();
  await page.emulateMedia({reducedMotion:'reduce'});
  expect(await page.locator('.pit-radio-signal i').first().evaluate(el=>getComputedStyle(el).animationName)).toBe('none');
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.screenshot({path:'test-results/radio-transmitting.png',fullPage:true});
  await page.evaluate(()=>window.currentUtterance.onend());
  await expect(page.getByRole('region',{name:'Pit radio console'})).toHaveAttribute('data-speaking','false');
  const count = await page.evaluate(() => window.engineerSpeech.cancellations);
  await page.getByRole('button',{name:'Sessions',exact:true}).click();
  await expect(page.getByRole('region',{name:'Running engineer'})).toContainText('Monitoring');
  await page.waitForTimeout(1300);
  expect(await page.evaluate(() => window.engineerSpeech.cancellations)).toBe(count);
  expect(await page.evaluate(() => window.engineerSpeech.spoken.filter(t=>t.startsWith('Lap 1')).length)).toBe(1);
  paused = true;
  await expect.poll(() => page.evaluate(() => window.engineerSpeech.cancellations)).toBeGreaterThan(count);
  await page.getByRole('button',{name:'Race engineer',exact:true}).click();
  await expect(page.getByText('Waiting for active driving')).toBeVisible();
  expect(await page.evaluate(() => window.engineerSpeech.spoken.some(t => t.includes('connection lost')))).toBe(false);
  stale = true;
  await expect(page.locator('.engineer-history').getByText('Telemetry connection lost.',{exact:true})).toBeVisible();
  const lostCancelCount = await page.evaluate(() => window.engineerSpeech.cancellations);
  await page.waitForTimeout(800);
  expect(await page.evaluate(() => window.engineerSpeech.cancellations)).toBe(lostCancelCount);
  expect(await page.evaluate(() => window.engineerSpeech.spoken.filter(t => t.includes('connection lost')).length)).toBe(1);
  stale = false;
  await expect(page.locator('.engineer-history').getByText('Telemetry connection restored.',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Mute engineer',exact:true}).click();
  await expect(page.getByRole('button',{name:'Unmute engineer'})).toHaveAttribute('aria-pressed','true');
  await expect(page.getByRole('region',{name:'Pit radio console'})).toHaveAttribute('data-speaking','false');
  await page.screenshot({path:'test-results/engineer-desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({path:'test-results/engineer-mobile.png',fullPage:true});
  await page.getByRole('button',{name:'Stop engineer'}).click();
  await expect(page.getByText('Stopped',{exact:true})).toBeVisible();
  await expect(page.getByLabel('Target lap time')).toBeVisible();
});

test('unsupported speech keeps race pit reminders available as text', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, 'speechSynthesis', { value: undefined }));
  const laps = [];
  await page.route('http://127.0.0.1:4181/**', route => {
    const session = {id:'text-test', car_id:82, started_at:Date.now()/1000, source:'console', laps};
    return route.fulfill({json:route.request().url().endsWith('/sessions') ? [session] : {
      source:'console', stale:false, session,
      sample:{captured_at:Date.now()/1000,car_id:82,on_track:true,paused:false,loading:false,lap:laps.length+1,
        speed:100,rpm:4000,gear:3,fuel:50,tyres:[80,80,80,80],throttle:60,brake:0},
    }});
  });
  await page.goto('/#Live%20telemetry');
  await page.getByLabel('Companion pairing code').fill('testing-pair-code');
  await page.getByRole('button',{name:'Connect',exact:true}).click();
  await expect(page.getByText('Live',{exact:true}).first()).toBeVisible();
  await page.getByRole('button',{name:'Race engineer',exact:true}).click();
  await expect(page.getByText('Voice unavailable. Callouts will appear as text.')).toBeVisible();
  await expect(page.getByRole('region',{name:'Engineer readiness'})).toContainText('Connected');
  await expect(page.getByRole('region',{name:'Engineer readiness'})).toContainText('Text only');
  await expect(page.getByLabel('Engineer voice')).not.toBeVisible();
  await page.screenshot({path:'test-results/engineer-essentials-desktop.png',fullPage:true});
  await page.getByLabel('Race length (laps)').fill('5');
  await page.getByLabel('Planned pit lap').fill('6');
  await page.getByRole('button',{name:'Start engineer'}).click();
  await expect(page.getByRole('alert')).toContainText('within the race');
  await page.getByLabel('Planned pit lap').fill('2');
  await page.getByLabel('Target lap time').fill('1:90');
  await page.getByRole('button',{name:'Start engineer'}).click();
  await expect(page.getByRole('alert')).toContainText('positive target lap time');
  await page.getByLabel('Target lap time').fill('1:30.500');
  await page.getByRole('button',{name:'Start engineer'}).click();
  await expect(page.getByText('Listening to live telemetry')).toBeVisible();
  await expect(page.getByRole('region',{name:'Current engineer plan'})).toContainText('Target: 1:30.500');
  await expect(page.getByRole('region',{name:'Current engineer plan'})).toContainText('Race length: 5 laps');
  await expect(page.getByRole('region',{name:'Current engineer plan'})).toContainText('Pit lap: 2');
  await page.waitForTimeout(400);
  laps.push({lap:1,time_ms:90000});
  await expect(page.locator('.engineer-history').getByText(/Pit this lap according to your plan\./)).toBeVisible();
  await expect(page.locator('.engineer-history').getByText(/0.500 seconds quicker than your target lap time/)).toBeVisible();
  await expect(page.locator('.engineer-history').getByText(/4 laps remaining in your entered race plan/)).toBeVisible();
  await expect(page.getByRole('region',{name:'Pit radio console'})).toHaveAttribute('data-speaking','false');
  await page.getByRole('main').getByRole('button',{name:'Settings',exact:true}).click();
  await expect(page.getByLabel('Target lap time')).toBeDisabled();
  await page.screenshot({path:'test-results/radio-settings-desktop.png',fullPage:true});
  await page.getByRole('button',{name:'Close engineer settings'}).click();
  await page.screenshot({path:'test-results/engineer-race-desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({path:'test-results/engineer-race-mobile.png',fullPage:true});
  expect(await page.locator('.pit-radio-stats').evaluate(el => [...el.children].every(cell => {
    const label = cell.querySelector('dt').getBoundingClientRect();
    const value = cell.querySelector('dd').getBoundingClientRect();
    return label.bottom <= value.top && value.right <= cell.getBoundingClientRect().right;
  }))).toBe(true);
  await page.getByRole('main').getByRole('button',{name:'Settings',exact:true}).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(await page.getByRole('dialog').evaluate(el=>el.scrollWidth <= el.clientWidth)).toBe(true);
  await page.screenshot({path:'test-results/radio-settings-mobile.png',fullPage:true});
  await page.getByRole('button',{name:'Close engineer settings'}).click();
  await page.getByRole('button',{name:'Stop engineer'}).click();
  await expect(page.getByLabel('Target lap time')).toHaveValue('1:30.500');
  await expect(page.getByLabel('Engineer voice')).not.toBeVisible();
  await page.getByText('Advanced settings',{exact:true}).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByLabel('Engineer voice')).toBeVisible();
  await page.getByLabel('Callout frequency').selectOption('key');
  await page.getByText('Advanced settings',{exact:true}).click();
  await page.screenshot({path:'test-results/engineer-essentials-mobile.png',fullPage:true});
  await page.getByRole('button',{name:'Start engineer'}).click();
  await expect(page.getByRole('region',{name:'Current engineer plan'})).toContainText('Key updates');
});
