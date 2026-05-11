alter table public.messages
  add column if not exists edited_at timestamptz;

alter table public.chat_decoy_messages
  add column if not exists edited_at timestamptz;

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

drop policy if exists "members can edit own decoy messages" on public.chat_decoy_messages;
create policy "members can edit own decoy messages"
on public.chat_decoy_messages for update
to authenticated
using (
  sender_id = auth.uid()
  and public.is_chat_member(chat_decoy_messages.chat_id)
)
with check (
  sender_id = auth.uid()
  and public.is_chat_member(chat_decoy_messages.chat_id)
);
