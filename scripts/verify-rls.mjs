// Run after migration with SUPABASE_URL and SUPABASE_ANON_KEY (publishable legacy anon key).
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_ANON_KEY;
if (!url || !key) { console.error('Set SUPABASE_URL and SUPABASE_ANON_KEY. Do not use the service-role key for this test.'); process.exit(1); }
let failed = false;
for (const table of ['waitlist','skill_votes','org_leads','followups','anonymous_counters']) {
 for (const method of ['GET','POST','PATCH','DELETE']) {
  const response = await fetch(`${url}/rest/v1/${table}${method === 'GET' ? '?select=*&limit=1' : ''}`, { method, headers:{ apikey:key, Authorization:`Bearer ${key}`, 'Content-Type':'application/json', Prefer:'return=representation' }, ...(method === 'POST' || method === 'PATCH' ? {body:'{}'} : {}) });
  if (response.status === 401 || response.status === 403) console.log(`PASS ${table}: anonymous ${method} denied`);
  else { failed=true; console.error(`FAIL ${table}: expected permission denial, received ${response.status}`); }
 }
}
process.exit(failed ? 1 : 0);
