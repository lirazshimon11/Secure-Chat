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
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { Chat, Message, Profile, ReactionSummary } from "@/lib/types";

type MessageComposerInput = {
  chatId: string;
  body: string;
  messageKind: "standard" | "temporary" | "view_once";
  replyToId?: string | null;
  expireSeconds?: number | null;
};

type ChatContextValue = {
  chats: Chat[];
  profiles: Record<string, Profile>;
  messagesByChat: Record<string, Message[]>;
  reactionsByMessage: Record<string, ReactionSummary>;
  openedViewOnceIds: Record<string, boolean>;
  loading: boolean;
  refreshChats: () => Promise<void>;
  loadMessages: (chatId: string) => Promise<void>;
  searchUsers: (query: string) => Promise<Profile[]>;
  sendMessage: (input: MessageComposerInput) => Promise<string | null>;
  createChat: (
    title: string,
    memberUsernames: string[],
  ) => Promise<{ chat: Chat | null; error: string | null }>;
  toggleReaction: (messageId: string, emoji: string) => Promise<void>;
  openViewOnceMessage: (message: Message) => Promise<void>;
};

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: PropsWithChildren) {
  const { profile } = useAuth();
  const [chats, setChats] = useState<Chat[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [messagesByChat, setMessagesByChat] = useState<Record<string, Message[]>>({});
  const [reactionsByMessage, setReactionsByMessage] = useState<Record<string, ReactionSummary>>({});
  const [openedViewOnceIds, setOpenedViewOnceIds] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const loadedChatIdsRef = useRef<string[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!profile?.id) {
      setChats([]);
      setMessagesByChat({});
      setReactionsByMessage({});
      setOpenedViewOnceIds({});
      loadedChatIdsRef.current = [];
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

    if (data) {
      const nextChats = data.map((row) => ({
        id: row.chat_id,
        title: row.chat_title,
        is_group: row.is_group,
        created_by: row.created_by,
        created_at: row.created_at,
        last_message_preview: row.last_message_preview,
        last_message_at: row.last_message_at,
      })) as Chat[];

      setChats(nextChats);
    }

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
    setMessagesByChat((current) => ({
      ...current,
      [chatId]: (messages as Message[]) ?? [],
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
    const normalizedTitle =
      title.trim() || (members?.length === 1 ? members[0].username : `Group with ${members?.length ?? 0} members`);

    const { data: chat, error: chatError } = await supabase
      .from("chats")
      .insert({
        title: normalizedTitle,
        is_group: allMemberIds.length > 2,
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

    await refreshChats();
    return { chat: chat as Chat, error: null };
  }

  async function toggleReaction(messageId: string, emoji: string) {
    if (!profile?.id) {
      return;
    }

    const currentUsers = reactionsByMessage[messageId]?.[emoji] ?? [];
    const alreadyReacted = currentUsers.includes(profile.id);

    if (alreadyReacted) {
      await supabase
        .from("message_reactions")
        .delete()
        .eq("message_id", messageId)
        .eq("user_id", profile.id)
        .eq("emoji", emoji);
      return;
    }

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

  const value = useMemo(
    () => ({
      chats,
      profiles,
      messagesByChat,
      reactionsByMessage,
      openedViewOnceIds,
      loading,
      refreshChats,
      loadMessages,
      searchUsers,
      sendMessage,
      createChat,
      toggleReaction,
      openViewOnceMessage,
    }),
    [chats, loading, messagesByChat, openedViewOnceIds, profiles, reactionsByMessage],
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
