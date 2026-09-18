-- ReWear schema. Run this in the Supabase SQL editor.

create table if not exists public.users (
  id uuid primary key references auth.users on delete cascade,
  email text not null,
  username text unique not null,
  bio text,
  rating numeric(2, 1),
  created_at timestamptz not null default now()
);

create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.users on delete cascade,
  title text not null,
  description text,
  category text not null,
  price numeric(10, 2) not null check (price >= 0),
  condition text not null,
  images text[],
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create index if not exists listings_status_created_at_idx
  on public.listings (status, created_at desc);

-- Profile rows are created by this trigger, not by the client. At sign-up time
-- there is no session yet (email confirmation is pending), so a client-side
-- insert would be rejected by the RLS policy below. `security definer` lets the
-- function bypass RLS; it reads the username out of the sign-up metadata.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  desired text := coalesce(
    nullif(new.raw_user_meta_data ->> 'username', ''),
    split_part(new.email, '@', 1)
  );
  candidate text := desired;
  attempt int := 0;
begin
  -- The client checks availability first, but two simultaneous sign-ups can
  -- still collide. Suffix rather than raise: a failure here would abort the
  -- whole auth insert and leave the user unable to register at all.
  loop
    begin
      insert into public.users (id, email, username)
      values (new.id, new.email, candidate)
      on conflict (id) do nothing;
      return new;
    exception when unique_violation then
      attempt := attempt + 1;
      exit when attempt > 5;
      candidate := desired || floor(random() * 10000)::int::text;
    end;
  end loop;

  -- Fell through every attempt; use something guaranteed free.
  insert into public.users (id, email, username)
  values (new.id, new.email, desired || '-' || replace(new.id::text, '-', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.users enable row level security;
alter table public.listings enable row level security;

-- `create policy` has no `if not exists`, so drop first to keep this file
-- re-runnable.

-- Profiles are public; you may only write your own.
drop policy if exists "profiles are readable by anyone" on public.users;
create policy "profiles are readable by anyone"
  on public.users for select using (true);

drop policy if exists "users insert own profile" on public.users;
create policy "users insert own profile"
  on public.users for insert with check (auth.uid() = id);

drop policy if exists "users update own profile" on public.users;
create policy "users update own profile"
  on public.users for update using (auth.uid() = id);

-- Listings are public; you may only write your own.
drop policy if exists "listings are readable by anyone" on public.listings;
create policy "listings are readable by anyone"
  on public.listings for select using (true);

drop policy if exists "users insert own listings" on public.listings;
create policy "users insert own listings"
  on public.listings for insert with check (auth.uid() = seller_id);

drop policy if exists "users update own listings" on public.listings;
create policy "users update own listings"
  on public.listings for update using (auth.uid() = seller_id);

drop policy if exists "users delete own listings" on public.listings;
create policy "users delete own listings"
  on public.listings for delete using (auth.uid() = seller_id);
