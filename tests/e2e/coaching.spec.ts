import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
test.use({launchOptions:{args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']}});

const positive={status:'looks_right',confidence:'high',observation:'Both tie ends are visible, with the wide end longer.',guidance:'Keep the fabric flat as you continue.'};
const unclear={status:'unclear',confidence:'low',observation:'The crossing is out of view.',guidance:'Move the collar into the center of the frame.'};
async function setup(page: Page) {
  await page.addInitScript(()=>{
    const original=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    const recorded=window as typeof window & {coachTracks:MediaStreamTrack[];coachConstraints:MediaStreamConstraints[]};
    recorded.coachTracks=[];recorded.coachConstraints=[];
    navigator.mediaDevices.getUserMedia=async constraints=>{
      recorded.coachConstraints.push(constraints || {});
      const stream=await original(constraints);recorded.coachTracks.push(...stream.getTracks());return stream;
    };
  });
  await page.route('**/api/coaching/session',route=>route.fulfill({json:route.request().method()==='GET'?{available:true,provider:'OpenAI'}:{accepted:true}}));
  await page.goto('/demo');
}
async function start(page: Page) {
  const coach=page.locator('.camera-coach');
  await coach.getByRole('checkbox',{name:'I am 16 or older.'}).check();
  await coach.getByRole('checkbox',{name:'I agree to automatic image checks'}).check();
  await coach.getByRole('button',{name:'Start camera coaching'}).click();
  await expect(coach.getByRole('button',{name:'Pause coaching'})).toBeVisible();
  return coach;
}
const stopped=(page:Page)=>page.evaluate(()=>(window as typeof window & {coachTracks:MediaStreamTrack[]}).coachTracks.every(track=>track.readyState==='ended'));

test('missing provider configuration disables camera coaching honestly',async({page,request})=>{
  const response=await request.get('/api/coaching/session');expect(response.status()).toBe(200);
  expect(await response.json()).toMatchObject({available:false});expect(response.headers()['cache-control']).toContain('no-store');
  await page.goto('/demo');
  await expect(page.locator('.camera-coach')).toContainText('isn’t connected yet');
  await expect(page.getByRole('button',{name:'Start camera coaching'})).toBeDisabled();
  await page.getByRole('button',{name:'Next lesson step',exact:true}).click();
  await expect(page.locator('.lesson-step')).toHaveText('Step 2 of 7');
});

test('consent starts camera-only capture and checks the current step automatically',async({page})=>{
  const sent:unknown[]=[];
  await page.route('**/api/coaching/check',async route=>{const body=route.request().postDataJSON();sent.push(body);await route.fulfill({json:{skill:body.skill,step:body.step,feedback:positive}});});
  await setup(page);
  const coach=page.locator('.camera-coach');
  await expect(coach.getByRole('button',{name:'Start camera coaching'})).toBeDisabled();
  expect(sent).toHaveLength(0);
  await start(page);
  await expect(coach).toContainText('This part looks right',{timeout:10000});
  expect(sent).toHaveLength(1);
  const body=sent[0] as {skill:string;step:number;frames:string[]};
  expect(body.skill).toBe('tie');expect(body.step).toBe(0);expect(body.frames).toHaveLength(2);
  expect(body.frames.every(frame=>frame.startsWith('data:image/jpeg;base64,'))).toBe(true);
  expect(Object.keys(body).sort()).toEqual(['frames','skill','step']);
  expect(await page.evaluate(()=>(window as typeof window & {coachConstraints:MediaStreamConstraints[]}).coachConstraints[0].audio)).toBe(false);
  await expect(page.getByRole('button',{name:/check this step/i})).toHaveCount(0);
  await page.clock.install();await page.clock.fastForward(20000);expect(sent).toHaveLength(1);
  await coach.getByRole('button',{name:'Stop camera'}).click();expect(await stopped(page)).toBe(true);
});

test('unclear feedback triggers another check without clicking any check control',async({page})=>{
  let count=0;
  await page.route('**/api/coaching/check',route=>{count++;const body=route.request().postDataJSON();return route.fulfill({json:{skill:body.skill,step:body.step,feedback:count===1?unclear:positive}});});
  await setup(page);const coach=await start(page);
  await expect(coach).toContainText('Let’s get a clearer view',{timeout:10000});
  await expect(coach).toContainText('This part looks right',{timeout:15000});expect(count).toBe(2);
});

test('checks never overlap, and an old step response cannot change the new step',async({page})=>{
  let calls=0;let release:()=>void=()=>{};
  const held=new Promise<void>(resolve=>{release=resolve;});
  await page.route('**/api/coaching/check',async route=>{
    calls++;const body=route.request().postDataJSON();
    if(calls===1)await held;
    await route.fulfill({json:{skill:body.skill,step:body.step,feedback:calls===1?{...positive,observation:'OLD STEP RESULT'}:unclear}});
  });
  await setup(page);const coach=await start(page);
  await expect.poll(()=>calls).toBe(1);
  await page.clock.install();await page.clock.fastForward(20000);expect(calls).toBe(1);
  await page.getByRole('button',{name:'Next lesson step',exact:true}).click();release();
  await expect(page.locator('.lesson-step')).toHaveText('Step 2 of 7');
  await expect(coach).not.toContainText('OLD STEP RESULT');
  await coach.getByRole('button',{name:'Stop camera'}).click();
});

test('pause prevents uploads, resume restarts checks, and hiding the page stops tracks',async({page})=>{
  let calls=0;
  await page.route('**/api/coaching/check',route=>{calls++;const body=route.request().postDataJSON();return route.fulfill({json:{skill:body.skill,step:body.step,feedback:unclear}});});
  await setup(page);const coach=await start(page);
  await coach.getByRole('button',{name:'Pause coaching'}).click();
  await page.clock.install();await page.clock.fastForward(20000);expect(calls).toBe(0);
  await page.clock.resume();
  await coach.getByRole('button',{name:'Resume coaching'}).click();
  await expect.poll(()=>calls,{timeout:10000}).toBe(1);
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});
  await expect(coach).toContainText('Camera stopped while this page was hidden');expect(await stopped(page)).toBe(true);
});

test('switching modules and completing a lesson release camera hardware',async({page})=>{
  await page.route('**/api/coaching/check',route=>{const body=route.request().postDataJSON();return route.fulfill({json:{skill:body.skill,step:body.step,feedback:positive}});});
  await setup(page);await start(page);
  await page.getByRole('group',{name:'Choose a lesson'}).getByRole('button',{name:'Shave',exact:true}).click();
  expect(await stopped(page)).toBe(true);
  await start(page);
  for(let i=0;i<6;i++)await page.getByRole('button',{name:'Next lesson step',exact:true}).click();
  await page.getByRole('button',{name:'Finish walkthrough'}).click();
  expect(await stopped(page)).toBe(true);await expect(page.locator('.camera-coach')).toHaveCount(0);
});

test('permission denial is recoverable without breaking the lesson',async({page})=>{
  await setup(page);
  await page.evaluate(()=>{navigator.mediaDevices.getUserMedia=async()=>{throw new DOMException('Denied','NotAllowedError');};});
  const coach=page.locator('.camera-coach');
  await coach.getByRole('checkbox',{name:'I am 16 or older.'}).check();await coach.getByRole('checkbox',{name:'I agree to automatic image checks'}).check();
  await coach.getByRole('button',{name:'Start camera coaching'}).click();
  await expect(coach).toContainText('Camera access was blocked');await expect(coach.getByRole('button',{name:'Start camera coaching'})).toBeEnabled();
  await page.getByRole('button',{name:'Next lesson step',exact:true}).click();await expect(page.locator('.lesson-step')).toHaveText('Step 2 of 7');
});

test('a camera permission request resolving after Stop immediately releases its tracks',async({page})=>{
  await setup(page);
  await page.evaluate(()=>{
    const original=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia=async constraints=>{
      const pending=await original(constraints);
      return new Promise<MediaStream>(resolve=>{
        (window as typeof window & {resolveCoachCamera:()=>void}).resolveCoachCamera=()=>resolve(pending);
      });
    };
  });
  const coach=page.locator('.camera-coach');
  await coach.getByRole('checkbox',{name:'I am 16 or older.'}).check();await coach.getByRole('checkbox',{name:'I agree to automatic image checks'}).check();
  await coach.getByRole('button',{name:'Start camera coaching'}).click();
  await expect.poll(()=>page.evaluate(()=>Boolean((window as typeof window & {resolveCoachCamera?:()=>void}).resolveCoachCamera))).toBe(true);
  await coach.getByRole('button',{name:'Stop camera'}).click();
  await page.evaluate(()=>(window as typeof window & {resolveCoachCamera:()=>void}).resolveCoachCamera());
  await expect.poll(()=>stopped(page)).toBe(true);
  await expect(coach.getByRole('button',{name:'Start camera coaching'})).toBeVisible();
});

test('rate limits and hazard feedback pause automatic checks',async({page})=>{
  let hazard=true;
  await page.route('**/api/coaching/check',route=>{
    const body=route.request().postDataJSON();
    return hazard?route.fulfill({json:{skill:body.skill,step:body.step,feedback:{...positive,status:'stop',guidance:'Pause and ask an experienced person.'}}}):route.fulfill({status:429,json:{error:'rate'}});
  });
  await setup(page);const coach=await start(page);
  await expect(coach.getByRole('button',{name:'Resume coaching'})).toBeVisible({timeout:10000});await expect(coach).toContainText('Pause and get help');
  hazard=false;await coach.getByRole('button',{name:'Resume coaching'}).click();
  await expect(coach).toContainText('Wait ten minutes before resuming',{timeout:10000});
  await expect(coach.getByRole('button',{name:'Resume coaching'})).toBeVisible();
});

test('session expiry and unavailable service stop the camera and clear the busy state',async({page})=>{
  let status=401;
  await page.route('**/api/coaching/check',route=>route.fulfill({status,json:{error:status===401?'session':'unavailable'}}));
  for(const code of [401,503]) {
    status=code;await setup(page);const coach=await start(page);
    await expect(coach).toContainText(code===401?'Your coaching session ended':'Camera coaching is unavailable right now',{timeout:10000});
    await expect(coach.locator('.camera-feedback')).toHaveAttribute('aria-busy','false');
    expect(await stopped(page)).toBe(true);
  }
});

test('mobile coaching controls and feedback are accessible',async({page})=>{
  await page.setViewportSize({width:375,height:900});await page.emulateMedia({reducedMotion:'reduce'});
  await page.route('**/api/coaching/check',route=>{const body=route.request().postDataJSON();return route.fulfill({json:{skill:body.skill,step:body.step,feedback:positive}});});
  await setup(page);const coach=await start(page);
  await expect(coach).toContainText('This part looks right',{timeout:10000});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();
  expect(result.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))).toEqual([]);
});
