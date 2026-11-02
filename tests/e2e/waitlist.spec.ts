import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('registration joins the waitlist, displays the real total, and never creates an auth account',async({page})=>{
 let authCalls=0;let submission:Record<string,unknown>|null=null;
 await page.route('**/api/auth/action',route=>{authCalls++;return route.fulfill({status:403,json:{error:'Registration closed'}});});
 await page.route('**/api/waitlist',route=>{
  if(route.request().method()==='POST'){submission=route.request().postDataJSON();return route.fulfill({json:{accepted:true}});}
  return route.fulfill({json:{count:1234}});
 });
 await page.route('**/api/session',route=>route.fulfill({json:{referral:'test-referral'}}));
 await page.goto('/signup?next=%2Flearn');
 await expect(page).toHaveTitle(/Join the waitlist/);
 await expect(page.getByRole('heading',{name:'Join the waitlist.'})).toBeVisible();
 await expect(page.locator('.waitlist-count')).toHaveText('1,234 people on the waitlist.');
 await expect(page.getByLabel('Username',{exact:true})).toHaveCount(0);
 await expect(page.getByLabel('Password',{exact:true})).toHaveCount(0);
 await expect(page.locator('#waitlist-note')).toContainText('does not create an account');
 await page.screenshot({path:test.info().outputPath('waitlist-desktop.png'),fullPage:true});
 await page.getByLabel('How old are you?').selectOption('25-34');
 await page.getByLabel('Your email address',{exact:true}).fill('learner@example.test');
 await page.getByRole('checkbox').check();
 const checkbox=(await page.getByRole('checkbox').boundingBox())!;
 const consentText=(await page.locator('.checkbox-row span').boundingBox())!;
 expect(checkbox.width).toBeLessThanOrEqual(24);
 expect(Math.abs(checkbox.y-consentText.y)).toBeLessThan(6);
 expect(consentText.x).toBeGreaterThan(checkbox.x+checkbox.width);
 expect((await new AxeBuilder({page}).include('#main').withTags(['wcag2a','wcag2aa']).analyze()).violations).toEqual([]);
 await page.getByRole('button',{name:'Join the waitlist',exact:true}).click();
 await page.waitForURL('**/thanks');
 await expect(page.getByRole('heading',{name:'You’re on the list.'})).toBeVisible();
 expect(submission).toMatchObject({email:'learner@example.test',age:'25-34',consent:true,skills:[]});
 expect(submission).not.toHaveProperty('password');expect(authCalls).toBe(0);
});

