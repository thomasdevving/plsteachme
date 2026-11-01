import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import nextEnv from '@next/env';
import { passwordSchema } from '../lib/auth/profile';

export const REVIEW_ACCOUNT = {username:'ycombinatorw2026',email:'contact@plsteach.me'} as const;
export class ProvisionError extends Error {}

/** Admin-only provisioning. Never grants privileges based on editable profile data at runtime. */
export async function provisionReviewAccount(client:SupabaseClient,password:string) {
  if(!passwordSchema.safeParse(password).success)throw new ProvisionError('Set REVIEW_ACCOUNT_PASSWORD to a password of 12–128 characters.');
  const profile=await client.from('account_profiles').select('user_id').eq('username',REVIEW_ACCOUNT.username).maybeSingle();
  if(profile.error)throw new ProvisionError('Account profiles are unavailable. Apply the account-profile migration first.');
  let user;
  if(profile.data) {
    const existing=await client.auth.admin.getUserById(profile.data.user_id);
    if(existing.error || !existing.data.user || existing.data.user.is_anonymous || existing.data.user.email?.toLowerCase()!==REVIEW_ACCOUNT.email)
      throw new ProvisionError('That username belongs to a different account. No existing account was changed.');
    user=existing.data.user;
  } else {
    const created=await client.auth.admin.createUser({
      email:REVIEW_ACCOUNT.email,password,email_confirm:true,
      user_metadata:{username:REVIEW_ACCOUNT.username,first_name:'Y Combinator',last_name:'Winter 2026'}
    });
    if(created.error || !created.data.user)
      throw new ProvisionError('Could not create the review account. Check whether its email already belongs to another account; no existing account was changed.');
    user=created.data.user;
  }
  // Verify the signup trigger reserved the username before granting access.
  const reserved=await client.from('account_profiles').select('username').eq('user_id',user.id).maybeSingle();
  if(reserved.error || reserved.data?.username!==REVIEW_ACCOUNT.username)
    throw new ProvisionError('The account exists but its username profile is not ready. No unlimited-access grant was applied.');
  const updated=await client.auth.admin.updateUserById(user.id,{
    password,email_confirm:true,
    app_metadata:{...user.app_metadata,coaching_access:'unlimited'}
  });
  if(updated.error || updated.data.user?.app_metadata.coaching_access!=='unlimited')
    throw new ProvisionError('Could not apply unlimited coaching access. Check Supabase Auth before retrying.');
  return {id:user.id,...REVIEW_ACCOUNT,unlimitedCoaching:true};
}

if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  try {
    nextEnv.loadEnvConfig(process.cwd());
    const url=(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL)?.trim();
    const key=process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    if(!url || !key)throw new ProvisionError('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY securely in your local environment. Do not paste them into chat or commit them.');
    const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
    await provisionReviewAccount(client,process.env.REVIEW_ACCOUNT_PASSWORD || '');
    console.info(`Ready: ${REVIEW_ACCOUNT.username} (${REVIEW_ACCOUNT.email}), unlimited coaching access. No password or admin key was logged.`);
  } catch(error) {
    console.error(error instanceof ProvisionError?error.message:'Provisioning could not finish. Check your Supabase connection and retry.');
    process.exitCode=1;
  } finally {
    delete process.env.REVIEW_ACCOUNT_PASSWORD;
  }
}
