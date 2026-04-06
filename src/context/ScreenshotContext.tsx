import {
  createContext,
  PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { useChats } from "@/context/ChatContext";

export const PERMISSION_DURATION_MS = 60 * 1000; // 1 minute (for testing)

export type ScreenshotRequestStatus = "pending" | "approved" | "denied";

export type ScreenshotRequest = {
  id: string;
  chat_id: string;
  requester_id: string;
  status: ScreenshotRequestStatus;
  requested_at: string;
  approved_at: string | null;
  approvals: string[];
  denied_by: string | null;
  member_ids: string[];
  requesterUsername?: string;
  chatTitle?: string;
};

type ScreenshotContextValue = {
  /** Requests from OTHER people in MY groups that I haven't yet voted on */
  incomingRequests: ScreenshotRequest[];
  /** Every loaded request by ID */
  allRequests: Record<string, ScreenshotRequest>;
  /** My own requests, keyed by chatId */
  myRequests: Record<string, ScreenshotRequest>;
  /** Active permission expiry timestamps (ms), keyed by chatId */
  activePermissions: Record<string, number>;
  /** Number of incoming requests waiting for my vote */
  screenshotPendingCount: number;
  requestScreenshotPermission: (chatId: string, memberIds: string[]) => Promise<{ id?: string; pollBody?: string; error?: string }>;
  approveRequest: (requestId: string, chatId: string, requesterName: string, approverName: string) => Promise<void>;
  denyRequest: (requestId: string) => Promise<void>;
  revokeApproval: (requestId: string, chatId: string, requesterName: string) => Promise<void>;
  hasPermission: (chatId: string) => boolean;
  getSecondsLeft: (chatId: string) => number;
};

const ScreenshotContext = createContext<ScreenshotContextValue | null>(null);

export function ScreenshotProvider({ children }: PropsWithChildren) {
  const { profile } = useAuth();
  const { sendMessage } = useChats();
  const [incomingRequests, setIncomingRequests] = useState<ScreenshotRequest[]>([]);
  const [allRequests, setAllRequests] = useState<Record<string, ScreenshotRequest>>({});
  const [myRequests, setMyRequests] = useState<Record<string, ScreenshotRequest>>({});
  const [activePermissions, setActivePermissions] = useState<Record<string, number>>({});
  const channelRef = useRef<RealtimeChannel | null>(null);
  const permTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const profileRef = useRef(profile);
  useEffect(() => { profileRef.current = profile; }, [profile]);

  useEffect(() => {
    if (!profile?.id) {
      setIncomingRequests([]);
      setMyRequests({});
      return;
    }
    void loadRequests();
    subscribe(profile.id);

    return () => {
      if (channelRef.current) void supabase.removeChannel(channelRef.current);
      Object.values(permTimers.current).forEach(clearTimeout);
    };
  }, [profile?.id]);

  async function loadRequests() {
    if (!profile?.id) return;

    const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from("screenshot_requests")
      .select("*")
      .gte("requested_at", since)
      .in("status", ["pending", "approved", "denied"]);

    if (!data?.length) return;

    // Fetch requester usernames
    const requesterIds = [...new Set((data as any[]).map((r) => r.requester_id))];
    const { data: profileRows } = await supabase
      .from("profiles")
      .select("id,username")
      .in("id", requesterIds);
    const profileMap = Object.fromEntries(
      ((profileRows ?? []) as { id: string; username: string }[]).map((p) => [p.id, p.username]),
    );

    const enriched: ScreenshotRequest[] = (data as any[]).map((row) => ({
      id: row.id,
      chat_id: row.chat_id,
      requester_id: row.requester_id,
      status: row.status as ScreenshotRequestStatus,
      requested_at: row.requested_at,
      approved_at: row.approved_at ?? null,
      approvals: Array.isArray(row.approvals) ? row.approvals : [],
      denied_by: row.denied_by ?? null,
      member_ids: Array.isArray(row.member_ids) ? row.member_ids : [],
      requesterUsername: profileMap[row.requester_id] ?? "משתמש",
    }));

    const incoming: ScreenshotRequest[] = [];
    const all: Record<string, ScreenshotRequest> = {};
    const mine: Record<string, ScreenshotRequest> = {};

    for (const req of enriched) {
      // Priority to local UI state to prevent jitter
      const localStatus = locallyHandled[req.id];
      if (localStatus) {
        req.status = localStatus;
      }

      all[req.id] = req;
      if (req.requester_id === profile.id) {
        if ((req.status === "approved" || req.approvals.length > 0) && (req.approved_at || req.requested_at)) {
          const baseTime = req.approved_at ? new Date(req.approved_at).getTime() : new Date(req.requested_at).getTime();
          const expiresAt = baseTime + PERMISSION_DURATION_MS;
          if (expiresAt > Date.now()) {
            schedulePermission(req.chat_id, expiresAt, req.requesterUsername || "מישהו");
          }
        }
        mine[req.chat_id] = req;
      } else if (req.status === "pending" && req.approvals.length === 0 && !req.approvals.includes(profile.id)) {
        incoming.push(req);
      }
    }

    setAllRequests(all);
    setIncomingRequests(incoming);
    setMyRequests(mine);
  }

  const lastExpiredSentTsRef = useRef<Record<string, number>>({});

  async function sendExpirationMessage(chatId: string, requesterName: string) {
    const now = Date.now();
    const lastSent = lastExpiredSentTsRef.current[chatId] || 0;
    if (now - lastSent < 5000) return; // Prevent duplicates in 5s window

    lastExpiredSentTsRef.current[chatId] = now;
    await sendMessage({
      chatId,
      body: `[SYSTEM_SCREENSHOT_EXPIRED]:${requesterName}`,
      messageKind: "system"
    });
  }

  function schedulePermission(chatId: string, expiresAt: number, requesterName?: string) {
    setActivePermissions((prev) => {
      if (prev[chatId] === expiresAt) return prev;
      return { ...prev, [chatId]: expiresAt };
    });

    if (permTimers.current[chatId]) {
      clearTimeout(permTimers.current[chatId]);
      delete permTimers.current[chatId];
    }

    const msLeft = expiresAt - Date.now();
    if (msLeft > 0) {
      permTimers.current[chatId] = setTimeout(async () => {
        // EXTRA GUARD: Check if strictly active before doing ANYTHING
        // If revoked or denied manually, activePermissions[chatId] was already deleted
        const stillActive = hasPermission(chatId);
        if (!stillActive) {
          delete permTimers.current[chatId];
          return;
        }

        // 1. Remove permission locally
        setActivePermissions((prev) => {
          const next = { ...prev };
          delete next[chatId];
          return next;
        });

        // 2. Clear timer reference
        delete permTimers.current[chatId];

        // 3. Send professional expiration message if we were the ones who took action
        if (requesterName) {
          await sendExpirationMessage(chatId, requesterName);
        }
      }, msLeft);
    }
  }

  // Watch for newly approved requests
  useEffect(() => {
    for (const [chatId, req] of Object.entries(myRequests)) {
      if ((req.status === "approved" || req.approvals.length > 0) && (req.approved_at || req.requested_at)) {
        const baseTime = req.approved_at ? new Date(req.approved_at).getTime() : new Date(req.requested_at).getTime();
        const expiresAt = baseTime + PERMISSION_DURATION_MS;
        if (expiresAt > Date.now()) {
          schedulePermission(chatId, expiresAt, req.requesterUsername || "מישהו");
        }
      }
    }
  }, [myRequests]);

  function subscribe(userId: string) {
    if (channelRef.current) void supabase.removeChannel(channelRef.current);
    channelRef.current = supabase
      .channel(`screenshot-stream-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "screenshot_requests" }, () => {
        void loadRequests();
      })
      .subscribe();
  }

  async function requestScreenshotPermission(chatId: string, memberIds: string[]): Promise<{ id?: string; pollBody?: string; error?: string }> {
    const currentProfile = profileRef.current;
    if (!currentProfile?.id) return { error: "No profile (not logged in)" };

    // If we ALREADY have valid permission, don't request another one
    if (hasPermission(chatId)) return { error: "Permission still active" };

    // Delete previous request for this chat/requester combo in the DB
    await supabase.from("screenshot_requests").delete().eq("chat_id", chatId).eq("requester_id", currentProfile.id);

    // also clear local state for this chatId to allow a fresh start
    setMyRequests(prev => {
      const next = { ...prev };
      delete next[chatId];
      return next;
    });

    // Create the Request entry in DB
    const { data: requestRow, error: requestError } = await supabase
      .from("screenshot_requests")
      .insert({ chat_id: chatId, requester_id: currentProfile.id, member_ids: memberIds })
      .select()
      .single();

    if (requestError) {
      console.error("Screenshot request insert error:", requestError);
      return { error: requestError.message };
    }

    if (requestRow) {
      const pollData = {
        question: "בקשת אישור לצילום מסך 📸",
        options: ["מאשר", "מסרב"],
        multipleAnswers: false,
        expiresAt: new Date(Date.now() + PERMISSION_DURATION_MS).toISOString(),
        isScreenshotRequest: true,
        screenshotRequestId: requestRow.id
      };

      const req: ScreenshotRequest = {
        id: requestRow.id,
        chat_id: chatId,
        requester_id: currentProfile.id,
        status: "pending",
        requested_at: requestRow.requested_at,
        approved_at: null,
        approvals: [],
        denied_by: null,
        member_ids: memberIds,
        requesterUsername: currentProfile.username,
      };

      setAllRequests((prev) => ({ ...prev, [requestRow.id]: req }));
      setMyRequests((prev) => ({ ...prev, [chatId]: req }));

      // Return the poll body so the caller (ChatOverlayManager) can send it
      return { id: requestRow.id, pollBody: `[POLL]:${JSON.stringify(pollData)}` };
    }
    return { error: "No data returned" };
  }

  // Track locally approved IDs to prevent UI jitter during server sync
  const [locallyHandled, setLocallyHandled] = useState<Record<string, ScreenshotRequestStatus>>({});

  async function approveRequest(requestId: string, chatId: string, requesterName: string, approverName: string) {
    // 1. Optimistic update
    setLocallyHandled(prev => ({ ...prev, [requestId]: "approved" }));
    setAllRequests(prev => {
      const req = prev[requestId];
      if (!req) return prev;
      return { ...prev, [requestId]: { ...req, status: "approved" as ScreenshotRequestStatus, approvals: [...req.approvals, profile?.id || ""] } };
    });

    // 2. Send System Message to the group (with dynamic duration)
    const durationMin = Math.round(PERMISSION_DURATION_MS / 60000);
    await sendMessage({
      chatId,
      body: `[SYSTEM_SCREENSHOT_APPROVED]:${requesterName}:${approverName}:${durationMin}`,
      messageKind: "system"
    });

    // 3. Update DB (Run RPC first, then supplement approvals array)
    await supabase.rpc("approve_screenshot_request", { request_id: requestId });

    // Fetch latest and ensure ID is added to approvals array for UI tracking
    const { data: current } = await supabase.from("screenshot_requests").select("approvals").eq("id", requestId).single();
    const existing = Array.isArray(current?.approvals) ? current.approvals : [];
    if (!existing.includes(profile?.id || "")) {
      await supabase.from("screenshot_requests").update({
        approvals: [...existing, profile?.id || ""]
      }).eq("id", requestId);
    }

    // 4. Also start timer locally with requester's name for expiration message
    schedulePermission(chatId, Date.now() + PERMISSION_DURATION_MS, requesterName);

    void loadRequests();
  }

  async function denyRequest(requestId: string) {
    setLocallyHandled(prev => ({ ...prev, [requestId]: "denied" }));
    setAllRequests(prev => {
      const req = prev[requestId];
      if (!req) return prev;
      return { ...prev, [requestId]: { ...req, status: "denied" as ScreenshotRequestStatus, denied_by: profile?.id || "" } };
    });

    await supabase.rpc("deny_screenshot_request", { request_id: requestId });
    void loadRequests();
  }

  async function revokeApproval(requestId: string, chatId: string, requesterName: string) {
    const userId = profileRef.current?.id;
    if (!userId) return;

    // 1. Fetch current approvals
    const { data } = await supabase.from("screenshot_requests").select("approvals").eq("id", requestId).single();
    const existing = Array.isArray(data?.approvals) ? data.approvals : [];
    const updated = existing.filter(id => id !== userId);

    // 2. Update DB: Explicitly set status to 'denied' if no one is approving
    const newStatus = updated.length === 0 ? ("denied" as ScreenshotRequestStatus) : ("approved" as ScreenshotRequestStatus);
    await supabase.from("screenshot_requests").update({
      approvals: updated,
      status: newStatus
    }).eq("id", requestId);

    // 3. If no one else is approving, terminate permission immediately
    if (updated.length === 0) {
      if (permTimers.current[chatId]) {
        clearTimeout(permTimers.current[chatId]);
        delete permTimers.current[chatId];
      }
      setActivePermissions(prev => {
        const next = { ...prev };
        delete next[chatId];
        return next;
      });

      await sendExpirationMessage(chatId, requesterName);
    }

    void loadRequests();
  }

  function hasPermission(chatId: string): boolean {
    const exp = activePermissions[chatId];
    if (exp && Date.now() < exp) return true;

    // Once the timer is gone from activePermissions, permission is strictly DENIED
    // regardless of what the DB says about past approvals.
    return false;
  }

  function getSecondsLeft(chatId: string): number {
    const exp = activePermissions[chatId];
    if (!exp) {
      const req = myRequests[chatId];
      if (req && req.approvals.length > 0) return PERMISSION_DURATION_MS / 1000;
      return 0;
    }
    return Math.max(0, Math.floor((exp - Date.now()) / 1000));
  }

  const screenshotPendingCount = incomingRequests.length;

  const value = useMemo(
    () => ({
      incomingRequests,
      allRequests,
      myRequests,
      activePermissions,
      screenshotPendingCount,
      requestScreenshotPermission,
      approveRequest,
      denyRequest,
      revokeApproval,
      hasPermission,
      getSecondsLeft,
    }),
    [incomingRequests, allRequests, myRequests, activePermissions, approveRequest, denyRequest, revokeApproval],
  );

  return <ScreenshotContext.Provider value={value}>{children}</ScreenshotContext.Provider>;
}

export function useScreenshots() {
  const ctx = useContext(ScreenshotContext);
  if (!ctx) throw new Error("useScreenshots must be used within ScreenshotProvider");
  return ctx;
}
