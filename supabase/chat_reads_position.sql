create table if not exists public.chat_reads (
  chat_id uuid not null references public.chats(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  last_read_at timestamptz not null default timezone('utc', now()),
  primary key (chat_id, user_id)
);

alter table public.chat_reads
  add column if not exists last_position_message_id uuid references public.messages(id) on delete set null;

alter table public.chat_reads
  add column if not exists last_position_at timestamptz;

alter table public.chat_reads enable row level security;

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
