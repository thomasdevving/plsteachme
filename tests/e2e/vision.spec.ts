import { installActiveTrial } from './trial-fixture';
import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { FEATURE_LENGTH, extractFeatures } from '../../lib/vision/features';
import { evaluate, train } from '../../lib/vision/model';
import { builtinSteps, qualityGate, targetLabels, type VisionModelSummary, type VisionTarget } from '../../lib/vision-contract';
test.use({launchOptions:{args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']}});

const staff={id:'11111111-1111-4111-8111-111111111111',email:'thomastheconguyen@gmail.com'};
const modelId='44444444-4444-4444-8444-444444444444';
// A real model trained on synthetic landmarks, so the browser runs genuine inference.
const hand=(cx:number,spread:number)=>Array.from({length:21},(_,i)=>({x:cx+Math.cos(i)*spread*(i%5)/10,y:.5+Math.sin(i)*spread*(i%4)/10}));
const clips=[...Array.from({length:3},(_,c)=>({id:`o${c}`,label:'other',frames:Array.from({length:20},()=>extractFeatures({pose:[],hands:[]}))})),...Array.from({length:3},(_,c)=>({id:`s${c}`,label:'s0',frames:Array.from({length:20},()=>extractFeatures({pose:[],hands:[hand(.4,1),hand(.6,1)]}))}))];
const model=train(clips,['other','s0']);
const metrics=evaluate(model,clips.filter(clip=>clip.id.endsWith('0')),4);
const summary:VisionModelSummary={id:modelId,target:'builtin:tie',version:1,status:'candidate',labels:model.labels,metrics,gate:qualityGate(metrics),datasetClips:6,trainedAt:'2026-10-20T10:00:00Z',activatedAt:null,shadow:{checks:0,agreements:0}};

async function mockLab(page:Page){
  const actions:Record<string,any>[]=[];const counts:Record<string,number>={other:2,s0:3};let models:VisionModelSummary[]=[];
  const target=():VisionTarget=>({target:'builtin:tie',title:'Built-in tie',steps:builtinSteps('tie'),labels:targetLabels(builtinSteps('tie')),clipCounts:counts,models,canContribute:true});
  await page.route('**/api/auth/session',route=>route.fulfill({json:{configured:true,user:staff,trial:null}}));
  await page.route('**/api/platform?view=config',route=>route.fulfill({json:{available:true,aiAvailable:true,supabaseUrl:'https://platform.supabase.test',publishableKey:'sb_publishable_test'}}));
  await page.route('**/api/vision**',async route=>{
    const request=route.request();const view=new URL(request.url()).searchParams.get('view');
    if(request.method()==='GET')return route.fulfill({json:view==='targets'?{staff:true,targets:[target()]}:view==='clips'?{clips:[]}:{}});
    const body=request.postDataJSON();actions.push(body);
    if(body.action==='clip.add'){counts[body.label]=(counts[body.label]||0)+1;return route.fulfill({json:{ok:true,handRate:0}});}
    if(body.action==='model.train'){models=[summary];return route.fulfill({json:{model:summary,skipped:[]}});}
    if(body.action==='model.activate'){models=[{...summary,status:'active'}];}
    return route.fulfill({json:{ok:true}});
  });
  return {actions};
}

test('staff record landmark clips, train, read held-out results and activate a model',async({page})=>{
  const {actions}=await mockLab(page);
  await page.goto('/vision');
  await expect(page.getByRole('heading',{name:'Teach the coach to see.'})).toBeVisible();
  await page.getByRole('radio',{name:/In between/}).click();
  await page.getByRole('button',{name:'Start camera'}).click();
  const record=page.getByRole('button',{name:'Record 4-second clip'});
  await expect(record).toBeDisabled();
  await page.getByLabel('I agree that hand and body landmarks',{exact:false}).check();
  await record.click();
  await expect(page.getByText('Clip saved for “In between”',{exact:false})).toBeVisible({timeout:15000});
  const clip=actions.find(item=>item.action==='clip.add')!;
  expect(clip).toMatchObject({target:'builtin:tie',label:'other',source:'camera',consent:true});
  expect(clip.frames.length).toBeGreaterThanOrEqual(10);
  expect(clip.frames.every((frame:number[])=>frame.length===FEATURE_LENGTH&&frame.every(Number.isFinite))).toBe(true);
  expect(JSON.stringify(clip)).not.toContain('data:image');
  await expect(page.getByRole('radio',{name:/In between/})).toContainText('3 clips');
  await page.getByRole('button',{name:'Stop'}).click();
  await expect(page.getByText('2 of 15 labels have enough clips.',{exact:false})).toBeVisible();
  await page.getByRole('button',{name:'Train a new model'}).click();
  await expect(page.getByText('Model v1 trained.')).toBeVisible();
  await expect(page.locator('.vision-confusion')).toBeVisible();
  await expect(page.getByText('Quality gate passed')).toBeVisible();
  await page.getByRole('button',{name:'Activate'}).click();
  await expect(page.getByText('now running on learners’ devices in shadow mode',{exact:false})).toBeVisible();
  expect(actions.map(item=>item.action)).toEqual(['clip.add','model.train','model.activate']);
  expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa']).analyze()).violations).toEqual([]);
});

test('the active model runs on the learner’s device and is scored against the cloud coach',async({page})=>{
  await installActiveTrial(page);
  const shadow:Record<string,unknown>[]=[];
  await page.route('**/api/vision**',route=>{const request=route.request();if(request.method()==='GET')return route.fulfill({json:{model:{id:modelId,target:'builtin:tie',version:1,model}}});shadow.push(request.postDataJSON());return route.fulfill({json:{ok:true}});});
  await page.route('**/api/coaching/session',route=>route.fulfill({json:route.request().method()==='GET'?{available:true}:{accepted:true}}));
  await page.route('**/api/coaching/check',async route=>{
    // Answer once the on-device model has produced a prediction for this step.
    await page.locator('.on-device-model').filter({hasNotText:'Starting…'}).waitFor({timeout:20000});
    const body=route.request().postDataJSON();
    await route.fulfill({json:{skill:body.skill,step:body.step,feedback:{status:'looks_right',confidence:'high',observation:'Both ends visible.',guidance:'Continue.'}}});
  });
  await page.goto('/demo');
  const coach=page.locator('.camera-coach');
  await coach.getByRole('checkbox',{name:'Automatically advance camera-confirmed checkpoints'}).uncheck();
  await coach.getByRole('checkbox',{name:'I am 16 or older.'}).check();
  await coach.getByRole('checkbox',{name:'I agree to automatic image checks'}).check();
  await coach.getByRole('button',{name:'Start camera coaching'}).click();
  await expect(coach.locator('.on-device-model')).toContainText('On-device model v1 (beta)',{timeout:20000});
  await expect(coach).toContainText('This part looks right',{timeout:25000});
  await expect.poll(()=>shadow.length).toBe(1);
  expect(shadow[0]).toMatchObject({action:'shadow',modelId,step:0,coachStatus:'looks_right'});
  expect(['other','s0','uncertain']).toContain(shadow[0].predicted);
  expect(Object.keys(shadow[0]).sort()).toEqual(['action','coachStatus','confidence','modelId','predicted','step']);
  await expect(coach.locator('.on-device-model')).toContainText('never moves you forward');
  await coach.getByRole('button',{name:'Stop camera'}).click();
  await expect(coach.locator('.on-device-model')).toHaveCount(0);
});
