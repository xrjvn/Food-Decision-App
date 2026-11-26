begin;

alter table public.events
  drop constraint events_walk_limit_minutes_check,
  drop constraint events_budget_check,
  alter column budget type numeric(5,2),
  add constraint events_walk_limit_minutes_check
    check (walk_limit_minutes in (5, 10, 15, 20)),
  add constraint events_budget_check
    check (budget between 1 and 100);

commit;
