import {test,expect} from '@playwright/test';

test('connection and review handoffs preserve the exact recorded session', async ({page}) => {
  let finished = false;
  let listRequests = 0;
  const session = {id:'journey-session',car_id:82,source:'console',started_at:100,ended_at:200,samples:22,
    top_speed:180,end_reason:'off_track',laps:[{lap:1,time_ms:90000},{lap:2,time_ms:89000}]};
  await page.route('http://127.0.0.1:4181/**', route => {
    const url = route.request().url();
    if (url.endsWith('/sessions')) listRequests++;
    if (url.endsWith('/annotations')) return route.fulfill({json:route.request().postDataJSON().annotation});
    if (url.includes('/export')) expect(new URL(url).searchParams.get('session')).toBe(session.id);
    return route.fulfill({json:url.includes('/export') ? [] : url.endsWith('/sessions') ? [{...session,id:'older-session',started_at:50}] : {
      source:'console',stale:false,session:finished ? null : session,last_session:finished ? session : null,
      sample:{captured_at:Date.now()/1000,car_id:82,on_track:!finished,paused:false,loading:false,
        speed:100,rpm:4000,gear:3,lap:3,fuel:50,throttle:60,brake:0,tyres:[80,80,80,80]},
    }});
  });
  await page.goto('/#Race%20engineer');
  await page.getByRole('button',{name:'Connect companion',exact:true}).click();
  await expect(page).toHaveURL(/Live%20telemetry/);
  await page.getByLabel('Companion pairing code').fill('test-code');
  await page.getByRole('button',{name:'Connect',exact:true}).click();
  await page.getByRole('button',{name:'Open race engineer'}).click();
  await expect(page).toHaveURL(/Race%20engineer/);
  await page.getByRole('radio',{name:'Time trial',exact:true}).check();
  await page.getByRole('button',{name:'Start engineer'}).click();
  finished = true;
  await page.getByRole('button',{name:'Review saved session'}).click();
  await expect(page.getByRole('button',{name:'Back to sessions'})).toBeVisible();
  await expect(page.getByRole('region',{name:'Session car'})).toContainText("Toyota Supra RZ '97");
  await page.getByLabel('Track (manual)').fill('Trial Mountain');
  await page.getByRole('button',{name:'Save session details'}).click();
  await expect(page.getByRole('status').filter({hasText:'Saved with recording on this PC.'})).toBeVisible();
  const requestsBefore = listRequests;
  await expect.poll(() => listRequests).toBeGreaterThan(requestsBefore);
  await expect(page.getByRole('button',{name:'Back to sessions'})).toBeVisible();
  await expect(page.getByLabel('Track (manual)')).toHaveValue('Trial Mountain');
  await page.getByRole('button',{name:'Analyze laps'}).click();
  await expect(page).toHaveURL(/Lap%20analysis/);
  const bar = page.getByRole('region',{name:'Running engineer'});
  await expect(bar).toContainText('Time trial engineer');
  await expect(bar).toContainText('Waiting for active driving');
  await bar.getByRole('button',{name:'Mute engineer',exact:true}).click();
  await expect(bar.getByRole('button',{name:'Unmute engineer'})).toHaveAttribute('aria-pressed','true');
  await bar.getByRole('button',{name:'Return to engineer'}).click();
  await expect(bar).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Unmute engineer'})).toHaveAttribute('aria-pressed','true');
  await page.getByRole('button',{name:'Live telemetry',exact:true}).click();
  await page.getByRole('button',{name:'Review saved session'}).click();
  await expect(page.getByRole('button',{name:'Back to sessions'})).toBeVisible();
  await bar.getByRole('button',{name:'Unmute engineer'}).click();
  await expect(bar).toContainText('Waiting for active driving');
  await page.screenshot({path:'test-results/engineer-bar-desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await page.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));
  await expect(bar).toBeInViewport();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({path:'test-results/engineer-bar-mobile.png'});
  await bar.getByRole('button',{name:'Stop engineer'}).click();
  await expect(bar).toHaveCount(0);
  await expect(page.getByRole('heading',{name:'Sessions',exact:true})).toBeFocused();
  await page.setViewportSize({width:1440,height:1100});
  await page.getByRole('button',{name:'Race engineer',exact:true}).click();
  await expect(page.getByRole('button',{name:'Start engineer'})).toBeVisible();
  await expect(page.getByRole('region',{name:'Engineer readiness'})).toContainText('Connected');
  await page.setViewportSize({width:390,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({path:'test-results/journey-mobile.png',fullPage:true});
});
