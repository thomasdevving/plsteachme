import { installActiveTrial } from './trial-fixture';
import { test,expect,type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { PROGRESS_KEY } from '../../lib/learning-progress';
test.use({launchOptions:{args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']}});
test.beforeEach(async({page})=>installActiveTrial(page));
const positive={status:'looks_right',confidence:'high',observation:'The wide end is longer and both ends are flat.',guidance:'Keep the crossing in view.'};
const uncertain={status:'unclear',confidence:'low',observation:'The object is out of view.',guidance:'Move the result into the frame.'};
async function startCamera(page:Page) {
  await page.getByRole('button',{name:'Coach',exact:true}).click();
  const coach=page.locator('.camera-coach');
  await coach.getByRole('checkbox',{name:'I am 16 or older.'}).check();
  await coach.getByRole('checkbox',{name:'I agree to automatic image checks'}).check();
  await coach.getByRole('button',{name:'Start camera coaching'}).click();await coach.getByRole('button',{name:'Skip this step'}).click();
  return coach;
}
async function mockCamera(page:Page,feedback=positive) {
  await page.route('**/api/coaching/session',route=>route.fulfill({json:route.request().method()==='GET'?{available:true}:{accepted:true}}));
  await page.route('**/api/coaching/check',route=>{const body=route.request().postDataJSON();return route.fulfill({json:{skill:body.skill,step:body.step,feedback}});});
}
async function record(page:Page,skill='tie') {return page.evaluate(({key,skill})=>JSON.parse(localStorage.getItem(key)||'{}').lessons?.[skill],{key:PROGRESS_KEY,skill});}

test('catalog searches six real-life categories, opens a journey and handles empty results',async({page})=>{
  await page.goto('/learn');
  await expect(page.locator('.catalog-card')).toHaveCount(9);
  const filters=page.getByRole('group',{name:'Filter by real-life category'});
  await expect(filters.getByRole('button')).toHaveCount(7);
  await filters.getByRole('button',{name:'Personal Care',exact:true}).click();
  await expect(page.locator('.catalog-card')).toHaveCount(2);
  await filters.getByRole('button',{name:'All skills',exact:true}).click();
  await page.getByRole('searchbox',{name:'Search skills'}).fill('couscous');
  await expect(page.locator('.catalog-card')).toHaveCount(1);
  await expect(page.locator('.catalog-card')).toContainText('Cook a simple meal');
  await page.getByRole('searchbox',{name:'Search skills'}).fill('nonexistent-skill');
  await expect(page.locator('.catalog-card')).toHaveCount(0);
  await expect(page.getByRole('link',{name:'Request a skill',exact:true})).toHaveAttribute('href','/community');
  await page.getByRole('searchbox',{name:'Search skills'}).clear();
  await page.locator('.learning-journeys article').filter({hasText:'Ready for your first interview'}).getByRole('link',{name:'Iron a shirt',exact:true}).click();
  await expect(page.locator('.lesson-player')).toHaveAttribute('data-skill','ironing');
  await expect(page.locator('.site-header')).toHaveCount(0);
  await expect(page).toHaveURL(/\/learn\/ironing$/);
});

test('manual progress resumes on reload and can be reset independently',async({page})=>{
  await page.goto('/learn?skill=tie');
  await page.getByRole('button',{name:'Next lesson step',exact:true}).click();
  await page.getByRole('button',{name:'Next lesson step',exact:true}).click();
  expect((await record(page)).checkpoints.slice(0,3)).toEqual(['self_checked','self_checked','pending']);
  await page.reload();
  await expect(page.locator('.lesson-step')).toHaveText('Step 3 of 7');
  await page.getByRole('link',{name:'All lessons',exact:true}).click();
  await expect(page.locator('.continue-learning')).toContainText('Resume Tie a tie');
  await page.getByRole('link',{name:'Resume Tie a tie',exact:true}).click();
  await page.getByRole('button',{name:'Prepare',exact:true}).click();
  await page.getByRole('button',{name:'Reset lesson progress'}).click();
  await expect(page.locator('.lesson-step')).toHaveText('Step 1 of 7');
  expect(await record(page)).toBeUndefined();
  await page.getByRole('link',{name:'All lessons',exact:true}).click();
  await expect(page.locator('.continue-learning')).toHaveCount(0);
});

test('completion names unverified checkpoints and recommends available related lessons',async({page})=>{
  await page.goto('/learn?skill=tie');
  await page.getByRole('button',{name:'Continue with this step unresolved'}).click();
  for(let index=1;index<6;index++)await page.getByRole('button',{name:'Next lesson step',exact:true}).click();
  await page.getByRole('button',{name:'Finish walkthrough'}).click();
  await expect(page.locator('.lesson-completion-note')).toHaveText('0 camera-confirmed visible checkpoints · 6 self-checked · 1 unresolved.');
  await page.getByRole('button',{name:'Progress',exact:true}).click();
  await expect(page.locator('.completion-checkpoints li')).toHaveCount(7);
  await expect(page.locator('.completion-checkpoints li').first()).toContainText('Unresolved');
  await expect(page.locator('.related-lessons a').first()).toHaveAttribute('href',/\/learn\//);
  await page.reload();await expect(page.locator('.lesson-step')).toHaveText('Walkthrough complete');
  await page.getByRole('button',{name:'Progress',exact:true}).click();
  await page.locator('.completion-checkpoints li').first().getByRole('button').click();
  await expect(page.locator('.lesson-step')).toHaveText('Step 1 of 7');
  await expect(page.locator('[data-checkpoint-state]')).toHaveText('Unresolved');
});

test('confident visible checkpoints automatically save and advance after a cancellable countdown',async({page})=>{
  await mockCamera(page);await page.goto('/learn?skill=tie');const coach=await startCamera(page);
  await expect(coach.getByRole('button',{name:'Stay on this step'})).toBeVisible({timeout:10000});
  expect((await record(page)).checkpoints[0]).toBe('camera_confirmed');
  await expect(page.locator('.lesson-step')).toHaveText('Step 2 of 7',{timeout:8000});
  expect((await record(page)).step).toBe(1);
  await coach.getByRole('button',{name:'Stop camera'}).click();
  await page.getByRole('button',{name:'Next lesson step',exact:true}).click();
  expect((await record(page)).checkpoints.slice(0,2)).toEqual(['camera_confirmed','self_checked']);
});

test('learner can cancel or opt out of automatic advancement while keeping confirmation',async({page})=>{
  await mockCamera(page);await page.goto('/learn?skill=tie');const coach=await startCamera(page);
  await coach.getByRole('button',{name:'Stay on this step'}).click({timeout:10000});
  await page.clock.install();await page.clock.runFor(6000);
  await expect(page.locator('.lesson-step')).toHaveText('Step 1 of 7');
  expect((await record(page)).checkpoints[0]).toBe('camera_confirmed');
  await coach.getByRole('checkbox',{name:'Automatically advance camera-confirmed checkpoints'}).uncheck();
  await page.getByRole('button',{name:'Next lesson step',exact:true}).click();
  await page.clock.resume();await expect(coach).toContainText('This part looks right',{timeout:10000});
  await page.clock.runFor(6000);
  await expect(page.locator('.lesson-step')).toHaveText('Step 2 of 7');
  expect((await record(page)).checkpoints.slice(0,2)).toEqual(['camera_confirmed','camera_confirmed']);
});

test('uncertain and nonvisual checkpoints never auto-pass even if the provider overclaims',async({page})=>{
  await mockCamera(page,uncertain);await page.goto('/learn?skill=tie');const coach=await startCamera(page);
  await expect(coach).toContainText('Let’s get a clearer view',{timeout:10000});
  expect((await record(page)).checkpoints[0]).toBe('unresolved');
  await expect(coach.getByRole('button',{name:'Stay on this step'})).toHaveCount(0);
  await mockCamera(page);await page.goto('/learn?skill=bike');const bikeCoach=await startCamera(page);
  await expect(bikeCoach).toContainText('Use your own checkpoint',{timeout:10000});
  await page.clock.install();await page.clock.runFor(6000);
  await expect(page.locator('.lesson-step')).toHaveText('Step 1 of 7');
  expect((await record(page,'bike')).checkpoints[0]).toBe('unresolved');
});

test('reporting a camera result pauses advancement and sends only the consented text',async({page})=>{
  let report:Record<string,unknown>|undefined;
  await mockCamera(page);
  await page.route('**/api/coaching/report',route=>{report=route.request().postDataJSON();return route.fulfill({status:201,json:{accepted:true}});});
  await page.goto('/learn?skill=tie');const coach=await startCamera(page);
  await coach.getByRole('button',{name:'Report incorrect feedback'}).click({timeout:10000});
  await expect(coach.getByRole('button',{name:'Resume coaching'})).toBeVisible();
  await expect(coach.getByRole('button',{name:'Stay on this step'})).toHaveCount(0);
  await page.clock.install();await page.clock.runFor(6000);
  await expect(page.locator('.lesson-step')).toHaveText('Step 1 of 7');
  const form=coach.locator('.feedback-report');
  await form.getByLabel('What did the coach get wrong?').fill('The wide end was actually behind the narrow end.');
  await form.getByRole('checkbox').check();await form.getByRole('button',{name:'Send report'}).click();
  await expect(form).toContainText('Report saved for human review');
  expect(report).toMatchObject({skill:'tie',step:0,feedback:positive,consent:true});
  expect(Object.keys(report!).sort()).toEqual(['consent','feedback','reason','skill','step']);
});

test('storage failure leaves the lesson usable and explains that progress is not saved',async({page})=>{
  await page.addInitScript(()=>{Storage.prototype.setItem=()=>{throw new DOMException('Blocked','SecurityError');};});
  await page.goto('/learn?skill=tie');
  await page.getByRole('button',{name:'Next lesson step',exact:true}).click();
  await expect(page.locator('.lesson-step')).toHaveText('Step 2 of 7');
  await expect(page.locator('.lesson-overview')).toContainText('could not save progress');
});

test('catalog and saved checkpoint summaries are accessible on a small screen',async({page})=>{
  await page.setViewportSize({width:375,height:900});await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/learn?skill=tie');await page.getByRole('button',{name:'Next lesson step',exact:true}).click();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  const results=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();
  expect(results.violations.map(result=>({id:result.id,nodes:result.nodes.map(node=>node.target)}))).toEqual([]);
});
