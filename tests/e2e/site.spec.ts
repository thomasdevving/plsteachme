import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
test('English canonical pages and legacy redirects preserve query parameters', async ({ page }) => {
 for (const path of ['/','/subscriptions','/organizations','/demo','/learn','/community','/teach','/privacy','/thanks']) { const response=await page.goto(path); expect(response?.status()).toBe(200); await expect(page.locator('html')).toHaveAttribute('lang','en'); await expect(page.locator('h1')).toHaveCount(1); }
 for (const [alias,target] of [['/en','/'],['/nl','/'],['/organisaties','/organizations'],['/en/organizations','/organizations'],['/bedankt','/thanks']]) { await page.goto(`${alias}?ref=FRIEND`); expect(new URL(page.url()).pathname).toBe(target); expect(new URL(page.url()).searchParams.get('ref')).toBe('FRIEND'); }
});
test('organization form works in mock mode',async({page})=>{
 await page.goto('/en/organizations'); await page.locator('#name').fill('Test Teacher'); await page.locator('#organization').fill('Test School'); await page.locator('#role').fill('Teacher'); await page.locator('#type').selectOption('school'); await page.locator('#email').fill('teacher@example.com'); await page.locator('#needs').fill('Tying ties'); await page.getByRole('checkbox').check(); await page.locator('.form-submit').click(); await expect(page.locator('.success-panel')).toContainText('No data has been stored');
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
 for(const width of [375,1280]) { await page.setViewportSize({width,height:900}); for(const path of ['/','/subscriptions','/organizations','/demo','/privacy']){ await page.goto(path); expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true); const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze(); expect(result.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))).toEqual([]); } }
});
test('cream canvas stays light under dark OS preference and reduced motion remains usable',async({page})=>{
 await page.emulateMedia({colorScheme:'dark',reducedMotion:'reduce'}); await page.goto('/en'); expect(await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--paper').trim())).toBe('#faf7f2'); const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa']).analyze(); expect(result.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))).toEqual([]); expect(await page.locator('.skill-card').first().evaluate(el=>getComputedStyle(el).animationName)).toBe('none');
});

test('module filters and previews work with keyboard and reduced motion', async ({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'}); await page.goto('/');
 await expect(page.locator('.wordmark img')).toBeVisible(); await expect(page.locator('.phone')).toBeVisible();
 await expect(page.locator('.skill-card')).toHaveCount(9);
 await page.getByRole('button',{name:'Personal care'}).click(); await expect(page.locator('.skill-card')).toHaveCount(2);
 await page.getByRole('button',{name:'All skills'}).click();
 await page.getByRole('button',{name:'Explore lesson: Do your laundry',exact:true}).click();
 await expect(page.locator('#module-preview')).toBeFocused(); await expect(page.locator('.lesson-copy')).toContainText('Read the care labels');

 await page.getByRole('button',{name:'Next lesson step',exact:true}).click(); await expect(page.locator('.lesson-copy')).toContainText('measure the detergent');
 await page.getByRole('button',{name:'Close module lesson'}).click(); await expect(page.getByRole('button',{name:'Explore lesson: Do your laundry',exact:true})).toBeFocused();
 const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa']).analyze(); expect(result.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))).toEqual([]); const labels=await new AxeBuilder({page}).withRules(['label-content-name-mismatch']).analyze(); expect(labels.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))).toEqual([]);
});


test('three logo directions preview in the header without changing the main brand', async ({page})=>{
 await page.goto('/brand/logo-directions.html');
 for(const design of ['A','B','C']) { const button=page.getByRole('button',{name:`Preview ${design}`,exact:true}); await button.click(); await expect(button).toHaveAttribute('aria-pressed','true'); await expect(page.locator('#selection')).toContainText(design+' — '); }
 await expect(page.locator('#header-logo img')).toHaveAttribute('src','/brand/concepts/passing-on.svg');
 await page.goto('/'); await expect(page.locator('.wordmark img')).toHaveAttribute('src',/hands-filled\.png/);
});

test('the homepage explains the live test phase, without a waitlist or interest votes',async({page})=>{
 await page.goto('/');
 await expect(page.locator('.hero-beta')).toHaveCount(0);
 await expect(page.locator('.hero').getByRole('link',{name:'Find your first skill'})).toHaveAttribute('href','/learn');
 await expect(page.getByText('Nine illustrated skills',{exact:false})).toHaveCount(0);
 await expect(page.locator('#waitlist')).toHaveCount(0);
 const phase=page.locator('#test-phase');
 await expect(phase).toContainText('Create a free account and complete one module with camera coaching.');
 await expect(phase).toContainText('Subscriptions will be available later.');
 await expect(phase.getByRole('link',{name:'Create an account'})).toHaveAttribute('href','/signup?next=%2Flearn');
 await expect(page.getByRole('button',{name:'I want to learn this'})).toHaveCount(0);
 await expect(page.locator('#skills .status-pill')).toHaveCount(0);
 await expect(page.locator('#skills .skill-card').first().getByRole('link',{name:'Start lesson'})).toHaveAttribute('href','/learn?skill=tie');
 const header=page.locator('.site-header');
 await expect(header.getByRole('link',{name:'Learn',exact:true})).toHaveAttribute('href','/learn');
 await expect(header.getByRole('link',{name:'Start free'})).toHaveCount(0);
 await expect(header.locator('a.button.primary',{hasText:'Log in'})).toHaveAttribute('href','/login');
 await expect(page.locator('#demo a.button')).toHaveAttribute('href','/learn');
});
test('the organization page matches the organization plan',async({page})=>{
 await page.goto('/organizations');
 await expect(page.getByRole('heading',{level:1})).toHaveText('Your training, guided by AI.');
 for(const title of ['Demonstrate it','Upload your manual','Enroll and monitor'])await expect(page.getByRole('heading',{name:title})).toBeVisible();
 await expect(page.locator('.org-pricing .training-price')).toHaveText(['$100/month','$200/month','$350/month','$500/month']);
});
