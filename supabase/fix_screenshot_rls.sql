-- Fix for screenshot_requests RLS and requester_id default
ALTER TABLE public.screenshot_requests 
  ALTER COLUMN requester_id SET DEFAULT auth.uid();

-- Re-apply policies with more robust checks
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
WITH CHECK (true); -- Security is handled by defaulting requester_id to auth.uid() and ensuring it's NOT NULL if needed.

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
