-- Read-only report for the operator's Supabase SQL Editor.
-- Each waitlist entry has one follow-up answer; a later submission replaces it.
-- created_at is the first submission time, not a last-edited timestamp.
select
  f.answer as requested_skill,
  f.created_at as first_submitted_at,
  w.email,
  w.created_at as joined_waitlist_at
from public.followups as f
join public.waitlist as w on w.id = f.waitlist_id
order by f.created_at desc;
