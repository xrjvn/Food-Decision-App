-- Total sessions and unique browsers with at least one recorded event.
select count(distinct (browser_id, session_id)) as total_sessions,
       count(distinct browser_id) as unique_browsers
from public.events;

-- Returns count a distinct session beginning on a later Waterloo date.
-- The 7-day rate uses browsers that have had a full 7-day observation window.
with sessions as (
  select browser_id, session_id, min(waterloo_date) as visit_date
  from public.events
  group by browser_id, session_id
), first_visits as (
  select browser_id, min(visit_date) as first_date
  from sessions
  group by browser_id
), returns as (
  select f.browser_id, f.first_date,
         min(s.visit_date) filter (where s.visit_date > f.first_date) as first_return
  from first_visits f
  join sessions s using (browser_id)
  group by f.browser_id, f.first_date
)
select count(*) as browsers,
       count(first_return) as returned_browsers,
       round(100.0 * count(first_return) / nullif(count(*), 0), 2) as return_rate_pct,
       count(*) filter (where first_date <= (now() at time zone 'America/Toronto')::date - 7) as seven_day_cohort,
       round(100.0 * count(*) filter (
         where first_date <= (now() at time zone 'America/Toronto')::date - 7
           and first_return <= first_date + 7
       ) / nullif(count(*) filter (
         where first_date <= (now() at time zone 'America/Toronto')::date - 7
       ), 0), 2) as return_within_7_days_pct
from returns;

-- Top restaurants shown, and their tap counts by destination.
select restaurant_id,
       count(*) filter (where event_type = 'result_shown') as shown,
       count(*) filter (where event_type in ('menu_tap', 'directions_tap', 'report_tap')) as tapped,
       count(*) filter (where event_type = 'menu_tap') as menu_taps,
       count(*) filter (where event_type = 'directions_tap') as directions_taps,
       count(*) filter (where event_type = 'report_tap') as report_taps
from public.events
where restaurant_id is not null
group by restaurant_id
order by shown desc, tapped desc, restaurant_id
limit 20;

-- Top restaurants tapped.
select restaurant_id, count(*) as tapped
from public.events
where event_type in ('menu_tap', 'directions_tap', 'report_tap')
group by restaurant_id
order by tapped desc, restaurant_id
limit 20;

-- Fallback appearances and share of recorded sessions that saw it.
select count(*) filter (where event_type = 'hours_fallback_shown') as appearances,
       count(distinct (browser_id, session_id)) filter (
         where event_type = 'hours_fallback_shown'
       ) as sessions_with_fallback,
       round(100.0 * count(distinct (browser_id, session_id)) filter (
         where event_type = 'hours_fallback_shown'
       ) / nullif(count(distinct (browser_id, session_id)), 0), 2) as session_share_pct
from public.events;

-- Run as the project owner to verify the events table's effective privileges.
select has_any_column_privilege('anon', 'public.events', 'INSERT') as can_insert,
       has_table_privilege('anon', 'public.events', 'SELECT') or
         has_any_column_privilege('anon', 'public.events', 'SELECT') as can_select,
       has_table_privilege('anon', 'public.events', 'UPDATE') or
         has_any_column_privilege('anon', 'public.events', 'UPDATE') as can_update,
       has_table_privilege('anon', 'public.events', 'DELETE') as can_delete,
       (select relrowsecurity from pg_class where oid = 'public.events'::regclass) as rls_enabled;

select policyname, roles, cmd, with_check
from pg_policies
where schemaname = 'public' and tablename = 'events';

-- To export: run just this SELECT and download its results as CSV.
select * from public.events order by created_at, id;
