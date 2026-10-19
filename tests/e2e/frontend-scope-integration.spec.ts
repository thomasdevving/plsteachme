import { test, expect } from '@playwright/test';
import { trialFixture, trialUser } from './trial-fixture';

test.use({serviceWorkers:'block'});

test('the current illustrated frontend retains subscriptions alongside the new platform',async({page,request})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/');
  await expect(page.getByRole('heading',{level:1})).toHaveText('A tutorial shows you, plsteach.me guides you.');
  await expect(page.locator('#hero-preview')).toBeVisible();
  await expect(page.locator('.hero .mascot--waving .mascot-illustration')).toBeVisible();
  await expect(page.locator('.module-rail .skill-card')).toHaveCount(9);
  expect(await page.locator('.hero .mascot-illustration').evaluate(element=>getComputedStyle(element).backgroundImage)).toContain('/mascots/expressive-atlas.webp');
  const sprite=await request.get('/mascots/expressive-atlas.webp');
  expect(sprite.status()).toBe(200);expect(sprite.headers()['content-type']).toContain('image/webp');
  const entries=page.locator('.scope-entry');
  for(const [label,path] of [['Explore learning journeys','/learn'],['Visit the request board','/community'],['Open the teacher studio','/teach']])await expect(entries.getByRole('link',{name:label})).toHaveAttribute('href',path);
  await page.goto('/subscriptions');
  await expect(page.locator('.subscription-plan h2')).toHaveText(['Starter','Plus','For organizations']);
  await expect(page.locator('.plan-price>p')).toHaveText(['$6','$20','$100–$500']);
  await expect(page.locator('.plan-price>span')).toHaveText(['per month','per month','per month']);
  await expect(page.locator('.plan-availability')).toHaveText(['Coming soon','Coming soon','Coming soon']);
  await expect(page.locator('.plan-plus .mascot--peeking')).toBeVisible();
  await expect(page.getByText('Free during demo',{exact:true})).toHaveCount(0);
  await expect(page.getByText('$9.99',{exact:false})).toHaveCount(0);
});

test('the restored account journey preserves one free session and returns to existing plans',async({page})=>{
  let account:{configured:boolean;user:typeof trialUser|null;trial:ReturnType<typeof trialFixture>|null}={configured:true,user:null,trial:null};
  await page.route('**/api/auth/session',route=>route.fulfill({json:account}));
  await page.goto('/coach/session/tie-four-in-hand');
  await expect(page.getByRole('heading',{name:'A little help starts here.'})).toBeVisible();
  const signup=page.getByRole('link',{name:'Create an account',exact:true});
  await expect(signup).toHaveAttribute('href','/signup?next=%2Fcoach%2Fsession%2Ftie-four-in-hand');
  await signup.click();
  await expect(page.getByRole('heading',{level:1})).toHaveText('A little help starts here.');
  await expect(page.locator('.auth-trial-note')).toContainText('One free coaching session.');
  await expect(page.locator('.auth-companions .mascot')).toHaveCount(2);
  expect(new URL(page.url()).searchParams.get('next')).toBe('/coach/session/tie-four-in-hand');
  account={configured:true,user:trialUser,trial:null};
  await page.goto('/coach/session/tie-four-in-hand');
  await expect(page.getByRole('button',{name:'Start my free session'})).toBeVisible();
  await expect(page.getByText('One session per account. No payment details needed.')).toBeVisible();
  account={configured:true,user:trialUser,trial:{...trialFixture('tie-four-in-hand'),completed_steps:7,completed_at:'2026-10-17T12:30:00Z'} as ReturnType<typeof trialFixture>};
  await page.goto('/account');
  await expect(page.getByRole('heading',{name:'Your free session is complete.'})).toBeVisible();
  await page.getByRole('link',{name:'Explore plans'}).click();
  await expect(page).toHaveURL(/\/subscriptions$/);
  await expect(page.locator('.plan-price>p')).toHaveText(['$6','$20','$100–$500']);
  await expect(page.locator('.plan-availability')).toHaveText(['Coming soon','Coming soon','Coming soon']);
});

test('new learning pages share the existing account entitlement while written lessons remain usable',async({page})=>{
  let account:{configured:boolean;user:typeof trialUser|null;trial:ReturnType<typeof trialFixture>|null}={configured:true,user:null,trial:null};
  await page.route('**/api/auth/session',route=>route.fulfill({json:account}));
  await page.route('**/api/coaching/session',route=>route.fulfill({json:{available:true}}));
  await page.goto('/learn?skill=tie');
  const gate=page.getByRole('complementary',{name:'Coaching session'});
  await expect(gate.getByRole('link',{name:'Create an account',exact:true})).toHaveAttribute('href','/signup?next=%2Flearn%3Fskill%3Dtie');
  await expect(page.locator('.camera-coach,.lesson-questions')).toHaveCount(0);
  await page.getByRole('button',{name:'Next lesson step',exact:true}).click();
  await expect(page.locator('.lesson-step')).toHaveText('Step 2 of 7');
  account={configured:true,user:trialUser,trial:{...trialFixture('tie-four-in-hand'),completed_steps:7,completed_at:'2026-10-17T12:30:00Z'}};
  await page.reload();
  await expect(gate).toContainText('You’ve used your free session.');
  await expect(gate.getByRole('link',{name:'Explore plans'})).toHaveAttribute('href','/subscriptions');
  await expect(page.locator('.camera-coach,.lesson-questions')).toHaveCount(0);
});
