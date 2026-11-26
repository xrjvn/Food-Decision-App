begin;

create table public.events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  waterloo_date date generated always as ((created_at at time zone 'America/Toronto')::date) stored,
  browser_id uuid not null,
  session_id uuid not null,
  event_type varchar(24) not null check (event_type in (
    'result_shown', 'reroll', 'menu_tap', 'directions_tap',
    'report_tap', 'ranking_toggle', 'hours_fallback_shown'
  )),
  restaurant_id varchar(12) check (restaurant_id ~ '^R[0-9]{1,11}$'),
  meal_id varchar(12) check (meal_id ~ '^M[0-9]{1,11}$'),
  rank_position smallint check (rank_position between 1 and 100),
  budget numeric(5,2) not null check (budget between 1 and 100),
  mood varchar(12) not null check (mood in ('Anything', 'Quick', 'Filling', 'Light', 'Treat')),
  ranking_mode varchar(12) not null check (ranking_mode in ('best-fit', 'cheapest')),
  location_mode varchar(6) not null check (location_mode in ('campus', 'device')),
  walk_limit_minutes smallint not null check (walk_limit_minutes in (5, 10, 15, 20)),
  check (
    (event_type in ('ranking_toggle', 'hours_fallback_shown')
      and restaurant_id is null and meal_id is null and rank_position is null)
    or
    (event_type in ('result_shown', 'reroll', 'menu_tap', 'directions_tap', 'report_tap')
      and restaurant_id is not null and rank_position is not null)
  )
);

alter table public.events enable row level security;
revoke all on table public.events from public, anon, authenticated;
grant insert (
  browser_id, session_id, event_type, restaurant_id, meal_id, rank_position,
  budget, mood, ranking_mode, location_mode, walk_limit_minutes
) on table public.events to anon;

create policy "Anonymous clients may insert pilot events"
  on public.events for insert to anon
  with check (true);

commit;
