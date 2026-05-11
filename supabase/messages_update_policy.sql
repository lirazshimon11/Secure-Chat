alter table public.messages
  add column if not exists edited_at timestamptz;

drop policy if exists "senders can soft delete messages" on public.messages;
drop policy if exists "members can edit own messages" on public.messages;

create policy "members can edit own messages"
on public.messages for update
to authenticated
using (
  sender_id = auth.uid()
  and public.is_chat_member(messages.chat_id)
)
with check (
  sender_id = auth.uid()
  and public.is_chat_member(messages.chat_id)
);
