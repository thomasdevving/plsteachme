import { installActiveTrial, trialFixtureId } from './trial-fixture';
import { expect, test } from '@playwright/test';
test.use({launchOptions:{args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']}});
test.beforeEach(async({page})=>installActiveTrial(page));

test('questions use current step, explicit consent and discard a previous-step answer',async({page})=>{
 await page.route('**/api/coaching/session',route=>route.fulfill({json:{available:true}}));
 let payload:Record<string,unknown>|undefined;
 await page.route('**/api/coaching/question',async route=>{expect(route.request().headers()['x-coaching-session']).toBe(trialFixtureId);payload=route.request().postDataJSON();await route.fulfill({json:{skill:payload!.skill,step:payload!.step,answer:'Hold the narrow end still.',reminder:'Check that both ends are flat.'}});});
 await page.goto('/learn/tie');
 await page.getByRole('button',{name:'Coach',exact:true}).click();
 await page.getByRole('button',{name:'Ask a question',exact:true}).click();
 const help=page.locator('.lesson-questions');
 await expect(help.getByRole('button',{name:'Ask the coach'})).toBeDisabled();
 await help.getByLabel('Your question',{exact:true}).fill('Which end should I hold?');
 await help.getByRole('checkbox').check();
 await help.getByRole('button',{name:'Ask the coach'}).click();
 await expect(help.getByText('Hold the narrow end still.')).toBeVisible();
 expect(payload).toMatchObject({skill:'tie',step:0,consent:true,over16:true});
 await page.getByRole('button',{name:'Next lesson step',exact:true}).click();
 await expect(help.getByText('Hold the narrow end still.')).toHaveCount(0);
 await expect(help.getByLabel('Your question',{exact:true})).toHaveValue('');
});

test('new product navigation reaches learning, requests and teacher studio on mobile',async({page})=>{
 await page.setViewportSize({width:375,height:812});
 await page.goto('/');
 const nav=page.getByRole('navigation',{name:'Mobile navigation',exact:true});
 await page.getByLabel('Navigation menu',{exact:true}).click();
 await nav.getByRole('link',{name:'Learn',exact:true}).click();
 await expect(page).toHaveURL(/\/learn$/);await expect(page.getByRole('heading',{level:1})).toContainText('useful skill.');
 await expect(page.locator('.site-header,.site-footer')).toHaveCount(0);
 await page.getByRole('searchbox',{name:'Search skills'}).fill('a missing skill');
 await page.getByRole('link',{name:'Request a skill',exact:true}).click();await expect(page).toHaveURL(/\/community$/);
 await page.getByLabel('Navigation menu',{exact:true}).click();await nav.getByRole('link',{name:'Become a teacher',exact:true}).click();await expect(page).toHaveURL(/\/teach$/);
});

test('published lesson questions and feedback reports retain the reviewed lesson identity beyond seven steps',async({page})=>{
 const id='66666666-6666-4666-8666-666666666666';const version=3;
 await installActiveTrial(page,{id,version,steps:8});
 const step={title:'Align the paper edges',instruction:'Bring the two corners together and flatten the paper.',tip:'Keep both corners visible.',check:'The two corners are aligned.',evidence:['Both corners align.'],commonMistakes:['Leaving one corner offset.'],uncertainty:'Show both corners clearly.',manualAlternative:'Compare the two corners yourself.',visuallyCheckable:true};
 const document={title:'Fold a paper bookmark',category:'hobbies',objective:'Practice a simple bookmark fold on a clear table.',materials:['A square of paper'],safety:['Use a clear table.'],prerequisites:[],alternatives:[],completionCheck:'The folded corners are aligned.',steps:Array.from({length:8},()=>step)};
 await page.addInitScript(({id,version})=>localStorage.setItem(`plsteach.published-progress.v1.${id}.${version}`,JSON.stringify({step:7,completed:false,results:Array(8).fill('pending')})),{id,version});
 await page.route('**/api/platform**',route=>{
  if(route.request().method()==='POST'){const body=route.request().postDataJSON();return route.fulfill({json:{id,version,step:body.step,feedback:{status:'looks_right',confidence:'high',observation:'Both corners are aligned.',guidance:'Keep the fold flat.'}}});}
  return route.fulfill({json:{lesson:{id,version,title:document.title,category:document.category,objective:document.objective,teacherName:'Reviewed teacher',document,hasVideo:false,publishedAt:'2026-10-17T12:00:00Z'}}});
 });
 await page.route('**/api/coaching/session',route=>route.fulfill({json:route.request().method()==='GET'?{available:true}:{accepted:true}}));
 let question:Record<string,unknown>|undefined;let report:Record<string,unknown>|undefined;
 await page.route('**/api/coaching/question',route=>{question=route.request().postDataJSON();return route.fulfill({json:{publishedLesson:{id,version},step:7,answer:'Bring the two paper corners together.',reminder:'The two corners are aligned.'}});});
 await page.route('**/api/coaching/report',route=>{report=route.request().postDataJSON();return route.fulfill({status:201,json:{accepted:true}});});
 await page.goto(`/learn?lesson=${id}`);const player=page.locator('.published-lesson');
 await expect(player.getByText('Step 8 of 8')).toBeVisible();
 await page.getByRole('button',{name:'Coach',exact:true}).click();
 await page.getByRole('button',{name:'Ask a question',exact:true}).click();
 const help=player.locator('.lesson-questions');await help.getByLabel('Your question',{exact:true}).fill('Which corners should I match?');await help.getByRole('checkbox').check();await help.getByRole('button',{name:'Ask the coach'}).click();
 await expect(help.getByText('Bring the two paper corners together.')).toBeVisible();
 expect(question).toMatchObject({publishedLesson:{id,version},step:7,consent:true,over16:true});expect(question).not.toHaveProperty('skill');expect(question).not.toHaveProperty('document');
 await page.getByRole('button',{name:'Camera',exact:true}).click();
 const coach=player.locator('.camera-coach');await coach.getByLabel('I am 16 or older.',{exact:true}).check();await coach.getByLabel('I agree to automatic image checks',{exact:false}).check();await coach.getByRole('button',{name:'Start camera coaching'}).click();await coach.getByRole('button',{name:'Skip this step'}).click();
 await coach.getByRole('button',{name:'Report incorrect feedback'}).click({timeout:10000});await expect(coach.getByRole('button',{name:'Resume coaching'})).toBeVisible();
 const feedback=coach.locator('.feedback-report');await feedback.getByLabel('What did the coach get wrong?').fill('One of the corners was outside the camera view.');await feedback.getByRole('checkbox').check();await feedback.getByRole('button',{name:'Send report'}).click();
 await expect(feedback).toContainText('Report saved for human review');
 expect(report).toMatchObject({publishedLesson:{id,version},step:7,consent:true});expect(report).not.toHaveProperty('skill');expect(report).not.toHaveProperty('frames');expect(report).not.toHaveProperty('document');
 await page.getByRole('button',{name:'Step',exact:true}).click();
 await expect(player.getByText('Step 8 of 8')).toBeVisible();
});
