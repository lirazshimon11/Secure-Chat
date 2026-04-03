CREATE TABLE IF NOT EXISTS public.screenshot_requests (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  chat_id uuid REFERENCES public.chats(id) ON DELETE CASCADE,
  requester_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text DEFAULT 'pending', 
  requested_at timestamp with time zone DEFAULT now(),
  approved_at timestamp with time zone,
  approvals uuid[] DEFAULT '{}',
  denied_by uuid REFERENCES public.profiles(id),
  member_ids uuid[] DEFAULT '{}'
);

ALTER TABLE public.screenshot_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view screenshot requests" ON public.screenshot_requests;
CREATE POLICY "Users can view screenshot requests"
ON public.screenshot_requests FOR SELECT
TO authenticated
USING (
  requester_id = auth.uid() OR 
  auth.uid() = ANY(member_ids)
);

DROP POLICY IF EXISTS "Users can create screenshot requests" ON public.screenshot_requests;
CREATE POLICY "Users can create screenshot requests"
ON public.screenshot_requests FOR INSERT
TO authenticated
WITH CHECK (requester_id = auth.uid());

DROP POLICY IF EXISTS "Users can update screenshot requests" ON public.screenshot_requests;
CREATE POLICY "Users can update screenshot requests"
ON public.screenshot_requests FOR UPDATE
TO authenticated
USING (
  requester_id = auth.uid() OR 
  auth.uid() = ANY(member_ids)
);

DROP POLICY IF EXISTS "Users can delete screenshot requests" ON public.screenshot_requests;
CREATE POLICY "Users can delete screenshot requests"
ON public.screenshot_requests FOR DELETE
TO authenticated
USING (requester_id = auth.uid());
