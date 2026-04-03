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

const PERMISSION_DURATION_MS = 5 * 60 * 1000; // 5 minutes

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
  requestScreenshotPermission: (chatId: string, memberIds: string[]) => Promise<{ id?: string; error?: string }>;
  approveRequest: (requestId: string) => Promise<void>;
  denyRequest: (requestId: string) => Promise<void>;
  hasPermission: (chatId: string) => boolean;
  getSecondsLeft: (chatId: string) => number;
};

const ScreenshotContext = createContext<ScreenshotContextValue | null>(null);

export function ScreenshotProvider({ children }: PropsWithChildren) {
  const { profile } = useAuth();
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
      all[req.id] = req;
      if (req.requester_id === profile.id) {
        mine[req.chat_id] = req;
        // Restore active permission if still within the 5-minute window
        if (req.status === "approved" && req.approved_at) {
          const expiresAt = new Date(req.approved_at).getTime() + PERMISSION_DURATION_MS;
          if (expiresAt > Date.now()) {
            schedulePermission(req.chat_id, expiresAt);
          }
        }
      } else if (req.status === "pending" && !req.approvals.includes(profile.id)) {
        incoming.push(req);
      }
    }

    setAllRequests(all);
    setIncomingRequests(incoming);
    setMyRequests(mine);
  }

  function schedulePermission(chatId: string, expiresAt: number) {
    setActivePermissions((prev) => {
      if (prev[chatId] === expiresAt) return prev;
      return { ...prev, [chatId]: expiresAt };
    });
    if (permTimers.current[chatId]) clearTimeout(permTimers.current[chatId]);
    const msLeft = expiresAt - Date.now();
    if (msLeft > 0) {
      permTimers.current[chatId] = setTimeout(() => {
        setActivePermissions((prev) => {
          const next = { ...prev };
          delete next[chatId];
          return next;
        });
      }, msLeft);
    }
  }

  // Watch for newly approved requests
  useEffect(() => {
    for (const [chatId, req] of Object.entries(myRequests)) {
      if (req.status === "approved" && req.approved_at) {
        const expiresAt = new Date(req.approved_at).getTime() + PERMISSION_DURATION_MS;
        if (expiresAt > Date.now()) {
          schedulePermission(chatId, expiresAt);
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

  async function requestScreenshotPermission(chatId: string, memberIds: string[]): Promise<{ id?: string; error?: string }> {
    const currentProfile = profileRef.current;
    if (!currentProfile?.id) return { error: "No profile (not logged in)" };
    // Don't duplicate if already pending
    if (myRequests[chatId]?.status === "pending") return { error: "Already pending" };

    // Delete previous request for this chat/requester combo to avoid unique constraint violations
    await supabase.from("screenshot_requests").delete().eq("chat_id", chatId).eq("requester_id", currentProfile.id);

    const { data, error } = await supabase
      .from("screenshot_requests")
      .insert({ chat_id: chatId, requester_id: currentProfile.id, member_ids: memberIds })
      .select()
      .single();

    if (error) {
      console.error("Screenshot request insert error:", error);
      return { error: error.message };
    }

    if (data) {
      const req: ScreenshotRequest = {
        id: data.id,
        chat_id: chatId,
        requester_id: currentProfile.id,
        status: "pending",
        requested_at: data.requested_at,
        approved_at: null,
        approvals: [],
        denied_by: null,
        member_ids: memberIds,
        requesterUsername: currentProfile.username,
      };
      setAllRequests((prev) => ({ ...prev, [data.id]: req }));
      setMyRequests((prev) => ({ ...prev, [chatId]: req }));
      return { id: data.id };
    }
    return { error: "No data returned" };
  }

  async function approveRequest(requestId: string) {
    await supabase.rpc("approve_screenshot_request", { request_id: requestId });
    void loadRequests();
  }

  async function denyRequest(requestId: string) {
    await supabase.rpc("deny_screenshot_request", { request_id: requestId });
    void loadRequests();
  }

  function hasPermission(chatId: string): boolean {
    const exp = activePermissions[chatId];
    return exp !== undefined && Date.now() < exp;
  }

  function getSecondsLeft(chatId: string): number {
    const exp = activePermissions[chatId];
    if (!exp) return 0;
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
      hasPermission,
      getSecondsLeft,
    }),
    [incomingRequests, allRequests, myRequests, activePermissions],
  );

  return <ScreenshotContext.Provider value={value}>{children}</ScreenshotContext.Provider>;
}

export function useScreenshots() {
  const ctx = useContext(ScreenshotContext);
  if (!ctx) throw new Error("useScreenshots must be used within ScreenshotProvider");
  return ctx;
}
