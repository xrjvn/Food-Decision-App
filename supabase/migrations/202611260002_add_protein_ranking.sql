begin;

alter table public.events
  drop constraint if exists events_ranking_mode_check,
  add constraint events_ranking_mode_check
    check (ranking_mode in ('best-fit', 'cheapest', 'most-protein'));

commit;
