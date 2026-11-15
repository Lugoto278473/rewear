-- ReWear migration 007: Accept/decline offers & delete messages
-- Run in the Supabase SQL editor. Safe to re-run.

-- 1. Allow participants to delete messages so they don't accumulate
drop policy if exists "participants delete messages" on public.messages;
create policy "participants delete messages"
  on public.messages for delete
  using (auth.uid() in (sender_id, recipient_id));

-- 2. Allow sellers to accept an offer (turns it into a transaction and reserves the listing)
create or replace function public.accept_offer(p_offer_id uuid)
returns public.transactions
language plpgsql
security definer
set search_path = public
as $$
declare
  o public.offers;
  l public.listings;
  t public.transactions;
begin
  if auth.uid() is null then
    raise exception 'Please log in first.';
  end if;

  select * into o from public.offers where id = p_offer_id for update;
  if not found then
    raise exception 'Offer not found.';
  end if;
  if o.seller_id <> auth.uid() then
    raise exception 'You can only accept offers on your own listings.';
  end if;
  if o.status <> 'pending' then
    raise exception 'This offer is no longer pending.';
  end if;

  select * into l from public.listings where id = o.listing_id for update;
  if not found or l.status <> 'active' then
    raise exception 'This item is no longer available.';
  end if;

  -- Create transaction in accepted status
  insert into public.transactions (listing_id, buyer_id, seller_id, amount, status)
  values (l.id, o.buyer_id, o.seller_id, o.offer_amount, 'accepted')
  returning * into t;

  -- Update listing to reserved
  update public.listings set status = 'reserved' where id = l.id;

  -- Update offer to accepted
  update public.offers set status = 'accepted' where id = o.id;

  -- Decline any other pending offers for this listing
  update public.offers set status = 'declined' where listing_id = l.id and id <> o.id and status = 'pending';

  return t;
end;
$$;

-- 3. Allow sellers to decline an offer
create or replace function public.decline_offer(p_offer_id uuid)
returns public.offers
language plpgsql
security definer
set search_path = public
as $$
declare
  o public.offers;
begin
  if auth.uid() is null then
    raise exception 'Please log in first.';
  end if;

  select * into o from public.offers where id = p_offer_id for update;
  if not found then
    raise exception 'Offer not found.';
  end if;
  if o.seller_id <> auth.uid() then
    raise exception 'You can only decline offers on your own listings.';
  end if;

  update public.offers set status = 'declined' where id = o.id returning * into o;
  return o;
end;
$$;

revoke execute on function public.accept_offer(uuid) from public, anon;
revoke execute on function public.decline_offer(uuid) from public, anon;
grant execute on function public.accept_offer(uuid) to authenticated;
grant execute on function public.decline_offer(uuid) to authenticated;
