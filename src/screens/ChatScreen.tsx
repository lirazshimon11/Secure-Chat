import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Alert, Pressable, ScrollView, Text, TextInput, View, useColorScheme, KeyboardAvoidingView, Platform, Keyboard, StyleSheet, PanResponder } from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { EmojiKeyboard, RECENT_KEY } from "@/components/EmojiKeyboard";
import { MessageBubble } from "@/components/MessageBubble";
import { MessageComposer } from "@/components/MessageComposer";
import { useAuth } from "@/context/AuthContext";
import { useChats } from "@/context/ChatContext";
import { useAppTheme } from "@/lib/theme";
import { Chat, Message, Profile } from "@/lib/types";
import { webEmbeddedInputReset, webDefaultCursor } from "@/lib/webStyles";
import { supabase } from "@/lib/supabase";

// Sub-screens
import { ChatAddMembersScreen } from "./chat-settings/ChatAddMembersScreen";
import { ChatMediaScreen } from "./chat-settings/ChatMediaScreen";
import { ChatDisappearingMessagesScreen } from "./chat-settings/ChatDisappearingMessagesScreen";
import { ChatThemeScreen } from "./chat-settings/ChatThemeScreen";
import { CreatePollScreen } from "./chat-settings/CreatePollScreen";
import { ChatPollVotesScreen } from "./chat-settings/ChatPollVotesScreen";
import { ChatMemberActionModal } from "./chat-settings/ChatMemberActionModal";

// Extracted modules
import { isChatMuted, formatRelativeDate } from "./chat/ChatUtils";
import { createStyles } from "./chat/ChatStyles";
import { ChatHeader } from "./chat/ChatHeader";
import { ChatOverlayManager } from "./chat/ChatOverlayManager";
import { useChatPermissions } from "./chat/useChatPermissions";
import { ChatBackground } from "./chat/ChatBackground";

type Props = {
  chat: Chat;
  onBack: () => void;
  onOpenChatSettings: (chat?: Chat) => void;
  scrollToMessageId?: string | null;
  onForward?: (messages: Message[]) => void;
  onCreateGroupWith?: (profile: Profile) => void;
  onOpenChat?: (chat: Chat) => void;
  /** When true, renders as the Decoy Content editor — same UI, different data source */
  decoyMode?: boolean;
};

