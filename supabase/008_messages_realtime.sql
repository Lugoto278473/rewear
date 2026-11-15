-- ReWear migration 008: live message delivery via Supabase Realtime.
-- Run in the Supabase SQL editor AFTER 002 (messages table exists). Safe to re-run.
-- Without this, the app still works, but new messages appear only on the
-- 15-second poll instead of instantly.

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end
$$;
