-- Extend the existing vote constraint without changing RLS or permissions.
alter table public.skill_votes drop constraint if exists skill_votes_skill_check;
alter table public.skill_votes add constraint skill_votes_skill_check check (skill in ('tie','shaving','beard','ironing','button','drill','laundry','cooking','bike'));
