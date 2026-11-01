import { test, expect } from '@playwright/test';
import { installActiveTrial } from './trial-fixture';

test.use({launchOptions:{args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']}});
test('the reviewer can open coaching across lessons without claiming a free trial',async({page})=>{
 await installActiveTrial(page);
 await page.route('**/api/auth/session',route=>route.fulfill({json:{configured:true,user:{id:'11111111-1111-4111-8111-111111111111',email:'contact@plsteach.me'},trial:null,unlimitedCoaching:true}}));
 let trialCalls=0;const checks:Record<string,string>[]=[];
 await page.route('**/api/trial',route=>{trialCalls++;return route.fulfill({status:403,json:{error:'No trial should be claimed.'}});});
 await page.route('**/api/coaching/session',route=>route.fulfill({json:route.request().method()==='GET'?{available:true}:{accepted:true}}));
 await page.route('**/api/coaching/check',route=>{checks.push(route.request().headers());return route.fulfill({json:{skill:'tie',step:0,feedback:{status:'unclear',confidence:'low',observation:'The knot is not clear.',guidance:'Show both tie ends.'}}});});
 await page.goto('/learn/tie');await page.getByRole('button',{name:'Coach',exact:true}).click();
 const coach=page.locator('.camera-coach');
 await expect(coach.getByRole('button',{name:'Start camera coaching'})).toBeVisible();
 await coach.getByRole('checkbox',{name:'I am 16 or older.'}).check();
 await coach.getByRole('checkbox',{name:'I agree to automatic image checks'}).check();
 await coach.getByRole('button',{name:'Start camera coaching'}).click();
 await coach.getByRole('button',{name:'Skip this step'}).click();
 await expect.poll(()=>checks.length).toBeGreaterThan(0);
 expect(checks[0]['x-coaching-session']).toBeUndefined();
 await coach.getByRole('button',{name:'Stop camera'}).click();
 await page.goto('/learn/laundry');await page.getByRole('button',{name:'Coach',exact:true}).click();
 await expect(page.locator('.camera-coach').getByRole('button',{name:'Start camera coaching'})).toBeVisible();
 expect(trialCalls).toBe(0);
 await page.goto('/account');
 await expect(page.getByRole('heading',{name:'Unlimited coaching access.'})).toBeVisible();
 await expect(page.getByRole('link',{name:'Start learning',exact:true})).toHaveAttribute('href','/learn');
});
