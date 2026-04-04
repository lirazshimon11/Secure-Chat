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
    AND cm.member_id = auth.uid()
  )
);

-- Allow users to toggle their own reactions
DROP POLICY IF EXISTS "Users can manage their own reactions" ON public.message_reactions;
CREATE POLICY "Users can manage their own reactions"
ON public.message_reactions FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());


-- 3. ENSURE UNREAD COUNTS SYNC
-- Make sure chats and chat_members allow visibility of last_read_at
DROP POLICY IF EXISTS "Users can view own memberships" ON public.chat_members;
CREATE POLICY "Users can view own memberships"
ON public.chat_members FOR SELECT TO authenticated
USING (member_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own memberships" ON public.chat_members;
CREATE POLICY "Users can update own memberships"
ON public.chat_members FOR UPDATE TO authenticated
USING (member_id = auth.uid())
WITH CHECK (member_id = auth.uid());
