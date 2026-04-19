-- ─────────────────────────────────────────────────
-- Migration: Relationship status + Decoy chat targets
-- Run this in Supabase SQL Editor
-- ─────────────────────────────────────────────────

-- 1. Add is_in_relationship column to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_in_relationship boolean NOT NULL DEFAULT false;

-- 2. Create chat_decoy_targets table
CREATE TABLE IF NOT EXISTS public.chat_decoy_targets (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id     uuid NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  target_id   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  enabled_by  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (chat_id, target_id)
);

ALTER TABLE public.chat_decoy_targets ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies for chat_decoy_targets

-- Any chat member can read the decoy targets for their chat
DROP POLICY IF EXISTS "members can read decoy targets" ON public.chat_decoy_targets;
CREATE POLICY "members can read decoy targets"
ON public.chat_decoy_targets FOR SELECT TO authenticated
USING (public.is_chat_member(chat_decoy_targets.chat_id));

-- Any chat member can activate protection on others
DROP POLICY IF EXISTS "members can insert decoy targets" ON public.chat_decoy_targets;
CREATE POLICY "members can insert decoy targets"
ON public.chat_decoy_targets FOR INSERT TO authenticated
WITH CHECK (
  enabled_by = auth.uid()
  AND public.is_chat_member(chat_decoy_targets.chat_id)
);

-- Any chat member can deactivate protection, BUT NOT on themselves
DROP POLICY IF EXISTS "members can delete decoy targets not self" ON public.chat_decoy_targets;
CREATE POLICY "members can delete decoy targets not self"
ON public.chat_decoy_targets FOR DELETE TO authenticated
USING (
  public.is_chat_member(chat_decoy_targets.chat_id)
  AND target_id <> auth.uid()
);

-- ─────────────────────────────────────────────────
-- 4. Bait (decoy) chat messages — editable by group members
-- ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.chat_decoy_messages (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id    uuid NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  sender_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body       text NOT NULL,
  is_me      boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE public.chat_decoy_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members can read decoy messages" ON public.chat_decoy_messages;
CREATE POLICY "members can read decoy messages"
ON public.chat_decoy_messages FOR SELECT TO authenticated
USING (public.is_chat_member(chat_decoy_messages.chat_id));

DROP POLICY IF EXISTS "members can insert decoy messages" ON public.chat_decoy_messages;
CREATE POLICY "members can insert decoy messages"
ON public.chat_decoy_messages FOR INSERT TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND public.is_chat_member(chat_decoy_messages.chat_id)
);

DROP POLICY IF EXISTS "members can delete decoy messages" ON public.chat_decoy_messages;
CREATE POLICY "members can delete decoy messages"
ON public.chat_decoy_messages FOR DELETE TO authenticated
USING (
  public.is_chat_member(chat_decoy_messages.chat_id)
);
