-- Read-only: no user records, secrets, writes, trial claims or AI-budget usage.
-- Run in the intended Supabase project's SQL Editor. Every row should be true.
with required_tables(name) as (
  values ('coaching_trials'),('account_profiles'),('learner_progress'),
    ('lesson_feedback'),('learning_events'),('coaching_reports'),('trial_claims'),('ai_usage'),('rate_limits')
), required_functions(name,signature) as (
  values ('claim_coaching_trial','public.claim_coaching_trial(uuid,text,integer,text)'),
    ('advance_coaching_trial','public.advance_coaching_trial(uuid,uuid,integer)'),
    ('progress_save','public.progress_save(uuid,text,jsonb,bigint)'),
    ('coaching_trial_use','public.coaching_trial_use(uuid,uuid,integer,integer)'),
    ('ai_budget_use','public.ai_budget_use(text,integer)'),
    ('rate_hit','public.rate_hit(text,integer,integer)'),
    ('account_login_email','public.account_login_email(text)'),
    ('lesson_feedback_save','public.lesson_feedback_save(uuid,text,integer,integer,text)'),
    ('lesson_feedback_summary','public.lesson_feedback_summary(text,integer)'),
    ('account_mfa_satisfied','public.account_mfa_satisfied()')
)
select 'table: public.' || name as check_name,
  to_regclass('public.' || name) is not null as ready
from required_tables
union all
select 'function: public.' || f.name,
  to_regprocedure(f.signature) is not null
from required_functions f
union all
select 'private JPEG profile-avatars bucket',
  exists(select 1 from storage.buckets where id='profile-avatars'
    and public=false and file_size_limit=262144 and allowed_mime_types=array['image/jpeg'])
order by check_name;
