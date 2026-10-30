begin;
-- Comments are private account data, never a public comment feed. Dates are server-owned.
create table public.lesson_feedback (
 user_id uuid not null references auth.users(id) on delete cascade,
 lesson_key text not null check(lesson_key ~ '^(builtin:[a-z]+|(published|training):[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$'),
 version integer not null check(version between 1 and 999999),
 rating integer not null check(rating between 1 and 5),
 comment text not null default '' check(char_length(comment)<=2000),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 primary key(user_id,lesson_key,version)
);
create index lesson_feedback_lesson_version on public.lesson_feedback(lesson_key,version);
alter table public.lesson_feedback enable row level security;
revoke all on public.lesson_feedback from public,anon,authenticated;
grant select,insert,update,delete on public.lesson_feedback to service_role;

-- One rating per account/version; edits preserve the original date and stamp the new one.
create function public.lesson_feedback_save(p_user uuid,p_key text,p_version integer,p_rating integer,p_comment text) returns void
language sql security invoker set search_path='' as $$
 insert into public.lesson_feedback(user_id,lesson_key,version,rating,comment)
 values(p_user,p_key,p_version,p_rating,btrim(p_comment))
 on conflict(user_id,lesson_key,version) do update set rating=excluded.rating,comment=excluded.comment,updated_at=now();
$$;
create function public.lesson_feedback_summary(p_key text,p_version integer) returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('count',count(*),'average',round(avg(rating),1))
 from public.lesson_feedback where lesson_key=p_key and version=p_version;
$$;
revoke all on function public.lesson_feedback_save(uuid,text,integer,integer,text) from public,anon,authenticated;
revoke all on function public.lesson_feedback_summary(text,integer) from public,anon,authenticated;
grant execute on function public.lesson_feedback_save(uuid,text,integer,integer,text) to service_role;
grant execute on function public.lesson_feedback_summary(text,integer) to service_role;
commit;
