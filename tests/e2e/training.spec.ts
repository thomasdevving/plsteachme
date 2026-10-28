import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import type { TrainingDocument, TrainingMember, TrainingMembership, TrainingModule, TrainingOrgView, TrainingProgress } from '../../lib/training-contract';
test.use({launchOptions:{args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']}});

const uid='11111111-1111-4111-8111-111111111111',org='22222222-2222-4222-8222-222222222222',mid='33333333-3333-4333-8333-333333333333',adminMember='44444444-4444-4444-8444-444444444444',learnerMember='55555555-5555-4555-8555-555555555555';
const frame=(n:number)=>`${org}/${mid}/frames/6666666${n}-6666-4666-8666-666666666666.jpg`;
const pixel='data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="4" height="3"%3E%3Crect width="4" height="3" fill="%23cbd5c0"/%3E%3C/svg%3E';
const step=(title:string,extra:Partial<TrainingDocument['steps'][number]>={})=>({title,instruction:`${title} as shown in the manual.`,tip:'',check:`${title} is complete.`,evidence:['Result is visible'],commonMistakes:['Rushing the step'],uncertainty:'Show the work from above.',manualAlternative:'Ask your instructor to check.',visuallyCheckable:true,...extra});
const drafted:TrainingDocument={title:'Replace a till roll',category:'independent-living',objective:'Replace the receipt roll on the shop till without jamming it.',materials:['New till roll'],safety:['Switch the printer off before opening the cover.'],prerequisites:[],alternatives:[],completionCheck:'Print a test receipt.',steps:[step('Open the cover',{reference:{frame:frame(1),startSec:0,endSec:4,hands:2}}),step('Insert the roll',{visuallyCheckable:false})]};
const organization={id:org,name:'Riverside Shop',kind:'business' as const,plan:'up-to-25' as const,seatLimit:25,createdAt:'2026-10-19T10:00:00Z'};

async function mockTraining(page:Page,role:'admin'|'learner'='admin',options:{invite?:boolean}={}){
  const actions:Record<string,any>[]=[];
  let memberships:TrainingMembership[]=role==='learner'&&options.invite?[]:role==='learner'?[{memberId:learnerMember,role,organization}]:[];
  const members:TrainingMember[]=[{id:adminMember,email:'admin@shop.example',displayName:'',role:'admin',status:'active',joinedAt:'2026-10-19T10:00:00Z',inviteExpiresAt:null}];
  const modules:TrainingModule[]=[];const progress:TrainingProgress[]=[];
  if(role==='learner'){modules.push({id:mid,organizationId:org,source:'manual',status:'published',document:drafted,sourceText:'',moments:[],demoPath:null,manualPath:null,audience:'all',version:1,publishedVersionId:'77777777-7777-4777-8777-777777777777',publishedAt:'2026-10-19T10:00:00Z',updatedAt:'2026-10-19T10:00:00Z',assignedMemberIds:[],unpublishedChanges:false});}
  const view=():TrainingOrgView=>{
    const assigned=modules.filter(item=>item.publishedVersionId).map(item=>({id:item.id,version:item.version,title:item.document.title,objective:item.document.objective,category:item.document.category,steps:item.document.steps.length,publishedAt:item.publishedAt,progress:progress.find(row=>row.moduleId===item.id)||null}));
    const memberRole=memberships[0]?.role||'admin';
    return memberRole==='learner'?{organization,role:'learner',memberId:learnerMember,seatsUsed:members.filter(item=>item.role==='learner').length,assigned}:{organization,role:'admin',memberId:adminMember,seatsUsed:members.filter(item=>item.role==='learner').length,assigned,members,modules,progress};
  };
  await page.route('**/api/auth/session',route=>route.fulfill({json:{configured:true,user:{id:uid,email:role==='admin'?'admin@shop.example':'learner@shop.example'},trial:null}}));
  await page.route('**/api/platform?view=config',route=>route.fulfill({json:{available:true,aiAvailable:true,supabaseUrl:'https://platform.supabase.test',publishableKey:'sb_publishable_test'}}));
  await page.route('**/api/coaching/session',route=>route.fulfill({json:{available:true}}));
  await page.route('https://platform.supabase.test/**',route=>route.fulfill({json:{data:{path:'uploaded'}}}));
  await page.route('**/api/training**',async route=>{
    const request=route.request();const url=new URL(request.url());
    if(request.method()==='GET'){switch(url.searchParams.get('view')){
      case 'config':return route.fulfill({json:{available:true,aiAvailable:true}});
      case 'me':return route.fulfill({json:{user:{id:uid,email:role==='admin'?'admin@shop.example':'learner@shop.example'},memberships,canCreate:role==='admin',invitation:url.searchParams.get('invite')?{organizationName:'Riverside Shop',role:'learner',expired:false,emailMatches:true,invitedEmail:'learner@shop.example'}:null}});
      case 'org':return route.fulfill({json:view()});
      case 'frames':return route.fulfill({json:{frames:Object.fromEntries([frame(1),frame(2)].map(path=>[path,pixel]))}});
      case 'module':{const item=modules[0];return route.fulfill({json:{module:{id:item.id,organizationId:org,version:item.version,document:item.document,hasVideo:false,frames:{[frame(1)]:pixel},progress:null,trackProgress:role==='learner'}}});}
      default:return route.fulfill({status:404,json:{message:'Not found'}});
    }}
    const body=request.postDataJSON();actions.push(body);
    switch(body.action){
      case 'org.create':memberships=[{memberId:adminMember,role:'admin',organization:{...organization,name:body.name,kind:body.kind,plan:body.plan}}];return route.fulfill({json:{ok:true,organizationId:org}});
      case 'member.accept':memberships=[{memberId:learnerMember,role:'learner',organization}];return route.fulfill({json:{ok:true,organizationId:org}});
      case 'member.invite':for(const email of body.emails)members.push({id:learnerMember,email,displayName:'',role:body.role,status:'invited',joinedAt:null,inviteExpiresAt:'2026-11-18T10:00:00Z'});return route.fulfill({json:{added:body.emails.length,skipped:[],emailed:true,invites:body.emails.map((email:string)=>({email,link:`http://localhost:3100/training?invite=${'a'.repeat(32)}`}))}});
      case 'module.create':modules.unshift({id:mid,organizationId:org,source:body.source,status:'draft',document:{...drafted,title:body.title,steps:[step('First step',{visuallyCheckable:false,evidence:[]})]},sourceText:'',moments:[],demoPath:null,manualPath:null,audience:'all',version:0,publishedVersionId:null,publishedAt:null,updatedAt:'2026-10-19T10:00:00Z',assignedMemberIds:[],unpublishedChanges:false});return route.fulfill({json:{ok:true,moduleId:mid}});
      case 'module.upload':return route.fulfill({json:{bucket:'organization-training',path:`${org}/${mid}/manuals/${'8'.repeat(8)}-8888-4888-8888-888888888888.pdf`,token:'upload-token'}});
      case 'module.attach':modules[0]={...modules[0],manualPath:body.path};break;
      case 'module.save':modules[0]={...modules[0],document:body.document,sourceText:body.sourceText};break;
      case 'module.generate':return route.fulfill({json:{document:{...drafted,title:modules[0].document.title},verify:['Confirm the printer model in section 2.']}});
      case 'module.moments':{const saved=body.moments.map((item:Record<string,unknown>,index:number)=>({...item,frame:frame(index+1)}));modules[0]={...modules[0],moments:saved};return route.fulfill({json:{moments:saved,frames:{}}});}
      case 'module.publish':modules[0]={...modules[0],status:'published',version:modules[0].version+1,publishedVersionId:'77777777-7777-4777-8777-777777777777',publishedAt:'2026-10-19T11:00:00Z',audience:body.audience};break;
      case 'module.coach':return route.fulfill({json:{id:mid,version:1,step:body.step,feedback:{status:'looks_right',confidence:'high',observation:'The cover is open.',guidance:'Continue when ready.'}}});
      case 'progress.save':{const row={moduleId:mid,memberId:learnerMember,version:1,step:body.step,results:body.results,completedResults:body.completed?body.results:null,startedAt:'2026-10-19T11:00:00Z',updatedAt:'2026-10-19T11:05:00Z',completedAt:body.completed?'2026-10-19T11:05:00Z':null};progress.splice(0,progress.length,row);return route.fulfill({json:{ok:true,stored:true,results:body.results}});}
    }
    return route.fulfill({json:{ok:true}});
  });
  return {actions};
}

test('admin creates an organization, turns a manual into a module with AI, publishes it and invites learners',async({page})=>{
  const {actions}=await mockTraining(page);
  await page.goto('/training');
  await page.getByLabel('Organization name').fill('Riverside Shop');
  await page.getByLabel('Type').selectOption('business');
  await page.getByLabel('How many learners?').fill('60');
  await expect(page.getByLabel('Plan')).toHaveValue('up-to-75');
  await page.getByRole('button',{name:'Create workspace'}).click();
  await expect(page.getByRole('heading',{name:'Riverside Shop'})).toBeVisible();
  await page.getByLabel('Module title').fill('Replace a till roll');
  await page.getByLabel('Our manual or written procedure').check();
  await page.getByRole('button',{name:'Create private draft'}).click();
  await page.getByLabel('Upload a PDF manual (up to 20 MB)').setInputFiles({name:'till.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.7 test')});
  await page.getByRole('button',{name:'Upload till.pdf'}).click();
  await expect(page.getByText('Manual uploaded privately.',{exact:false})).toBeVisible();
  await page.getByLabel('Focus for AI (optional)').fill('Section 2 only');
  await expect(page.getByRole('button',{name:'Generate module with AI'})).toBeDisabled();
  await page.getByLabel('Send these notes',{exact:false}).check();
  await page.getByRole('button',{name:'Generate module with AI'}).click();
  await expect(page.getByText('Confirm the printer model in section 2.')).toBeVisible();
  await expect(page.getByRole('img',{name:'Instructor reference for step 1'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Publish module'})).toBeDisabled();
  await page.getByRole('button',{name:'Save draft'}).click();
  await expect(page.getByText('All changes saved.')).toBeVisible();
  await page.getByLabel('I reviewed every instruction',{exact:false}).check();
  await page.getByRole('button',{name:'Publish module'}).click();
  await expect(page.getByText('Version 1 published.',{exact:false})).toBeVisible();
  await page.getByRole('button',{name:'People',exact:true}).click();
  await page.getByLabel('Email addresses').fill('learner@shop.example, second@shop.example');
  await page.getByRole('button',{name:'Send invitations'}).click();
  await expect(page.getByText('2 invitations emailed.',{exact:false})).toBeVisible();
  await expect(page.locator('.training-links li')).toHaveCount(2);
  await page.getByRole('button',{name:'Progress',exact:true}).click();
  await expect(page.locator('.training-table tbody tr')).toHaveCount(2);
  await expect(page.locator('.training-table')).toContainText('Invited, not joined');
  expect(actions.map(item=>item.action)).toEqual(['org.create','module.create','module.upload','module.attach','module.save','module.generate','module.save','module.publish','member.invite']);
  expect(actions[0]).toMatchObject({name:'Riverside Shop',kind:'business',plan:'up-to-75'});
  expect(actions[5]).toMatchObject({focus:'Section 2 only',aiConsent:true});
  expect(actions[7]).toMatchObject({audience:'all',reviewed:true});
});

test('admin demonstrates on camera, captures key moments and builds referenced steps',async({page})=>{
  const {actions}=await mockTraining(page);
  await page.addInitScript(()=>{const original=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);const state=window as typeof window & {trackerTracks:MediaStreamTrack[]};state.trackerTracks=[];navigator.mediaDevices.getUserMedia=async constraints=>{const stream=await original(constraints);state.trackerTracks.push(...stream.getTracks());return stream;};});
  await page.goto('/training');
  await page.getByLabel('Organization name').fill('Riverside Shop');
  await page.getByRole('button',{name:'Create workspace'}).click();
  await page.getByLabel('Module title').fill('Open the till');
  await page.getByRole('button',{name:'Create private draft'}).click();
  await page.getByRole('button',{name:'Record and track demonstration'}).click();
  await expect(page.getByRole('button',{name:'Mark step'})).toBeVisible({timeout:20000});
  await expect(page.locator('.training-tracker-hud')).toContainText('key moments');
  await page.getByRole('button',{name:'Mark step'}).click();
  await page.waitForTimeout(400);
  await page.getByRole('button',{name:'Mark step'}).click();
  await page.getByRole('button',{name:'Finish demonstration'}).click();
  await expect(page.getByText('key moments captured.',{exact:false})).toBeVisible();
  expect(await page.evaluate(()=>(window as typeof window & {trackerTracks:MediaStreamTrack[]}).trackerTracks.every(track=>track.readyState==='ended'))).toBe(true);
  await page.getByLabel('Caption for key moment 1').fill('Key turned');
  await page.getByRole('button',{name:'Save 2 key moments'}).click();
  await expect(page.getByText('2 key moments saved.',{exact:false})).toBeVisible();
  await page.getByRole('button',{name:'Build one step per key moment'}).click();
  await expect(page.getByLabel('Step title').first()).toHaveValue('Key turned');
  await expect(page.getByRole('img',{name:'Instructor reference for step 2'})).toBeVisible();
  const moments=actions.find(item=>item.action==='module.moments')!;
  expect(moments.moments).toHaveLength(2);expect(moments.moments[0]).toMatchObject({kind:'marker',caption:'Key turned'});expect(moments.moments[0].frame).toMatch(/^data:image\/jpeg;base64,/);
  await expect(page.getByRole('button',{name:/Upload recording for learners/})).toBeVisible();
});

test('invited learner joins, practices with camera coaching and reports progress',async({page})=>{
  const {actions}=await mockTraining(page,'learner',{invite:true});
  await page.goto(`/training?invite=${'a'.repeat(32)}`);
  await page.getByRole('button',{name:'Join Riverside Shop'}).click();
  await expect(page).toHaveURL(/\/training$/);
  await page.getByRole('button',{name:'Start module'}).click();
  const player=page.locator('.published-lesson');
  await expect(player.getByRole('img',{name:'Your instructor’s result for step 1'})).toBeVisible();
  await page.getByRole('button',{name:'Coach',exact:true}).click();
  const coach=player.locator('.camera-coach');
  await coach.getByLabel('I am 16 or older.',{exact:true}).check();
  await coach.getByLabel('I agree to automatic image checks',{exact:false}).check();
  await coach.getByRole('button',{name:'Start camera coaching'}).click();await coach.getByRole('button',{name:'Skip this step'}).click();
  await expect(player.getByText('Step 2 of 2')).toHaveText('Step 2 of 2',{timeout:15000});
  await coach.getByRole('button',{name:'Stop camera'}).click();
  await player.getByRole('button',{name:'Finish with my own check'}).click();
  await expect(player).toContainText('1 checkpoints confirmed by camera, 1 checked by you');
  await expect(player.getByText('Progress saved for your organization.')).toBeVisible();
  expect(actions.find(item=>item.action==='module.coach')).toMatchObject({moduleId:mid,version:1,step:0,consent:true,over16:true});
  expect(actions.filter(item=>item.action==='progress.save').at(-1)).toMatchObject({results:['visual','manual'],completed:true});
  expect(actions.some(item=>item.action==='lesson.coach')).toBe(false);
});

test('accounts without workspace access see that it is not open and cannot create anything',async({page})=>{
  await page.route('**/api/auth/session',route=>route.fulfill({json:{configured:true,user:{id:uid,email:'someone@example.test'},trial:null}}));
  await page.route('**/api/platform?view=config',route=>route.fulfill({json:{available:true,aiAvailable:true,supabaseUrl:'https://platform.supabase.test',publishableKey:'sb_publishable_test'}}));
  await page.route('**/api/training**',route=>route.fulfill(new URL(route.request().url()).searchParams.get('view')==='config'?{json:{available:true,aiAvailable:true}}:{status:403,json:{error:'restricted',message:'The training workspace is not open to this account yet.'}}));
  await page.goto('/training');
  await expect(page.getByRole('heading',{name:'The training workspace isn’t open yet.'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Create workspace'})).toHaveCount(0);
  await page.goto('/');
  await expect(page.locator('a[href="/training"]')).toHaveCount(0);
});

test('staff grant pilot access from the workspace and from pilot requests',async({page})=>{
  const pilots:{email:string;note:string;created_at:string}[]=[];const actions:Record<string,any>[]=[];
  await page.route('**/api/auth/session',route=>route.fulfill({json:{configured:true,user:{id:uid,email:'staff@plsteach.example'},trial:null}}));
  await page.route('**/api/platform?view=config',route=>route.fulfill({json:{available:true,aiAvailable:true,supabaseUrl:'https://platform.supabase.test',publishableKey:'sb_publishable_test'}}));
  await page.route('**/api/training**',async route=>{
    const request=route.request();const view=new URL(request.url()).searchParams.get('view');
    if(request.method()==='GET')return route.fulfill({json:view==='config'?{available:true,aiAvailable:true}:view==='pilots'?{pilots,requests:[{name:'Sam',organization:'Hillside College',role:'Coordinator',type:'school',email:'sam@hillside.example',needs:'Lab safety training',created_at:'2026-10-18T10:00:00Z'}],emailConfigured:true}:{user:{id:uid,email:'staff@plsteach.example'},memberships:[],invitation:null,canCreate:true,staff:true}});
    const body=request.postDataJSON();actions.push(body);
    if(body.action==='pilot.add')pilots.unshift({email:body.email,note:body.note,created_at:'2026-10-20T10:00:00Z'});
    if(body.action==='pilot.remove')pilots.splice(pilots.findIndex(item=>item.email===body.email),1);
    return route.fulfill({json:{ok:true,emailed:true}});
  });
  await page.goto('/training');
  const panel=page.locator('.training-pilots');
  await expect(panel).toContainText('They get an email when you add them.');
  await panel.getByLabel('Email address').fill('admin@riverside.example');await panel.getByRole('button',{name:'Grant pilot access'}).click();
  await expect(panel.getByText('admin@riverside.example has pilot access and was emailed.')).toBeVisible();
  await panel.getByRole('button',{name:'Grant access'}).click();
  await expect(panel.getByText('Has access')).toBeVisible();
  page.once('dialog',dialog=>dialog.accept());
  await panel.locator('li',{hasText:'admin@riverside.example'}).getByRole('button',{name:'Remove'}).click();
  await expect(panel.locator('li',{hasText:'admin@riverside.example'})).toHaveCount(0);
  expect(actions).toEqual([{action:'pilot.add',email:'admin@riverside.example',note:''},{action:'pilot.add',email:'sam@hillside.example',note:'Hillside College'},{action:'pilot.remove',email:'admin@riverside.example'}]);
  expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa']).analyze()).violations).toEqual([]);
});

test('training workspace fits phones and passes accessibility checks',async({page})=>{
  await mockTraining(page);await page.setViewportSize({width:375,height:812});
  await page.goto('/training');
  await expect(page.getByRole('heading',{name:'Create your organization’s workspace'})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa']).analyze()).violations).toEqual([]);
  await page.getByLabel('Organization name').fill('Riverside Shop');await page.getByRole('button',{name:'Create workspace'}).click();
  await page.getByLabel('Module title').fill('Open the till');await page.getByRole('button',{name:'Create private draft'}).click();
  await expect(page.getByRole('button',{name:'Record and track demonstration'})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa']).analyze()).violations).toEqual([]);
});
