/** Catch common privileged-key configuration mistakes before exposing auth config. */
export function isPublicSupabaseKey(key:string|undefined, serviceKey?:string):boolean {
  if(!key || key===serviceKey || key.startsWith('sb_secret_'))return false;
  if(key.startsWith('sb_publishable_'))return true;
  try {
    const payload=key.split('.')[1];
    if(payload && JSON.parse(atob(payload.replace(/-/g,'+').replace(/_/g,'/'))).role==='service_role')return false;
  } catch { /* Invalid credentials are rejected by Supabase; never infer authorization here. */ }
  return true;
}
