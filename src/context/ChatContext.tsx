import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useRef, useState } from "react";
import { RealtimeChannel } from "@supabase/supabase-js";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { Chat, ChatLocalPreferences, ChatMuteSetting, Message, MuteDurationOption, Profile, ReactionSummary } from "@/lib/types";

// Extracted modules
import { getUtcTime, buildMuteSetting, getDefaultChatPreferences, normalizeChatPreferences } from "./ChatContextUtils";
import { ChatService } from "@/services/ChatService";

export type ContactNicknameData = { first_name: string; last_name: string; phone?: string; sync_enabled?: boolean; };
type MessageComposerInput = { chatId: string; body: string; messageKind: "standard" | "temporary" | "view_once" | "system"; replyToId?: string | null; expireSeconds?: number | null; };

type ChatContextValue = {
  chats: Chat[]; profiles: Record<string, Profile>; messagesByChat: Record<string, Message[]>; reactionsByMessage: Record<string, ReactionSummary>; unreadCounts: Record<string, number>; muteSettings: Record<string, ChatMuteSetting>; chatPreferences: Record<string, ChatLocalPreferences>; contactNicknames: Record<string, ContactNicknameData>; openedViewOnceIds: Record<string, boolean>; loading: boolean;
  refreshChats: () => Promise<void>; loadMessages: (chatId: string) => Promise<void>; loadChatMembers: (chatId: string) => Promise<Profile[]>; markChatSeen: (chatId: string, timestamp?: string, nextUnreadCount?: number) => Promise<void>;
  setChatMute: (chatId: string, duration: MuteDurationOption) => void; clearChatMute: (chatId: string) => void; archiveChats: (chatIds: string[]) => void; unarchiveChats: (chatIds: string[]) => void; togglePinnedChats: (chatIds: string[]) => void; lockChats: (chatIds: string[]) => void; unlockChats: (chatIds: string[]) => void; clearChatsLocally: (chatIds: string[]) => void;
  searchUsers: (query: string) => Promise<Profile[]>; sendMessage: (input: MessageComposerInput) => Promise<string | null>; createChat: (title: string, memberUsernames: string[]) => Promise<{ chat: Chat | null; error: string | null }>; toggleReaction: (messageId: string, emoji: string) => Promise<void>; openViewOnceMessage: (message: Message) => Promise<void>; deleteMessages: (messageIds: string[], forEveryone: boolean) => Promise<void>; updateChatDescription: (chatId: string, description: string) => Promise<void>; updateChatTitle: (chatId: string, title: string) => Promise<void>; deleteChats: (chatIds: string[]) => Promise<void>; setContactNickname: (userId: string, data: ContactNicknameData) => Promise<void>; searchMessagesGlobal: (query: string) => Promise<{ chat_id: string; message: Message }[]>;
  setChatMemberRole: (chatId: string, userId: string, role: string) => Promise<void>; removeChatMember: (chatId: string, profile: Profile, chatTitle: string) => Promise<void>; isCurrentMember: (chatId: string) => Promise<boolean>;
};

const ChatContext = createContext<ChatContextValue | null>(null);
const LOCAL_CHAT_STATE_KEY_PREFIX = "private-chat-local-state";
const LOCAL_NICKNAMES_KEY_PREFIX = "private-chat-nicknames";

