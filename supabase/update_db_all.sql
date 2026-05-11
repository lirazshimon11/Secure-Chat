-- 1. FIX SCREENSHOT REQUESTS RLS (Robust version)
ALTER TABLE public.screenshot_requests 
  ALTER COLUMN requester_id SET DEFAULT auth.uid();

DROP POLICY IF EXISTS "Users can view screenshot requests" ON public.screenshot_requests;
CREATE POLICY "Users can view screenshot requests"
ON public.screenshot_requests FOR SELECT TO authenticated
USING (requester_id = auth.uid() OR auth.uid() = ANY(member_ids));

DROP POLICY IF EXISTS "Users can create screenshot requests" ON public.screenshot_requests;
CREATE POLICY "Users can create screenshot requests"
ON public.screenshot_requests FOR INSERT TO authenticated
WITH CHECK (auth.uid() = requester_id);

DROP POLICY IF EXISTS "Users can update screenshot requests" ON public.screenshot_requests;
CREATE POLICY "Users can update screenshot requests"
ON public.screenshot_requests FOR UPDATE TO authenticated
USING (requester_id = auth.uid() OR auth.uid() = ANY(member_ids));

DROP POLICY IF EXISTS "Users can delete screenshot requests" ON public.screenshot_requests;
CREATE POLICY "Users can delete screenshot requests"
ON public.screenshot_requests FOR DELETE TO authenticated
USING (requester_id = auth.uid());


-- 2. FIX MESSAGE REACTIONS RLS
-- Allow everyone to see reactions for messages they have access to
DROP POLICY IF EXISTS "Users can view message reactions" ON public.message_reactions;
CREATE POLICY "Users can view message reactions"
ON public.message_reactions FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.messages m
    JOIN public.chat_members cm ON m.chat_id = cm.chat_id
    WHERE m.id = message_reactions.message_id
    AND cm.user_id = auth.uid()
  )
);

-- Allow users to toggle their own reactions
DROP POLICY IF EXISTS "Users can manage their own reactions" ON public.message_reactions;
CREATE POLICY "Users can manage their own reactions"
ON public.message_reactions FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());


-- 3. ENSURE UNREAD COUNTS AND LAST POSITION SYNC
CREATE TABLE IF NOT EXISTS public.chat_reads (
  chat_id uuid NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  last_read_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  PRIMARY KEY (chat_id, user_id)
);

ALTER TABLE public.chat_reads
  ADD COLUMN IF NOT EXISTS last_position_message_id uuid REFERENCES public.messages(id) ON DELETE SET NULL;

ALTER TABLE public.chat_reads
  ADD COLUMN IF NOT EXISTS last_position_at timestamptz;

ALTER TABLE public.chat_reads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users can read own chat reads" ON public.chat_reads;
CREATE POLICY "users can read own chat reads"
ON public.chat_reads FOR SELECT TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "members can insert own chat reads" ON public.chat_reads;
CREATE POLICY "members can insert own chat reads"
ON public.chat_reads FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND public.is_chat_member(chat_reads.chat_id)
);

DROP POLICY IF EXISTS "users can update own chat reads" ON public.chat_reads;
CREATE POLICY "users can update own chat reads"
ON public.chat_reads FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (
  user_id = auth.uid()
  AND public.is_chat_member(chat_reads.chat_id)
);
