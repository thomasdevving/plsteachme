import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { cacheContents, mockSignedIn } from './helpers';

const factorId = '11111111-1111-4111-8111-111111111111';
test('catalog tabs work with the keyboard and recommendations reflect previous learning', async ({page}) => {
  await mockSignedIn(page);
  await page.addInitScript(() => localStorage.setItem('plsteach.learning.v1', JSON.stringify({version:1,lessons:{tie:{contentVersion:1,step:6,completed:true,updatedAt:100,checkpoints:Array(7).fill('self_checked')}}})));
  await page.goto('/learn');
  await expect(page.getByRole('heading',{name:'Recommended for you'})).toBeVisible();
  const recommended=page.locator('.catalog-recommendation');
  await expect(recommended).toHaveCount(3);await expect(recommended.first()).toContainText('Iron a shirt');
  await expect(page.getByText('Practice with clear steps, automatic camera checks and room to try again. Start with a small task and build from there.')).toHaveCount(0);
  const tabs=page.getByRole('tablist',{name:'Skill categories'});
  await tabs.getByRole('tab',{name:'All skills',exact:true}).focus();await page.keyboard.press('ArrowRight');
  await expect(tabs.getByRole('tab',{name:'Personal Care',exact:true})).toHaveAttribute('aria-selected','true');
  await expect(page.locator('.catalog-card')).toHaveCount(2);
  await page.keyboard.press('End');await expect(page.locator('.catalog-card')).toHaveCount(1);
  await page.keyboard.press('Home');await expect(page.locator('.catalog-card')).toHaveCount(9);
  for(const width of [320,390,1280]) {await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
  const result=await new AxeBuilder({page}).include('.learning-catalog').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(result.violations).toEqual([]);
});

test('offline library copy is spaced and has no redundant eyebrow',async({page})=>{
  await page.goto('/learn/offline');
  await expect(page.locator('.offline-kicker')).toHaveCount(0);
  await expect(page.locator('.offline-connection-note')).toHaveText('Camera coaching, questions and account sync require internet.');
  for(const width of [320,390,1280]){await page.setViewportSize({width,height:900});await expect(page.locator('.offline-title-row h1')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
});

test('lesson feedback saves ratings with dates, keeps earlier versions separate and renders comments as text',async({page})=>{
  await mockSignedIn(page);
  const own:Record<string,unknown>[]=[{version:1,rating:3,comment:'Earlier draft',createdAt:'2026-09-01T12:00:00Z',updatedAt:'2026-09-01T12:00:00Z'}];
  const posts:Record<string,unknown>[]=[];
  await page.route('**/api/lesson-feedback**',route=>{
    if(route.request().method()==='POST'){
      const data=route.request().postDataJSON();posts.push(data);
      if(data.action==='save'){own.splice(0,own.some(item=>item.version===2)?1:0,{version:2,rating:data.rating,comment:data.comment,createdAt:'2026-10-30T12:00:00Z',updatedAt:'2026-10-30T12:00:00Z'});}
      else {const index=own.findIndex(item=>item.version===data.version);if(index>=0)own.splice(index,1);}
      return route.fulfill({json:{ok:true}});
    }
    return route.fulfill({json:{own,summary:{count:2,average:4.5}}});
  });
  await page.route('**/api/platform?**', route => route.fulfill({json:{lesson:{id:factorId,title:'Fold a towel',teacherName:'Teacher',version:2,hasVideo:false,document:{title:'Fold a towel',objective:'Fold a towel neatly.',category:'independent-living',materials:[],safety:[],prerequisites:[],alternatives:[],completionCheck:'Check the fold.',steps:[{title:'Fold',instruction:'Bring the edges together.',check:'The edges align.',tip:'Go slowly.',manualAlternative:'Check by hand.',uncertainty:'Try a clearer view.',commonMistakes:[],visuallyCheckable:false}]}}}}));
  await page.goto(`/learn/lessons/${factorId}`);
  await page.getByRole('button',{name:'Feedback',exact:true}).click();
  await expect(page.getByText('Version 2 · 4.5 / 5 from 2 ratings')).toBeVisible();
  await page.getByRole('radio',{name:'5 stars',exact:true}).check();
  await page.getByLabel('Comment (optional)').fill('<script>alert("test")</script> Clear steps.');
  await page.getByRole('button',{name:'Send feedback',exact:true}).click();
  await expect(page.getByRole('status').filter({hasText:'Your feedback is saved'})).toBeVisible();
  expect(posts[0]).toMatchObject({action:'save',lessonKey:`published:${factorId}`,version:2,rating:5});
  expect(posts[0]).not.toHaveProperty('createdAt');
  await expect(page.locator('.feedback-date time')).toHaveAttribute('datetime','2026-10-30T12:00:00Z');
  await page.getByText('Your feedback on earlier versions',{exact:true}).click();
  await expect(page.locator('.feedback-history')).toContainText('1 Sept 2026');
  await expect(page.locator('.feedback-history')).toContainText('Version 1');
  const result=await new AxeBuilder({page}).include('.lesson-feedback').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(result.violations).toEqual([]);
  for(const urls of Object.values(await cacheContents(page)))expect(urls.every(url=>!url.startsWith('/api/lesson-feedback'))).toBe(true);
  await page.getByRole('button',{name:'Delete my feedback',exact:true}).click();
  await expect(page.getByRole('button',{name:'Send feedback',exact:true})).toBeVisible();
});

test('feedback has a clear signed-out state and does not submit while offline',async({context,page})=>{
  await page.route('**/api/lesson-feedback**',route=>route.fulfill({status:401,json:{message:'Sign in.'}}));
  await page.goto('/learn/tie');await page.getByRole('button',{name:'Feedback',exact:true}).click();
  await expect(page.locator('.lesson-feedback').getByRole('link',{name:'Sign in',exact:true})).toHaveAttribute('href','/login?next=%2Flearn%2Ftie');
  await context.setOffline(true);
  await expect(page.getByText('Connect to the internet to read or leave feedback. Your lesson still works offline.')).toBeVisible();
  await expect(page.getByRole('button',{name:'Send feedback',exact:true})).toHaveCount(0);
});

test('authenticator setup requires a code and login then asks for the second factor',async({page})=>{
  await mockSignedIn(page);
  let enabled=false,required=false;
  const attempts:Record<string,unknown>[]=[];
  await page.route('**/api/auth/mfa',route=>{
    if(route.request().method()==='GET')return route.fulfill({json:{required,factors:enabled?[{id:factorId,name:'Authenticator app'}]:[]}});
    const data=route.request().postDataJSON();attempts.push(data);
    if(data.action==='enroll')return route.fulfill({json:{enrollment:{id:factorId,qr:'<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="white"/></svg>',secret:'test-setup-secret'}}});
    if(data.code!=='123456')return route.fulfill({status:400,json:{error:'That code did not work. Enter a fresh code from your authenticator.'}});
    enabled=true;required=false;return route.fulfill({json:{ok:true,url:data.next||'/account'}});
  });
  await page.goto('/account');
  await page.getByRole('button',{name:'Set up authenticator',exact:true}).click();
  await expect(page.getByRole('img',{name:'QR code to add plsteach.me to your authenticator'})).toBeVisible();
  expect(enabled).toBe(false);
  await page.getByLabel('Authenticator code', {exact:true}).fill('123456');
  await page.getByRole('button',{name:'Enable verification',exact:true}).click();
  await expect(page.getByText('Two-step verification is enabled.',{exact:true})).toBeVisible();
  required=true;
  await page.goto('/login/mfa?next=%2Flearn');
  await page.getByLabel('Authenticator code',{exact:true}).fill('000000');
  await page.getByRole('button',{name:'Verify and continue',exact:true}).click();
  await expect(page.locator('.auth-error[role="alert"]')).toContainText('That code did not work');
  await page.getByLabel('Authenticator code',{exact:true}).fill('123456');
  await page.getByRole('button',{name:'Verify and continue',exact:true}).click();
  await expect(page).toHaveURL(/\/learn$/);
  expect(attempts.filter(item=>item.action==='verify')).toHaveLength(3);
});