export function ChatProvider({ children }: PropsWithChildren) {
  const { profile } = useAuth();
  const [rawChats, setRawChats] = useState<Chat[]>([]);
  const [privateChatPartners, setPrivateChatPartners] = useState<Record<string, string>>({});
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [messagesByChat, setMessagesByChat] = useState<Record<string, Message[]>>({});
  const [reactionsByMessage, setReactionsByMessage] = useState<Record<string, ReactionSummary>>({});
  const [openedViewOnceIds, setOpenedViewOnceIds] = useState<Record<string, boolean>>({});
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [muteSettings, setMuteSettings] = useState<Record<string, ChatMuteSetting>>({});
  const [chatPreferences, setChatPreferences] = useState<Record<string, ChatLocalPreferences>>({});
  const [deletedForMeIds, setDeletedForMeIds] = useState<string[]>([]);
  const deletedForMeIdsRef = useRef<string[]>([]);
  const [contactNicknames, setContactNicknames] = useState<Record<string, ContactNicknameData>>({});
  const [loading, setLoading] = useState(true);
  const [localPreferencesReady, setLocalPreferencesReady] = useState(false);
  const loadedChatIdsRef = useRef<string[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);

  // ── Sync with Auth State ───────────────────────────────────────────────
  useEffect(() => {
    if (!profile?.id) {
      setRawChats([]); setPrivateChatPartners({}); setMessagesByChat({}); setReactionsByMessage({}); setOpenedViewOnceIds({}); setUnreadCounts({}); setMuteSettings({}); setChatPreferences({}); setDeletedForMeIds([]); deletedForMeIdsRef.current = []; loadedChatIdsRef.current = []; setLocalPreferencesReady(false); setLoading(false); return;
    }
    void refreshChats(); subscribe(profile.id);
    return () => { if (channelRef.current) void supabase.removeChannel(channelRef.current); };
  }, [profile?.id]);

  // ── Local Storage Management ───────────────────────────────────────────
  useEffect(() => {
    if (!profile?.id) { setChatPreferences({}); setLocalPreferencesReady(false); return; }
    let active = true; const key = `${LOCAL_CHAT_STATE_KEY_PREFIX}:${profile.id}`;
    void (async () => {
      try {
        const raw = await AsyncStorage.getItem(key);
        if (!active) return;
        if (!raw) { setChatPreferences({}); setLocalPreferencesReady(true); return; }
        const parsed = JSON.parse(raw); const norm = Object.fromEntries(Object.entries(parsed ?? {}).map(([id, v]) => [id, normalizeChatPreferences(v as any)]));
        setChatPreferences(norm);
      } catch { if (active) setChatPreferences({}); } finally { if (active) setLocalPreferencesReady(true); }
    })();
    return () => { active = false; };
  }, [profile?.id]);

  useEffect(() => {
    if (!profile?.id) { setContactNicknames({}); return; }
    void AsyncStorage.getItem(`${LOCAL_NICKNAMES_KEY_PREFIX}:${profile.id}`).then(raw => raw && setContactNicknames(JSON.parse(raw)));
  }, [profile?.id]);

  useEffect(() => { if (profile?.id) void AsyncStorage.setItem(`${LOCAL_NICKNAMES_KEY_PREFIX}:${profile.id}`, JSON.stringify(contactNicknames)); }, [contactNicknames, profile?.id]);

  useEffect(() => {
    if (!profile?.id || !localPreferencesReady) return;
    void AsyncStorage.setItem(`${LOCAL_CHAT_STATE_KEY_PREFIX}:${profile.id}`, JSON.stringify(chatPreferences));
  }, [chatPreferences, localPreferencesReady, profile?.id]);

  // ── Core Actions ────────────────────────────────────────────────────────
  const refreshChats = async () => {
    if (!profile?.id) return;
    setLoading(true);
    const { data: rows } = await ChatService.fetchMemberDetails(profile.id);
    const cIds = (rows ?? []).map(r => r.chat_id);
    const directIds = (rows ?? []).filter(r => !r.is_group).map(r => r.chat_id);
    const { data: memberRows } = await ChatService.fetchDirectPartners(directIds);
    const otherIds = [...new Set(((memberRows ?? []) as any).filter((r: any) => r.user_id !== profile.id).map((r: any) => r.user_id))];
    const { data: otherProfiles } = await ChatService.fetchProfiles(otherIds as string[]);
    const { data: readRows } = await ChatService.fetchLastReadAt(profile.id, cIds);
    const { data: unreadMsgRows } = cIds.length ? await supabase.from("messages").select("chat_id,sender_id,created_at").in("chat_id", cIds).is("deleted_at", null) : { data: [] };

    const profMap = Object.fromEntries(((otherProfiles ?? []) as Profile[]).map(p => [p.id, p]));
    const partners: Record<string, string> = {};
    const directTitles: Record<string, string> = {};
    for (const r of (memberRows ?? []) as any) if (r.user_id !== profile.id) { partners[r.chat_id] = r.user_id; if (profMap[r.user_id]) directTitles[r.chat_id] = profMap[r.user_id].username; }
    setPrivateChatPartners(partners); setProfiles(cur => ({ ...cur, ...profMap }));

    const lastReadMap: Record<string, string> = {};
    for (const r of (readRows ?? []) as any) if (!lastReadMap[r.chat_id] || getUtcTime(r.last_read_at) > getUtcTime(lastReadMap[r.chat_id])) lastReadMap[r.chat_id] = r.last_read_at;
    
    const unCounts: Record<string, number> = {};
    for (const id of cIds) unCounts[id] = 0;
    for (const r of (unreadMsgRows ?? []) as any) if (r.sender_id !== profile.id) {
        const lastRead = lastReadMap[r.chat_id];
        if (!lastRead || getUtcTime(r.created_at) > getUtcTime(lastRead)) unCounts[r.chat_id] = (unCounts[r.chat_id] ?? 0) + 1;
    }

    setRawChats(rows!.map(r => {
      const isRemoved = r.role === "removed";
      return { 
        id: r.chat_id, 
        title: r.is_group ? r.chat_title : directTitles[r.chat_id] ?? r.chat_title, 
        is_group: r.is_group, 
        description: r.description ?? null, 
        created_by: r.created_by, 
        created_at: r.created_at, 
        last_message_preview: isRemoved ? "את/ה הוסרת/ה מהקבוצה" : r.last_message_preview, 
        last_message_at: isRemoved ? r.removed_at || r.last_message_at : r.last_message_at 
      };
    }) as any);
    setUnreadCounts(cur => { const next = { ...unCounts }; Object.keys(cur).forEach(id => { if (cur[id] === 0) next[id] = 0; }); return next; });
    setLoading(false);
  };

  const loadMessages = async (chatId: string) => {
    if (!profile?.id) return;
    const { data: messages } = await ChatService.fetchMessages(chatId);
    const mIds = (messages ?? []).map(m => m.id);
    const sIds = [...new Set((messages ?? []).map(m => m.sender_id))];
    const { data: reactionRows } = await ChatService.fetchReactions(mIds);
    const { data: viewRows } = await ChatService.fetchViewOnceOpened(profile.id, mIds);
    const { data: profRows } = await ChatService.fetchProfiles(sIds);

    loadedChatIdsRef.current = [...new Set([...loadedChatIdsRef.current, chatId])];
    setMessagesByChat(cur => ({ ...cur, [chatId]: ((messages as Message[]) ?? []).filter(m => !deletedForMeIdsRef.current.includes(m.id)) }));
    if (profRows) setProfiles(cur => ({ ...cur, ...Object.fromEntries(((profRows as Profile[]) ?? []).map(p => [p.id, p])) }));
    if (reactionRows) setReactionsByMessage(cur => { const next = { ...cur }; mIds.forEach(id => next[id] = {}); ((reactionRows as any) ?? []).forEach((r: any) => { next[r.message_id] ??= {}; next[r.message_id][r.emoji] ??= []; next[r.message_id][r.emoji].push(r.user_id); }); return next; });
    if (viewRows) setOpenedViewOnceIds(cur => ({ ...cur, ...Object.fromEntries(((viewRows as any) ?? []).map((r: any) => [r.message_id, !!r.opened_at])) }));
  };

  const subscribe = (userId: string) => {
    if (channelRef.current) void supabase.removeChannel(channelRef.current);
    channelRef.current = supabase.channel(`chat-stream-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, (p) => {
        const n = p.new as Message; if (!n?.chat_id) return;
        setMessagesByChat(cur => { if (deletedForMeIdsRef.current.includes(n.id)) return cur; const existing = cur[n.chat_id] ?? []; return { ...cur, [n.chat_id]: [...existing.filter(m => m.id !== n.id), n].sort((a,b) => a.created_at.localeCompare(b.created_at)) }; });
        void refreshChats();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "message_reactions" }, () => loadedChatIdsRef.current.forEach(id => void loadMessages(id)))
      .on("postgres_changes", { event: "*", schema: "public", table: "message_views" }, () => loadedChatIdsRef.current.forEach(id => void loadMessages(id)))
      .subscribe();
  };

  const markChatSeen = async (chatId: string, timestamp?: string, nextUnread?: number) => {
     if (!profile?.id) return;
     const ts = timestamp || new Date().toISOString();
     setUnreadCounts(cur => ({ ...cur, [chatId]: nextUnread ?? 0 }));
     await ChatService.markSeen(profile.id, chatId, ts);
  };

  const sendMessage = async (input: MessageComposerInput) => {
     if (!profile?.id || !input.body.trim()) return "Message empty.";
     const body = input.body.trim();
     const preview = input.messageKind === "view_once" ? "View once message" : body;
     const expiresAt = input.messageKind === "temporary" && input.expireSeconds ? new Date(Date.now() + input.expireSeconds * 1000).toISOString() : null;
     const { error } = await ChatService.sendMessage(input.chatId, profile.id, body, preview, input.messageKind, input.replyToId ?? null, expiresAt);
     return error?.message ?? null;
  };

  const toggleReaction = async (messageId: string, emoji: string) => {
    if (!profile?.id) return;
    const curUsers = reactionsByMessage[messageId]?.[emoji] ?? [];
    const already = curUsers.includes(profile.id);
    setReactionsByMessage(cur => {
      const next = { ...cur }; const msgReactions = { ...(next[messageId] ?? {}) };
      msgReactions[emoji] = already ? curUsers.filter(id => id !== profile.id) : [...curUsers, profile.id];
      next[messageId] = msgReactions; return next;
    });
    await ChatService.toggleReaction(messageId, profile.id, emoji, already);
  };

  const openViewOnceMessage = async (msg: Message) => {
    if (!profile?.id || msg.sender_id === profile.id) return;
    setOpenedViewOnceIds(cur => ({ ...cur, [msg.id]: true }));
    await ChatService.openViewOnce(msg.id, profile.id);
  };

  const deleteMessages = async (ids: string[], everyone: boolean) => {
    if (!ids.length) return;
    if (everyone) await ChatService.deleteMessages(ids);
    else {
      const key = `${LOCAL_CHAT_STATE_KEY_PREFIX}:deleted_for_me:${profile?.id}`;
      const next = [...new Set([...deletedForMeIds, ...ids])];
      setDeletedForMeIds(next); deletedForMeIdsRef.current = next;
      void AsyncStorage.setItem(key, JSON.stringify(next));
      setMessagesByChat(cur => { const res = { ...cur }; Object.keys(res).forEach(cid => { res[cid] = (res[cid] ?? []).filter(m => !next.includes(m.id)); }); return res; });
    }
  };

  const updateChatPreferences = (ids: string[], updater: (c: ChatLocalPreferences) => ChatLocalPreferences) => {
    setChatPreferences(cur => { const next = { ...cur }; ids.forEach(id => next[id] = updater(normalizeChatPreferences(cur[id]))); return next; });
  };

  const chatValue = useMemo(() => ({
    chats: rawChats.map(c => {
      if (c.is_group) return c;
      const oId = privateChatPartners[c.id]; if (!oId) return c;
      const nick = contactNicknames[oId]; if (nick) { const name = `${nick.first_name} ${nick.last_name}`.trim(); if (name) return { ...c, title: name }; }
      if (profiles[oId]) return { ...c, title: profiles[oId].username };
      return c;
    }),
    profiles, messagesByChat, reactionsByMessage, openedViewOnceIds, unreadCounts, muteSettings, chatPreferences, contactNicknames, loading, refreshChats, loadMessages, markChatSeen,
    clearChatsLocally: (ids: string[]) => updateChatPreferences(ids, c => ({ ...c, cleared_at: new Date().toISOString() })),
    loadChatMembers: async (chatId: string) => { 
      const viewerId = profile?.id;
      const { data: myRow } = viewerId ? await supabase.from("chat_members").select("role,removed_at").eq("chat_id", chatId).eq("user_id", viewerId).maybeSingle() : { data: null };
      let query = supabase.from("chat_members").select("user_id,joined_at").eq("chat_id", chatId);
      
      if (myRow?.role === "removed" && myRow.removed_at) {
        query = query.lte("joined_at", myRow.removed_at);
      } else {
        query = query.neq("role", "removed");
      }
      
      const { data } = await query;
      if (!data) return []; 
      const { data: profs } = await ChatService.fetchProfiles(data.map(m => m.user_id)); 
      const next = (profs as Profile[]) ?? []; 
      setProfiles(cur => ({ ...cur, ...Object.fromEntries(next.map(p => [p.id, p])) })); 
      return next.sort((a,b) => (a.full_name || a.username).localeCompare(b.full_name || b.username)); 
    },
    setChatMute: (id: string, d: MuteDurationOption) => setMuteSettings(cur => ({ ...cur, [id]: buildMuteSetting(d) })),
    clearChatMute: (id: string) => setMuteSettings(cur => ({ ...cur, [id]: { mute_until: null, mute_always: false } })),
    archiveChats: (ids: string[]) => updateChatPreferences(ids, c => ({ ...c, archived: true })),
    unarchiveChats: (ids: string[]) => updateChatPreferences(ids, c => ({ ...c, archived: false })),
    togglePinnedChats: (ids: string[]) => { const pin = ids.some(id => !chatPreferences[id]?.pinned_at); updateChatPreferences(ids, c => ({ ...c, pinned_at: pin ? new Date().toISOString() : null })); },
    lockChats: (ids: string[]) => updateChatPreferences(ids, c => ({ ...c, locked: true })),
    unlockChats: (ids: string[]) => updateChatPreferences(ids, c => ({ ...c, locked: false })),
    searchUsers: async (q: string) => { if (!profile?.id) return []; let req = supabase.from("profiles").select("*").neq("id", profile.id).order("username").limit(20); const tq = q.trim().replace(/[%_,]/g, ""); if (tq) req = req.or(`username.ilike.%${tq}%,full_name.ilike.%${tq}%`); const { data } = await req; if (!data) return []; setProfiles(cur => ({ ...cur, ...Object.fromEntries((data as Profile[]).map(p => [p.id, p])) })); return data as Profile[]; },
    createChat: async (title: string, memberUsernames: string[]) => {
      if (!profile?.id) return { chat: null, error: "You must be signed in." };
      const usernames = [...new Set(memberUsernames.map(v => v.trim()).filter(Boolean))];
      if (!usernames.length) return { chat: null, error: "Add at least one member username." };
      const { data: members, error: memberError } = await supabase.from("profiles").select("id,username").in("username", usernames);
      if (memberError) return { chat: null, error: memberError.message };
      const allMemberIds = [...new Set([profile.id, ...(members ?? []).map(m => m.id)])];
      const isGroup = allMemberIds.length > 2;
      const normalizedTitle = title.trim() || (members?.length === 1 ? members[0].username : `Group with ${members?.length ?? 0} members`);
      const { data: chat, error: chatError } = await ChatService.createChat(normalizedTitle, isGroup, profile.id);
      if (chatError || !chat) return { chat: null, error: chatError?.message ?? "Could not create chat." };
      const { error: joinError } = await ChatService.addChatMembers(chat.id, allMemberIds.map(uid => ({ user_id: uid, role: uid === profile.id ? "owner" : "member" })));
      if (joinError) return { chat: null, error: joinError.message };
      const displayTitle = !isGroup && members?.[0]?.username ? members[0].username : normalizedTitle;
      const nextChat = { ...(chat as Chat), title: displayTitle };
      await refreshChats();
      return { chat: nextChat, error: null };
    },
    sendMessage, toggleReaction, openViewOnceMessage, deleteMessages, updateChatDescription: async (id: string, d: string) => { await ChatService.updateChatInfo(id, { description: d }); void refreshChats(); },
    updateChatTitle: async (id: string, t: string) => { await ChatService.updateChatInfo(id, { title: t }); void refreshChats(); },
    deleteChats: async (ids: string[]) => { 
      if (!profile?.id) return;
      const { data: memberRows } = await supabase.from("chat_members").select("chat_id,role").in("chat_id", ids).eq("user_id", profile.id);
      const removedIds = (memberRows ?? []).filter(r => r.role === "removed").map(r => r.chat_id);
      const activeIds = ids.filter(id => !removedIds.includes(id));
      if (removedIds.length > 0) {
        await supabase.from("chat_members").delete().in("chat_id", removedIds).eq("user_id", profile.id);
      }
      if (activeIds.length > 0) {
        updateChatPreferences(activeIds, c => ({ ...c, deleted_from_home_at: new Date().toISOString() })); 
      }
      void refreshChats();
    },
    setContactNickname: async (id: string, data: ContactNicknameData) => setContactNicknames(cur => ({ ...cur, [id]: data })),
    searchMessagesGlobal: async (q: string) => { const tq = q.trim().replace(/[%_,]/g, ""); if (!profile?.id || !tq) return []; const { data } = await ChatService.searchGlobalMessages(tq); if (!data) return []; const valid = new Set(rawChats.map(c => c.id)); return ((data as Message[]) ?? []).filter(m => valid.has(m.chat_id)).map(m => ({ chat_id: m.chat_id, message: m })); },
    setChatMemberRole: async (chatId: string, userId: string, role: string) => { await ChatService.updateChatMemberRole(chatId, userId, role); },
    removeChatMember: async (chatId: string, targetMember: Profile, _chatTitle: string) => {
      if (!profile?.id) return;
      
      // 1. Send ONE unified system message placeholder
      await ChatService.sendMessage(chatId, profile.id, `[SYSTEM_USER_REMOVED]:${targetMember.id}`, "", "system", null, null);

      // 2. Instead of deleting, set role to 'removed' so they keep history
      await ChatService.updateChatMemberRole(chatId, targetMember.id, "removed");
      
      void refreshChats();
    },
    isCurrentMember: async (chatId: string) => {
      if (!profile?.id) return false;
      const { data } = await supabase.from("chat_members").select("chat_id").match({ chat_id: chatId, user_id: profile.id }).neq("role", "removed").maybeSingle();
      return !!data;
    }
  }), [rawChats, profiles, messagesByChat, reactionsByMessage, openedViewOnceIds, unreadCounts, muteSettings, chatPreferences, contactNicknames, loading, privateChatPartners, profile?.id]);

  return <ChatContext.Provider value={chatValue}>{children}</ChatContext.Provider>;
}

export const useChats = () => { const context = useContext(ChatContext); if (!context) throw new Error("useChats must be used within ChatProvider"); return context; };
