-- ReWear: Safe Trade transactions + offers.
-- Run after supabase/schema.sql and 002, in the Supabase SQL editor. Safe to
-- re-run.

-- ---------------------------------------------------------------------------
-- Transactions
-- ---------------------------------------------------------------------------

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id),
  buyer_id uuid not null references public.users(id),
  seller_id uuid not null references public.users(id),
  amount numeric(10, 2) not null,
  status text not null default 'pending',
  tracking_number text,
  signature_confirmed boolean default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Lifecycle: pending -> accepted -> shipped -> completed, or pending ->
-- declined. Nothing is charged yet, so the old 'paid' status is renamed.
update public.transactions set status = 'accepted' where status = 'paid';

alter table public.transactions drop constraint if exists transactions_status_check;
alter table public.transactions add constraint transactions_status_check
  check (status in ('pending', 'accepted', 'shipped', 'completed', 'declined'));

-- One live sale per listing, so a double click or a second buyer can't
-- create a duplicate.
create unique index if not exists transactions_one_open_per_listing
  on public.transactions (listing_id) where status <> 'declined';

alter table public.transactions enable row level security;

drop policy if exists "Users can view own transactions" on public.transactions;
create policy "Users can view own transactions"
  on public.transactions for select
  using (auth.uid() = buyer_id or auth.uid() = seller_id);

-- Clients never write rows directly: the price, seller and status would all
-- be client-controlled. They go through the functions below instead.
drop policy if exists "Buyers can initiate transactions" on public.transactions;
revoke insert, update, delete on public.transactions from anon, authenticated;

-- Buy a listing at its listed price. Locks the listing row so two buyers
-- can't both get it, and reserves it so it leaves the browse grid.
create or replace function public.buy_listing(p_listing_id uuid)
returns public.transactions
language plpgsql
security definer
set search_path = public
as $$
declare
  l public.listings;
  t public.transactions;
begin
  if auth.uid() is null then
    raise exception 'Please log in first.';
  end if;

  select * into l from public.listings where id = p_listing_id for update;
  if not found then
    raise exception 'Listing not found.';
  end if;
  if l.seller_id = auth.uid() then
    raise exception 'You cannot buy your own listing.';
  end if;
  if l.status <> 'active' then
    raise exception 'This item is no longer available.';
  end if;

  insert into public.transactions (listing_id, buyer_id, seller_id, amount)
  values (l.id, auth.uid(), l.seller_id, l.price)
  returning * into t;

  update public.listings set status = 'reserved' where id = l.id;
  return t;
end;
$$;

-- Move a sale one step. The seller accepts/declines and ships; only the
-- buyer can confirm delivery and complete it.
create or replace function public.advance_transaction(p_id uuid, p_status text)
returns public.transactions
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.transactions;
begin
  select * into t from public.transactions where id = p_id for update;
  if not found or auth.uid() is null or auth.uid() not in (t.buyer_id, t.seller_id) then
    raise exception 'Transaction not found.';
  end if;

  if not (
    (auth.uid() = t.seller_id and t.status = 'pending' and p_status in ('accepted', 'declined'))
    or (auth.uid() = t.seller_id and t.status = 'accepted' and p_status = 'shipped')
    or (auth.uid() = t.buyer_id and t.status = 'shipped' and p_status = 'completed')
  ) then
    raise exception 'You cannot move this sale from % to %.', t.status, p_status;
  end if;

  update public.transactions
  set status = p_status,
      signature_confirmed = (p_status = 'completed'),
      updated_at = now()
  where id = p_id
  returning * into t;

  -- A declined sale puts the item back on sale; a completed one marks it sold.
  if p_status = 'declined' then
    update public.listings set status = 'active' where id = t.listing_id;
  elsif p_status = 'completed' then
    update public.listings set status = 'sold' where id = t.listing_id;
  end if;

  return t;
end;
$$;

revoke execute on function public.buy_listing(uuid) from public, anon;
revoke execute on function public.advance_transaction(uuid, text) from public, anon;
grant execute on function public.buy_listing(uuid) to authenticated;
grant execute on function public.advance_transaction(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Offers
-- ---------------------------------------------------------------------------

create table if not exists public.offers (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings on delete cascade,
  buyer_id uuid not null references public.users on delete cascade,
  seller_id uuid not null references public.users on delete cascade,
  offer_amount numeric(10, 2) not null check (offer_amount > 0),
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  check (buyer_id <> seller_id)
);

create index if not exists offers_seller_idx on public.offers (seller_id, created_at desc);
create index if not exists offers_buyer_idx on public.offers (buyer_id, created_at desc);

alter table public.offers enable row level security;

drop policy if exists "participants read offers" on public.offers;
create policy "participants read offers"
  on public.offers for select
  using (auth.uid() in (buyer_id, seller_id));

-- You can make a pending offer, up to the asking price, on someone else's
-- active listing. seller_id must be the listing's real seller. The older,
-- looser insert policy is dropped, since policies are OR'd together.
drop policy if exists "Buyers can create offers" on public.offers;
drop policy if exists "buyers make offers" on public.offers;
create policy "buyers make offers"
  on public.offers for insert
  with check (
    auth.uid() = buyer_id
    and status = 'pending'
    and exists (
      select 1 from public.listings l
      where l.id = listing_id
        and l.seller_id = offers.seller_id
        and l.seller_id <> auth.uid()
        and l.status = 'active'
        and offers.offer_amount <= l.price
    )
  );
