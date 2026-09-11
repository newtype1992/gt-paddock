import {test,expect} from '@playwright/test';

test('pairing help, masked reveal, invalid code recovery and successful retry', async ({page}) => {
  await page.route('http://127.0.0.1:4181/**', route => {
    const valid = route.request().headers().authorization === 'Bearer current-test-code';
    return route.fulfill({status:valid ? 200 : 401,json:valid ? (route.request().url().endsWith('/sessions') ? [] : {source:'console',session:null,sample:null}) : {error:'Pairing code is invalid'}});
  });
  await page.goto('/#Live%20telemetry');
  await page.getByText('Where do I find my pairing code?').click();
  await expect(page.getByText('Start GT Paddock Companion.cmd',{exact:true})).toBeVisible();
  const field = page.getByLabel('Companion pairing code');
  await field.fill('old-code');
  await expect(field).toHaveAttribute('type','password');
  await page.getByRole('button',{name:'Show pairing code'}).click();
  await expect(field).toHaveAttribute('type','text');
  await page.getByRole('button',{name:'Connect',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('expired or invalid');
  await expect(field).toBeEnabled();
  await expect(field).toHaveValue('');
  await field.fill('current-test-code');
  await page.getByRole('button',{name:'Connect',exact:true}).click();
  await expect(field).toBeDisabled();
  await expect(field).toHaveAttribute('type','password');
  await expect(page.getByRole('button',{name:'Open race engineer'})).toBeVisible();
  expect(await page.evaluate(()=>JSON.stringify({...localStorage,...sessionStorage}))).not.toContain('current-test-code');
  expect(page.url()).not.toContain('current-test-code');
  await page.getByRole('button',{name:'Disconnect',exact:true}).click();
  await page.screenshot({path:'test-results/pairing-desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({path:'test-results/pairing-mobile.png',fullPage:true});
});
