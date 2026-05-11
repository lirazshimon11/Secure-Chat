-- Ensure security toggles propagate to every active group member in realtime.
do $$
begin
  if exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) and not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'chat_security_settings'
  ) then
    alter publication supabase_realtime add table public.chat_security_settings;
  end if;
end $$;
