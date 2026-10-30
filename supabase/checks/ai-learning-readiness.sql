-- Read-only: no user records, secrets, writes, trial claims or AI-budget usage.
-- Run in the intended Supabase project's SQL Editor. Every row should be true.
with required_tables(name) as (
  values ('coaching_trials'),('account_profiles'),('learner_progress'),
    ('learning_events'),('coaching_reports'),('trial_claims'),('ai_usage'),('rate_limits')
), required_functions(name) as (
  values ('claim_coaching_trial'),('advance_coaching_trial'),('progress_save'),
    ('coaching_trial_use'),('ai_budget_use'),('rate_hit'),('account_login_email')
)
select 'table: public.' || name as check_name,
  to_regclass('public.' || name) is not null as ready
from required_tables
union all
select 'function: public.' || f.name,
  exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname=f.name)
from required_functions f
union all
select 'private JPEG profile-avatars bucket',
  exists(select 1 from storage.buckets where id='profile-avatars'
    and public=false and file_size_limit=262144 and allowed_mime_types=array['image/jpeg'])
order by check_name;
