DROP POLICY IF EXISTS "senders can soft delete messages" ON public.messages;
CREATE POLICY "senders can soft delete messages"
ON public.messages FOR UPDATE
TO authenticated
USING (sender_id = auth.uid())
WITH CHECK (sender_id = auth.uid());
