import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { provisionReviewAccount, REVIEW_ACCOUNT } from '../scripts/provision-review-account';

const id='11111111-1111-4111-8111-111111111111';
const password='test password for review account';
const admin={createUser:vi.fn(),getUserById:vi.fn(),updateUserById:vi.fn()};
const query=vi.fn();
const client={auth:{admin},from:()=>({select:()=>({eq:(column:string,value:string)=>({maybeSingle:()=>query(column,value)})})})} as unknown as SupabaseClient;
beforeEach(()=>{
 vi.resetAllMocks();
 query.mockImplementation(async(column:string)=>({data:column==='username'?null:{username:REVIEW_ACCOUNT.username},error:null}));
 admin.createUser.mockResolvedValue({data:{user:{id,app_metadata:{}}},error:null});
 admin.getUserById.mockResolvedValue({data:{user:{id,email:REVIEW_ACCOUNT.email,app_metadata:{provider:'email'}}},error:null});
 admin.updateUserById.mockResolvedValue({data:{user:{id,app_metadata:{coaching_access:'unlimited'}}},error:null});
});
describe('single review-account provisioning',()=>{
 it('creates exactly the requested account and only grants access after checking its username',async()=>{
  expect(await provisionReviewAccount(client,password)).toEqual({id,...REVIEW_ACCOUNT,unlimitedCoaching:true});
  expect(admin.createUser).toHaveBeenCalledWith(expect.objectContaining({email:REVIEW_ACCOUNT.email,password,email_confirm:true,user_metadata:expect.objectContaining({username:REVIEW_ACCOUNT.username})}));
  expect(admin.createUser.mock.calls[0][0].app_metadata).toBeUndefined();
  expect(query).toHaveBeenCalledWith('user_id',id);
  expect(admin.updateUserById).toHaveBeenCalledWith(id,{password,email_confirm:true,app_metadata:{coaching_access:'unlimited'}});
 });
 it('can rerun for the matching existing account while preserving unrelated admin metadata',async()=>{
  query.mockImplementation(async(column:string)=>({data:column==='username'?{user_id:id}:{username:REVIEW_ACCOUNT.username},error:null}));
  await provisionReviewAccount(client,password);
  expect(admin.createUser).not.toHaveBeenCalled();
  expect(admin.updateUserById).toHaveBeenCalledWith(id,expect.objectContaining({app_metadata:{provider:'email',coaching_access:'unlimited'}}));
 });
 it('never changes another account when a username or email is already occupied',async()=>{
  query.mockResolvedValue({data:{user_id:id},error:null});
  admin.getUserById.mockResolvedValue({data:{user:{id,email:'another@example.test'}},error:null});
  await expect(provisionReviewAccount(client,password)).rejects.toThrow('different account');
  expect(admin.updateUserById).not.toHaveBeenCalled();expect(admin.createUser).not.toHaveBeenCalled();
 });
 it('does not reset an existing email account as a fallback to a failed creation',async()=>{
  admin.createUser.mockResolvedValue({data:{user:null},error:{message:'email exists'}});
  await expect(provisionReviewAccount(client,password)).rejects.toThrow('no existing account was changed');
  expect(admin.updateUserById).not.toHaveBeenCalled();
 });
 it('fails without granting access if the profile trigger is missing',async()=>{
  query.mockResolvedValue({data:null,error:null});
  await expect(provisionReviewAccount(client,password)).rejects.toThrow('No unlimited-access grant was applied');
  expect(admin.updateUserById).not.toHaveBeenCalled();
 });
 it('does not contact Supabase for an invalid password',async()=>{
  await expect(provisionReviewAccount(client,'short')).rejects.toThrow('12–128');
  expect(query).not.toHaveBeenCalled();expect(admin.createUser).not.toHaveBeenCalled();
 });
});
