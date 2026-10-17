import type { SkillId } from '@/lib/config';

// The tie lesson shares the original account entitlement. Other lessons use
// namespaced IDs so they cannot accidentally become a second free session.
export function builtinTrialId(skill:SkillId) { return skill==='tie'?'tie-four-in-hand':`builtin:${skill}`; }
export function publishedTrialId(id:string,version:number) { return `published:${id}:v${version}`; }
export function trialResumeHref(id:string) {
  if(id.startsWith('builtin:'))return `/learn?skill=${encodeURIComponent(id.slice(8))}`;
  const published=/^published:([a-f0-9-]{36}):v\d+$/i.exec(id);
  if(published)return `/learn?lesson=${encodeURIComponent(published[1])}`;
  return `/coach/session/${encodeURIComponent(id)}`;
}
