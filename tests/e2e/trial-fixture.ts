import type { Page } from '@playwright/test';

export const trialFixtureId='77777777-7777-4777-8777-777777777777';
export const trialUser={id:'11111111-1111-4111-8111-111111111111',email:'learner@example.test'};
export function trialFixture(skillId:string,totalSteps=7) {
  return {id:trialFixtureId,user_id:trialUser.id,skill_id:skillId,total_steps:totalSteps,completed_steps:0,completed_at:null as string|null,started_at:'2026-10-17T12:00:00Z'};
}

// Each test supplies an eligible account; server authorization is tested separately.
// Reading the displayed lesson lets the same fixture follow explicit module switches.
export async function installActiveTrial(page:Page, published?:{id:string;version:number;steps:number}) {
  const current=async()=>{
    if(published)return trialFixture(`published:${published.id}:v${published.version}`,published.steps);
    const skill=await page.evaluate(()=>window.document.querySelector('.lesson-player[data-skill]')?.getAttribute('data-skill')||new URL(window.location.href).searchParams.get('skill')||'tie');
    return trialFixture(skill==='tie'?'tie-four-in-hand':`builtin:${skill}`);
  };
  await page.route('**/api/auth/session',async route=>route.fulfill({json:{configured:true,user:trialUser,trial:await current()}}));
  await page.route('**/api/trial',async route=>{const body=route.request().postDataJSON();const trial=await current();return route.fulfill({json:{trial:{...trial,...(body?.action==='start'?{skill_id:body.skillId}:{}),...(body?.action==='progress'?{completed_steps:body.completedSteps??trial.completed_steps}: {})}}});});
}
