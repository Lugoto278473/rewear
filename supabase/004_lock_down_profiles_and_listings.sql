-- ReWear migration 004: hide emails, stop self-rating, freeze listings in a sale.
-- Run after setup_transactions.sql, in the Supabase SQL editor. Safe to re-run.

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------

-- Profiles stay public, but `email` is no longer selectable by clients. A
-- column revoke can't override a table-level grant, so grant per column.
-- Your own email comes from the auth session, not this table.
revoke select, insert, update on public.users from anon, authenticated;
grant select (id, username, bio, rating, created_at) on public.users to anon, authenticated;

-- You may edit your username and bio only; `rating` is server-controlled.
-- Rows are created by the handle_new_user() trigger, so no client insert.
grant update (username, bio) on public.users to authenticated;

-- ---------------------------------------------------------------------------
-- Listings
-- ---------------------------------------------------------------------------

-- New listings must start active (no posting straight to 'sold').
drop policy if exists "users insert own listings" on public.listings;
create policy "users insert own listings"
  on public.listings for insert
  with check (auth.uid() = seller_id and status = 'active');

-- Status only moves through buy_listing()/advance_transaction(), and a listing
-- in a sale can't be edited (e.g. price changed under the buyer). Those
-- functions are security definer, so current_user is the owner there and
-- this check lets them through.
create or replace function public.guard_listing_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('anon', 'authenticated') then
    if new.status is distinct from old.status then
      raise exception 'Listing status can only change through a sale.';
    end if;
    if old.status <> 'active' then
      raise exception 'This listing is part of a sale and can no longer be edited.';
    end if;
    if new.seller_id is distinct from old.seller_id then
      raise exception 'You cannot change who is selling a listing.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_listing_update on public.listings;
create trigger guard_listing_update
  before update on public.listings
  for each row execute function public.guard_listing_update();
