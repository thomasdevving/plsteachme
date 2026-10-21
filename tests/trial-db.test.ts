import { it,expect } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFile,readdir } from 'node:fs/promises';

it('applies every migration together and enforces durable trial ownership, monotonic progress and RLS',async()=>{
  const db=new PGlite();
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
      create schema auth;create table auth.users(id uuid primary key, email text);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema auth to authenticated;
      create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);`);
    const directory=new URL('../supabase/migrations/',import.meta.url);
    for(const file of (await readdir(directory)).filter(name=>name.endsWith('.sql')).sort())await db.exec(await readFile(new URL(file,directory),'utf8'));
    const owner='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
    await db.query('insert into auth.users(id) values($1),($2)',[owner,other]);
    await db.exec('set role service_role');
    const claim=async(skill:string)=>(await db.query<{trial:{id:string;skill_id:string;completed_steps:number;completed_at:string|null}}>('select public.claim_coaching_trial($1,$2,7,$3) trial',[owner,skill,'owner@example.test'])).rows[0].trial;
    const first=await claim('tie-four-in-hand');
    expect(await claim('builtin:laundry')).toEqual(first);
    expect((await db.query<{count:number}>('select count(*)::int count from public.coaching_trials')).rows[0].count).toBe(1);
    const progress=async(user:string,steps:number)=>(await db.query<{trial:{completed_steps:number;completed_at:string|null}|null}>('select public.advance_coaching_trial($1,$2,$3) trial',[user,first.id,steps])).rows[0].trial;
    expect(await progress(other,4)).toBeNull();
    expect(await progress(owner,4)).toMatchObject({completed_steps:4,completed_at:null});
    expect(await progress(owner,2)).toMatchObject({completed_steps:4,completed_at:null});
    const completed=await progress(owner,100);
    expect(completed?.completed_steps).toBe(7);expect(completed?.completed_at).toBeTruthy();
    expect(await progress(owner,0)).toEqual(completed);
    expect(await claim('builtin:laundry')).toMatchObject({id:first.id,skill_id:first.skill_id,completed_at:completed?.completed_at});
    // The second migration really enables all nine illustrated skill votes.
    for(const skill of ['laundry','cooking','bike'])await db.query('insert into public.skill_votes(skill,voter_hash) values($1,$2)',[skill,`test-${skill}`]);
    await db.exec('set role authenticated');
    await db.query("select set_config('request.jwt.claim.sub',$1,false)",[other]);
    expect((await db.query('select id from public.coaching_trials')).rows).toEqual([]);
    await db.query("select set_config('request.jwt.claim.sub',$1,false)",[owner]);
    expect((await db.query('select id from public.coaching_trials')).rows).toEqual([{id:first.id}]);
    await expect(claim('builtin:laundry')).rejects.toThrow('permission denied');
    await expect(progress(owner,0)).rejects.toThrow('permission denied');
    await expect(db.exec('delete from public.coaching_trials')).rejects.toThrow('permission denied');
    await db.exec('set role anon');
    await expect(db.exec('select * from public.coaching_trials')).rejects.toThrow('permission denied');
    await expect(db.exec('select * from public.platform_lessons')).rejects.toThrow('permission denied');
  } finally {await db.close();}
},20_000);
