-- Read-only: checks structure and permissions, never reads learner rows or secrets.
-- Run in the Supabase project configured as the Worker's SUPABASE_URL.
-- Every row should say ready = true. Do not rerun old migrations blindly.
with objects as (
 select to_regclass('public.learner_progress') as progress_table,
        to_regprocedure('public.progress_save(uuid,text,jsonb,bigint)') as save_function
)
select 'learner_progress table exists' as check_name, progress_table is not null as ready from objects
union all
select 'required progress columns exist',
 (select count(*)=4 from information_schema.columns where table_schema='public' and table_name='learner_progress'
  and column_name in ('user_id','lesson_key','data','client_updated_at'))
union all
select 'service_role can read progress',coalesce(has_table_privilege('service_role',progress_table,'SELECT'),false) from objects
union all
select 'service_role can insert progress',coalesce(has_table_privilege('service_role',progress_table,'INSERT'),false) from objects
union all
select 'service_role can update progress',coalesce(has_table_privilege('service_role',progress_table,'UPDATE'),false) from objects
union all
select 'progress_save function exists',save_function is not null from objects
union all
select 'service_role can execute progress_save',coalesce(has_function_privilege('service_role',save_function,'EXECUTE'),false) from objects
order by check_name;
