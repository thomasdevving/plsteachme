import { installActiveTrial } from './trial-fixture';
import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
test.use({launchOptions:{args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']}});

const unclear={status:'unclear',confidence:'low',observation:'The crossing is out of view.',guidance:'Move closer.'};
async function startCoach(page:Page){
  await installActiveTrial(page);
  const requests:string[]=[];
  page.on('request',request=>{if(request.url().includes('/api/'))requests.push(new URL(request.url()).pathname);});
  await page.route('**/api/coaching/session',route=>route.fulfill({json:route.request().method()==='GET'?{available:true}:{accepted:true}}));
  await page.route('**/api/coaching/check',route=>{const body=route.request().postDataJSON();return route.fulfill({json:{skill:body.skill,step:body.step,feedback:unclear}});});
  await page.goto('/demo');
  const coach=page.locator('.camera-coach');
  await coach.getByRole('checkbox',{name:'I am 16 or older.'}).check();
  await coach.getByRole('checkbox',{name:'I agree to automatic image checks'}).check();
  await coach.getByRole('button',{name:'Start camera coaching'}).click();
  await expect(coach.getByRole('button',{name:'Pause coaching'})).toBeVisible();
  return {coach,requests};
}
// Counts drawn (non-transparent) pixels on the tracking overlay.
const overlayPixels=(page:Page)=>page.locator('.camera-object-overlay').evaluate(canvas=>{const element=canvas as HTMLCanvasElement;const data=element.getContext('2d')!.getImageData(0,0,element.width,element.height).data;let count=0;for(let i=3;i<data.length;i+=4)if(data[i])count++;return count;});

test('learner shows the tie, the coach learns it and tracks it on the live preview',async({page})=>{
  const {coach,requests}=await startCoach(page);
  await coach.getByRole('button',{name:'Show me the tie'}).click();
  await expect(coach.locator('.object-tracking-status')).toHaveText('Hold the tie inside the box.');
  await expect.poll(()=>overlayPixels(page)).toBeGreaterThan(0);
  await expect(coach.locator('.object-tracking-status')).toContainText('Slowly turn the tie',{timeout:6000});
  await expect(coach.locator('.object-tracking-status')).toContainText(/Tracking the tie|out of view/,{timeout:8000});
  const overlay=coach.locator('.camera-object-overlay');
  await expect(overlay).toHaveAttribute('data-tracking',/^(tracking|searching)$/);
  expect(await overlayPixels(page)).toBeGreaterThan(0);
  await expect(coach.getByRole('button',{name:'Stop tracking the tie'})).toBeVisible();
  // Tracking is local: no new endpoints, and coaching requests are unchanged.
  expect(requests.every(path=>['/api/auth/session','/api/coaching/session','/api/coaching/check','/api/trial','/api/vision','/api/config'].includes(path))).toBe(true);
  expect((await new AxeBuilder({page}).include('.camera-coach').withTags(['wcag2a','wcag2aa']).analyze()).violations).toEqual([]);
  await coach.getByRole('button',{name:'Stop tracking the tie'}).click();
  await expect.poll(()=>overlayPixels(page)).toBe(0);
  await expect(coach.getByRole('button',{name:'Show me the tie'})).toBeVisible();
});

test('learner can draw a box around the object instead, and tracking stops with the camera',async({page})=>{
  const {coach}=await startCoach(page);
  await coach.getByRole('button',{name:'Draw a box instead'}).click();
  const overlay=coach.locator('.camera-object-overlay');
  await expect(overlay).toHaveClass(/drawing/);
  await overlay.scrollIntoViewIfNeeded();
  const box=(await overlay.boundingBox())!;
  await page.mouse.move(box.x+box.width*.35,box.y+box.height*.3);await page.mouse.down();
  await page.mouse.move(box.x+box.width*.6,box.y+box.height*.65,{steps:5});await page.mouse.up();
  await expect(coach.locator('.object-tracking-status')).toContainText(/Tracking the tie|out of view/,{timeout:8000});
  await expect(overlay).not.toHaveClass(/drawing/);
  await coach.getByRole('button',{name:'Stop camera'}).click();
  await expect(coach.getByRole('button',{name:'Show me the tie'})).toHaveCount(0);
});