test('waitlist count failure is honest and does not hide the waitlist form on a phone',async({page})=>{
 await page.setViewportSize({width:375,height:812});
 await page.route('**/api/waitlist',route=>route.fulfill({status:503,json:{count:null}}));
 await page.goto('/signup');
 await expect(page.locator('.waitlist-count')).toHaveText('The waitlist count is temporarily unavailable.');
 await expect(page.getByRole('button',{name:'Join the waitlist',exact:true})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 await page.screenshot({path:test.info().outputPath('waitlist-mobile.png'),fullPage:true});
});

test('existing members keep the same login form with a waitlist link for new users',async({page})=>{
 await page.goto('/login');
 await expect(page.getByRole('heading',{name:'Welcome back.'})).toBeVisible();
 await expect(page.getByLabel('Email or username')).toBeVisible();
 await expect(page.getByLabel('Password',{exact:true})).toBeVisible();
 const link=page.getByRole('link',{name:'Join the waitlist',exact:true});
 await expect(link).toHaveAttribute('href',/\/signup/);
 await link.click();
 await expect(page.getByRole('heading',{name:'Join the waitlist.'})).toBeVisible();
});

for(const viewport of [{width:1440,height:900},{width:375,height:812},{width:320,height:568}]) {
 test(`confirmation fits ${viewport.width}×${viewport.height} and submits the follow-up skill`,async({page})=>{
  await page.setViewportSize(viewport);
  await page.addInitScript(()=>{Object.defineProperty(navigator,'share',{configurable:true,value:async()=>{}});});
  await page.route('**/api/session',route=>route.fulfill({json:{referral:'test-referral'}}));
  let answer:Record<string,unknown>|null=null;
  await page.route('**/api/followup',route=>{answer=route.request().postDataJSON();return route.fulfill({json:{accepted:true}});});
  await page.goto('/thanks');
  await expect(page.getByRole('heading',{name:'You’re on the list.'})).toBeVisible();
  await expect(page.locator('.thanks-mascot .mascot--waving')).toBeVisible();
  const logo=await page.locator('header .wordmark').evaluate(el=>({imageWidth:getComputedStyle(el.querySelector('.brand-logo')!).width,frameWidth:getComputedStyle(el.querySelector('.brand-symbol')!).width}));
  expect(logo.imageWidth).toBe(logo.frameWidth);
  await expect(page.getByRole('button',{name:'Send your answer'})).toBeVisible();
  expect(await page.evaluate(()=>({height:document.documentElement.scrollHeight,width:document.documentElement.scrollWidth}))).toEqual({height:viewport.height,width:viewport.width});
  for(const control of [page.getByRole('button',{name:'Send your answer'}),page.getByRole('button',{name:'Copy your link'}),page.getByRole('link',{name:'Privacy statement',exact:true})]){
   const box=(await control.boundingBox())!;expect(box.y).toBeGreaterThanOrEqual(0);expect(box.y+box.height).toBeLessThanOrEqual(viewport.height);
  }
  expect((await new AxeBuilder({page}).include('.confirmation-page').withTags(['wcag2a','wcag2aa']).analyze()).violations).toEqual([]);
  await page.screenshot({path:test.info().outputPath('confirmation.png'),fullPage:true});
  await page.getByRole('textbox',{name:'What’s one skill you wish someone had taught you?',exact:true}).fill('Learning to braid hair');
  await page.getByRole('button',{name:'Send your answer'}).click();
  await expect(page.locator('.thanks-saved')).toHaveText('Thanks for sharing.');
  expect(answer).toEqual({answer:'Learning to braid hair',website:''});
  await page.screenshot({path:test.info().outputPath('confirmation-saved.png'),fullPage:true});
 });
}

test('mail removal requires an explicit action and never happens just by opening the email link',async({page})=>{
 const token='11111111-1111-4111-8111-111111111111.'+'A'.repeat(43);let calls=0;
 await page.route('**/api/waitlist/unsubscribe',route=>{
  calls++;expect(route.request().method()).toBe('POST');expect(route.request().postDataJSON()).toEqual({token});
  return route.fulfill({json:{removed:true}});
 });
 await page.goto('/unsubscribe#token='+token);
 await expect(page.getByRole('button',{name:'Remove me from the waitlist'})).toBeVisible();
 expect(calls).toBe(0);
 await page.getByRole('button',{name:'Remove me from the waitlist'}).click();
 await expect(page.getByRole('heading',{name:'You’re off the list.'})).toBeVisible();
 expect(calls).toBe(1);expect(new URL(page.url()).hash).toBe('');
});

test('a failed confirmation email is shown honestly and the same form can retry',async({page})=>{
 let attempts=0;
 await page.route('**/api/waitlist',route=>{
  if(route.request().method()==='GET')return route.fulfill({json:{count:12}});
  attempts++;
  return route.fulfill(attempts===1?{status:503,json:{error:'email',saved:true}}:{json:{accepted:true}});
 });
 await page.route('**/api/session',route=>route.fulfill({json:{referral:'test-referral'}}));
 await page.goto('/signup');await page.getByLabel('How old are you?').selectOption('25-34');
 await page.getByLabel('Your email address',{exact:true}).fill('learner@example.test');await page.getByRole('checkbox').check();
 await page.getByRole('button',{name:'Join the waitlist',exact:true}).click();
 await expect(page.locator('.signup-form').getByRole('alert')).toContainText('confirmation email could not be sent');
 await expect(page.getByLabel('Your email address',{exact:true})).toHaveValue('learner@example.test');
 await page.getByRole('button',{name:'Join the waitlist',exact:true}).click();
 await page.waitForURL('**/thanks');expect(attempts).toBe(2);
});
