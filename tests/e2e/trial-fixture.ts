import type { Page } from '@playwright/test';

export const trialFixtureId='77777777-7777-4777-8777-777777777777';
export const trialUser={id:'11111111-1111-4111-8111-111111111111',email:'learner@example.test'};
export function trialFixture(skillId:string,totalSteps=7) {
  return {id:trialFixtureId,user_id:trialUser.id,skill_id:skillId,total_steps:totalSteps,completed_steps:0,completed_at:null as string|null,started_at:'2026-10-17T12:00:00Z'};
}

// Each test supplies an eligible account; server authorization is tested separately.
// Reading the displayed lesson lets the same fixture follow explicit module switches.
export async function installActiveTrial(page:Page, published?:{id:string;version:number;steps:number}) {
  // Chromium's default fake video flashes every half second, so it never meets
  // the real positioning stillness gate. Use explicit stable synthetic pixels;
  // semantic accuracy is covered separately with real-camera testing, not this mock.
  await page.addInitScript(()=>{
    navigator.mediaDevices.getUserMedia=async constraints=>{
      if(constraints?.audio)throw new Error('The coaching fixture supports video only.');
      const canvas=document.createElement('canvas');canvas.width=640;canvas.height=480;
      const ctx=canvas.getContext('2d')!;
      const gradient=ctx.createLinearGradient(0,0,640,480);gradient.addColorStop(0,'#ddd2b7');gradient.addColorStop(1,'#80937d');
      ctx.fillStyle=gradient;ctx.fillRect(0,0,640,480);ctx.fillStyle='#bb4827';
      ctx.beginPath();ctx.moveTo(300,70);ctx.lineTo(340,70);ctx.lineTo(355,105);ctx.lineTo(332,135);ctx.lineTo(365,380);ctx.lineTo(320,430);ctx.lineTo(275,380);ctx.lineTo(308,135);ctx.lineTo(285,105);ctx.closePath();ctx.fill();
      return canvas.captureStream(15);
    };
  });
  const current=async()=>{
    if(published)return trialFixture(`published:${published.id}:v${published.version}`,published.steps);
    const skill=await page.evaluate(()=>window.document.querySelector('.lesson-player[data-skill]')?.getAttribute('data-skill')||new URL(window.location.href).searchParams.get('skill')||'tie');
    return trialFixture(skill==='tie'?'tie-four-in-hand':`builtin:${skill}`);
  };
  // Controlled identity verdict for non-vision-specific browser flows. Dedicated
  // positioning tests override this; it is not a real recognition-accuracy test.
  await page.route('**/api/coaching/object',route=>route.fulfill({json:{object:{recognized:true,box:route.request().postDataJSON().guide,guidance:'Object recognized.'}}}));
  await page.route('**/api/auth/session',async route=>route.fulfill({json:{configured:true,user:trialUser,trial:await current()}}));
  await page.route('**/api/trial',async route=>{const body=route.request().postDataJSON();const trial=await current();return route.fulfill({json:{trial:{...trial,...(body?.action==='start'?{skill_id:body.skillId}:{}),...(body?.action==='progress'?{completed_steps:body.completedSteps??trial.completed_steps}: {})}}});});
}
