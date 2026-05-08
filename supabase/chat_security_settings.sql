create table if not exists public.chat_security_settings (
  chat_id uuid primary key references public.chats(id) on delete cascade,
  require_hold_to_reveal boolean not null default true,
  identity_magnet boolean not null default true,
  shutter_flicker boolean not null default true,
  app_switcher_blackout boolean not null default true,
  fake_screenshot_warning boolean not null default true,
  anti_copy_canvas boolean not null default true,
  updated_at timestamptz not null default timezone('utc'::text, now()),
  updated_by uuid references public.profiles(id) on delete set null
);

alter table public.chat_security_settings enable row level security;

drop policy if exists "chat security settings are readable by members" on public.chat_security_settings;
create policy "chat security settings are readable by members"
  on public.chat_security_settings
  for select
  using (public.is_chat_member(chat_id));

drop policy if exists "chat security settings are editable by chat owners" on public.chat_security_settings;
create policy "chat security settings are editable by chat owners"
  on public.chat_security_settings
  for all
  using (public.is_chat_owner(chat_id))
  with check (public.is_chat_owner(chat_id));
