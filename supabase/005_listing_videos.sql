-- ReWear migration 005: one optional presentation video per listing.
-- Run after 004, in the Supabase SQL editor. Safe to re-run.

alter table public.listings add column if not exists video_url text;

-- Public bucket like listing-images; 50 MB matches the Supabase free-plan
-- per-file cap. Uploads go to `<user id>/<file>`.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('listing-videos', 'listing-videos', true, 52428800,
        array['video/mp4', 'video/quicktime', 'video/webm'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "users upload own listing videos" on storage.objects;
create policy "users upload own listing videos"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'listing-videos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "users delete own listing videos" on storage.objects;
create policy "users delete own listing videos"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'listing-videos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
