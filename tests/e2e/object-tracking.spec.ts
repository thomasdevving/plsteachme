import { installActiveTrial } from './trial-fixture';
import { test, expect, type Page } from '@playwright/test';
import sharp from 'sharp';
import AxeBuilder from '@axe-core/playwright';
test.use({launchOptions:{args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']}});
const feedback={status:'unclear',confidence:'low',observation:'The checkpoint is not clear.',guidance:'Show both ends.'};
async function setup(page:Page,skill='tie') {
 await installActiveTrial(page);let checks=0;
 await page.route('**/api/coaching/session',route=>route.fulfill({json:route.request().method()==='GET'?{available:true}:{accepted:true}}));
 await page.route('**/api/coaching/check',route=>{checks++;const body=route.request().postDataJSON();return route.fulfill({json:{skill:body.skill,step:body.step,feedback}});});
 await page.goto('/learn/'+skill);await page.getByRole('button',{name:'Coach',exact:true}).click();
 const coach=page.locator('.camera-coach');await coach.getByRole('checkbox',{name:'I am 16 or older.'}).check();
 await coach.getByRole('checkbox',{name:'I agree to automatic image checks'}).check();await coach.getByRole('button',{name:'Start camera coaching'}).click();
 return {coach,checks:()=>checks};
}
test('a visible outline waits for recognition, never just a countdown, and sends whole frames',async({page})=>{
 let accepted=false;const bodies:{frames:string[];guide:{x:number;y:number;w:number;h:number}}[]=[];
 // Override the generic fixture only after setup installs it, before the stable scan fires.
 const {coach,checks}=await setup(page);
 await page.route('**/api/coaching/object',route=>{const body=route.request().postDataJSON();bodies.push(body);return route.fulfill({json:{object:{recognized:accepted,box:accepted?body.guide:null,guidance:accepted?'Tie recognized.':'Show a real tie inside the outline.'}}});});
 await expect(coach.locator('.object-tracking-step')).toContainText('Position your tie');
 await expect(coach.getByRole('button',{name:'Skip this step'})).toHaveCount(0);
 await expect.poll(()=>bodies.length,{timeout:10000}).toBeGreaterThan(0);
 await page.waitForTimeout(4500);expect(checks()).toBe(0);
 await coach.locator('.camera-preview').screenshot({path:'/tmp/plsteach-outline-desktop.png'});
 await page.setViewportSize({width:375,height:812});await coach.locator('.camera-preview').screenshot({path:'/tmp/plsteach-outline-mobile.png'});
 await expect(coach.locator('.camera-current-step')).toContainText('Before step 1:');
 accepted=true;
 await expect(coach.locator('.camera-current-step')).toContainText('Step 1:',{timeout:15000});
 await expect.poll(checks,{timeout:10000}).toBeGreaterThan(0);
 expect(bodies[0].frames).toHaveLength(2);
 const dimensions=await Promise.all(bodies[0].frames.map(async frame=>{const meta=await sharp(Buffer.from(frame.split(',')[1],'base64')).metadata();return [meta.width,meta.height];}));
 const size=await coach.locator('video').evaluate(video=>{const v=video as HTMLVideoElement,s=Math.min(1,640/Math.max(v.videoWidth,v.videoHeight));return [Math.round(v.videoWidth*s),Math.round(v.videoHeight*s)];});
 expect(dimensions).toEqual([size,size]);
 expect((await new AxeBuilder({page}).include('.camera-coach').withTags(['wcag2a','wcag2aa']).analyze()).violations).toEqual([]);
});
test('stopping a camera cancels a pending recognition and cannot accept the stale result',async({page})=>{
 let scans=0,release:()=>void=()=>{};const held=new Promise<void>(resolve=>{release=resolve;});
 const {coach,checks}=await setup(page);
 await page.route('**/api/coaching/object',async route=>{scans++;const body=route.request().postDataJSON();await held;try{await route.fulfill({json:{object:{recognized:true,box:body.guide,guidance:'Tie recognized.'}}});}catch{/* The aborted request may already be gone. */}});
 await expect.poll(()=>scans,{timeout:10000}).toBe(1);
 await coach.getByRole('button',{name:'Stop camera'}).click();release();await page.waitForTimeout(600);
 expect(checks()).toBe(0);await expect(coach.getByRole('button',{name:'Start camera coaching'})).toBeVisible();
});
test('scene modules do not require an irrelevant object enrollment step',async({page})=>{
 let scans=0;const {coach,checks}=await setup(page,'laundry');
 await page.route('**/api/coaching/object',route=>{scans++;return route.fulfill({status:400,json:{error:'unsupported'}});});
 await expect(coach.locator('.object-tracking')).toHaveCount(0);
 await expect.poll(checks,{timeout:10000}).toBeGreaterThan(0);expect(scans).toBe(0);
});
