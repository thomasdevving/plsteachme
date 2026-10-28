import { test, expect } from '@playwright/test';
test('header links to teaching and login while the coach retains camera access and the current brand', async ({page, request}) => {
 await page.goto('/');
 const actions=page.locator('.nav-actions');
 await expect(actions.getByRole('link',{name:'Log in',exact:true})).toHaveAttribute('href','/login');
 await actions.getByRole('link',{name:'Become a teacher',exact:true}).click();
 await expect(page).toHaveURL(/\/teach$/);
 await page.goto('/coach');
 await expect(page.locator('.wordmark img')).toHaveAttribute('src',/hands-filled/);
 await expect(page.locator('body')).toHaveCSS('background-color','rgb(250, 247, 242)');
 const coach = await request.get('/coach/session/tie-four-in-hand');
 expect(coach.status()).toBe(200);
 expect(coach.headers()['permissions-policy']).toContain('camera=(self)');
 const landing = await request.get('/');
 expect(landing.headers()['permissions-policy']).toContain('camera=(self)');
 const legacy = await request.get('/session/tie-four-in-hand?debug=1');
 expect(new URL(legacy.url()).pathname).toBe('/coach/session/tie-four-in-hand');
 expect(new URL(legacy.url()).searchParams.get('debug')).toBe('1');
 const manifest = await request.get('/manifest.webmanifest');
 expect(manifest.status()).toBe(200);
 // One manifest for the whole site: the installed app opens the learning environment.
 expect(await manifest.json()).toMatchObject({id:'/learn',start_url:'/learn',scope:'/',icons:[{src:'/icons/icon-192.png'},{src:'/icons/icon-512.png'},{src:'/icons/maskable-512.png',purpose:'maskable'}]});
 const asset = await request.get('/skills/tie/drape.svg');
 expect(asset.headers()['content-type']).toContain('image/svg');
});
