import AsyncStorage from "@react-native-async-storage/async-storage";
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
import { Alert } from "react-native";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import {
  Chat,
  ChatLocalPreferences,
  ChatMuteSetting,
  Message,
  MuteDurationOption,
  Profile,
  ReactionSummary,
} from "@/lib/types";

export type ContactNicknameData = {
  first_name: string;
  last_name: string;
  phone?: string;
  sync_enabled?: boolean;
};

type MessageComposerInput = {
  chatId: string;
  body: string;
  messageKind: "standard" | "temporary" | "view_once";
  replyToId?: string | null;
  expireSeconds?: number | null;
};

function getUtcTime(timestamp: string): number {
  if (timestamp.endsWith("Z")) return new Date(timestamp).getTime();
  const timePart = timestamp.includes("T") ? timestamp.split("T")[1] : "";
  if (timePart.includes("+") || timePart.includes("-")) {
    return new Date(timestamp).getTime();
  }
  return new Date(timestamp + "Z").getTime();
}

type ChatContextValue = {
  chats: Chat[];
  profiles: Record<string, Profile>;
  messagesByChat: Record<string, Message[]>;
  reactionsByMessage: Record<string, ReactionSummary>;
  openedViewOnceIds: Record<string, boolean>;
  unreadCounts: Record<string, number>;
  muteSettings: Record<string, ChatMuteSetting>;
  chatPreferences: Record<string, ChatLocalPreferences>;
  loading: boolean;
  refreshChats: () => Promise<void>;
  loadMessages: (chatId: string) => Promise<void>;
  loadChatMembers: (chatId: string) => Promise<Profile[]>;
  markChatSeen: (chatId: string, timestamp?: string, nextUnreadCount?: number) => Promise<void>;
  setChatMute: (chatId: string, duration: MuteDurationOption) => void;
  clearChatMute: (chatId: string) => void;
  archiveChats: (chatIds: string[]) => void;
  unarchiveChats: (chatIds: string[]) => void;
  togglePinnedChats: (chatIds: string[]) => void;
  lockChats: (chatIds: string[]) => void;
  unlockChats: (chatIds: string[]) => void;
  clearChatsLocally: (chatIds: string[]) => void;
  searchUsers: (query: string) => Promise<Profile[]>;
  sendMessage: (input: MessageComposerInput) => Promise<string | null>;
  createChat: (title: string, memberUsernames: string[]) => Promise<{ chat: Chat | null; error: string | null }>;
  toggleReaction: (messageId: string, emoji: string) => Promise<void>;
  openViewOnceMessage: (message: Message) => Promise<void>;
  deleteMessages: (messageIds: string[], forEveryone: boolean) => Promise<void>;
  updateChatDescription: (chatId: string, description: string) => Promise<void>;
  updateChatTitle: (chatId: string, title: string) => Promise<void>;
  deleteChats: (chatIds: string[]) => Promise<void>;
  contactNicknames: Record<string, ContactNicknameData>;
  setContactNickname: (userId: string, data: ContactNicknameData) => Promise<void>;
  searchMessagesGlobal: (query: string) => Promise<{ chat_id: string; message: Message }[]>;
};

const ChatContext = createContext<ChatContextValue | null>(null);
const LOCAL_CHAT_STATE_KEY_PREFIX = "private-chat-local-state";
const LOCAL_NICKNAMES_KEY_PREFIX = "private-chat-nicknames";

function buildMuteSetting(duration: MuteDurationOption): ChatMuteSetting {
  if (duration === "always") {
    return { mute_until: null, mute_always: true };
  }

  const now = Date.now();
  const offset = duration === "8_hours" ? 8 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
  return {
    mute_until: new Date(now + offset).toISOString(),
    mute_always: false,
  };
}

function getDefaultChatPreferences(): ChatLocalPreferences {
  return {
    archived: false,
    pinned_at: null,
    locked: false,
    cleared_at: null,
    deleted_from_home_at: null,
  };
}

