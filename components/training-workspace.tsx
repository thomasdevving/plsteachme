'use client';
import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, BarChart3, Camera, Users } from 'lucide-react';
import { categoryLabels } from '@/lib/platform-contract';
import { messageOf } from '@/lib/platform-client';
import { trainingAction, trainingFetch } from '@/lib/training-client';
import { organizationKindLabels, organizationKinds, planForLearners, resultSummary, trainingPlans, trainingRoleLabels, type TrainingMembership, type TrainingOrgView, type TrainingPlanId } from '@/lib/training-contract';
import { PlatformAccount, PlatformProvider, usePlatformAccount } from './platform-account';
import { ModuleBuilder } from './training-builder';
import { People, Plan, ProgressReport } from './training-admin';
import { TrainingPlayer } from './training-player';

type Invitation={organizationName:string;role:keyof typeof trainingRoleLabels;expired:boolean;emailMatches:boolean;invitedEmail:string}|{missing:true};
type Me={user:{id:string;email?:string};memberships:TrainingMembership[];invitation:Invitation|null;canCreate:boolean};
type Tab='training'|'modules'|'people'|'progress'|'plan';

export function TrainingWorkspace(){return <PlatformProvider><Workspace/></PlatformProvider>;}
function Workspace(){
  const {session,config}=usePlatformAccount();const [me,setMe]=useState<Me|null>(null);const [orgId,setOrgId]=useState('');const [message,setMessage]=useState('');const [loading,setLoading]=useState(false);const [aiAvailable,setAiAvailable]=useState(false);const [restricted,setRestricted]=useState(false);
  const token=typeof window==='undefined'?null:new URLSearchParams(window.location.search).get('invite');
  const load=useCallback(async()=>{const response=await fetch(`/api/training?view=me${token?`&invite=${encodeURIComponent(token)}`:''}`,{cache:'no-store'});const data=await response.json().catch(()=>null);if(response.status===403&&data?.error==='restricted'){setRestricted(true);return;}if(!response.ok||!data)throw new Error(data?.message||'Your training could not load. Please try again.');const value=data as Me;setMe(value);setOrgId(previous=>previous&&value.memberships.some(item=>item.organization.id===previous)?previous:value.memberships[0]?.organization.id||'');},[token]);
  useEffect(()=>{if(!session){setMe(null);return;}setLoading(true);setMessage('');Promise.all([load(),trainingFetch<{aiAvailable:boolean}>('view=config').then(value=>setAiAvailable(value.aiAvailable))]).catch(error=>setMessage(messageOf(error))).finally(()=>setLoading(false));},[session?.user.id,load]);
  return <div className="platform-page container training-page"><header className="platform-intro"><p className="eyebrow">For schools, training providers and businesses</p><h1>Your training, guided by AI.</h1><p>Turn your own demonstrations and manuals into AI-guided training modules. Enroll your students or employees, and see how each of them is progressing.</p></header>
    <div className="platform-steps"><div><Camera size={23} aria-hidden="true"/><strong>Show or upload</strong><p>Perform the skill while hand tracking captures each step, or upload your manual.</p></div><div><Users size={23} aria-hidden="true"/><strong>Enroll</strong><p>Invite learners by email and assign modules to everyone or to selected people.</p></div><div><BarChart3 size={23} aria-hidden="true"/><strong>Monitor</strong><p>Follow completion and camera-confirmed checkpoints for every learner.</p></div></div>
    <PlatformAccount/><p className="platform-message platform-error" role="status">{message}</p>
    {!config?.available?null:!session?<div className="platform-empty"><h2>Sign in to open your training workspace.</h2><p>Admins create a workspace for their organization. Learners join with the invitation link they receive.</p></div>:restricted?<div className="platform-empty"><h2>The training workspace isn’t open yet.</h2><p>Organization training is being tested with a small group. To bring plsteach.me to your school, training provider or business, <a className="text-link" href="/organizations#pilot">tell us about your group</a>.</p></div>:loading&&!me?<p role="status">Loading your training…</p>:me&&<>
      {me.invitation&&<InvitationPanel invitation={me.invitation} token={token||''} email={me.user.email||''} onAccepted={async id=>{window.history.replaceState({},'','/training');await load();setOrgId(id);}}/>}
      {me.memberships.length>1&&<label className="platform-field training-switch">Organization<select className="platform-search" value={orgId} onChange={event=>setOrgId(event.target.value)}>{me.memberships.map(item=><option key={item.organization.id} value={item.organization.id}>{item.organization.name} · {trainingRoleLabels[item.role]}</option>)}</select></label>}
      {orgId?<Organization key={orgId} organizationId={orgId} aiAvailable={aiAvailable}/>:!me.invitation&&<CreateOrganization canCreate={me.canCreate} onCreated={async id=>{await load();setOrgId(id);}}/>}
      {orgId&&me.canCreate&&<details className="studio-review"><summary>Create another organization</summary><CreateOrganization canCreate onCreated={async id=>{await load();setOrgId(id);}}/></details>}
    </>}
  </div>;
}

