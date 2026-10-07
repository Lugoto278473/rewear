-- Approximate listing location for local browsing. numeric(5,2)/(6,2) rounds
-- to two decimals (~1 km), so an exact home address is never stored even if a
-- client sends full GPS precision.
alter table public.listings
  add column if not exists lat numeric(5,2) check (lat between -90 and 90),
  add column if not exists lng numeric(6,2) check (lng between -180 and 180);
