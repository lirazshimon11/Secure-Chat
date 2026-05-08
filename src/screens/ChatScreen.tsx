import { PropsWithChildren, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Alert, AppState, Pressable, ScrollView, Text, TextInput, View, useColorScheme, KeyboardAvoidingView, Platform, Keyboard, StyleSheet, PanResponder, Easing, useWindowDimensions } from "react-native";
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
import { Chat, ChatSecuritySettings, Message, Profile } from "@/lib/types";
import { webEmbeddedInputReset, webDefaultCursor, webSystemFont } from "@/lib/webStyles";
import { supabase } from "@/lib/supabase";
import { CHAT_SECURITY_SETTINGS_EVENT, DEFAULT_CHAT_SECURITY_SETTINGS, fetchChatSecuritySettings } from "@/lib/chatSecuritySettings";
import { useMessages, useMessagesSubscription, useSendMessage } from "@/hooks/useChatMessages";

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
import { ChatLeakShield, chatLeakShieldStyles } from "./chat/ChatLeakShield";

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
  const { width } = useWindowDimensions();
  const theme = useAppTheme();
  const colorScheme = useColorScheme();
  const styles = useMemo(() => createStyles(theme, insets), [theme, insets]);
  const { profile } = useAuth();
  const [initialUnreadCount, setInitialUnreadCount] = useState<number>(0);
  const [initialUnreadStartIndex, setInitialUnreadStartIndex] = useState<number>(-1);

  const {
    loadMessages, markChatSeen, refreshChats, unreadCounts, messagesByChat, profiles, chats,
    contactNicknames, reactionsByMessage, openedViewOnceIds, muteSettings,
    chatPreferences, setChatMute, clearChatMute, openViewOnceMessage,
    toggleReaction, deleteMessages, loadChatMembers, clearChatsLocally, isCurrentMember,
    createChat, setChatMemberRole, removeChatMember
  } = useChats();

  const {
    messages: cachedMessages,
    fetchNextPage: fetchNextMessagesPage,
    hasNextPage: hasOlderMessages,
    isFetchingNextPage: isFetchingOlderMessages,
  } = useMessages(chat.id, !decoyMode);
  const sendMessageMutation = useSendMessage();
  useMessagesSubscription(chat.id, profile?.id, !decoyMode);

  const sendCachedMessage = useCallback(async (input: { chatId: string; body: string; messageKind: Message["message_kind"]; replyToId?: string | null; expireSeconds?: number | null }) => {
    if (!profile?.id || !input.body.trim()) return "Message empty.";

    try {
      await sendMessageMutation.sendMessageAsync({
        chatId: input.chatId,
        senderId: profile.id,
        body: input.body,
        messageKind: input.messageKind,
        replyToId: input.replyToId,
        expireSeconds: input.expireSeconds,
      });
      void refreshChats(true);
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : "Could not send message.";
    }
  }, [profile?.id, refreshChats, sendMessageMutation]);

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
    const allMessages = cachedMessages.length ? cachedMessages : ((messagesByChat && chat && messagesByChat[chat.id]) ?? []);
    const prefs = chatPreferences && chat && chatPreferences[chat.id];
    const clearedAt = prefs?.cleared_at;
    if (!clearedAt) return allMessages;
    const clearedAtMs = new Date(clearedAt).getTime();
    return allMessages.filter((m) => new Date(m.created_at).getTime() > clearedAtMs);
  }, [cachedMessages, decoyMode, decoyDbMessages, chat?.id, chatPreferences, messagesByChat]);

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

  // Sync showEmojiPickerForId with the bottom keyboard
  useEffect(() => {
    if (showEmojiPickerForId) {
      // If we are opening the emoji picker for a reaction, show the bottom keyboard
      setShowEmojiKeyboard(true);
      Keyboard.dismiss();
    }
  }, [showEmojiPickerForId]);
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
  const [securitySettings, setSecuritySettings] = useState<ChatSecuritySettings>(DEFAULT_CHAT_SECURITY_SETTINGS);
  const [viewPollVotesMessage, setViewPollVotesMessage] = useState<Message | null>(null);
  const [isRevealingChat, setIsRevealingChat] = useState(false);
  const isRevealingChatRef = useRef(false);
  useEffect(() => { isRevealingChatRef.current = isRevealingChat; }, [isRevealingChat]);
  const [touchDebugPoints, setTouchDebugPoints] = useState<Array<{ id: number; x: number; y: number; target: string }>>([]);
  const [securityBlackout, setSecurityBlackout] = useState(false);
  const [fakeScreenshotWarning, setFakeScreenshotWarning] = useState(false);
  const [identityMagnetPoint, setIdentityMagnetPoint] = useState({ x: 214, y: 320 });
  const suspiciousInputUntilRef = useRef(0);
  const warningTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blackoutTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
  const highlightAnim = useRef(new Animated.Value(0)).current;
  const initialScrollDone = useRef(false);
  const pendingSelfSendScrollRef = useRef(false);
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

  const scrollToBottomAfterSelfSend = () => {
    pendingSelfSendScrollRef.current = true;
    setShowScrollToBottom(false);
    showScrollToBottomRef.current = false;
    scrollToBottom(true);
    setTimeout(() => scrollToBottom(true), 80);
    setTimeout(() => scrollToBottom(true), 220);
  };

  const scrollToMessageWithRetry = (msgId: string, highlight = true, attempts = 6) => {
    const layout = messageLayoutsRef.current[msgId];
    const y = layout?.y;
    if (y !== undefined) {
      scrollRef.current?.scrollTo({ y: Math.max(0, y - 120), animated: true });
      if (highlight) {
        highlightAnim.setValue(1);
        setHighlightedMessageId(msgId);
        // Fade out after 1.2s over 0.8s
        setTimeout(() => {
          Animated.timing(highlightAnim, {
            toValue: 0,
            duration: 800,
            useNativeDriver: false,
          }).start(() => setHighlightedMessageId(null));
        }, 1200);
      }
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
    useChatPermissions(chat, groupMembers, (p) => sendCachedMessage(p), activeSubScreen !== null);

  useEffect(() => {
    let active = true;
    const reloadSettings = () => {
      void fetchChatSecuritySettings(chat.id).then((next) => {
        if (active) setSecuritySettings(next);
      });
    };
    const handleLocalSettingsChange = (event: Event) => {
      const detail = (event as CustomEvent<{ chatId: string; settings: ChatSecuritySettings }>).detail;
      if (detail?.chatId === chat.id) {
        setSecuritySettings({ ...DEFAULT_CHAT_SECURITY_SETTINGS, ...detail.settings });
      }
    };

    void fetchChatSecuritySettings(chat.id).then((next) => {
      if (active) setSecuritySettings(next);
    });

    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.addEventListener(CHAT_SECURITY_SETTINGS_EVENT, handleLocalSettingsChange);
      window.addEventListener("focus", reloadSettings);
    }

    const channel = supabase
      .channel(`chat-security-settings:${chat.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_security_settings", filter: `chat_id=eq.${chat.id}` },
        (payload) => {
          const next = payload.new as Partial<ChatSecuritySettings> | null;
          if (next) {
            setSecuritySettings({ ...DEFAULT_CHAT_SECURITY_SETTINGS, ...next });
          }
        },
      )
      .subscribe();

    return () => {
      active = false;
      if (Platform.OS === "web" && typeof window !== "undefined") {
        window.removeEventListener(CHAT_SECURITY_SETTINGS_EVENT, handleLocalSettingsChange);
        window.removeEventListener("focus", reloadSettings);
      }
      void supabase.removeChannel(channel);
    };
  }, [chat.id]);

  const triggerSecurityBlackout = useCallback((showWarning: boolean) => {
    if (!securitySettings.app_switcher_blackout && !(showWarning && securitySettings.fake_screenshot_warning)) {
      return;
    }
    if (securitySettings.app_switcher_blackout) {
      setSecurityBlackout(true);
      if (blackoutTimeoutRef.current) clearTimeout(blackoutTimeoutRef.current);
      blackoutTimeoutRef.current = setTimeout(() => setSecurityBlackout(false), 1400);
    }

    if (showWarning && securitySettings.fake_screenshot_warning) {
      setFakeScreenshotWarning(true);
      if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
      warningTimeoutRef.current = setTimeout(() => setFakeScreenshotWarning(false), 3600);
    }
  }, [securitySettings.app_switcher_blackout, securitySettings.fake_screenshot_warning]);

  const markSuspiciousInput = useCallback(() => {
    suspiciousInputUntilRef.current = Date.now() + 700;
  }, []);

  const updateIdentityMagnet = useCallback((event: any) => {
    const nativeEvent = event?.nativeEvent;
    const touch = nativeEvent?.touches?.[1] || nativeEvent?.touches?.[0] || nativeEvent;
    const x = touch?.locationX ?? touch?.pageX;
    const y = touch?.locationY ?? touch?.pageY;
    if (typeof x === "number" && typeof y === "number") {
      setIdentityMagnetPoint({ x, y });
    }

    if ((nativeEvent?.touches?.length ?? 0) > 1) {
      markSuspiciousInput();
    }
  }, [markSuspiciousInput]);

  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined" || typeof document === "undefined") return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const isScreenshotShortcut =
        event.key === "PrintScreen" ||
        ((event.metaKey || event.ctrlKey) && event.shiftKey && ["3", "4", "5", "s"].includes(key));

      if (isScreenshotShortcut) {
        markSuspiciousInput();
        triggerSecurityBlackout(true);
      }
    };

    const handleFocus = () => {
      setSecurityBlackout(false);
      setFakeScreenshotWarning(false);
      suspiciousInputUntilRef.current = 0;
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        triggerSecurityBlackout(Date.now() < suspiciousInputUntilRef.current);
        return;
      }
      handleFocus();
    };

    window.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("focus", handleFocus, true);
    document.addEventListener("visibilitychange", handleVisibilityChange, true);

    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("focus", handleFocus, true);
      document.removeEventListener("visibilitychange", handleVisibilityChange, true);
    };
  }, [markSuspiciousInput, triggerSecurityBlackout]);

  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;

    const targetLabel = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return "unknown";
      if (target.closest("[data-secure-reveal-button='true']")) return "eye";
      if (target.closest("[data-chat-action]")) {
        return `header:${target.closest("[data-chat-action]")?.getAttribute("data-chat-action") ?? "action"}`;
      }
      if (target.closest("[data-message-id]")) return "message";
      if (target.closest("input, textarea")) return "input";
      return target.tagName.toLowerCase();
    };

    const updateTouches = (event: TouchEvent) => {
      setTouchDebugPoints(
        Array.from(event.touches).map((touch, index) => {
          const element = document.elementFromPoint(touch.clientX, touch.clientY);
          return {
            id: touch.identifier,
            x: Math.round(touch.clientX),
            y: Math.round(touch.clientY),
            target: targetLabel(element),
          };
        }),
      );
    };

    const clearTouches = (event: TouchEvent) => {
      if (event.touches.length) {
        updateTouches(event);
      } else {
        setTouchDebugPoints([]);
      }
    };

    document.addEventListener("touchstart", updateTouches, { capture: true, passive: true });
    document.addEventListener("touchmove", updateTouches, { capture: true, passive: true });
    document.addEventListener("touchend", clearTouches, { capture: true, passive: true });
    document.addEventListener("touchcancel", clearTouches, { capture: true, passive: true });

    return () => {
      document.removeEventListener("touchstart", updateTouches, { capture: true } as any);
      document.removeEventListener("touchmove", updateTouches, { capture: true } as any);
      document.removeEventListener("touchend", clearTouches, { capture: true } as any);
      document.removeEventListener("touchcancel", clearTouches, { capture: true } as any);
    };
  }, []);

  useEffect(() => {
    setSecurityBlackout(false);
    setFakeScreenshotWarning(false);
    suspiciousInputUntilRef.current = 0;
  }, [activeSubScreen]);

  useEffect(() => {
    if (Platform.OS === "web") return;
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState !== "active") {
        triggerSecurityBlackout(Date.now() < suspiciousInputUntilRef.current);
      }
    });
    return () => subscription.remove();
  }, [triggerSecurityBlackout]);

  useEffect(() => () => {
    if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
    if (blackoutTimeoutRef.current) clearTimeout(blackoutTimeoutRef.current);
  }, []);

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
          toValue: kh, // iOS KAV handles insets differently, usually kh is enough
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
        // On Android, especially tablets, rawKbHeight might be reported 
        // relative to the navigation bar. Since we draw behind it, we need to add it.
        const targetValue = kh + insets.bottom;

        console.log(`[KB-DEBUG] keyboardDidShow: rawKbHeight=${kh}, insets.bottom=${insets.bottom}, target=${targetValue}`);
        setRecordedKeyboardHeight(kh);
        setKeyboardHeight(kh);
        isKeyboardOpenRef.current = true;
        setShowEmojiKeyboard(false);

        Animated.timing(keyboardHeightAnim, {
          toValue: targetValue,
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
    if (lastMsg.sender_id === profile?.id) {
      pendingSelfSendScrollRef.current = false;
      scrollToBottom(true);
    } else if (lastMsg.message_kind === "system") {
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

  // ── Drag to Select Setup ───────────────────────────────────────────────
  const selectedIdsRef = useRef<string[]>([]);
  useEffect(() => { selectedIdsRef.current = selectedIds; }, [selectedIds]);

  const threadHeightRef = useRef(0);
  const isDragSelectingRef = useRef(false);
  const scrollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastDragPageYRef = useRef<number | null>(null);

  const dragPivotIdRef = useRef<string | null>(null);
  const dragInitialIdsRef = useRef<Set<string>>(new Set());

  const stopDragSelect = useCallback(() => {
    isDragSelectingRef.current = false;
    lastDragPageYRef.current = null;
    setIsDragSelectLocked(false);
    if (scrollTimerRef.current) {
      clearInterval(scrollTimerRef.current);
      scrollTimerRef.current = null;
    }
  }, []);

  const updateDragSelection = useCallback((pageY: number) => {
    const topOffset = insets.top + 58 + (searchOpen ? 52 : 0);
    const viewportY = pageY - topOffset;
    const contentY = viewportY + scrollMetricsRef.current.y;
    lastDragPageYRef.current = pageY;

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

    const edgeSize = 50;
    if (viewportY < edgeSize || viewportY > threadHeightRef.current - edgeSize) {
      if (!scrollTimerRef.current) {
        scrollTimerRef.current = setInterval(() => {
          const lastPageY = lastDragPageYRef.current;
          if (lastPageY === null) return;

          const currentViewportY = lastPageY - topOffset;
          const direction = currentViewportY < edgeSize ? -1 : 1;
          const nextY = Math.max(0, scrollMetricsRef.current.y + direction * 25);
          scrollMetricsRef.current.y = nextY;
          scrollRef.current?.scrollTo({ y: nextY, animated: false });
          updateDragSelection(lastPageY);
        }, 16);
      }
    } else if (scrollTimerRef.current) {
      clearInterval(scrollTimerRef.current);
      scrollTimerRef.current = null;
    }
  }, [insets.top, messageMap, searchOpen]);

  const beginDragSelect = useCallback((pageY: number) => {
    if (!isDragSelectingRef.current) {
      isDragSelectingRef.current = true;
      dragPivotIdRef.current = null;
      dragInitialIdsRef.current = new Set(selectedIdsRef.current);
    }
    updateDragSelection(pageY);
  }, [updateDragSelection]);

  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;

    type OperationalTouch = {
      id: number;
      startX: number;
      startY: number;
      lastY: number;
      messageId: string | null;
      chatAction: string | null;
      downTarget: HTMLElement | null;
      longPressed: boolean;
      moved: boolean;
      timer: ReturnType<typeof setTimeout> | null;
    };

    const operationalTouchRef = { current: null as OperationalTouch | null };

    const getElementFromTouch = (touch: Touch) =>
      document.elementFromPoint(touch.clientX, touch.clientY) as HTMLElement | null;

    const findMessageId = (element: HTMLElement | null) =>
      element?.closest?.("[data-message-id]")?.getAttribute("data-message-id") ?? null;

    const findClickable = (element: HTMLElement | null) =>
      element?.closest?.("button,[role='button'],a,input,textarea") as HTMLElement | null;

    const findChatAction = (element: HTMLElement | null) =>
      element?.closest?.("[data-chat-action]")?.getAttribute("data-chat-action") ?? null;

    const runChatAction = (action: string | null) => {
      if (!action) return false;
      switch (action) {
        case "back":
          if (selectedIdsRef.current.length) setSelectedIds([]);
          else onBack();
          return true;
        case "settings":
          onOpenChatSettings();
          return true;
        case "reply-selected": {
          const selected = selectedIdsRef.current[0];
          const message = selected ? messageMap[selected] : null;
          if (message) setReplyTo(message);
          setSelectedIds([]);
          return true;
        }
        case "delete-selected":
          setShowDeleteModal(true);
          return true;
        case "forward-selected":
          onForward?.(selectedIdsRef.current.map((id) => messageMap[id]).filter(Boolean));
          setSelectedIds([]);
          return true;
        case "selection-overflow":
          setShowSelectionOverflowMenu(true);
          return true;
        case "overflow":
          setShowOverflowMenu(true);
          return true;
        default:
          return false;
      }
    };

    const dispatchTapSequence = (element: HTMLElement, touch: Touch) => {
      const primaryPointerId = 1;
      const commonPointer = {
        bubbles: true,
        cancelable: true,
        composed: true,
        pointerId: primaryPointerId,
        pointerType: "touch",
        isPrimary: true,
        clientX: touch.clientX,
        clientY: touch.clientY,
        screenX: touch.screenX,
        screenY: touch.screenY,
      };

      try {
        element.dispatchEvent(new PointerEvent("pointerdown", commonPointer));
        element.dispatchEvent(new PointerEvent("pointerup", commonPointer));
      } catch {
        // Older embedded WebViews can miss PointerEvent construction.
      }

      const commonMouse = {
        bubbles: true,
        cancelable: true,
        composed: true,
        clientX: touch.clientX,
        clientY: touch.clientY,
        screenX: touch.screenX,
        screenY: touch.screenY,
      };
      element.dispatchEvent(new MouseEvent("mousedown", commonMouse));
      element.dispatchEvent(new MouseEvent("mouseup", commonMouse));
      element.dispatchEvent(new MouseEvent("click", commonMouse));
    };

    const dispatchPrimaryTouchPointer = (element: HTMLElement | null, type: "pointerdown" | "pointermove" | "pointerup" | "pointercancel", touch: Touch) => {
      if (!element) return;
      try {
        element.dispatchEvent(
          new PointerEvent(type, {
            bubbles: true,
            cancelable: true,
            composed: true,
            pointerId: 1,
            pointerType: "touch",
            isPrimary: true,
            clientX: touch.clientX,
            clientY: touch.clientY,
            screenX: touch.screenX,
            screenY: touch.screenY,
          }),
        );
      } catch {
        // PointerEvent construction can be unavailable in older embedded webviews.
      }
    };

    const dispatchPrimaryMouse = (element: HTMLElement | null, type: "mousedown" | "mousemove" | "mouseup", touch: Touch) => {
      if (!element) return;
      element.dispatchEvent(
        new MouseEvent(type, {
          bubbles: true,
          cancelable: true,
          composed: true,
          clientX: touch.clientX,
          clientY: touch.clientY,
          screenX: touch.screenX,
          screenY: touch.screenY,
        }),
      );
    };

    const toggleSelection = (messageId: string) => {
      if (!messageMap[messageId] || messageMap[messageId].message_kind === "system") return;
      setSelectedIds((current) =>
        current.includes(messageId) ? current.filter((id) => id !== messageId) : [...current, messageId],
      );
    };

    const clearOperationalTimer = () => {
      if (operationalTouchRef.current?.timer) {
        clearTimeout(operationalTouchRef.current.timer);
        operationalTouchRef.current.timer = null;
      }
    };

    const shouldHandleTouch = (target: HTMLElement | null) => {
      if (!isRevealingChatRef.current) return false;
      if (target?.closest?.("[data-secure-reveal-button='true']")) return false;
      return true;
    };

    const handleTouchStart = (event: TouchEvent) => {
      if (operationalTouchRef.current) return;
      const touch = Array.from(event.changedTouches).find((candidate) => {
        const target = getElementFromTouch(candidate);
        return shouldHandleTouch(target);
      });
      if (!touch) return;

      const target = getElementFromTouch(touch);
      const messageId = findMessageId(target);
      const chatAction = findChatAction(target);
      const nextTouch: OperationalTouch = {
        id: touch.identifier,
        startX: touch.clientX,
        startY: touch.clientY,
        lastY: touch.clientY,
        messageId,
        chatAction,
        downTarget: target,
        longPressed: false,
        moved: false,
        timer: null,
      };

      if (messageId) {
        nextTouch.timer = setTimeout(() => {
          const current = operationalTouchRef.current;
          if (!current || current.id !== nextTouch.id || current.moved) return;
          current.longPressed = true;
          isDragSelectingRef.current = true;
          dragPivotIdRef.current = null;
          dragInitialIdsRef.current = new Set(selectedIdsRef.current);
          beginDragSelect(current.startY);
        }, 430);
      }

      operationalTouchRef.current = nextTouch;
      dispatchPrimaryTouchPointer(target, "pointerdown", touch);
      dispatchPrimaryMouse(target, "mousedown", touch);
      event.preventDefault();
      event.stopPropagation();
      (event as any).stopImmediatePropagation?.();
    };

    const handleTouchMove = (event: TouchEvent) => {
      const current = operationalTouchRef.current;
      if (!current) return;
      const touch = Array.from(event.changedTouches).find((candidate) => candidate.identifier === current.id);
      if (!touch) return;

      const deltaX = touch.clientX - current.startX;
      const deltaY = touch.clientY - current.startY;
      const movedEnough = Math.abs(deltaX) > 8 || Math.abs(deltaY) > 8;
      if (movedEnough) {
        current.moved = true;
      }

      setIdentityMagnetPoint({ x: touch.clientX, y: touch.clientY });
      const currentTarget = getElementFromTouch(touch);
      dispatchPrimaryTouchPointer(currentTarget || current.downTarget, "pointermove", touch);
      dispatchPrimaryMouse(currentTarget || current.downTarget, "mousemove", touch);

      if (current.longPressed) {
        beginDragSelect(touch.clientY);
      } else if (movedEnough) {
        clearOperationalTimer();
        const { y, height, contentHeight } = scrollMetricsRef.current;
        const maxY = Math.max(0, contentHeight - height);
        const nextY = Math.max(0, Math.min(maxY, y + current.lastY - touch.clientY));
        scrollMetricsRef.current.y = nextY;
        scrollRef.current?.scrollTo({ y: nextY, animated: false });
      }

      current.lastY = touch.clientY;
      event.preventDefault();
      event.stopPropagation();
      (event as any).stopImmediatePropagation?.();
    };

    const handleTouchEnd = (event: TouchEvent) => {
      const current = operationalTouchRef.current;
      if (!current) return;
      const touch = Array.from(event.changedTouches).find((candidate) => candidate.identifier === current.id);
      if (!touch) return;

      clearOperationalTimer();
      const target = getElementFromTouch(touch);
      const messageId = findMessageId(target) || current.messageId;
      let handled = current.moved;
      dispatchPrimaryTouchPointer(target || current.downTarget, "pointerup", touch);
      dispatchPrimaryMouse(target || current.downTarget, "mouseup", touch);

      if (!current.longPressed && !current.moved) {
        if (runChatAction(findChatAction(target) || current.chatAction)) {
          handled = true;
        } else if (messageId && selectedIdsRef.current.length > 0) {
          toggleSelection(messageId);
          handled = true;
        } else {
          const clickable = findClickable(target);
          if (clickable && !clickable.closest("[data-secure-reveal-button='true']")) {
            dispatchTapSequence(clickable, touch);
            clickable.click();
            handled = true;
          }
        }
      }

      if (current.longPressed) {
        stopDragSelect();
        handled = true;
      }

      operationalTouchRef.current = null;
      if (handled || current.chatAction) {
        event.preventDefault();
        event.stopPropagation();
        (event as any).stopImmediatePropagation?.();
      }
    };

    const handleTouchCancel = () => {
      clearOperationalTimer();
      const current = operationalTouchRef.current;
      if (current?.downTarget) {
        try {
          current.downTarget.dispatchEvent(new PointerEvent("pointercancel", { bubbles: true, cancelable: true, composed: true, pointerId: 1, pointerType: "touch", isPrimary: true }));
        } catch {
          // no-op
        }
      }
      operationalTouchRef.current = null;
      stopDragSelect();
    };

    document.addEventListener("touchstart", handleTouchStart, { capture: true, passive: false });
    document.addEventListener("touchmove", handleTouchMove, { capture: true, passive: false });
    document.addEventListener("touchend", handleTouchEnd, { capture: true, passive: false });
    document.addEventListener("touchcancel", handleTouchCancel, { capture: true, passive: false });

    return () => {
      clearOperationalTimer();
      document.removeEventListener("touchstart", handleTouchStart, { capture: true } as any);
      document.removeEventListener("touchmove", handleTouchMove, { capture: true } as any);
      document.removeEventListener("touchend", handleTouchEnd, { capture: true } as any);
      document.removeEventListener("touchcancel", handleTouchCancel, { capture: true } as any);
    };
  }, [beginDragSelect, messageMap, onBack, onForward, onOpenChatSettings, stopDragSelect]);

  const webDragHandlers = useMemo(() => {
    if (Platform.OS !== "web") return {};

    return {
      onPointerMove: (event: any) => {
        updateIdentityMagnet(event);
        if (!isDragSelectLockedRef.current && !isDragSelectingRef.current) return;
        if (event?.nativeEvent?.buttons !== undefined && event.nativeEvent.buttons !== 1) {
          stopDragSelect();
          return;
        }

        event?.preventDefault?.();
        beginDragSelect(event.nativeEvent.pageY);
      },
      onPointerUp: stopDragSelect,
      onPointerCancel: stopDragSelect,
      onPointerLeave: (event: any) => {
        if (isDragSelectingRef.current && event?.nativeEvent?.buttons !== 1) {
          stopDragSelect();
        }
      },
    } as any;
  }, [beginDragSelect, stopDragSelect, updateIdentityMagnet]);

  const selectionPanResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponderCapture: () => false,
    onMoveShouldSetPanResponderCapture: (evt, gestureState) => {
      // Improved threshold: Must move more than 25px vertically,
      // and the movement must be primarily vertical (dy > dx) to distinguish from scroll/swipes.
      if (isDragSelectLockedRef.current && 
          Math.abs(gestureState.dy) > 25 && 
          Math.abs(gestureState.dy) > Math.abs(gestureState.dx)) {
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
      updateDragSelection(gestureState.moveY);
    },
    onPanResponderRelease: stopDragSelect,
    onPanResponderTerminate: stopDragSelect,
  }), [beginDragSelect, stopDragSelect, updateDragSelection]);


  // ── 4. Render ──────────────────────────────────────────────────────────
  const closeActiveSubScreen = () => setActiveSubScreen(null);
  const slideDistance = Math.min(width, 430);
  const activeSubScreenContent = useMemo(() => {
    if (activeSubScreen === "addMembers") return <ChatAddMembersScreen chat={chat} onBack={closeActiveSubScreen} />;
    if (activeSubScreen === "media") return <ChatMediaScreen chat={chat} onBack={closeActiveSubScreen} />;
    if (activeSubScreen === "disappearing") return <ChatDisappearingMessagesScreen onBack={closeActiveSubScreen} />;
    if (activeSubScreen === "theme") return <ChatThemeScreen chat={chat} onBack={closeActiveSubScreen} />;
    if (activeSubScreen === "createPoll") return <CreatePollScreen chat={chat} onBack={closeActiveSubScreen} />;
    if (activeSubScreen === "pollVotes" && viewPollVotesMessage) {
      return (
        <ChatPollVotesScreen
          message={viewPollVotesMessage}
          reactions={reactionsByMessage ? reactionsByMessage[viewPollVotesMessage.id] : undefined}
          currentUserId={profile?.id || ""}
          onBack={closeActiveSubScreen}
        />
      );
    }
    return null;
  }, [activeSubScreen, chat, profile?.id, reactionsByMessage, viewPollVotesMessage]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.chatBackdrop, overflow: "hidden" }}
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
                style={[
                  styles.thread,
                  !securitySettings.require_hold_to_reveal || isRevealingChat
                    ? chatLeakShieldStyles.protectedThreadRevealed
                    : chatLeakShieldStyles.protectedThreadBlurred,
                ]}
                {...selectionPanResponder.panHandlers}
                {...webDragHandlers}
                onLayout={(e) => {
                  threadHeightRef.current = e.nativeEvent.layout.height;
                }}
              >
                <ScrollView ref={scrollRef} scrollEnabled={!isDragSelectLocked} keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.scrollContent, webDefaultCursor]} showsVerticalScrollIndicator={false} scrollEventThrottle={16}
                  onTouchStart={updateIdentityMagnet}
                  onTouchMove={updateIdentityMagnet}
                  // Initial offset to bottom to reduce jump
                  contentOffset={{ x: 0, y: 10000 }}
                  onLayout={(e) => { scrollMetricsRef.current.height = e.nativeEvent.layout.height; checkVisibility(); }}
                  onContentSizeChange={(w, h) => {
                    scrollMetricsRef.current.contentHeight = h;
                    if (pendingSelfSendScrollRef.current) {
                      scrollToBottom(true);
                    }
                  }}
                  onScroll={(e) => {
                    const y = e.nativeEvent.contentOffset.y;
                    const h = e.nativeEvent.layoutMeasurement.height || scrollMetricsRef.current.height;
                    const ch = e.nativeEvent.contentSize.height || scrollMetricsRef.current.contentHeight;
                    scrollMetricsRef.current.y = y;
                    scrollMetricsRef.current.height = h;
                    scrollMetricsRef.current.contentHeight = ch;

                    if (!decoyMode && y < 80 && hasOlderMessages && !isFetchingOlderMessages) {
                      void fetchNextMessagesPage();
                    }

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
                  <Pressable style={[{ flexGrow: 1 }, webDefaultCursor]} onPress={() => { 
                    if (showReactionsForId) setShowReactionsForId(null); 
                    if (showEmojiKeyboard) setShowEmojiKeyboard(false);
                    if (showEmojiPickerForId) setShowEmojiPickerForId(null);
                  }}>
                    {groupedMessages.map((item, idx) => {
                      if (item.type === "date") return <View key={`date-${idx}`} style={styles.dateSeparator}><View style={styles.datePill}><Text style={styles.datePillText}>{item.dateLabel}</Text></View></View>;
                      if (item.type === "unread") return <View key={`unread-${idx}`} style={styles.unreadSeparator}><View style={styles.unreadPill}><Text style={styles.unreadPillText}>{item.unreadCount === 1 ? "1 הודעה שלא נקראה" : `${item.unreadCount} הודעות שלא נקראו`}</Text></View></View>;
                      const msg = item.message;
                      return (
                        <View key={msg.id} onLayout={(e) => messageLayoutsRef.current[msg.id] = { y: e.nativeEvent.layout.y, h: e.nativeEvent.layout.height }}>
                          {highlightedMessageId === msg.id ? (
                            <Animated.View style={{ backgroundColor: highlightAnim.interpolate({ inputRange: [0, 1], outputRange: ['transparent', theme.colors.selectionModeBackground] }) }}>
                              <MessageBubble author={profiles && profiles[msg.sender_id]} currentUserId={profile?.id ?? ""} message={msg} onReply={setReplyTo} onScrollToReply={(replyToId) => { Keyboard.dismiss(); scrollToMessageWithRetry(replyToId, true); }}
                                onRevealViewOnce={() => {
                                  if (revealTimeoutRef.current) clearTimeout(revealTimeoutRef.current);
                                  setRevealedMessageId(msg.id);
                                  revealTimeoutRef.current = setTimeout(() => { void openViewOnceMessage(msg); setRevealedMessageId(c => c === msg.id ? null : c); }, 5000);
                                }} onToggleReaction={(e) => handleToggleReaction(msg.id, e)} onToggleSelection={(id) => setSelectedIds((current) => current.includes(id) ? current.filter(x => x !== id) : [...current, id])} onShowReactions={setShowReactionsForId} onShowReactionsSheet={setShowReactionsSheetForId} onPlusExtra={setShowEmojiPickerForId}
                                reactions={reactionsByMessage && reactionsByMessage[msg.id]} isSelected={selectedIds.includes(msg.id)} isSelectionMode={selectedIds.length > 0} showReactions={showReactionsForId === msg.id} onReportPickerLayout={setPickerLayout} isSaved={savedMessageIds.has(msg.id)}
                                onOpenPollVotes={(id) => { setViewPollVotesMessage(messageMap[id]); setActiveSubScreen("pollVotes"); }}
                                onInitiateDragSelect={() => {
                                  if (Platform.OS === "web") {
                                    isDragSelectingRef.current = true;
                                    dragPivotIdRef.current = null;
                                    dragInitialIdsRef.current = new Set(selectedIdsRef.current);
                                  } else {
                                    setIsDragSelectLocked(true);
                                  }
                                }}
                                renderSecureText={securitySettings.anti_copy_canvas}
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
                            </Animated.View>
                          ) : (
                            <MessageBubble author={profiles && profiles[msg.sender_id]} currentUserId={profile?.id ?? ""} message={msg} onReply={setReplyTo} onScrollToReply={(replyToId) => { Keyboard.dismiss(); scrollToMessageWithRetry(replyToId, true); }}
                              onRevealViewOnce={() => {
                                if (revealTimeoutRef.current) clearTimeout(revealTimeoutRef.current);
                                setRevealedMessageId(msg.id);
                                revealTimeoutRef.current = setTimeout(() => { void openViewOnceMessage(msg); setRevealedMessageId(c => c === msg.id ? null : c); }, 5000);
                              }} onToggleReaction={(e) => handleToggleReaction(msg.id, e)} onToggleSelection={(id) => setSelectedIds((current) => current.includes(id) ? current.filter(x => x !== id) : [...current, id])} onShowReactions={setShowReactionsForId} onShowReactionsSheet={setShowReactionsSheetForId} onPlusExtra={setShowEmojiPickerForId}
                              reactions={reactionsByMessage && reactionsByMessage[msg.id]} isSelected={selectedIds.includes(msg.id)} isSelectionMode={selectedIds.length > 0} showReactions={showReactionsForId === msg.id} onReportPickerLayout={setPickerLayout} isSaved={savedMessageIds.has(msg.id)}
                              onOpenPollVotes={(id) => { setViewPollVotesMessage(messageMap[id]); setActiveSubScreen("pollVotes"); }}
                              onInitiateDragSelect={() => {
                                if (Platform.OS === "web") {
                                  isDragSelectingRef.current = true;
                                  dragPivotIdRef.current = null;
                                  dragInitialIdsRef.current = new Set(selectedIdsRef.current);
                                } else {
                                  setIsDragSelectLocked(true);
                                }
                              }}
                              renderSecureText={securitySettings.anti_copy_canvas}
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
                          )}
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
              <ChatLeakShield
                revealHeld={isRevealingChat}
                blackout={securityBlackout}
                warningVisible={fakeScreenshotWarning}
                magnetPoint={identityMagnetPoint}
                username={profile?.username || profile?.full_name || "משתמש"}
                onRevealChange={setIsRevealingChat}
                bottomOffset={16}
                revealButtonsEnabled={securitySettings.require_hold_to_reveal}
                identityMagnetEnabled={securitySettings.identity_magnet}
                shutterFlickerEnabled={securitySettings.shutter_flicker}
              />
              {Platform.OS === "web" && (
                <View pointerEvents="none" style={touchDebugStyles.panel}>
                  <Text style={[touchDebugStyles.title, webSystemFont]}>Touch debug</Text>
                  {touchDebugPoints.length ? (
                    touchDebugPoints.map((point, index) => (
                      <Text key={point.id} style={[touchDebugStyles.line, webSystemFont]}>
                        {`אצבע ${index + 1} | id ${point.id} | x:${point.x} y:${point.y} | ${point.target}`}
                      </Text>
                    ))
                  ) : (
                    <Text style={[touchDebugStyles.line, webSystemFont]}>אין אצבעות פעילות</Text>
                  )}
                </View>
              )}
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
                    scrollToBottomAfterSelfSend();
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
                      void sendCachedMessage({ chatId: chat.id, body, messageKind: kind, replyToId: replyTo?.id ?? null, expireSeconds });
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
                  onToggleEmojiKeyboard={() => { 
                    // No longer active from composer, but keeping the prop to avoid breaking MessageComposer type
                  }} emojiEvent={composerEmojiEvent} />
              </View>
            </Animated.View>
          )}
        </KeyboardAvoidingView>

        {showEmojiKeyboard ? (
          <View style={{ 
            height: (recordedKeyboardHeight || 300) + insets.bottom, 
            width: "100%", 
            backgroundColor: theme.colors.surface,
            ...(showEmojiPickerForId ? {
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              zIndex: 99999,
            } : {})
          }}>
            <EmojiKeyboard 
              height={recordedKeyboardHeight || 300} 
              onEmojiSelected={(emoji) => {
                if (showEmojiPickerForId) {
                  // If in reaction mode, toggle reaction and close
                  handleToggleReaction(showEmojiPickerForId, emoji);
                  
                  // Clear state
                  setShowEmojiPickerForId(null);
                  setShowEmojiKeyboard(false);
                  
                  // NEW: Clear selection after reacting
                  setSelectedIds([]);
                } else {
                  // Fallback for any other case
                  setComposerEmojiEvent({ emoji, ts: Date.now() });
                }
              }} 
              recents={emojiRecents} 
              onRecentsUpdate={setEmojiRecents} 
              bottomInset={insets.bottom} 
            />
          </View>
        ) : null}
      </SafeAreaView>

      <ChatOverlayManager
        {...{
          chat, profile, profiles, theme, styles, showOverflowMenu, setShowOverflowMenu, showMoreMenu, setShowMoreMenu, showMuteMenu, setShowMuteMenu, showClearDialog, setShowClearDialog, showExportDialog, setShowExportDialog, showReportDialog, setShowReportDialog, showAttachmentMenu, setShowAttachmentMenu, showSelectionOverflowMenu, setShowSelectionOverflowMenu, showDeleteModal, setShowDeleteModal,
          muteSelection, setMuteSelection, clearSelection, setClearSelection, clearStarred, setClearStarred, reportExit, setReportExit, selectedIds, setSelectedIds, messageMap, viewInfoMessage, setViewInfoMessage, showReactionsSheetForId, setShowReactionsSheetForId, reactionsByMessage, contactNicknames, showEmojiPickerForId, setShowEmojiPickerForId, toastMessage, activeSubScreen, setActiveSubScreen, onOpenChatSettings, onCreateGroupWith, setChatMute, clearChatsLocally, showToast, toggleReaction, toggleSelection: (id) => setSelectedIds((current) => current.includes(id) ? current.filter(x => x !== id) : [...current, id]), requestScreenshotPermission, sendMessage: sendCachedMessage, hasScreenshotPerm, myRequests, groupMembers, setSearchOpen,
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
            await sendCachedMessage({ chatId: chat.id, body, messageKind: "system" });
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

      <SlidingChatPage visible={!!activeSubScreen} distance={slideDistance}>
        {activeSubScreenContent}
      </SlidingChatPage>
    </View>
  );
}

function SlidingChatPage({ visible, distance, children }: PropsWithChildren<{ visible: boolean; distance: number }>) {
  const [present, setPresent] = useState(visible);
  const anim = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const childrenRef = useRef<React.ReactNode>(children);

  if (visible && children) {
    childrenRef.current = children;
  }

  useEffect(() => {
    if (visible) {
      setPresent(true);
      anim.setValue(0);
      requestAnimationFrame(() => {
        Animated.timing(anim, {
          toValue: 1,
          duration: 260,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start();
      });
      return;
    }

    if (!present) return;

    anim.setValue(1);
    requestAnimationFrame(() => {
      Animated.timing(anim, {
        toValue: 0,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(() => setPresent(false));
    });
  }, [anim, present, visible]);

  if (!present) return null;

  return (
    <Animated.View
      pointerEvents={visible ? "auto" : "none"}
      style={[
        StyleSheet.absoluteFillObject,
        {
          zIndex: 80,
          backgroundColor: "#000",
          transform: [
            {
              translateX: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [-distance, 0],
              }),
            },
          ],
        },
      ]}
    >
      {visible ? children : childrenRef.current}
    </Animated.View>
  );
}

const touchDebugStyles = StyleSheet.create({
  panel: {
    position: "absolute",
    top: 10,
    left: 10,
    right: 10,
    zIndex: 999,
    backgroundColor: "rgba(0, 0, 0, 0.72)",
    borderColor: "rgba(0, 168, 132, 0.9)",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  title: {
    color: "#00f5c8",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "left",
    writingDirection: "ltr",
    marginBottom: 3,
  },
  line: {
    color: "#ffffff",
    fontSize: 12,
    lineHeight: 17,
    textAlign: "left",
    writingDirection: "ltr",
  },
});
