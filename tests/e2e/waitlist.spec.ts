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
