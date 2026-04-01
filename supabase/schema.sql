create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  username text not null unique check (char_length(username) >= 3),
  full_name text,
  created_at timestamptz not null default timezone('utc', now())
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, username)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'username', 'user_' || substr(new.id::text, 1, 8))
  )
  on conflict (id) do update
  set
    email = excluded.email,
    username = excluded.username;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create table if not exists public.chats (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  is_group boolean not null default true,
  description text,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  last_message_preview text,
  last_message_at timestamptz
);

create table if not exists public.chat_members (
  chat_id uuid not null references public.chats(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('owner', 'member')),
  joined_at timestamptz not null default timezone('utc', now()),
  primary key (chat_id, user_id)
);

create or replace function public.is_chat_member(target_chat_id uuid, target_user_id uuid default auth.uid())
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.chat_members
    where chat_id = target_chat_id
      and user_id = target_user_id
  );
$$;

create or replace function public.is_chat_owner(target_chat_id uuid, target_user_id uuid default auth.uid())
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.chats
    where id = target_chat_id
      and created_by = target_user_id
  );
$$;

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body_ciphertext text not null,
  body_preview text,
  message_kind text not null check (message_kind in ('standard', 'temporary', 'view_once')),
  reply_to_id uuid references public.messages(id) on delete set null,
  expires_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz
);

create table if not exists public.message_reactions (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  emoji text not null check (char_length(emoji) <= 8),
  created_at timestamptz not null default timezone('utc', now()),
  primary key (message_id, user_id, emoji)
);

create table if not exists public.message_views (
  message_id uuid not null references public.messages(id) on delete cascade,
  viewer_id uuid not null references public.profiles(id) on delete cascade,
  opened_at timestamptz,
  primary key (message_id, viewer_id)
);

create table if not exists public.chat_reads (
  chat_id uuid not null references public.chats(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  last_read_at timestamptz not null default timezone('utc', now()),
  primary key (chat_id, user_id)
);

create or replace function public.touch_chat_from_message()
returns trigger
language plpgsql
security definer
as $$
begin
  update public.chats
  set
    last_message_preview = case
      when new.message_kind = 'view_once' then 'View once message'
      else left(coalesce(new.body_preview, ''), 120)
    end,
    last_message_at = new.created_at
  where id = new.chat_id;

  return new;
end;
$$;

drop trigger if exists on_message_insert_touch_chat on public.messages;
create trigger on_message_insert_touch_chat
after insert on public.messages
for each row execute procedure public.touch_chat_from_message();

create or replace view public.chat_member_details
with (security_invoker = true) as
select
  cm.user_id,
  c.id as chat_id,
  c.title as chat_title,
  c.is_group,
  c.created_by,
  c.created_at,
  c.last_message_preview,
  c.last_message_at,
  c.description
from public.chat_members cm
join public.chats c on c.id = cm.chat_id;

alter table public.profiles enable row level security;
alter table public.chats enable row level security;
alter table public.chat_members enable row level security;
alter table public.messages enable row level security;
alter table public.message_reactions enable row level security;
alter table public.message_views enable row level security;
alter table public.chat_reads enable row level security;

drop policy if exists "profiles readable by signed in users" on public.profiles;
create policy "profiles readable by signed in users"
on public.profiles for select
to authenticated
using (true);

drop policy if exists "profiles can insert self" on public.profiles;
create policy "profiles can insert self"
on public.profiles for insert
to authenticated
with check (auth.uid() = id);

drop policy if exists "profiles can update self" on public.profiles;
create policy "profiles can update self"
on public.profiles for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "chat members can read chats" on public.chats;
create policy "chat members can read chats"
on public.chats for select
to authenticated
using (public.is_chat_member(chats.id) or chats.created_by = auth.uid());

drop policy if exists "authenticated users can create chats" on public.chats;
create policy "authenticated users can create chats"
on public.chats for insert
to authenticated
with check (created_by = auth.uid());

drop policy if exists "members can read memberships" on public.chat_members;
create policy "members can read memberships"
on public.chat_members for select
to authenticated
using (
  user_id = auth.uid()
  or public.is_chat_member(chat_members.chat_id)
);

drop policy if exists "chat owners can add memberships" on public.chat_members;
create policy "chat owners can add memberships"
on public.chat_members for insert
to authenticated
with check (public.is_chat_owner(chat_members.chat_id));

drop policy if exists "members can read messages" on public.messages;
create policy "members can read messages"
on public.messages for select
to authenticated
using (public.is_chat_member(messages.chat_id));

drop policy if exists "members can send messages" on public.messages;
create policy "members can send messages"
on public.messages for insert
to authenticated
with check (
  sender_id = auth.uid()
  and public.is_chat_member(messages.chat_id)
);

drop policy if exists "members can read reactions" on public.message_reactions;
create policy "members can read reactions"
on public.message_reactions for select
to authenticated
using (
  exists (
    select 1
    from public.messages m
    where m.id = message_reactions.message_id
      and public.is_chat_member(m.chat_id)
  )
);

drop policy if exists "members can write reactions" on public.message_reactions;
create policy "members can write reactions"
on public.message_reactions for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.messages m
    where m.id = message_reactions.message_id
      and public.is_chat_member(m.chat_id)
  )
);

drop policy if exists "users can remove own reactions" on public.message_reactions;
create policy "users can remove own reactions"
on public.message_reactions for delete
to authenticated
using (user_id = auth.uid());

drop policy if exists "members can read message views" on public.message_views;
create policy "members can read message views"
on public.message_views for select
to authenticated
using (
  viewer_id = auth.uid()
  or exists (
    select 1
    from public.messages m
    where m.id = message_views.message_id
      and public.is_chat_member(m.chat_id)
  )
);

drop policy if exists "users can log own message views" on public.message_views;
create policy "users can log own message views"
on public.message_views for insert
to authenticated
with check (viewer_id = auth.uid());

drop policy if exists "users can update own message views" on public.message_views;
create policy "users can update own message views"
on public.message_views for update
to authenticated
using (viewer_id = auth.uid())
with check (viewer_id = auth.uid());

drop policy if exists "users can read own chat reads" on public.chat_reads;
create policy "users can read own chat reads"
on public.chat_reads for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "members can insert own chat reads" on public.chat_reads;
create policy "members can insert own chat reads"
on public.chat_reads for insert
to authenticated
with check (
  user_id = auth.uid()
  and public.is_chat_member(chat_reads.chat_id)
);

drop policy if exists "users can update own chat reads" on public.chat_reads;
create policy "users can update own chat reads"
on public.chat_reads for update
to authenticated
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and public.is_chat_member(chat_reads.chat_id)
);
