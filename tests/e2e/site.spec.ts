import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
test('English canonical pages and legacy redirects preserve query parameters', async ({ page }) => {
 for (const path of ['/','/organizations','/demo','/privacy','/thanks']) { const response=await page.goto(path); expect(response?.status()).toBe(200); await expect(page.locator('html')).toHaveAttribute('lang','en'); await expect(page.locator('h1')).toHaveCount(1); }
 for (const [alias,target] of [['/en','/'],['/nl','/'],['/organisaties','/organizations'],['/en/organizations','/organizations'],['/bedankt','/thanks']]) { await page.goto(`${alias}?ref=FRIEND`); expect(new URL(page.url()).pathname).toBe(target); expect(new URL(page.url()).searchParams.get('ref')).toBe('FRIEND'); }
});
test('mobile signup keeps first-touch attribution and uses an honest mock acknowledgement', async ({page}) => {
 await page.setViewportSize({width:375,height:812}); await page.goto('/?utm_source=tiktok&utm_campaign=tie&ref=FRIEND'); await page.locator('#age').selectOption('18-24'); await page.locator('#email').fill('test@example.com'); await page.getByRole('checkbox').check();
 const submission=page.waitForRequest(req=>req.url().endsWith('/api/waitlist') && req.method()==='POST'); await page.locator('.form-submit').click(); const req=await submission; expect(req.postDataJSON().attribution).toMatchObject({utm_source:'tiktok',utm_campaign:'tie',referral:'FRIEND',landing_path:'/',language:'en'}); await expect(page).toHaveURL(/\/thanks\?preview=1/); await expect(page.getByRole('heading',{name:'Your form has been tested.'})).toBeVisible();
});
test('under-16 submit sends no email, attribution, skills or free text',async({page})=>{
 await page.goto('/'); await page.locator('#email').fill('child@example.com'); await page.locator('#age').selectOption('under16'); await expect(page.locator('#email')).toHaveCount(0); const submission=page.waitForRequest(req=>req.url().endsWith('/api/waitlist') && req.method()==='POST'); await page.locator('.form-submit').click(); expect((await submission).postDataJSON()).toEqual({age:'under16',website:''}); await expect(page.locator('.signup-form .form-message')).toContainText('We won’t store your email address.');
});
test('organization form and skill vote work in mock mode',async({page})=>{
 await page.goto('/en/organizations'); await page.locator('#name').fill('Test Teacher'); await page.locator('#organization').fill('Test School'); await page.locator('#role').fill('Teacher'); await page.locator('#type').selectOption('school'); await page.locator('#email').fill('teacher@example.com'); await page.locator('#needs').fill('Tying ties'); await page.getByRole('checkbox').check(); await page.locator('.form-submit').click(); await expect(page.locator('.success-panel')).toContainText('No data has been stored');
 await page.goto('/en'); await page.getByRole('button',{name:'I want to learn this',exact:true}).first().click(); await page.getByRole('button',{name:'Yes, save my interest'}).click(); await expect(page.getByRole('button',{name:'Interest noted'})).toBeVisible();
});
test('server rejects invalid submissions, cross-origin requests, oversize payloads and honeypots',async({request})=>{
 const invalid=await request.post('/api/waitlist',{data:{age:'18-24',email:'bad'}}); expect(invalid.status()).toBe(400);
 const origin=await request.post('/api/waitlist',{data:{age:'under16'},headers:{Origin:'https://unrelated.example'}}); expect(origin.status()).toBe(403);
 const oversize=await request.post('/api/waitlist',{data:{age:'under16',extra:'x'.repeat(17000)}}); expect(oversize.status()).toBe(413);
 const trap=await request.post('/api/waitlist',{data:{age:'under16',website:'bot'}}); expect(await trap.json()).toEqual({accepted:true});
});
test('referral and follow-up use the server session rather than query-supplied identity',async({page})=>{
 await page.route('**/api/session',route=>route.fulfill({json:{referral:'SAFE123'}})); await page.goto('/en/thanks?id=someone-else'); await expect(page.locator('#referral')).toHaveValue(`${new URL(page.url()).origin}/?ref=SAFE123`); await page.locator('#answer').fill('Sew on a button'); const sent=page.waitForRequest(req=>req.url().endsWith('/api/followup')&&req.method()==='POST'); await page.getByRole('button',{name:'Send your answer'}).click(); expect((await sent).postDataJSON()).toEqual({answer:'Sew on a button',website:''}); await expect(page.getByText('Thanks for sharing.',{exact:true})).toBeVisible();
});
test('404 and production styleguide restrictions',async({page})=>{
 const missing=await page.goto('/a-page-that-does-not-exist'); expect(missing?.status()).toBe(404); await expect(page.getByRole('heading',{name:'Lost your way?'})).toBeVisible(); const dev=await page.goto('/dev/styleguide'); expect(dev?.status()).toBe(404);
});
test('no horizontal overflow, accessible landmarks and no serious accessibility violations',async({page})=>{
 for(const width of [375,1280]) { await page.setViewportSize({width,height:900}); for(const path of ['/','/organizations','/demo','/privacy']){ await page.goto(path); expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true); const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze(); expect(result.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))).toEqual([]); } }
});
test('cream canvas stays light under dark OS preference and reduced motion remains usable',async({page})=>{
 await page.emulateMedia({colorScheme:'dark',reducedMotion:'reduce'}); await page.goto('/en'); expect(await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--paper').trim())).toBe('#faf7f2'); const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa']).analyze(); expect(result.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))).toEqual([]); expect(await page.locator('.loop-node:first-child>span').evaluate(el=>getComputedStyle(el).animationName)).toBe('none');
});

test('module filters, previews and phone controls work with keyboard and reduced motion', async ({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'}); await page.goto('/');
 await expect(page.locator('.wordmark img')).toBeVisible(); await expect(page.locator('.phone')).toBeVisible();
 await expect(page.locator('.skill-card')).toHaveCount(9);
 await page.getByRole('button',{name:'Personal care'}).click(); await expect(page.locator('.skill-card')).toHaveCount(2);
 await page.getByRole('button',{name:'All skills'}).click();
 await page.getByRole('button',{name:'Explore preview: Do your laundry',exact:true}).click();
 await expect(page.locator('#module-preview')).toBeFocused(); await expect(page.locator('.lesson-copy')).toContainText('Read the care labels');
 await page.getByRole('button',{name:'Next preview step',exact:true}).click(); await expect(page.locator('.lesson-copy')).toContainText('measure the detergent');
 await page.getByRole('button',{name:'Close module preview'}).click(); await expect(page.getByRole('button',{name:'Explore preview: Do your laundry',exact:true})).toBeFocused();
 await page.getByRole('button',{name:'Next step',exact:true}).click(); await expect(page.locator('.coach-step')).toContainText('Step 4 of 7');
 await page.getByRole('button',{name:'Previous example step'}).click(); await expect(page.locator('.coach-step')).toContainText('Step 3 of 7');
 const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa']).analyze(); expect(result.violations.map(v=>v.id)).toEqual([]); const labels=await new AxeBuilder({page}).withRules(['label-content-name-mismatch']).analyze(); expect(labels.violations.map(v=>v.id)).toEqual([]);
});

test('hero modules change the phone preview and preserve a usable step flow', async ({page}) => {
 await page.emulateMedia({reducedMotion:'reduce'}); await page.goto('/');
 const choices = page.locator('.hero-module-options');
 await expect(choices.getByRole('button')).toHaveCount(6);
 for (const name of ['Shave','Sew on a button','Iron a shirt','Cook a simple meal','Care for your bike']) {
  const button=choices.getByRole('button',{name,exact:true}); await button.focus(); await page.keyboard.press('Enter');
  await expect(button).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('#hero-preview')).toHaveAccessibleName(`${name}: text preview`);
  await expect(page.locator('.coach-step')).toContainText('Step 1 of 3');
  await expect(page.locator('.phone-figure figcaption')).toContainText('no camera or AI feedback');
  await expect(page.getByRole('button',{name:'Previous example step'})).toBeDisabled();
  await page.getByRole('button',{name:'Next step',exact:true}).click();
  await expect(page.locator('.coach-step')).toContainText('Step 2 of 3');
 }
 await choices.getByRole('button',{name:'Tie a tie',exact:true}).click();
 await expect(page.locator('.coach-step')).toContainText('Step 3 of 7');
 await expect(page.locator('.tie-motion')).toBeVisible();
 expect(await page.locator('.tie-wide-end').evaluate(el=>getComputedStyle(el).animationName)).toBe('none');
 const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze(); expect(result.violations.map(v=>v.id)).toEqual([]);
});

test('tie artwork follows all seven lesson states, including back, reset and reduced motion', async ({page}) => {
 await page.emulateMedia({reducedMotion:'reduce'}); await page.goto('/');
 const art=page.locator('.tie-motion'); const fabric=page.locator('.tie-wide-end');
 await page.getByRole('button',{name:'Previous example step'}).click(); await page.getByRole('button',{name:'Previous example step'}).click();
 const shapes: string[]=[];
 for(let step=1;step<=7;step++) {
  await expect(art).toHaveAttribute('data-step',String(step));
  await expect(art).toHaveAccessibleName(new RegExp(`^Step ${step}:`));
  await expect(page.locator('.coach-step')).toContainText(`Step ${step} of 7`);
  const shape=await fabric.getAttribute('d'); expect(shape).not.toBeNull(); shapes.push(shape!);
  expect(await fabric.evaluate(el=>el.getAnimations().length)).toBe(0);
  if(step<7) await page.getByRole('button',{name:'Next step',exact:true}).click();
 }
 expect(new Set(shapes).size).toBe(7);
 await page.getByRole('button',{name:'Previous example step'}).click(); await expect(fabric).toHaveAttribute('d',shapes[5]);
 await page.getByRole('button',{name:'Next step',exact:true}).click(); await page.getByRole('button',{name:'Try again',exact:true}).click();
 await expect(art).toHaveAttribute('data-step','1'); await expect(fabric).toHaveAttribute('d',shapes[0]);
});

test('a tie move plays once, holds its result, replays and pauses offscreen', async ({page}) => {
 await page.emulateMedia({reducedMotion:'no-preference'}); await page.goto('/');
 const fabric=page.locator('.tie-wide-end');
 await page.getByRole('button',{name:'Next step',exact:true}).click();
 const target=await fabric.getAttribute('d');
 await expect.poll(()=>fabric.evaluate(el=>el.getAnimations().some(a=>a.playState==='running'))).toBe(true);
 await expect.poll(()=>fabric.evaluate(el=>el.getAnimations().some(a=>a.playState==='running')),{timeout:3500}).toBe(false);
 expect(await fabric.getAttribute('d')).toBe(target);
 await page.getByRole('button',{name:'Replay this tie step'}).click();
 const start=await fabric.evaluate(el=>getComputedStyle(el).d);
 await expect.poll(()=>fabric.evaluate(el=>getComputedStyle(el).d)).not.toBe(start);
 await page.evaluate(()=>window.scrollTo({top:3000,behavior:'instant'}));
 await expect.poll(()=>fabric.evaluate(el=>el.getAnimations().some(a=>a.playState==='paused'))).toBe(true);
});

test('three logo directions preview in the header without changing the main brand', async ({page})=>{
 await page.goto('/brand/logo-directions.html');
 for(const design of ['A','B','C']) { const button=page.getByRole('button',{name:`Preview ${design}`,exact:true}); await button.click(); await expect(button).toHaveAttribute('aria-pressed','true'); await expect(page.locator('#selection')).toContainText(design+' — '); }
 await expect(page.locator('#header-logo img')).toHaveAttribute('src','/brand/concepts/passing-on.svg');
 await page.goto('/'); await expect(page.locator('.wordmark img')).toHaveAttribute('src',/hands-filled\.png/);
});
