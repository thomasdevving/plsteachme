import { installActiveTrial } from './trial-fixture';
import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
test.use({launchOptions:{args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']}});

const unclear={status:'unclear',confidence:'low',observation:'The crossing is out of view.',guidance:'Move closer.'};
async function startCoach(page:Page){
  await installActiveTrial(page);
  const requests:string[]=[];const checks:number[]=[];
  page.on('request',request=>{if(request.url().includes('/api/'))requests.push(new URL(request.url()).pathname);});
  await page.route('**/api/coaching/session',route=>route.fulfill({json:route.request().method()==='GET'?{available:true}:{accepted:true}}));
  await page.route('**/api/coaching/check',route=>{const body=route.request().postDataJSON();checks.push(Date.now());return route.fulfill({json:{skill:body.skill,step:body.step,feedback:unclear}});});
  await page.goto('/demo');
  const coach=page.locator('.camera-coach');
  await coach.getByRole('checkbox',{name:'I am 16 or older.'}).check();
  await coach.getByRole('checkbox',{name:'I agree to automatic image checks'}).check();
  await coach.getByRole('button',{name:'Start camera coaching'}).click();
  await expect(coach.getByRole('button',{name:'Pause coaching'})).toBeVisible();
  return {coach,requests,checks};
}
const status=(page:Page)=>page.locator('.object-tracking-status');
// Counts drawn (non-transparent) pixels on the tracking overlay.
const overlayPixels=(page:Page)=>page.locator('.camera-object-overlay').evaluate(canvas=>{const element=canvas as HTMLCanvasElement;const data=element.getContext('2d')!.getImageData(0,0,element.width,element.height).data;let count=0;for(let i=3;i<data.length;i+=4)if(data[i])count++;return count;});

test('showing the tie is the first camera step, before any lesson step is checked',async({page})=>{
  const {coach,requests,checks}=await startCoach(page);
  await expect(coach.getByRole('button',{name:'Show me the tie'})).toHaveCount(0);
  await expect(coach.locator('.camera-current-step')).toContainText('Before step 1: show me the tie');
  await expect(coach.locator('.object-tracking-step')).toContainText('Show me the tie');
  await expect(status(page)).toContainText('Hold the tie inside the box');
  await expect.poll(()=>overlayPixels(page)).toBeGreaterThan(0);
  await page.waitForTimeout(2500);
  expect(checks).toHaveLength(0);
  await expect(status(page)).toContainText(/Tracking the tie|out of view/,{timeout:10000});
  await expect(coach.locator('.camera-current-step')).toContainText('Step 1:');
  await expect(coach.locator('.camera-object-overlay')).toHaveAttribute('data-tracking',/^(tracking|searching)$/);
  await expect.poll(()=>checks.length,{timeout:10000}).toBeGreaterThan(0);
  // Tracking is local: no new endpoints are called.
  expect(requests.every(path=>['/api/auth/session','/api/coaching/session','/api/coaching/check','/api/trial','/api/vision','/api/config'].includes(path))).toBe(true);
  expect((await new AxeBuilder({page}).include('.camera-coach').withTags(['wcag2a','wcag2aa']).analyze()).violations).toEqual([]);
  // A learned object is reused when the camera restarts, so the step is not repeated.
  await coach.getByRole('button',{name:'Stop camera'}).click();
  await coach.getByRole('button',{name:'Start camera coaching'}).click();
  await expect(coach.locator('.camera-current-step')).toContainText('Step 1:');
  await expect(coach.locator('.object-tracking-step')).toHaveCount(0);
});

test('the learner can drag a box around the tie during the step, and draw a new one later',async({page})=>{
  const {coach}=await startCoach(page);
  const overlay=coach.locator('.camera-object-overlay');
  await expect(overlay).toHaveClass(/drawing/);
  await overlay.scrollIntoViewIfNeeded();
  const drag=async(from:[number,number],to:[number,number])=>{await overlay.scrollIntoViewIfNeeded();const box=(await overlay.boundingBox())!;await page.mouse.move(box.x+box.width*from[0],box.y+box.height*from[1]);await page.mouse.down();await page.mouse.move(box.x+box.width*to[0],box.y+box.height*to[1],{steps:5});await page.mouse.up();};
  await drag([.35,.3],[.6,.65]);
  await expect(status(page)).toContainText(/Tracking the tie|out of view/,{timeout:8000});
  await expect(overlay).not.toHaveClass(/drawing/);
  await coach.getByRole('button',{name:'Draw a new box'}).click();
  await expect(overlay).toHaveClass(/drawing/);
  await drag([.2,.2],[.45,.5]);
  await expect(status(page)).toContainText(/Tracking the tie|out of view/,{timeout:8000});
});

test('the step can be skipped, then done after all',async({page})=>{
  const {coach,checks}=await startCoach(page);
  await coach.getByRole('button',{name:'Skip this step'}).click();
  await expect(status(page)).toContainText('Skipped.');
  await expect(coach.locator('.camera-current-step')).toContainText('Step 1:');
  await expect.poll(()=>checks.length,{timeout:10000}).toBeGreaterThan(0);
  expect(await overlayPixels(page)).toBe(0);
  await coach.getByRole('button',{name:'Show me the tie after all'}).click();
  await expect(status(page)).toContainText(/Tracking the tie|out of view/,{timeout:10000});
});