export function ChatScreen({ chat, onBack, onOpenChatSettings, scrollToMessageId, onForward, onCreateGroupWith, onOpenChat, decoyMode }: Props) {
  const insets = useSafeAreaInsets() || { top: 0, bottom: 0, left: 0, right: 0 };
  const theme = useAppTheme();
  const colorScheme = useColorScheme();
  const styles = useMemo(() => createStyles(theme, insets), [theme, insets]);
  const { profile } = useAuth();
  const [initialUnreadCount, setInitialUnreadCount] = useState<number>(0);
  const [initialUnreadStartIndex, setInitialUnreadStartIndex] = useState<number>(-1);

  const {
    loadMessages, markChatSeen, unreadCounts, messagesByChat, profiles, chats,
    contactNicknames, reactionsByMessage, openedViewOnceIds, muteSettings,
    chatPreferences, setChatMute, clearChatMute, sendMessage, openViewOnceMessage,
    toggleReaction, deleteMessages, loadChatMembers, clearChatsLocally, isCurrentMember,
    createChat, setChatMemberRole, removeChatMember
  } = useChats();

  const [isMember, setIsMember] = useState(false);
  const [selectedAvatarMember, setSelectedAvatarMember] = useState<Profile | null>(null);

  // Initialize membership from context data if available
  useEffect(() => {
    if (chat && chats) {
      const chatInList = chats.find(c => c.id === chat.id);
      if (chatInList) {
        // If the chat preview indicates we are removed, setIsMember(false) immediately
        // Note: we'll follow up with the DB check for total accuracy
        setIsMember(chatInList.last_message_preview !== "את/ה הוסרת/ה מהקבוצה");
      }
    }
  }, [chat?.id, chats]);

  // ── 1. Memoized Data (Moved to top of scope) ───────────────────────────
  // ── Decoy content mode: load from chat_decoy_messages instead of real messages ──
  const [decoyDbMessages, setDecoyDbMessages] = useState<Message[]>([]);
  useEffect(() => {
    if (!decoyMode || !profile?.id) return;
    let active = true;
    void (async () => {
      const { data, error } = await supabase
        .from("chat_decoy_messages")
        .select("id, body, is_me, created_at, sender_id")
        .eq("chat_id", chat.id)
        .order("created_at", { ascending: true });
      if (!active || error || !data) return;
      setDecoyDbMessages(
        data.map((r: any) => ({
          id: `decoy-${r.id}`,
          _decoy_row_id: r.id,
          chat_id: chat.id,
          sender_id: r.is_me ? profile.id : (`decoy-other-${r.sender_id}`),
          body_ciphertext: r.body,
          body_preview: r.body,
          message_kind: "standard" as const,
          reply_to_id: null,
          expires_at: null,
          created_at: r.created_at,
          deleted_at: null,
        })),
      );
    })();
    return () => { active = false; };
  }, [decoyMode, chat.id, profile?.id]);

  const visibleMessages = useMemo(() => {
    if (decoyMode) return decoyDbMessages;
    const allMessages = (messagesByChat && chat && messagesByChat[chat.id]) ?? [];
    const prefs = chatPreferences && chat && chatPreferences[chat.id];
    const clearedAt = prefs?.cleared_at;
    if (!clearedAt) return allMessages;
    const clearedAtMs = new Date(clearedAt).getTime();
    return allMessages.filter((m) => new Date(m.created_at).getTime() > clearedAtMs);
  }, [decoyMode, decoyDbMessages, chat?.id, chatPreferences, messagesByChat]);

  const messageMap = useMemo(() => Object.fromEntries((visibleMessages || []).map((msg) => [msg.id, msg])), [visibleMessages]);

  const [searchQuery, setSearchQuery] = useState("");
  const [groupMembers, setGroupMembers] = useState<Profile[]>([]);

  // ── Decoy (guard) state (must be declared before groupedMessages) ───────
  const [showDecoyManager, setShowDecoyManager] = useState(false);
  const [isDecoyActive, setIsDecoyActive] = useState(false);
  /** DB bait messages loaded from chat_decoy_messages when decoy activates */
  const [dbDecoyMessages, setDbDecoyMessages] = useState<Message[]>([]);
  /** Messages sent by this user during decoy mode — shown in fake chat, cleared when guard lifts */
  const [localDecoyMessages, setLocalDecoyMessages] = useState<Message[]>([]);

  // Load DB decoy messages when guard activates; clear when it deactivates
  useEffect(() => {
    if (!isDecoyActive || !profile?.id) {
      setDbDecoyMessages([]);
      setLocalDecoyMessages([]);
      return;
    }
    let active = true;
    void (async () => {
      const { data } = await supabase
        .from("chat_decoy_messages")
        .select("id, body, is_me, created_at, sender_id")
        .eq("chat_id", chat.id)
        .order("created_at", { ascending: true });

      if (!active || !data) return;

      const otherMember = groupMembers.find((m) => m.id !== profile.id);
      setDbDecoyMessages(
        data.map((dm: any) => ({
          id: `db-decoy-${dm.id}`,
          chat_id: chat.id,
          sender_id: dm.is_me
            ? profile.id
            : (otherMember?.id ?? "decoy-user"),
          body_ciphertext: dm.body,
          body_preview: dm.body,
          message_kind: "standard" as const,
          reply_to_id: null,
          expires_at: null,
          created_at: dm.created_at,
          deleted_at: null,
        })),
      );
    })();
    return () => { active = false; };
  }, [isDecoyActive, profile?.id, chat.id, groupMembers]);

  // Combined decoy messages: DB content + messages sent this session
  const decoyMessages = useMemo<Message[]>(
    () => (isDecoyActive ? [...dbDecoyMessages, ...localDecoyMessages] : []),
    [isDecoyActive, dbDecoyMessages, localDecoyMessages],
  );


  const groupedMessages = useMemo(() => {
    const groups: any[] = [];
    if (!chat || !visibleMessages) return groups;

    // ── When decoy is active, show fake boring messages ────────────────
    const messagesToGroup = isDecoyActive ? decoyMessages : (visibleMessages || []).filter((msg) => {
      const normalizedQuery = searchQuery.trim().toLowerCase();
      if (!normalizedQuery) return true;
      const originalMsg = msg?.reply_to_id ? messageMap[msg.reply_to_id] : null;
      const replyPreview = originalMsg?.body_preview ?? "";
      const bodyText = msg?.body_ciphertext || "";
      const previewText = msg?.body_preview || "";
      return [bodyText, previewText, replyPreview].some((v) => v.toLowerCase().includes(normalizedQuery));
    });

    let lastDateLabel = "";
    messagesToGroup.forEach((msg, idx) => {
      if (!isDecoyActive && initialUnreadCount > 0 && idx === initialUnreadStartIndex && !searchQuery.trim()) {
        groups.push({ type: "unread", unreadCount: initialUnreadCount });
      }
      const label = formatRelativeDate(new Date(msg.created_at));
      if (label !== lastDateLabel) { groups.push({ type: "date", dateLabel: label }); lastDateLabel = label; }
      groups.push({ type: "message", message: msg });
    });
    return groups;
  }, [messageMap, searchQuery, visibleMessages, initialUnreadCount, initialUnreadStartIndex, isDecoyActive, decoyMessages]);

  const groupSubtitle = useMemo(() => {
    if (!chat?.is_group || !groupMembers || (groupMembers?.length || 0) === 0) return "קבוצה";
    const allNames = (groupMembers || []).map(m => m.id === profile?.id ? "את/ה" : m.username);
    const text = allNames.join(", ");
    return text.length > 40 ? text.slice(0, 37) + "..." : text;
  }, [groupMembers, chat?.is_group, profile?.id]);

  // ── 2. Other States ────────────────────────────────────────────────────
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [revealedMessageId, setRevealedMessageId] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [showOverflowMenu, setShowOverflowMenu] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showMuteMenu, setShowMuteMenu] = useState(false);
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [muteSelection, setMuteSelection] = useState<"8_hours" | "1_week" | "always">("always");
  const [clearSelection, setClearSelection] = useState<"all" | "media">("all");
  const [clearStarred, setClearStarred] = useState(false);
  const [reportExit, setReportExit] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showReactionsForId, setShowReactionsForId] = useState<string | null>(null);
  const [showSelectionOverflowMenu, setShowSelectionOverflowMenu] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [pickerLayout, setPickerLayout] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [viewInfoMessage, setViewInfoMessage] = useState<Message | null>(null);
  const [showEmojiPickerForId, setShowEmojiPickerForId] = useState<string | null>(null);
  const [showReactionsSheetForId, setShowReactionsSheetForId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const viewHeightRef = useRef(0);
  const maxViewHeightRef = useRef(0);
  const rootViewHeightRef = useRef(0);       // ref mirror of rootViewHeight for async callbacks
  const preKeyboardHeightRef = useRef(0);    // height captured BEFORE keyboard opened (orientation-safe)
  const isKeyboardOpenRef = useRef(false);   // true while Android software keyboard is visible
  const composerWrapperRef = useRef<View>(null); // for measureInWindow ground-truth debugging
  const [showEmojiKeyboard, setShowEmojiKeyboard] = useState(false);
  const [composerEmojiEvent, setComposerEmojiEvent] = useState<{ emoji: string; ts: number } | null>(null);
  const [rootViewHeight, setRootViewHeight] = useState(0);
  const [emojiRecents, setEmojiRecents] = useState<string[]>([]);
  const [composerFocusTrigger, setComposerFocusTrigger] = useState(0);
  const [savedMessageIds, setSavedMessageIds] = useState<Set<string>>(new Set());

  // ── Keyboard spacer: Animated approach (as requested) ──────────────────────────────
  const keyboardHeightAnim = useRef(new Animated.Value(0)).current;
  const [recordedKeyboardHeight, setRecordedKeyboardHeight] = useState(300);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [activeSubScreen, setActiveSubScreen] = useState<"addMembers" | "media" | "disappearing" | "theme" | "createPoll" | "pollVotes" | null>(null);
  const [viewPollVotesMessage, setViewPollVotesMessage] = useState<Message | null>(null);
  const [isRevealingChat, setIsRevealingChat] = useState(false);
  const [isDragSelectLocked, setIsDragSelectLocked] = useState(false);
  const isDragSelectLockedRef = useRef(false);
  useEffect(() => { isDragSelectLockedRef.current = isDragSelectLocked; }, [isDragSelectLocked]);

  const showScrollToBottomRef = useRef(false);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);


  const scrollRef = useRef<ScrollView | null>(null);
  const threadContainerRef = useRef<any>(null);
  const scrollMetricsRef = useRef({ y: 0, height: 0, contentHeight: 0 });
  const messageLayoutsRef = useRef<Record<string, { y: number; h: number }>>({});
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const initialScrollDone = useRef(false);
  const revealTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── 3. Actions & Effects ───────────────────────────────────────────────
  const checkVisibility = () => {
    if (!profile?.id || !visibleMessages?.length) return;
    const { y, height: h } = scrollMetricsRef.current;
    if (h === 0) return;
    const bottomEdge = y + h;
    let latestSeenMsg: Message | null = null;
    for (let i = visibleMessages.length - 1; i >= 0; i--) {
      const msg = visibleMessages[i];
      if (msg.sender_id !== profile.id) {
        const layout = messageLayoutsRef.current[msg.id];
        const topY = layout?.y;
        if (topY !== undefined && topY <= bottomEdge + 50) {
          latestSeenMsg = msg;
          break;
        }
      }
    }
    if (latestSeenMsg) {
      const remainingUnread = visibleMessages.filter((m) => m.sender_id !== profile?.id && new Date(m.created_at).getTime() > new Date(latestSeenMsg!.created_at).getTime()).length;
      const currentUnread = (unreadCounts && chat && unreadCounts[chat.id]) || 0;
      if (remainingUnread < currentUnread) markChatSeen(chat.id, latestSeenMsg.created_at, remainingUnread);
    }
  };

  const showToast = (text: string) => {
    setToastMessage(text);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => setToastMessage(null), 2500);
  };

  const scrollToBottom = (animated = true) => {
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated }));
  };

  const scrollToMessageWithRetry = (msgId: string, highlight = true, attempts = 6) => {
    const layout = messageLayoutsRef.current[msgId];
    const y = layout?.y;
    if (y !== undefined) {
      scrollRef.current?.scrollTo({ y: Math.max(0, y - 120), animated: true });
      if (highlight) { setHighlightedMessageId(msgId); setTimeout(() => setHighlightedMessageId(null), 2000); }
    } else if (attempts > 0) {
      setTimeout(() => scrollToMessageWithRetry(msgId, highlight, attempts - 1), 250);
    }
  };

  const handleMemberAction = async (member: Profile) => {
    setSelectedAvatarMember(null);
    const existing = chats.find(c => !c.is_group && (c.title === member.username || c.title === contactNicknames[member.id]?.first_name));
    if (existing && onOpenChat) {
      onOpenChat(existing);
    } else if (onOpenChat) {
      const { chat: newChat, error } = await createChat(member.username, [member.username]);
      if (newChat) onOpenChat(newChat);
      else Alert.alert("שגיאה", error || "לא ניתן לפתוח צ'אט כרגע.");
    }
  };

  const handleDetailsAction = async (member: Profile) => {
    setSelectedAvatarMember(null);
    const existing = chats.find(c => !c.is_group && (c.title === member.username || c.title === contactNicknames[member.id]?.first_name));
    if (existing && onOpenChatSettings) {
      onOpenChatSettings(existing);
    } else if (onOpenChatSettings) {
      const { chat: newChat } = await createChat(member.username, [member.username]);
      if (newChat) onOpenChatSettings(newChat);
    }
  };

  const handleSetAdmin = (memberId: string) => {
    setSelectedAvatarMember(null);
    Alert.alert("הגדרה כמנהל/ת", "האם להפוך משתתף זה למנהל הקבוצה?", [
      { text: "ביטול", style: "cancel" },
      {
        text: "אישור", onPress: async () => {
          await setChatMemberRole(chat.id, memberId, "admin");
          void loadChatMembers(chat.id).then(setGroupMembers);
        }
      }
    ]);
  };

  const handleRemoveMember = (member: Profile) => {
    setSelectedAvatarMember(null);
    const displayName = contactNicknames[member.id]?.first_name || member.full_name || member.username;
    Alert.alert("הסרה", `האם להסיר את ${displayName} מהקבוצה "${chat.title}"?`, [
      { text: "ביטול", style: "cancel" },
      {
        text: "הסרה", style: "destructive", onPress: async () => {
          await removeChatMember(chat.id, member, chat.title);
          void loadChatMembers(chat.id).then(setGroupMembers);
        }
      }
    ]);
  };

  const { hasScreenshotPerm, screenshotHold, activePermissions, myRequests, requestScreenshotPermission, approveRequest, denyRequest, revokeApproval } =
    useChatPermissions(chat, groupMembers, (p) => sendMessage(p), activeSubScreen !== null);

  const handleToggleReaction = (messageId: string, emoji: string) => {
    const msg = visibleMessages.find(m => m.id === messageId);
    if (msg?.body_ciphertext.startsWith("[POLL]:")) {
      try {
        const pData = JSON.parse(msg.body_ciphertext.substring(7));
        if (pData.isScreenshotRequest) {
          const requestId = pData.screenshotRequestId;
          const requesterName = profiles[msg.sender_id]?.username || "מישהו";
          const alreadyApproved = myRequests[chat.id]?.status === "approved";

          if (emoji === "poll:0") {
            // Background permission update
            approveRequest(requestId, chat.id, requesterName, profile?.username || "מישהו");
          } else if (emoji === "poll:1") {
            // Background cleanup and denial
            void (async () => {
              if (alreadyApproved) await revokeApproval(requestId, chat.id, requesterName);
              await denyRequest(requestId);
            })();
          }
        }
      } catch (e) {
        console.error("Screenshot poll vote error", e);
      }
    }

    // Optimistic UI update via global context
    toggleReaction(messageId, emoji);
  };

  useEffect(() => {
    if (chat?.is_group) loadChatMembers(chat.id).then(setGroupMembers);
  }, [chat?.id, chat?.is_group]);

  // ── Decoy detection: initial fetch + real-time subscription ───────────
  useEffect(() => {
    if (!profile?.id || !chat?.id) return;

    // 1. Initial fetch — is this user currently protected?
    void supabase
      .from("chat_decoy_targets")
      .select("id")
      .eq("chat_id", chat.id)
      .eq("target_id", profile.id)
      .maybeSingle()
      .then(({ data }) => setIsDecoyActive(!!data));

    // 2. Realtime — react instantly when guard is toggled
    const channel = supabase
      .channel(`decoy-guard:${chat.id}:${profile.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_decoy_targets",
          filter: `chat_id=eq.${chat.id}`,
        },
        (payload) => {
          if (payload.new?.target_id === profile.id) {
            setIsDecoyActive(true);
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "chat_decoy_targets",
          // No filter here: DELETE events can't filter by chat_id without REPLICA IDENTITY FULL
          // Instead we re-fetch on any delete and check if this user is still protected
        },
        () => {
          void supabase
            .from("chat_decoy_targets")
            .select("id")
            .eq("chat_id", chat.id)
            .eq("target_id", profile.id)
            .maybeSingle()
            .then(({ data }) => setIsDecoyActive(!!data));
        },
      )
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [chat?.id, profile?.id]);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(`saved-messages:${profile?.id ?? "guest"}`).then((raw) => {
      if (active && raw) { try { setSavedMessageIds(new Set(JSON.parse(raw).map((m: any) => m.id))); } catch { } }
    });
    return () => { active = false; };
  }, [profile?.id, selectedIds?.length]);

  useEffect(() => {
    AsyncStorage.getItem(RECENT_KEY).then((raw) => {
      if (raw) try { setEmojiRecents(JSON.parse(raw)); } catch { }
    });
  }, []);

  useEffect(() => {
    if (Platform.OS !== "android") {
      const s1 = Keyboard.addListener("keyboardWillShow", (e) => {
        const kh = e.endCoordinates.height;
        setKeyboardHeight(kh);
        Animated.timing(keyboardHeightAnim, {
          toValue: kh,
          duration: e.duration || 250,
          useNativeDriver: false,
        }).start();
      });
      const s2 = Keyboard.addListener("keyboardWillHide", (e) => {
        setKeyboardHeight(0);
        Animated.timing(keyboardHeightAnim, {
          toValue: 0,
          duration: e.duration || 250,
          useNativeDriver: false,
        }).start();
      });
      return () => { s1.remove(); s2.remove(); };
    } else {
      const s1 = Keyboard.addListener("keyboardDidShow", (e) => {
        const kh = e.endCoordinates.height;
        console.log(`[KB-DEBUG] keyboardDidShow: rawKbHeight=${kh}`);
        setRecordedKeyboardHeight(kh);
        setKeyboardHeight(kh);
        isKeyboardOpenRef.current = true;
        setShowEmojiKeyboard(false);
        
        Animated.timing(keyboardHeightAnim, {
          toValue: kh,
          duration: 250,
          useNativeDriver: false,
        }).start();

        // Measure actual position for debugging
        setTimeout(() => {
          composerWrapperRef.current?.measureInWindow((x, y, width, height) => {
            const composerBottom = y + height;
            const keyboardTop = rootViewHeightRef.current - kh;
            console.log(`[KB-DEBUG] measureInWindow: composerBottom=${composerBottom.toFixed(1)} keyboardTop=${keyboardTop.toFixed(1)} overlap=${(composerBottom - keyboardTop).toFixed(1)}px`);
          });
        }, 150);
      });
      const s2 = Keyboard.addListener("keyboardDidHide", () => {
        isKeyboardOpenRef.current = false;
        setKeyboardHeight(0);
        Animated.timing(keyboardHeightAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: false,
        }).start();
      });
      return () => { s1.remove(); s2.remove(); };
    }
  }, []);

  useEffect(() => {
    initialScrollDone.current = false;
    if (chat?.id) {
      void loadMessages(chat.id);
      void isCurrentMember(chat.id).then(setIsMember);
    }
  }, [chat?.id]);

  useEffect(() => {
    if (!visibleMessages?.length || initialScrollDone.current) return;
    const currentUnread = (unreadCounts && chat && unreadCounts[chat.id]) || 0;

    // Initialize unread divider positions once per chat entry
    if (!initialScrollDone.current) {
      setInitialUnreadCount(currentUnread);
      setInitialUnreadStartIndex(Math.max(0, visibleMessages.length - currentUnread));
    }

    if (scrollToMessageId) {
      setTimeout(() => scrollToMessageWithRetry(scrollToMessageId, true), 100);
      initialScrollDone.current = true;
    } else if (currentUnread > 0) {
      const unreadStartIndex = Math.max(0, visibleMessages.length - currentUnread);
      const firstUnreadMsg = visibleMessages[unreadStartIndex];
      if (firstUnreadMsg) {
        setTimeout(() => {
          scrollToMessageWithRetry(firstUnreadMsg.id, false);
          setTimeout(checkVisibility, 400);
        }, 150);
      } else {
        scrollToBottom(false);
      }
      initialScrollDone.current = true;
    } else {
      // Go to bottom immediately
      requestAnimationFrame(() => scrollToBottom(false));
      initialScrollDone.current = true;
    }
  }, [chat?.id, visibleMessages?.length, scrollToMessageId, unreadCounts]);

  // Live auto-scroll and visibility check
  useEffect(() => {
    if (!initialScrollDone.current || !visibleMessages?.length) return;

    const lastMsg = visibleMessages[visibleMessages.length - 1];
    if (!lastMsg) return;

    // System messages (guard, group events, etc.) → always scroll to bottom
    if (lastMsg.message_kind === "system") {
      scrollToBottom(true);
    } else if (lastMsg.sender_id !== profile?.id) {
      // Someone else's regular message — only scroll if already near bottom
      const { y, height, contentHeight } = scrollMetricsRef.current;
      const distanceFromBottom = contentHeight - (y + height);
      if (distanceFromBottom < 150) {
        scrollToBottom(true);
      }
    }

    // Always check visibility to mark new messages as seen if they are on screen
    const timer = setTimeout(checkVisibility, 100);
    return () => clearTimeout(timer);
  }, [visibleMessages]);

  const [fadeAnim] = useState(new Animated.Value(0));
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      delay: 200, // Wait for transition animation to be mostly done
      useNativeDriver: true,
    }).start();
  }, []);

  // ── Drag to Select Setup ───────────────────────────────────────────────
  const selectedIdsRef = useRef<string[]>([]);
  useEffect(() => { selectedIdsRef.current = selectedIds; }, [selectedIds]);

  const threadHeightRef = useRef(0);
  const isDragSelectingRef = useRef(false);
  const scrollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const dragPivotIdRef = useRef<string | null>(null);
  const dragInitialIdsRef = useRef<Set<string>>(new Set());

  const selectionPanResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponderCapture: () => false,
    onMoveShouldSetPanResponderCapture: (evt, gestureState) => {
      if (isDragSelectLockedRef.current && Math.abs(gestureState.dy) > 8) {
        return true;
      }
      return false;
    },
    onPanResponderGrant: () => {
      isDragSelectingRef.current = true;
      dragPivotIdRef.current = null;
      dragInitialIdsRef.current = new Set(selectedIdsRef.current);
    },
    onPanResponderMove: (evt, gestureState) => {
      const topOffset = insets.top + 58 + (searchOpen ? 52 : 0);
      const viewportY = gestureState.moveY - topOffset;
      const contentY = viewportY + scrollMetricsRef.current.y;

      let targetId: string | null = null;
      for (const [id, layout] of Object.entries(messageLayoutsRef.current)) {
        if (contentY >= layout.y && contentY <= layout.y + layout.h) {
          if (messageMap[id]?.message_kind !== "system") {
            targetId = id;
            break;
          }
        }
      }

      if (targetId) {
        if (!dragPivotIdRef.current) {
          dragPivotIdRef.current = targetId;
          dragInitialIdsRef.current.add(targetId);
        }

        const pivotLayout = messageLayoutsRef.current[dragPivotIdRef.current];
        const targetLayout = messageLayoutsRef.current[targetId];

        if (pivotLayout && targetLayout) {
          const minY = Math.min(pivotLayout.y, targetLayout.y);
          const maxY = Math.max(pivotLayout.y, targetLayout.y);

          const dragRangeIds = new Set<string>();
          for (const [id, layout] of Object.entries(messageLayoutsRef.current)) {
            if (layout.y >= minY && layout.y <= maxY) {
              if (messageMap[id]?.message_kind !== "system") {
                dragRangeIds.add(id);
              }
            }
          }

          const nextSelectedSet = new Set(dragInitialIdsRef.current);
          for (const id of dragRangeIds) {
            nextSelectedSet.add(id);
          }

          let changed = false;
          if (nextSelectedSet.size !== selectedIdsRef.current.length) {
            changed = true;
          } else {
            for (const id of selectedIdsRef.current) {
              if (!nextSelectedSet.has(id)) {
                changed = true;
                break;
              }
            }
          }

          if (changed) {
            setSelectedIds(Array.from(nextSelectedSet));
          }
        }
      }

      if (viewportY < 50) {
        if (!scrollTimerRef.current) {
          scrollTimerRef.current = setInterval(() => {
            scrollRef.current?.scrollTo({ y: Math.max(0, scrollMetricsRef.current.y - 25), animated: false });
          }, 16);
        }
      } else if (viewportY > threadHeightRef.current - 50) {
        if (!scrollTimerRef.current) {
          scrollTimerRef.current = setInterval(() => {
            scrollRef.current?.scrollTo({ y: scrollMetricsRef.current.y + 25, animated: false });
          }, 16);
        }
      } else {
        if (scrollTimerRef.current) {
          clearInterval(scrollTimerRef.current);
          scrollTimerRef.current = null;
        }
      }
    },
    onPanResponderRelease: () => {
      isDragSelectingRef.current = false;
      setIsDragSelectLocked(false);
      if (scrollTimerRef.current) {
        clearInterval(scrollTimerRef.current);
        scrollTimerRef.current = null;
      }
    },
    onPanResponderTerminate: () => {
      isDragSelectingRef.current = false;
      setIsDragSelectLocked(false);
      if (scrollTimerRef.current) {
        clearInterval(scrollTimerRef.current);
        scrollTimerRef.current = null;
      }
    }
  }), [insets.top, searchOpen, messageMap]);


  // ── 4. Render ──────────────────────────────────────────────────────────
  if (activeSubScreen === "addMembers") return <ChatAddMembersScreen chat={chat} onBack={() => setActiveSubScreen(null)} />;
  if (activeSubScreen === "media") return <ChatMediaScreen chat={chat} onBack={() => setActiveSubScreen(null)} />;
  if (activeSubScreen === "disappearing") return <ChatDisappearingMessagesScreen onBack={() => setActiveSubScreen(null)} />;
  if (activeSubScreen === "theme") return <ChatThemeScreen chat={chat} onBack={() => setActiveSubScreen(null)} />;
  if (activeSubScreen === "createPoll") return <CreatePollScreen chat={chat} onBack={() => setActiveSubScreen(null)} />;
  if (activeSubScreen === "pollVotes" && viewPollVotesMessage) return <ChatPollVotesScreen message={viewPollVotesMessage} reactions={reactionsByMessage ? reactionsByMessage[viewPollVotesMessage.id] : undefined} currentUserId={profile?.id || ""} onBack={() => setActiveSubScreen(null)} />;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.chatBackdrop }}
      onLayout={(e) => {
        const h = e.nativeEvent.layout.height;
        viewHeightRef.current = h;
        rootViewHeightRef.current = h; // keep ref in sync for use in keyboard callbacks
        setRootViewHeight(h);           // triggers re-renders if needed
        if (h > maxViewHeightRef.current) maxViewHeightRef.current = h;
        // Only update pre-keyboard baseline when keyboard is NOT open.
        // This makes the baseline orientation-safe: portrait ↔ landscape switches
        // correctly update the reference height for the NEXT keyboard open event.
        if (!isKeyboardOpenRef.current) {
          preKeyboardHeightRef.current = h;
        }
      }}
      onStartShouldSetResponderCapture={(e) => {
        if (showReactionsForId) {
          if (!pickerLayout) { setShowReactionsForId(null); return false; }
          const { pageX, pageY } = e.nativeEvent;
          const { x, y, width: w, height: h } = pickerLayout;
          if (pageX < x - 30 || pageX > x + w + 30 || pageY < y - 30 || pageY > y + h + 30) setShowReactionsForId(null);
        }
        return false;
      }}>
      <ChatBackground colorScheme={colorScheme} />
      <SafeAreaView edges={["top"]} style={{ backgroundColor: theme.colors.header, zIndex: 10 }}>
        <ChatHeader
          chat={chat} theme={theme} styles={styles} isSelectionMode={selectedIds && selectedIds.length > 0}
          selectedIds={selectedIds} savedMessageIds={savedMessageIds} chatMuted={isChatMuted(muteSettings && chat && muteSettings[chat.id])}
          muteSetting={muteSettings && chat && muteSettings[chat.id]} groupSubtitle={groupSubtitle} chatLocked={chatPreferences && chat && chatPreferences[chat.id]?.locked}
          onBack={() => selectedIds.length ? setSelectedIds([]) : onBack()} onOpenChatSettings={() => onOpenChatSettings()}
          onReplyToSelected={() => { const m = messageMap[selectedIds[0]]; if (m) setReplyTo(m); setSelectedIds([]); }}
          onToggleStarSelected={async () => {
            const allStarred = selectedIds.every(id => savedMessageIds.has(id));
            const key = `saved-messages:${profile?.id ?? "guest"}`;
            const raw = await AsyncStorage.getItem(key);
            let saved: any[] = raw ? JSON.parse(raw) : [];
            if (allStarred) {
              saved = saved.filter(m => !selectedIds.includes(m.id));
            } else {
              const toAdd = selectedIds.map(id => messageMap[id]).filter(Boolean).map(m => ({
                id: m!.id,
                body: m!.body_ciphertext,
                created_at: m!.created_at,
                source_chat_title: chat.title,
                chat_id: chat.id
              }));
              saved = [...saved, ...toAdd];
            }
            await AsyncStorage.setItem(key, JSON.stringify(saved));
            setSavedMessageIds(new Set(saved.map(m => m.id)));
            setSelectedIds([]);
            showToast(allStarred ? "הוסר מההודעות השמורות" : "נשמר בהודעות השמורות");
          }}
          onDeleteSelected={() => setShowDeleteModal(true)}
          onForwardSelected={() => { onForward?.(selectedIds.map(id => messageMap[id]).filter(Boolean)); setSelectedIds([]); }}
          onShowSelectionOverflow={() => setShowSelectionOverflowMenu(true)}
          onShowOverflowMenu={() => setShowOverflowMenu(true)}
          decoyMode={decoyMode}
        />
      </SafeAreaView>

      <SafeAreaView edges={["left", "right"]} style={{ flex: 1, backgroundColor: 'transparent' }}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }} enabled={Platform.OS === "ios"}>
          <View style={{ flex: 1 }}>
            {searchOpen && (
              <View style={styles.searchBar}>
                <Feather color={theme.colors.textMuted} name="search" size={16} />
                <TextInput onChangeText={setSearchQuery} placeholder="חיפוש בצ'אט" placeholderTextColor={theme.colors.textMuted} style={[styles.searchInput, webEmbeddedInputReset]} value={searchQuery} />
                <Pressable onPress={() => { setSearchOpen(false); setSearchQuery(""); }}><Feather color={theme.colors.textMuted} name="x" size={18} /></Pressable>
              </View>
            )}

            <View style={{ flex: 1 }}>
              <Animated.View
                ref={threadContainerRef}
                style={[styles.thread, { opacity: fadeAnim }]}
                {...selectionPanResponder.panHandlers}
                onLayout={(e) => {
                  threadHeightRef.current = e.nativeEvent.layout.height;
                }}
              >
                <ScrollView ref={scrollRef} scrollEnabled={!isDragSelectLocked} contentContainerStyle={[styles.scrollContent, webDefaultCursor]} showsVerticalScrollIndicator={false} scrollEventThrottle={16}
                  // Initial offset to bottom to reduce jump
                  contentOffset={{ x: 0, y: 10000 }}
                  onLayout={(e) => { scrollMetricsRef.current.height = e.nativeEvent.layout.height; checkVisibility(); }}
                  onContentSizeChange={(w, h) => scrollMetricsRef.current.contentHeight = h}
                  onScroll={(e) => {
                    const y = e.nativeEvent.contentOffset.y;
                    const h = e.nativeEvent.layoutMeasurement.height || scrollMetricsRef.current.height;
                    const ch = e.nativeEvent.contentSize.height || scrollMetricsRef.current.contentHeight;
                    scrollMetricsRef.current.y = y;
                    scrollMetricsRef.current.height = h;
                    scrollMetricsRef.current.contentHeight = ch;

                    // Show the button when we are more than 200px away from the bottom.
                    const distFromBottom = ch - (y + h);
                    const shouldShow = distFromBottom > 200;
                    if (shouldShow !== showScrollToBottomRef.current) {
                      showScrollToBottomRef.current = shouldShow;
                      setShowScrollToBottom(shouldShow);
                    }
                  }}
                  onScrollBeginDrag={() => { if (showReactionsForId) setShowReactionsForId(null); }}
                  onMomentumScrollEnd={() => checkVisibility()} onScrollEndDrag={() => checkVisibility()}
                >
                  <Pressable style={[{ flexGrow: 1 }, webDefaultCursor]} onPress={() => { if (showReactionsForId) setShowReactionsForId(null); }}>
                    {groupedMessages.map((item, idx) => {
                      if (item.type === "date") return <View key={`date-${idx}`} style={styles.dateSeparator}><View style={styles.datePill}><Text style={styles.datePillText}>{item.dateLabel}</Text></View></View>;
                      if (item.type === "unread") return <View key={`unread-${idx}`} style={styles.unreadSeparator}><View style={styles.unreadPill}><Text style={styles.unreadPillText}>{item.unreadCount === 1 ? "1 הודעה שלא נקראה" : `${item.unreadCount} הודעות שלא נקראו`}</Text></View></View>;
                      const msg = item.message;
                      return (
                        <View key={msg.id} onLayout={(e) => messageLayoutsRef.current[msg.id] = { y: e.nativeEvent.layout.y, h: e.nativeEvent.layout.height }} style={highlightedMessageId === msg.id ? { backgroundColor: theme.colors.selectionModeBackground } : undefined}>
                          <MessageBubble author={profiles && profiles[msg.sender_id]} currentUserId={profile?.id ?? ""} message={msg} onReply={setReplyTo} onRevealViewOnce={() => {
                            if (revealTimeoutRef.current) clearTimeout(revealTimeoutRef.current);
                            setRevealedMessageId(msg.id);
                            revealTimeoutRef.current = setTimeout(() => { void openViewOnceMessage(msg); setRevealedMessageId(c => c === msg.id ? null : c); }, 5000);
                          }} onToggleReaction={(e) => handleToggleReaction(msg.id, e)} onToggleSelection={(id) => setSelectedIds((current) => current.includes(id) ? current.filter(x => x !== id) : [...current, id])} onShowReactions={setShowReactionsForId} onShowReactionsSheet={setShowReactionsSheetForId} onPlusExtra={setShowEmojiPickerForId}
                            reactions={reactionsByMessage && reactionsByMessage[msg.id]} isSelected={selectedIds.includes(msg.id)} isSelectionMode={selectedIds.length > 0} showReactions={showReactionsForId === msg.id} onReportPickerLayout={setPickerLayout} isSaved={savedMessageIds.has(msg.id)}
                            onOpenPollVotes={(id) => { setViewPollVotesMessage(messageMap[id]); setActiveSubScreen("pollVotes"); }}
                            onInitiateDragSelect={() => setIsDragSelectLocked(true)}
                            onAvatarPress={(author) => setSelectedAvatarMember(author)}
                            replyToText={msg.reply_to_id ? messageMap[msg.reply_to_id]?.body_preview : null}
                            replyToName={(() => {
                              if (!msg.reply_to_id) return null;
                              const original = messageMap?.[msg.reply_to_id];
                              if (!original) return "תגובה";
                              const authorId = original.sender_id;
                              if (!authorId) return "תגובה";
                              return contactNicknames?.[authorId]?.first_name || profiles?.[authorId]?.full_name || profiles?.[authorId]?.username || "משתתף/ת";
                            })()}
                            viewOnceState={msg.message_kind === "view_once" && msg.sender_id !== profile?.id ? (revealedMessageId === msg.id ? "revealed" : openedViewOnceIds[msg.id] ? "opened" : "hidden") : undefined} />
                        </View>
                      );
                    })}
                  </Pressable>
                </ScrollView>

                {showScrollToBottom && (
                  <Pressable
                    onPress={() => scrollToBottom(true)}
                    style={{
                      position: "absolute",
                      right: 16,
                      bottom: 16,
                      width: 42,
                      height: 42,
                      borderRadius: 21,
                      backgroundColor: theme.colors.surfaceAlt || "#202c33",
                      justifyContent: "center",
                      alignItems: "center",
                      elevation: 8,
                      shadowColor: "#000",
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.35,
                      shadowRadius: 5,
                      zIndex: 50,
                    }}
                  >
                    <Feather name="chevron-down" size={24} color={theme.colors.textMuted} />
                    {((unreadCounts && chat && unreadCounts[chat.id]) || 0) > 0 && (
                      <View style={{
                        position: "absolute",
                        top: -4,
                        right: -4,
                        backgroundColor: "#00A884",
                        borderRadius: 10,
                        minWidth: 20,
                        height: 20,
                        justifyContent: "center",
                        alignItems: "center",
                        paddingHorizontal: 4,
                      }}>
                        <Text style={{
                          color: "#fff",
                          fontSize: 12,
                          fontWeight: "700",
                        }}>
                          {(unreadCounts && chat && unreadCounts[chat.id]) || 0}
                        </Text>
                      </View>
                    )}
                  </Pressable>
                )}
              </Animated.View>
            </View>
          </View>
          {/* Composer — always visible for members (decoy users can still send real messages) */}
          {(isMember || decoyMode) && (
            <Animated.View style={{ paddingBottom: keyboardHeightAnim }}>
              <View
                ref={composerWrapperRef}
                onLayout={(e) =>
                  console.log(`[KB-DEBUG] composerWrapper onLayout: height=${e.nativeEvent.layout.height.toFixed(1)}`)
                }
                style={{ paddingBottom: (showEmojiKeyboard || keyboardHeight > 0) ? 16 : insets.bottom }}
              >
                <MessageComposer
                  onInputFocus={() => {
                    setShowReactionsForId(null);
                    if (showEmojiKeyboard) {
                      setTimeout(() => setShowEmojiKeyboard(false), 300);
                    }
                  }}
                  onCancelReply={() => setReplyTo(null)}
                  onSend={(body, kind, expireSeconds) => {
                    scrollToBottom(true);
                    setReplyTo(null);
                    if (decoyMode && profile?.id) {
                      // Decoy mode: write to chat_decoy_messages
                      void supabase
                        .from("chat_decoy_messages")
                        .insert([{ chat_id: chat.id, sender_id: profile.id, body, is_me: true }])
                        .select("id, body, is_me, created_at, sender_id")
                        .single()
                        .then(({ data }) => {
                          if (data) {
                            setDecoyDbMessages((prev) => [
                              ...prev,
                              {
                                id: `decoy-${data.id}`,
                                chat_id: chat.id,
                                sender_id: profile.id,
                                body_ciphertext: data.body,
                                body_preview: data.body,
                                message_kind: "standard" as const,
                                reply_to_id: null,
                                expires_at: null,
                                created_at: data.created_at,
                                deleted_at: null,
                              } as any,
                            ]);
                          }
                        });
                    } else {
                      // Real mode: send to real chat
                      void sendMessage({ chatId: chat.id, body, messageKind: kind, replyToId: replyTo?.id ?? null, expireSeconds });
                      // While decoy guard is active, also append to fake chat view (client-side)
                      if (isDecoyActive && profile?.id) {
                        setLocalDecoyMessages((prev) => [
                          ...prev,
                          {
                            id: `local-decoy-${Date.now()}`,
                            chat_id: chat.id,
                            sender_id: profile.id,
                            body_ciphertext: body,
                            body_preview: body,
                            message_kind: kind,
                            reply_to_id: replyTo?.id ?? null,
                            expires_at: null,
                            created_at: new Date().toISOString(),
                            deleted_at: null,
                          },
                        ]);
                      }
                    }
                  }}
                  replyToText={replyTo?.body_preview ?? null}
                  replyToName={(() => {
                    if (!replyTo) return null;
                    const authorId = replyTo.sender_id;
                    return contactNicknames[authorId]?.first_name || profiles[authorId]?.full_name || profiles[authorId]?.username || "משתתף/ת";
                  })()}
                  emojiKeyboardOpen={showEmojiKeyboard} focusTrigger={composerFocusTrigger} onAttachmentPress={() => setShowAttachmentMenu(true)}
                  onToggleEmojiKeyboard={() => { if (showEmojiKeyboard) setComposerFocusTrigger(n => n + 1); else { setShowEmojiKeyboard(true); Keyboard.dismiss(); } }} emojiEvent={composerEmojiEvent} />
              </View>
            </Animated.View>
          )}
        </KeyboardAvoidingView>

        {showEmojiKeyboard ? (
          <View style={{ height: recordedKeyboardHeight || 300, width: "100%" }}>
            <EmojiKeyboard height={recordedKeyboardHeight || 300} onEmojiSelected={(emoji) => setComposerEmojiEvent({ emoji, ts: Date.now() })} recents={emojiRecents} onRecentsUpdate={setEmojiRecents} bottomInset={insets.bottom} />
          </View>
        ) : null}
      </SafeAreaView>

      <ChatOverlayManager
        {...{
          chat, profile, profiles, theme, styles, showOverflowMenu, setShowOverflowMenu, showMoreMenu, setShowMoreMenu, showMuteMenu, setShowMuteMenu, showClearDialog, setShowClearDialog, showExportDialog, setShowExportDialog, showReportDialog, setShowReportDialog, showAttachmentMenu, setShowAttachmentMenu, showSelectionOverflowMenu, setShowSelectionOverflowMenu, showDeleteModal, setShowDeleteModal,
          muteSelection, setMuteSelection, clearSelection, setClearSelection, clearStarred, setClearStarred, reportExit, setReportExit, selectedIds, setSelectedIds, messageMap, viewInfoMessage, setViewInfoMessage, showReactionsSheetForId, setShowReactionsSheetForId, reactionsByMessage, contactNicknames, showEmojiPickerForId, setShowEmojiPickerForId, toastMessage, activeSubScreen, setActiveSubScreen, onOpenChatSettings, onCreateGroupWith, setChatMute, clearChatsLocally, showToast, toggleReaction, toggleSelection: (id) => setSelectedIds((current) => current.includes(id) ? current.filter(x => x !== id) : [...current, id]), requestScreenshotPermission, sendMessage, hasScreenshotPerm, myRequests, groupMembers, setSearchOpen,
          muteSetting: (muteSettings && chat) ? muteSettings[chat.id] : undefined,
          performDelete: async (everyone) => {
            if (decoyMode) {
              const rowIds = selectedIds.map(id => {
                const msg = decoyDbMessages.find(m => m.id === id);
                return (msg as any)?._decoy_row_id;
              }).filter(Boolean);
              if (rowIds.length > 0) {
                await supabase.from("chat_decoy_messages").delete().in("id", rowIds);
                setDecoyDbMessages((prev) => prev.filter((m) => !selectedIds.includes(m.id)));
              }
              setSelectedIds([]);
              setShowDeleteModal(false);
            } else {
              await deleteMessages(selectedIds, everyone);
              setSelectedIds([]);
              setShowDeleteModal(false);
            }
          },
          keyboardHeight: showEmojiKeyboard ? (recordedKeyboardHeight || 300) : keyboardHeight,
          showDecoyManager, setShowDecoyManager,
          onSendSystemMessage: async (body: string) => {
            await sendMessage({ chatId: chat.id, body, messageKind: "system" });
          },
          decoyMode,
        }}
      />

      <ChatMemberActionModal
        visible={!!selectedAvatarMember}
        onClose={() => setSelectedAvatarMember(null)}
        member={selectedAvatarMember}
        nickname={selectedAvatarMember ? contactNicknames?.[selectedAvatarMember.id]?.first_name : undefined}
        onMessage={handleMemberAction}
        onDetails={handleDetailsAction}
        onSetAdmin={profile?.id === chat.created_by ? handleSetAdmin : undefined}
        onRemove={profile?.id === chat.created_by ? handleRemoveMember : undefined}
      />

      {screenshotHold && (
        <View style={{ ...StyleSheet.absoluteFillObject, zIndex: 999999, top: -100, bottom: -100 }}>
          {/* Shutter effect - quick flash */}
          <View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: "#fff" }} />

          {/* Result is black */}
          <View style={{
            ...StyleSheet.absoluteFillObject,
            backgroundColor: "#000",
            opacity: 0.98,
            justifyContent: "center",
            alignItems: "center"
          }}>
            <MaterialCommunityIcons name="camera-off" size={64} color="#ffffff" style={{ opacity: 0.7, marginBottom: 20 }} />
            <Text style={{ color: "#fff", fontSize: 18, fontWeight: "700", textAlign: "center" }}>צילום מסך נחסם</Text>
            <Text style={{ color: "#fff", fontSize: 14, marginTop: 8, opacity: 0.6, width: "70%", textAlign: "center" }}>
              המסך מושחר בעת הניסיון לצלם את הצ'אט מבלי לקבל הרשאה.
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}
