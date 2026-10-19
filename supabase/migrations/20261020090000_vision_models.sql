begin;
-- Specialized computer vision models trained from contributed demonstrations.
-- Clips hold MediaPipe landmark features only: no images, video or audio.
create table public.vision_clips (
 id uuid primary key default gen_random_uuid(),
 target text not null check(target ~ '^(builtin:[a-z]+|lesson:[a-f0-9-]{36})$'),
 label text not null check(label ~ '^(other|s1?[0-9]|m1?[0-9])$'),
 contributor_id uuid not null references auth.users(id) on delete cascade,
 source text not null check(source in ('camera','video')),
 feature_version integer not null,
 frames jsonb not null check(jsonb_typeof(frames)='array' and jsonb_array_length(frames) between 10 and 300),
 hand_rate real not null check(hand_rate between 0 and 1),
 -- The contributor's training permission is recorded with every clip.
 consent_version text not null,
 created_at timestamptz not null default now()
);
create index vision_clips_target on public.vision_clips(target,label);
create index vision_clips_contributor on public.vision_clips(contributor_id);
create table public.vision_models (
 id uuid primary key default gen_random_uuid(),
 target text not null check(target ~ '^(builtin:[a-z]+|lesson:[a-f0-9-]{36})$'),
 version integer not null check(version>0),
 status text not null default 'candidate' check(status in ('candidate','active','retired')),
 labels jsonb not null, model jsonb not null, metrics jsonb not null, gate jsonb not null,
 dataset_clips integer not null, feature_version integer not null,
 trained_by uuid not null references auth.users(id), trained_at timestamptz not null default now(),
 activated_by uuid references auth.users(id), activated_at timestamptz,
 unique(target,version)
);
-- At most one model per lesson serves learners at a time.
create unique index vision_models_one_active on public.vision_models(target) where status='active';
create index vision_models_trainer on public.vision_models(trained_by);
create index vision_models_activator on public.vision_models(activated_by);
create table public.vision_shadow_checks (
 id bigint generated always as identity primary key,
 model_id uuid not null references public.vision_models(id) on delete cascade,
 step integer not null check(step between 0 and 19),
 predicted text not null, confidence real not null check(confidence between 0 and 1),
 coach_status text not null check(coach_status in ('looks_right','adjust','unclear','not_verifiable','stop')),
 agrees boolean,
 created_at timestamptz not null default now()
);
create index vision_shadow_model on public.vision_shadow_checks(model_id);

alter table public.vision_clips enable row level security;
alter table public.vision_models enable row level security;
alter table public.vision_shadow_checks enable row level security;
revoke all on public.vision_clips, public.vision_models, public.vision_shadow_checks from anon, authenticated;
grant select,insert,delete on public.vision_clips to service_role;
grant select,insert,update on public.vision_models to service_role;
grant select,insert on public.vision_shadow_checks to service_role;
grant usage on sequence public.vision_shadow_checks_id_seq to service_role;

-- Swaps the active model atomically. Only a candidate that passed its quality gate can serve learners.
create function public.vision_activate(actor_id uuid, model_id uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare chosen public.vision_models%rowtype;
begin
 select * into chosen from public.vision_models where id=model_id for update;
 if not found then raise exception 'not_found'; end if;
 if chosen.status<>'candidate' or not coalesce((chosen.gate->>'passed')::boolean,false) then raise exception 'conflict'; end if;
 update public.vision_models set status='retired' where target=chosen.target and status='active';
 update public.vision_models set status='active',activated_by=actor_id,activated_at=now() where id=model_id;
 return jsonb_build_object('ok',true);
end;
$$;
revoke all on function public.vision_activate(uuid,uuid) from public,anon,authenticated;
grant execute on function public.vision_activate(uuid,uuid) to service_role;
commit;
