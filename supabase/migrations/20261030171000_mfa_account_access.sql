begin;
-- Opt-in MFA also protects the two tables readable directly with an account JWT.
-- The function checks the provider's factor registry, never editable user_metadata.
create function public.account_mfa_satisfied() returns boolean
language sql stable security definer set search_path='' as $$
 select coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'aal','')='aal2'
 or not exists(select 1 from auth.mfa_factors where user_id=(select auth.uid()) and status='verified');
$$;
revoke all on function public.account_mfa_satisfied() from public,anon;
grant execute on function public.account_mfa_satisfied() to authenticated,service_role;
create policy "Require opted-in MFA for profile reads" on public.account_profiles as restrictive for select to authenticated
 using ((select public.account_mfa_satisfied()));
create policy "Require opted-in MFA for trial reads" on public.coaching_trials as restrictive for select to authenticated
 using ((select public.account_mfa_satisfied()));
commit;
