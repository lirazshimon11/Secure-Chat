-- Restrict decoy bait messages: each member updates/deletes only their own rows (still readable by everyone in the chat).
-- Run in Supabase SQL Editor after chat_decoy_messages exists.

DROP POLICY IF EXISTS "members can delete decoy messages" ON public.chat_decoy_messages;
CREATE POLICY "members delete own decoy messages"
ON public.chat_decoy_messages FOR DELETE TO authenticated
USING (
  public.is_chat_member(chat_decoy_messages.chat_id)
  AND sender_id = auth.uid()
);

DROP POLICY IF EXISTS "members update own decoy messages" ON public.chat_decoy_messages;
CREATE POLICY "members update own decoy messages"
ON public.chat_decoy_messages FOR UPDATE TO authenticated
USING (
  public.is_chat_member(chat_decoy_messages.chat_id)
  AND sender_id = auth.uid()
)
WITH CHECK (
  public.is_chat_member(chat_decoy_messages.chat_id)
  AND sender_id = auth.uid()
);