function InvitationPanel({invitation,token,email,onAccepted}:{invitation:Invitation;token:string;email:string;onAccepted:(id:string)=>Promise<void>}){
  const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');
  if('missing' in invitation)return <section className="platform-panel"><h2>This invitation is no longer valid.</h2><p>It may have been used already or replaced by a newer link. Ask your organization’s admin to send a new invitation.</p></section>;
  async function accept(){setBusy(true);setMessage('');try{const result=await trainingAction<{organizationId:string}>({action:'member.accept',token});await onAccepted(result.organizationId);}catch(error){setMessage(messageOf(error));}finally{setBusy(false);}}
  return <section className="platform-panel training-invite"><h2>Join {invitation.organizationName}</h2>{invitation.expired?<p>This invitation has expired. Ask your admin for a new link.</p>:!invitation.emailMatches?<p>This invitation was sent to {invitation.invitedEmail}, but you are signed in as {email}. Sign in with the invited email to join.</p>:<><p>You have been invited as {trainingRoleLabels[invitation.role].toLowerCase()}. Your organization’s admins and instructors will see your progress on the modules assigned to you, including which checkpoints the camera confirmed.</p><button type="button" className="button primary compact" disabled={busy} onClick={accept}>{busy?'Joining…':`Join ${invitation.organizationName}`}</button></>}<p className="platform-message" role="status">{message}</p></section>;
}

function CreateOrganization({canCreate,onCreated}:{canCreate:boolean;onCreated:(id:string)=>Promise<void>}){
  const [learners,setLearners]=useState(25);const [plan,setPlan]=useState<TrainingPlanId>('up-to-25');const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');
  if(!canCreate)return <section className="platform-panel"><h2>Organization workspaces are in a limited pilot.</h2><p>If you were invited to an organization, open the invitation link from your admin. To bring plsteach.me to your group, <a className="text-link" href="/organizations#pilot">tell us about it</a>.</p></section>;
  async function create(event:React.FormEvent<HTMLFormElement>){event.preventDefault();const fields=new FormData(event.currentTarget);setBusy(true);setMessage('');try{const result=await trainingAction<{organizationId:string}>({action:'org.create',name:fields.get('name'),kind:fields.get('kind'),plan});await onCreated(result.organizationId);}catch(error){setMessage(messageOf(error));}finally{setBusy(false);}}
  const suggested=planForLearners(learners);
  return <section className="platform-panel"><h2>Create your organization’s workspace</h2><p>You become its admin. Invite colleagues as instructors or admins, and students or employees as learners.</p><form className="platform-form" onSubmit={create}><div className="studio-fields"><label>Organization name<input name="name" required minLength={2} maxLength={120} autoComplete="organization"/></label><label>Type<select name="kind" defaultValue="school">{organizationKinds.map(item=><option key={item} value={item}>{organizationKindLabels[item]}</option>)}</select></label><label>How many learners?<input type="number" min={1} max={1000} value={learners} onChange={event=>{const value=Math.max(1,Number(event.target.value)||1);setLearners(value);const fit=planForLearners(value);if(fit)setPlan(fit.id);}}/></label><label>Plan<select value={plan} onChange={event=>setPlan(event.target.value as TrainingPlanId)}>{trainingPlans.map(item=><option key={item.id} value={item.id}>Up to {item.learners} learners · ${item.monthly}/month</option>)}</select></label></div>
    {!suggested&&<p className="studio-review-note">More than 300 learners: start with the largest plan, and <a className="text-link" href="/organizations#pilot">contact us</a> about a custom plan.</p>}
    <p className="platform-small">Billing is not active during testing. No payment is taken; the plan sets your learner seats.</p><button className="button primary compact" disabled={busy}>{busy?'Creating…':'Create workspace'}</button></form><p className="platform-message" role="status">{message}</p></section>;
}

