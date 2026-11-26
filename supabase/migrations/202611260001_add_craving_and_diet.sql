begin;

alter table public.events
  add column craving varchar(16),
  add column diet varchar(24),
  drop constraint events_mood_check,
  add constraint events_craving_check check (craving in ('Meal', 'Snack', 'Dessert/Drink')),
  add constraint events_diet_check check (diet in ('Anything', 'Meat or fish only', 'Vegetarian only')),
  add constraint events_search_filters_check check ((craving is null) = (diet is null)),
  add constraint events_mood_check check (
    mood in ('Anything', 'Quick', 'Filling')
    or (craving is null and diet is null and mood in ('Light', 'Treat'))
  );

grant insert (craving, diet) on public.events to anon;

commit;
