-- ReWear migration 002: listing photos + buyer/seller messages.
-- Run after schema.sql, in the Supabase SQL editor. Safe to re-run.

-- ---------------------------------------------------------------------------
-- Photos
-- ---------------------------------------------------------------------------

-- Public bucket: anyone can view a listing's photos by URL, so no select
-- policy is needed. The client re-encodes everything to JPEG before upload.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('listing-images', 'listing-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Uploads go to `<user id>/<file>`, and you may only write inside your own
-- folder.
drop policy if exists "users upload own listing images" on storage.objects;
create policy "users upload own listing images"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'listing-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "users delete own listing images" on storage.objects;
create policy "users delete own listing images"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'listing-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ---------------------------------------------------------------------------
-- Messages
-- ---------------------------------------------------------------------------

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings on delete cascade,
  sender_id uuid not null references public.users on delete cascade,
  recipient_id uuid not null references public.users on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  check (sender_id <> recipient_id)
);

create index if not exists messages_sender_idx
  on public.messages (sender_id, created_at);
create index if not exists messages_recipient_idx
  on public.messages (recipient_id, created_at);

alter table public.messages enable row level security;

-- You can read a message only if you sent or received it.
drop policy if exists "participants read messages" on public.messages;
create policy "participants read messages"
  on public.messages for select
  using (auth.uid() in (sender_id, recipient_id));

-- You can message a listing's seller, or, as the seller, reply to someone
-- who already messaged you about that listing. That blocks cold-messaging
-- arbitrary users.
drop policy if exists "users send messages" on public.messages;
create policy "users send messages"
  on public.messages for insert
  with check (
    auth.uid() = sender_id
    and (
      recipient_id = (select l.seller_id from public.listings l where l.id = listing_id)
      or exists (
        select 1 from public.messages m
        where m.listing_id = messages.listing_id
          and m.sender_id = messages.recipient_id
          and m.recipient_id = auth.uid()
      )
    )
  );