function Organization({organizationId,aiAvailable}:{organizationId:string;aiAvailable:boolean}){
  const [view,setView]=useState<TrainingOrgView|null>(null);const [chosenTab,setTab]=useState<Tab|null>(null);const [message,setMessage]=useState('');const [playing,setPlaying]=useState('');
  const refresh=useCallback(async()=>{setView(await trainingFetch<TrainingOrgView>(`view=org&id=${organizationId}`));},[organizationId]);
  useEffect(()=>{refresh().catch(error=>setMessage(messageOf(error)));},[refresh]);
  if(!view)return <p role="status">{message||'Loading organization…'}</p>;
  const manager=view.role!=='learner';const tab=manager?chosenTab??'modules':'training';
  const tabs:[Tab,string][]=manager?[['modules','Modules'],['people','People'],['progress','Progress'],...(view.role==='admin'?[['plan','Plan'] as [Tab,string]]:[]),['training','Preview as learner']]:[];
  return <div className="studio-stack"><div className="platform-card-head"><div><h2 className="platform-section-title" style={{marginBottom:4}}>{view.organization.name}</h2><span className="platform-badge">{organizationKindLabels[view.organization.kind]} · {trainingRoleLabels[view.role]}</span></div></div>
    {manager&&<div className="studio-tabs" role="group" aria-label="Organization workspace">{tabs.map(([id,label])=><button key={id} type="button" aria-pressed={tab===id} onClick={()=>{setTab(id);setPlaying('');}}>{label}</button>)}</div>}
    <p className="platform-message platform-error" role="status">{message}</p>
    {tab==='modules'&&manager?<ModuleBuilder view={view} refresh={refresh} aiAvailable={aiAvailable}/>:tab==='people'&&manager?<People view={view} refresh={refresh}/>:tab==='progress'&&manager?<ProgressReport view={view}/>:tab==='plan'&&view.role==='admin'?<Plan view={view} refresh={refresh}/>:playing?<TrainingPlayer moduleId={playing} onBack={()=>{setPlaying('');refresh().catch(error=>setMessage(messageOf(error)));}}/>:<Assigned view={view} onOpen={setPlaying}/>}
  </div>;
}

function Assigned({view,onOpen}:{view:TrainingOrgView;onOpen:(id:string)=>void}){
  if(!view.assigned.length)return <div className="platform-empty"><strong>No training assigned yet.</strong><p>{view.role==='learner'?'Modules your organization assigns to you will appear here.':'Publish a module to see it here as your learners will.'}</p></div>;
  return <div className="published-grid">{view.assigned.map(item=>{const results=item.progress?.completedResults||item.progress?.results;const summary=results?resultSummary(results):null;return <article className="published-card" key={item.id}><span className="platform-badge">{categoryLabels[item.category]}</span><h3>{item.title}</h3><p>{item.objective}</p><small>{item.progress?.completedAt?`Completed · ${summary?.visual??0} of ${item.steps} confirmed by camera`:item.progress?`In progress · step ${item.progress.step+1} of ${item.steps}`:`${item.steps} steps · not started`}</small><button type="button" className="text-link" onClick={()=>onOpen(item.id)}>{item.progress?.completedAt?'Practice again':item.progress?'Continue':'Start module'}<ArrowRight size={16} aria-hidden="true"/></button></article>;})}</div>;
}
