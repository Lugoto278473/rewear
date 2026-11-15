-- ReWear migration 006: Verified Reviews tied to completed transactions.
-- Run in the Supabase SQL editor after setup_transactions.sql and 004. Safe to re-run.

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null unique references public.transactions(id) on delete cascade,
  buyer_id uuid not null references public.users(id),
  seller_id uuid not null references public.users(id),
  rating integer not null check (rating >= 1 and rating <= 5),
  comment text,
  created_at timestamptz not null default now()
);

-- Index for quickly fetching all reviews for a seller
create index if not exists reviews_seller_id_idx on public.reviews(seller_id);

-- Enable Row Level Security
alter table public.reviews enable row level security;

-- 1. Anyone can view reviews
drop policy if exists "Reviews are viewable by everyone" on public.reviews;
create policy "Reviews are viewable by everyone"
  on public.reviews for select
  using (true);

-- 2. Only the verified buyer of a COMPLETED transaction can insert a review
drop policy if exists "Buyers can review completed transactions" on public.reviews;
create policy "Buyers can review completed transactions"
  on public.reviews for insert
  with check (
    auth.uid() = buyer_id
    and exists (
      select 1 from public.transactions t
      where t.id = transaction_id
        and t.buyer_id = auth.uid()
        and t.seller_id = reviews.seller_id
        and t.status = 'completed'
    )
  );

-- Function & Trigger: Automatically update the seller's rating average on the users table
create or replace function public.update_seller_rating()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_avg numeric;
begin
  select round(avg(rating)::numeric, 1) into new_avg
  from public.reviews
  where seller_id = new.seller_id;

  update public.users
  set rating = new_avg
  where id = new.seller_id;

  return new;
end;
$$;

drop trigger if exists on_review_created on public.reviews;
create trigger on_review_created
  after insert on public.reviews
  for each row execute function public.update_seller_rating();
