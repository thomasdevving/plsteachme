begin;
create table public.waitlist (
 id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(),
 email text not null unique check (length(email) <= 254),
 age_bracket text not null check (age_bracket in ('16-17','18-24','25-34','35+')),
 skills text[] not null default '{}', other_skill text not null default '' check (length(other_skill) <= 500),
 payment text check (payment in ('free','few','5-10','per-skill','unsure')),
 consent boolean not null check (consent = true), consent_version text not null,
 attribution jsonb not null default '{}', referral_code text not null unique,
 session_hash text not null unique
);
create table public.skill_votes (
 id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(),
 skill text not null check (skill in ('tie','shaving','beard','ironing','button','drill')),
 voter_hash text not null, waitlist_id uuid references public.waitlist(id) on delete cascade,
 unique (voter_hash, skill)
);
create table public.org_leads (
 id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(),
 name text not null, organization text not null, role text not null,
 type text not null check (type in ('school','higher','youth','healthcare','employer','other')),
 email text not null, phone text not null default '', needs text not null,
 consent boolean not null check (consent = true), consent_version text not null, attribution jsonb not null default '{}'
);
create table public.followups (
 id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(),
 waitlist_id uuid not null unique references public.waitlist(id) on delete cascade,
 answer text not null check (length(answer) between 1 and 1000)
);
-- This is an aggregate only: no email, IP, timestamps of individual visits, or campaign data.
create table public.anonymous_counters (name text primary key, total bigint not null default 0);
insert into public.anonymous_counters(name) values ('under16');
create function public.increment_under16() returns void language sql security definer set search_path = '' as $$
 update public.anonymous_counters set total = total + 1 where name = 'under16';
$$;
revoke all on function public.increment_under16() from public, anon, authenticated;
grant execute on function public.increment_under16() to service_role;
-- API routes use service_role only. No browser role can read OR bypass the validation by inserting directly.
-- RLS enabled without permissive policies is deny-by-default.
alter table public.waitlist enable row level security;
alter table public.skill_votes enable row level security;
alter table public.org_leads enable row level security;
alter table public.followups enable row level security;
alter table public.anonymous_counters enable row level security;
revoke all on table public.waitlist, public.skill_votes, public.org_leads, public.followups, public.anonymous_counters from anon, authenticated;
grant all on table public.waitlist, public.skill_votes, public.org_leads, public.followups, public.anonymous_counters to service_role;
commit;