function normalizeChatPreferences(value: Partial<ChatLocalPreferences> | null | undefined): ChatLocalPreferences {
  return {
    archived: Boolean(value?.archived),
    pinned_at: typeof value?.pinned_at === "string" ? value.pinned_at : null,
    locked: Boolean(value?.locked),
    cleared_at: typeof value?.cleared_at === "string" ? value.cleared_at : null,
    deleted_from_home_at: typeof value?.deleted_from_home_at === "string" ? value.deleted_from_home_at : null,
  };
}

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

  useEffect(() => {
    if (!profile?.id) {
      setRawChats([]);
      setPrivateChatPartners({});
      setMessagesByChat({});
      setReactionsByMessage({});
      setOpenedViewOnceIds({});
      setUnreadCounts({});
      setMuteSettings({});
      setChatPreferences({});
      setDeletedForMeIds([]);
      deletedForMeIdsRef.current = [];
      loadedChatIdsRef.current = [];
      setLocalPreferencesReady(false);
      setLoading(false);
      return;
    }

    void refreshChats();
    subscribe(profile.id);

    return () => {
      if (channelRef.current) {
        void supabase.removeChannel(channelRef.current);
      }
    };
  }, [profile?.id]);

  useEffect(() => {
    if (!profile?.id) {
      setChatPreferences({});
      setLocalPreferencesReady(false);
      return;
    }

    let active = true;
    const storageKey = `${LOCAL_CHAT_STATE_KEY_PREFIX}:${profile.id}`;
    setLocalPreferencesReady(false);

    void (async () => {
      try {
        const raw = await AsyncStorage.getItem(storageKey);
        if (!active) {
          return;
        }

        if (!raw) {
          setChatPreferences({});
          setLocalPreferencesReady(true);
          return;
        }

        const parsed = JSON.parse(raw) as Record<string, Partial<ChatLocalPreferences>>;
        const normalizedEntries = Object.entries(parsed ?? {}).map(([chatId, value]) => [chatId, normalizeChatPreferences(value)]);
        setChatPreferences(Object.fromEntries(normalizedEntries));
      } catch {
        if (active) {
          setChatPreferences({});
        }
      } finally {
        if (active) {
          setLocalPreferencesReady(true);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [profile?.id]);

  useEffect(() => {
    if (!profile?.id) {
      setContactNicknames({});
      return;
    }

    let active = true;
    const storageKey = `${LOCAL_NICKNAMES_KEY_PREFIX}:${profile.id}`;

    void (async () => {
      try {
        const raw = await AsyncStorage.getItem(storageKey);
        if (active && raw) {
          setContactNicknames(JSON.parse(raw));
        }
      } catch {}
    })();

    return () => {
      active = false;
    };
  }, [profile?.id]);

  useEffect(() => {
    if (!profile?.id) return;
    const storageKey = `${LOCAL_NICKNAMES_KEY_PREFIX}:${profile.id}`;
    void AsyncStorage.setItem(storageKey, JSON.stringify(contactNicknames));
  }, [contactNicknames, profile?.id]);

  useEffect(() => {
    if (!profile?.id) {
      setDeletedForMeIds([]);
      deletedForMeIdsRef.current = [];
      return;
    }
    const storageKey = `${LOCAL_CHAT_STATE_KEY_PREFIX}:deleted_for_me:${profile.id}`;
    void AsyncStorage.getItem(storageKey).then(raw => {
      if (raw) {
         const parsed = JSON.parse(raw);
         setDeletedForMeIds(parsed);
         deletedForMeIdsRef.current = parsed;
      }
    });
  }, [profile?.id]);

  useEffect(() => {
    if (!profile?.id || !localPreferencesReady) {
      return;
    }

    const storageKey = `${LOCAL_CHAT_STATE_KEY_PREFIX}:${profile.id}`;
    void AsyncStorage.setItem(storageKey, JSON.stringify(chatPreferences));
  }, [chatPreferences, localPreferencesReady, profile?.id]);

  function updateChatPreferences(chatIds: string[], updater: (current: ChatLocalPreferences) => ChatLocalPreferences) {
    if (!chatIds.length) {
      return;
    }

    setChatPreferences((current) => {
      const next = { ...current };
      for (const chatId of [...new Set(chatIds)]) {
        next[chatId] = updater(normalizeChatPreferences(current[chatId]));
      }
      return next;
    });
  }

  const chats = useMemo(() => {
    return rawChats.map((chat) => {
      if (chat.is_group) return chat;
      
      const otherId = privateChatPartners[chat.id];
      if (!otherId) return chat;

      const nick = contactNicknames[otherId];
      if (nick) {
        const name = `${nick.first_name} ${nick.last_name}`.trim();
        if (name) return { ...chat, title: name };
      }

      const p = profiles[otherId];
      if (p) return { ...chat, title: p.username };

      return chat;
    });
  }, [rawChats, privateChatPartners, contactNicknames, profiles]);

  async function refreshChats() {
    if (!profile?.id) {
      return;
    }

    setLoading(true);

    const { data } = await supabase
      .from("chat_member_details")
      .select("*")
      .eq("user_id", profile.id)
      .order("last_message_at", { ascending: false, nullsFirst: false });

    const rows = data ?? [];
    const chatIds = rows.map((row) => row.chat_id);
    const directChatIds = rows.filter((row) => !row.is_group).map((row) => row.chat_id);

    const { data: membershipRows } = directChatIds.length
      ? await supabase.from("chat_members").select("chat_id,user_id").in("chat_id", directChatIds)
      : { data: [] };

    const otherUserIds = [
      ...new Set(
        (membershipRows ?? [])
          .filter((row) => row.user_id !== profile.id)
          .map((row) => row.user_id),
      ),
    ];

    const { data: otherProfiles } = otherUserIds.length
      ? await supabase.from("profiles").select("*").in("id", otherUserIds)
      : { data: [] };

    const { data: readRows } = chatIds.length
      ? await supabase.from("chat_members").select("chat_id,last_read_at").eq("user_id", profile.id).in("chat_id", chatIds)
      : { data: [] };

    const { data: unreadMessageRows } = chatIds.length
      ? await supabase
          .from("messages")
          .select("chat_id,sender_id,created_at")
          .in("chat_id", chatIds)
          .is("deleted_at", null)
      : { data: [] };

    const profileMap = Object.fromEntries(((otherProfiles ?? []) as Profile[]).map((item) => [item.id, item]));
    const directTitles = Object.fromEntries(
      (membershipRows ?? [])
        .filter((row) => row.user_id !== profile.id)
        .map((row) => [row.chat_id, profileMap[row.user_id]?.username])
        .filter((entry): entry is [string, string] => Boolean(entry[1])),
    );

    const partners: Record<string, string> = {};
    for (const row of (membershipRows ?? [])) {
      if (row.user_id !== profile.id) {
        partners[row.chat_id] = row.user_id;
      }
    }
    setPrivateChatPartners(partners);

    if (otherProfiles?.length) {
      setProfiles((current) => {
        const merged = { ...current };
        for (const nextProfile of otherProfiles as Profile[]) {
          merged[nextProfile.id] = nextProfile;
        }
        return merged;
      });
    }

    const lastReadMap: Record<string, string> = {};
    for (const row of readRows ?? []) {
      if (!lastReadMap[row.chat_id] || getUtcTime(row.last_read_at) > getUtcTime(lastReadMap[row.chat_id])) {
        lastReadMap[row.chat_id] = row.last_read_at;
      }
    }
    const nextUnreadCounts: Record<string, number> = {};

    for (const chatId of chatIds) {
      nextUnreadCounts[chatId] = 0;
    }

    for (const row of unreadMessageRows ?? []) {
      if (row.sender_id === profile.id) {
        continue;
      }

      const lastReadAt = lastReadMap[row.chat_id];
      if (!lastReadAt || getUtcTime(row.created_at) > getUtcTime(lastReadAt)) {
        nextUnreadCounts[row.chat_id] = (nextUnreadCounts[row.chat_id] ?? 0) + 1;
      }
    }

    const nextChats = rows.map((row) => ({
      id: row.chat_id,
      title: row.is_group ? row.chat_title : directTitles[row.chat_id] ?? row.chat_title,
      is_group: row.is_group,
      description: row.description ?? null,
      created_by: row.created_by,
      created_at: row.created_at,
      last_message_preview: row.last_message_preview,
      last_message_at: row.last_message_at,
    })) as Chat[];

    setRawChats(nextChats);
    // Merge: take the lower value so a locally-zeroed chat (just marked seen) isn't
    // overwritten by a stale count from a DB read that landed before the upsert propagated.
    setUnreadCounts((current) => {
      const merged: Record<string, number> = { ...nextUnreadCounts };
      for (const chatId of Object.keys(current)) {
        if (current[chatId] === 0 && (merged[chatId] ?? 0) > 0) {
          merged[chatId] = 0;
        }
      }
      return merged;
    });
    setLoading(false);
  }

  async function loadMessages(chatId: string) {
    if (!profile?.id) {
      return;
    }

    const { data: messages } = await supabase
      .from("messages")
      .select("*")
      .eq("chat_id", chatId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true });

    const messageIds = (messages ?? []).map((message) => message.id);
    const senderIds = [...new Set((messages ?? []).map((message) => message.sender_id))];

    const { data: reactionRows } = messageIds.length
      ? await supabase.from("message_reactions").select("message_id,emoji,user_id").in("message_id", messageIds)
      : { data: [] };

    const { data: viewRows } = messageIds.length
      ? await supabase
          .from("message_views")
          .select("message_id,opened_at")
          .eq("viewer_id", profile.id)
          .in("message_id", messageIds)
      : { data: [] };

    const { data: profileRows } = senderIds.length
      ? await supabase.from("profiles").select("*").in("id", senderIds)
      : { data: [] };

    loadedChatIdsRef.current = [...new Set([...loadedChatIdsRef.current, chatId])];
    // We filter synchronously against deletedForMeIdsRef to ensure they don't pop up from stale closure
    setMessagesByChat((current) => ({
      ...current,
      [chatId]: ((messages as Message[]) ?? []).filter(m => !deletedForMeIdsRef.current.includes(m.id)),
    }));

    if (profileRows) {
      setProfiles((current) => {
        const merged = { ...current };
        for (const nextProfile of profileRows as Profile[]) {
          merged[nextProfile.id] = nextProfile;
        }
        return merged;
      });
    }

    if (reactionRows) {
      setReactionsByMessage((current) => {
        const next = { ...current };

        for (const messageId of messageIds) {
          next[messageId] = {};
        }

        for (const row of reactionRows) {
          next[row.message_id] ??= {};
          next[row.message_id][row.emoji] ??= [];
          next[row.message_id][row.emoji].push(row.user_id);
        }

        return next;
      });
    }

    if (viewRows) {
      setOpenedViewOnceIds((current) => {
        const next = { ...current };
        for (const row of viewRows) {
          if (row.opened_at) {
            next[row.message_id] = true;
          }
        }
        return next;
      });
    }
  }

  async function loadChatMembers(chatId: string) {
    const { data: members, error } = await supabase.from("chat_members").select("user_id").eq("chat_id", chatId);

    if (error || !members?.length) {
      return [];
    }

    const memberIds = members.map((member) => member.user_id);
    const { data: memberProfiles } = await supabase.from("profiles").select("*").in("id", memberIds);
    const nextProfiles = (memberProfiles as Profile[]) ?? [];

    if (nextProfiles.length) {
      setProfiles((current) => {
        const merged = { ...current };
        for (const nextProfile of nextProfiles) {
          merged[nextProfile.id] = nextProfile;
        }
        return merged;
      });
    }

    return nextProfiles.sort((a, b) => a.username.localeCompare(b.username));
  }

  async function markChatSeen(chatId: string, timestamp?: string, nextUnreadCount?: number) {
    if (!profile?.id) {
      return;
    }

    const newTimestamp = timestamp || new Date().toISOString();
    const countToSet = nextUnreadCount !== undefined ? nextUnreadCount : 0;

    // Immediately clear locally so the badge updates while the DB write is in-flight
    setUnreadCounts((current) => ({
      ...current,
      [chatId]: countToSet,
    }));

    // Update the existing member row with the new read timestamp
    const { error } = await supabase
      .from("chat_members")
      .update({ last_read_at: newTimestamp })
      .eq("chat_id", chatId)
      .eq("user_id", profile.id);

    if (error) {
       console.warn("markChatSeen failed:", error);
    }
  }

  function setChatMute(chatId: string, duration: MuteDurationOption) {
    setMuteSettings((current) => ({
      ...current,
      [chatId]: buildMuteSetting(duration),
    }));
  }

  function clearChatMute(chatId: string) {
    setMuteSettings((current) => ({
      ...current,
      [chatId]: { mute_until: null, mute_always: false },
    }));
  }

  function archiveChats(chatIds: string[]) {
    updateChatPreferences(chatIds, (current) => ({
      ...current,
      archived: true,
    }));
  }

  function unarchiveChats(chatIds: string[]) {
    updateChatPreferences(chatIds, (current) => ({
      ...current,
      archived: false,
    }));
  }

  function togglePinnedChats(chatIds: string[]) {
    const shouldPin = chatIds.some((chatId) => !chatPreferences[chatId]?.pinned_at);
    const pinnedAt = shouldPin ? new Date().toISOString() : null;

    updateChatPreferences(chatIds, (current) => ({
      ...current,
      pinned_at: pinnedAt,
    }));
  }

  function lockChats(chatIds: string[]) {
    updateChatPreferences(chatIds, (current) => ({
      ...current,
      locked: true,
    }));
  }

  function unlockChats(chatIds: string[]) {
    updateChatPreferences(chatIds, (current) => ({
      ...current,
      locked: false,
    }));
  }

  function clearChatsLocally(chatIds: string[]) {
    const clearedAt = new Date().toISOString();
    updateChatPreferences(chatIds, (current) => ({
      ...current,
      cleared_at: clearedAt,
    }));
  }

  async function searchUsers(query: string) {
    if (!profile?.id) {
      return [];
    }

    let request = supabase
      .from("profiles")
      .select("*")
      .neq("id", profile.id)
      .order("username", { ascending: true })
      .limit(20);

    const trimmedQuery = query.trim();
    if (trimmedQuery) {
      const escapedQuery = trimmedQuery.replace(/[%_,]/g, "");
      request = request.or(`username.ilike.%${escapedQuery}%,full_name.ilike.%${escapedQuery}%`);
    }

    const { data, error } = await request;
    if (error || !data) {
      return [];
    }

    const nextProfiles = data as Profile[];
    setProfiles((current) => {
      const merged = { ...current };
      for (const nextProfile of nextProfiles) {
        merged[nextProfile.id] = nextProfile;
      }
      return merged;
    });

    return nextProfiles;
  }

  async function searchMessagesGlobal(query: string) {
    if (!profile?.id || !query.trim()) {
      return [];
    }

    const trimmedQuery = query.trim().replace(/[%_,]/g, "");
    if (!trimmedQuery) return [];

    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .ilike("body_ciphertext", `%${trimmedQuery}%`)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error || !data) {
      return [];
    }

    // Filter to only messages that belong to chats the user is in 
    // (the RLS policy should handle this, but just to be safe, filter by our known rawChats)
    const validChatIds = new Set(rawChats.map(c => c.id));
    return (data as Message[]).filter(m => validChatIds.has(m.chat_id)).map(m => ({ chat_id: m.chat_id, message: m }));
  }

  function subscribe(userId: string) {
    if (channelRef.current) {
      void supabase.removeChannel(channelRef.current);
    }

    channelRef.current = supabase
      .channel(`chat-stream-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, (payload) => {
        const next = payload.new as Message;
        if (!next?.chat_id) {
          return;
        }

        setMessagesByChat((current) => {
          if (deletedForMeIdsRef.current.includes(next.id)) return current;
          const existing = current[next.chat_id] ?? [];
          const withoutCurrent = existing.filter((message) => message.id !== next.id);
          return {
            ...current,
            [next.chat_id]: [...withoutCurrent, next].sort((a, b) => a.created_at.localeCompare(b.created_at)),
          };
        });

        void refreshChats();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "message_reactions" }, () => {
        for (const chatId of loadedChatIdsRef.current) {
          void loadMessages(chatId);
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "message_views" }, () => {
        for (const chatId of loadedChatIdsRef.current) {
          void loadMessages(chatId);
        }
      })
      .subscribe();
  }

  async function sendMessage(input: MessageComposerInput) {
    if (!profile?.id || !input.body.trim()) {
      return "Message is empty.";
    }

    const body = input.body.trim();
    const preview = input.messageKind === "view_once" ? "View once message" : body;
    const expiresAt =
      input.messageKind === "temporary" && input.expireSeconds
        ? new Date(Date.now() + input.expireSeconds * 1000).toISOString()
        : null;

    const { error } = await supabase.from("messages").insert({
      chat_id: input.chatId,
      sender_id: profile.id,
      body_ciphertext: body,
      body_preview: preview,
      message_kind: input.messageKind,
      reply_to_id: input.replyToId ?? null,
      expires_at: expiresAt,
    });

    return error?.message ?? null;
  }

  async function createChat(title: string, memberUsernames: string[]) {
    if (!profile?.id) {
      return { chat: null, error: "You must be signed in." };
    }

    const usernames = [...new Set(memberUsernames.map((value) => value.trim()).filter(Boolean))];
    if (!usernames.length) {
      return { chat: null, error: "Add at least one member username." };
    }

    const { data: members, error: memberError } = await supabase
      .from("profiles")
      .select("id,username")
      .in("username", usernames);

    if (memberError) {
      return { chat: null, error: memberError.message };
    }

    const allMemberIds = [...new Set([profile.id, ...(members ?? []).map((member) => member.id)])];
    const isGroup = allMemberIds.length > 2;
    const normalizedTitle =
      title.trim() || (members?.length === 1 ? members[0].username : `Group with ${members?.length ?? 0} members`);

    const { data: chat, error: chatError } = await supabase
      .from("chats")
      .insert({
        title: normalizedTitle,
        is_group: isGroup,
        created_by: profile.id,
      })
      .select()
      .single();

    if (chatError || !chat) {
      return { chat: null, error: chatError?.message ?? "Could not create chat." };
    }

    const { error: joinError } = await supabase.from("chat_members").insert(
      allMemberIds.map((userId) => ({
        chat_id: chat.id,
        user_id: userId,
        role: userId === profile.id ? "owner" : "member",
      })),
    );

    if (joinError) {
      return { chat: null, error: joinError.message };
    }

    const displayTitle = !isGroup && members?.[0]?.username ? members[0].username : normalizedTitle;
    const nextChat = { ...(chat as Chat), title: displayTitle };

    await refreshChats();
    return { chat: nextChat, error: null };
  }

  async function toggleReaction(messageId: string, emoji: string) {
    if (!profile?.id) {
      return;
    }

    // Check if the user already has this specific emoji applied
    const currentUsersForEmoji = reactionsByMessage[messageId]?.[emoji] ?? [];
    const alreadyReactedWithThisEmoji = currentUsersForEmoji.includes(profile.id);

    // ── OPTIMISTIC UPDATE: update local state immediately so UI is instant ──
    setReactionsByMessage((current) => {
      const messageReactions = { ...(current[messageId] ?? {}) };

      // Remove all current emoji reactions for this user
      for (const key of Object.keys(messageReactions)) {
        messageReactions[key] = messageReactions[key].filter((uid) => uid !== profile.id);
      }

      // Add the new reaction if not toggling off
      if (!alreadyReactedWithThisEmoji) {
        messageReactions[emoji] = [...(messageReactions[emoji] ?? []), profile.id];
      }

      return { ...current, [messageId]: messageReactions };
    });

    // ── DB SYNC in background ─────────────────────────────────────────────
    // Delete any existing reactions this user has on this message
    await supabase
      .from("message_reactions")
      .delete()
      .eq("message_id", messageId)
      .eq("user_id", profile.id);

    // If they just clicked the exact same emoji, the delete above successfully toggled it off.
    if (alreadyReactedWithThisEmoji) {
      return;
    }

    // Otherwise, insert the newly selected emoji reaction
    await supabase.from("message_reactions").insert({
      message_id: messageId,
      user_id: profile.id,
      emoji,
    });
  }

  async function openViewOnceMessage(message: Message) {
    if (!profile?.id || message.message_kind !== "view_once") {
      return;
    }

    await supabase.from("message_views").upsert({
      message_id: message.id,
      viewer_id: profile.id,
      opened_at: new Date().toISOString(),
    });

    setOpenedViewOnceIds((current) => ({
      ...current,
      [message.id]: true,
    }));
  }

  async function deleteMessages(messageIds: string[], forEveryone: boolean) {
    if (!profile?.id || !messageIds.length) {
      return;
    }

    if (forEveryone) {
      const { error } = await supabase
        .from("messages")
        .update({ deleted_at: new Date().toISOString() })
        .in("id", messageIds);

      if (!error) {
        setMessagesByChat((current) => {
          const next = { ...current };
          for (const chatId in next) {
            next[chatId] = next[chatId].filter((m) => !messageIds.includes(m.id));
          }
          return next;
        });
      } else {
        Alert.alert("שגיאה במחיקה", "נא להריץ את קובץ SQL כי המסד חוסם: " + error.message);
      }
    } else {
      setDeletedForMeIds((current) => {
        const next = [...new Set([...current, ...messageIds])];
        deletedForMeIdsRef.current = next;
        void AsyncStorage.setItem(`${LOCAL_CHAT_STATE_KEY_PREFIX}:deleted_for_me:${profile.id}`, JSON.stringify(next));
        return next;
      });
      setMessagesByChat((current) => {
        const next = { ...current };
        for (const chatId in next) {
          next[chatId] = next[chatId].filter((m) => !messageIds.includes(m.id));
        }
        return next;
      });
    }
  }

  async function deleteChats(chatIdsToProcess: string[]) {
    if (!profile?.id || !chatIdsToProcess.length) return;

    // The user requested that deleting a chat (group or private) doesn't delete the content,
    // but just removes it from the user's Chats list, similar to clearing, but preserving the 
    // internal history when re-opened.
    const deletedAt = new Date().toISOString();
    updateChatPreferences(chatIdsToProcess, (current) => ({
      ...current,
      deleted_from_home_at: deletedAt,
    }));
  }

  async function updateChatDescription(chatId: string, description: string) {
    if (!profile?.id) {
      return;
    }

    const { error } = await supabase.from("chats").update({ description }).eq("id", chatId);

    if (!error) {
      setRawChats((current) =>
        current.map((chat) => (chat.id === chatId ? { ...chat, description } : chat))
      );
    }
  }

  async function updateChatTitle(chatId: string, title: string) {
    if (!profile?.id) return;
    const { error } = await supabase.from("chats").update({ title }).eq("id", chatId);
    if (!error) {
      setRawChats((current) =>
        current.map((chat) => (chat.id === chatId ? { ...chat, title } : chat))
      );
    }
  }

  async function setContactNickname(userId: string, data: ContactNicknameData) {
    setContactNicknames((current) => ({
      ...current,
      [userId]: data,
    }));
  }

  const value = useMemo(
    () => ({
      chats,
      profiles,
      messagesByChat,
      reactionsByMessage,
      openedViewOnceIds,
      unreadCounts,
      muteSettings,
      chatPreferences,
      loading,
      refreshChats,
      loadMessages,
      loadChatMembers,
      markChatSeen,
      setChatMute,
      clearChatMute,
      archiveChats,
      unarchiveChats,
      togglePinnedChats,
      lockChats,
      unlockChats,
      clearChatsLocally,
      searchUsers,
      sendMessage,
      createChat,
      toggleReaction,
      openViewOnceMessage,
      deleteMessages,
      updateChatDescription,
      updateChatTitle,
      deleteChats,
      contactNicknames,
      setContactNickname,
      searchMessagesGlobal,
    }),
    [chatPreferences, contactNicknames, chats, loading, messagesByChat, muteSettings, openedViewOnceIds, profiles, reactionsByMessage, unreadCounts],
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChats() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error("useChats must be used within ChatProvider");
  }
  return context;
}
