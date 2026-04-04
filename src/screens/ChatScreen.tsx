import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Pressable, ScrollView, Text, TextInput, View, useColorScheme, KeyboardAvoidingView, Platform, Keyboard, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
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
import { webEmbeddedInputReset } from "@/lib/webStyles";

// Sub-screens
import { ChatAddMembersScreen } from "./chat-settings/ChatAddMembersScreen";
import { ChatMediaScreen } from "./chat-settings/ChatMediaScreen";
import { ChatDisappearingMessagesScreen } from "./chat-settings/ChatDisappearingMessagesScreen";
import { ChatThemeScreen } from "./chat-settings/ChatThemeScreen";
import { CreatePollScreen } from "./chat-settings/CreatePollScreen";
import { ChatPollVotesScreen } from "./chat-settings/ChatPollVotesScreen";

// Extracted modules
import { isChatMuted, formatRelativeDate } from "./chat/ChatUtils";
import { createStyles } from "./chat/ChatStyles";
import { ChatHeader } from "./chat/ChatHeader";
import { ScreenshotBanner } from "./chat/ScreenshotBanner";
import { ChatOverlayManager } from "./chat/ChatOverlayManager";
import { useChatPermissions } from "./chat/useChatPermissions";
import { ChatBackground } from "./chat/ChatBackground";

type Props = {
  chat: Chat;
  onBack: () => void;
  onOpenChatSettings: () => void;
  scrollToMessageId?: string | null;
  onForward?: (messages: Message[]) => void;
  onCreateGroupWith?: (profile: Profile) => void;
};

export function ChatScreen({ chat, onBack, onOpenChatSettings, scrollToMessageId, onForward, onCreateGroupWith }: Props) {
  const insets = useSafeAreaInsets() || { top: 0, bottom: 0, left: 0, right: 0 };
  const theme = useAppTheme();
  const colorScheme = useColorScheme();
  const styles = useMemo(() => createStyles(theme, insets), [theme, insets]);
  const { profile } = useAuth();
  
  const {
    loadMessages, markChatSeen, unreadCounts, messagesByChat, profiles,
    contactNicknames, reactionsByMessage, openedViewOnceIds, muteSettings,
    chatPreferences, setChatMute, clearChatMute, sendMessage, openViewOnceMessage,
    toggleReaction, deleteMessages, loadChatMembers, clearChatsLocally
  } = useChats();

  // ── 1. Memoized Data (Moved to top of scope) ───────────────────────────
  const visibleMessages = useMemo(() => {
    const allMessages = (messagesByChat && chat && messagesByChat[chat.id]) ?? [];
    const prefs = chatPreferences && chat && chatPreferences[chat.id];
    const clearedAt = prefs?.cleared_at;
    if (!clearedAt) return allMessages;
    const clearedAtMs = new Date(clearedAt).getTime();
    return allMessages.filter((m) => new Date(m.created_at).getTime() > clearedAtMs);
  }, [chat?.id, chatPreferences, messagesByChat]);

  const messageMap = useMemo(() => Object.fromEntries((visibleMessages || []).map((msg) => [msg.id, msg])), [visibleMessages]);

  const [searchQuery, setSearchQuery] = useState("");

  const groupedMessages = useMemo(() => {
    const groups: any[] = [];
    if (!chat || !visibleMessages) return groups;

    let lastDateLabel = "";
    const currentUnread = (unreadCounts && chat && unreadCounts[chat.id]) || 0;
    const unreadStartIndex = Math.max(0, ((visibleMessages && visibleMessages.length) || 0) - currentUnread);
    const normalizedQuery = searchQuery.trim().toLowerCase();

    const messagesToGroup = visibleMessages.filter((msg) => {
      if (!normalizedQuery) return true;
      const replyPreview = msg.reply_to_id ? messageMap[msg.reply_to_id]?.body_preview ?? "" : "";
      return [msg.body_ciphertext, msg.body_preview ?? "", replyPreview].some((v) => v.toLowerCase().includes(normalizedQuery));
    });

    messagesToGroup.forEach((msg, idx) => {
      if (currentUnread > 0 && idx === unreadStartIndex && !normalizedQuery) groups.push({ type: "unread", unreadCount: currentUnread });
      const label = formatRelativeDate(new Date(msg.created_at));
      if (label !== lastDateLabel) { groups.push({ type: "date", dateLabel: label }); lastDateLabel = label; }
      groups.push({ type: "message", message: msg });
    });
    return groups;
  }, [messageMap, searchQuery, visibleMessages, unreadCounts, chat?.id]);

  const [groupMembers, setGroupMembers] = useState<Profile[]>([]);
  const groupSubtitle = useMemo(() => {
    if (!chat?.is_group || !groupMembers || groupMembers.length === 0) return "קבוצה";
    const allNames = groupMembers.map(m => m.id === profile?.id ? "את/ה" : m.username);
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
  const [androidNativeKeyboardPadding, setAndroidNativeKeyboardPadding] = useState(0);
  const [showEmojiKeyboard, setShowEmojiKeyboard] = useState(false);
  const [composerEmojiEvent, setComposerEmojiEvent] = useState<{ emoji: string; ts: number } | null>(null);
  const [recordedKeyboardHeight, setRecordedKeyboardHeight] = useState(300);
  const [emojiRecents, setEmojiRecents] = useState<string[]>([]);
  const [composerFocusTrigger, setComposerFocusTrigger] = useState(0);
  const [savedMessageIds, setSavedMessageIds] = useState<Set<string>>(new Set());
  const [activeSubScreen, setActiveSubScreen] = useState<"addMembers" | "media" | "disappearing" | "theme" | "createPoll" | "pollVotes" | null>(null);
  const [viewPollVotesMessage, setViewPollVotesMessage] = useState<Message | null>(null);

  const scrollRef = useRef<ScrollView | null>(null);
  const scrollMetricsRef = useRef({ y: 0, height: 0, contentHeight: 0 });
  const messageLayoutsRef = useRef<Record<string, number>>({});
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
          const topY = messageLayoutsRef.current[msg.id];
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
    const y = messageLayoutsRef.current[msgId];
    if (y !== undefined) {
      scrollRef.current?.scrollTo({ y: Math.max(0, y - 120), animated: true });
      if (highlight) { setHighlightedMessageId(msgId); setTimeout(() => setHighlightedMessageId(null), 2000); }
    } else if (attempts > 0) {
      setTimeout(() => scrollToMessageWithRetry(msgId, highlight, attempts - 1), 250);
    }
  };

  const { hasScreenshotPerm, screenshotBanner, activePermissions, myRequests, requestScreenshotPermission } = 
    useChatPermissions(chat, groupMembers, (p) => sendMessage(p));

  useEffect(() => {
    if (chat?.is_group) loadChatMembers(chat.id).then(setGroupMembers);
  }, [chat?.id, chat?.is_group]);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(`saved-messages:${profile?.id ?? "guest"}`).then((raw) => {
      if (active && raw) { try { setSavedMessageIds(new Set(JSON.parse(raw).map((m: any) => m.id))); } catch {} }
    });
    return () => { active = false; };
  }, [profile?.id, selectedIds?.length]);

  useEffect(() => {
    AsyncStorage.getItem(RECENT_KEY).then((raw) => {
      if (raw) try { setEmojiRecents(JSON.parse(raw)); } catch {}
    });
  }, []);

  useEffect(() => {
    if (Platform.OS !== "android") return;
    const s1 = Keyboard.addListener("keyboardDidShow", (e) => {
      setAndroidNativeKeyboardPadding(e.endCoordinates.height);
      setRecordedKeyboardHeight(e.endCoordinates.height);
      setShowEmojiKeyboard(false);
    });
    const s2 = Keyboard.addListener("keyboardDidHide", () => setAndroidNativeKeyboardPadding(0));
    return () => { s1.remove(); s2.remove(); };
  }, []);

  useEffect(() => {
    initialScrollDone.current = false;
    if (chat) loadMessages(chat.id);
  }, [chat?.id]);

  useEffect(() => {
    if (!visibleMessages?.length || initialScrollDone.current) return;
    const currentUnread = (unreadCounts && chat && unreadCounts[chat.id]) || 0;
    if (scrollToMessageId) {
      setTimeout(() => scrollToMessageWithRetry(scrollToMessageId, true), 300);
      initialScrollDone.current = true;
    } else if (currentUnread > 0) {
      const unreadStartIndex = Math.max(0, visibleMessages.length - currentUnread);
      const firstUnreadMsg = visibleMessages[unreadStartIndex];
      if (firstUnreadMsg) setTimeout(() => { scrollToMessageWithRetry(firstUnreadMsg.id, false); setTimeout(checkVisibility, 600); }, 300);
      else scrollToBottom(false);
      initialScrollDone.current = true;
    } else {
      setTimeout(() => scrollToBottom(false), 50);
      initialScrollDone.current = true;
    }
  }, [chat?.id, visibleMessages?.length, scrollToMessageId, unreadCounts]);

  // ── 4. Render ──────────────────────────────────────────────────────────
  if (activeSubScreen === "addMembers") return <ChatAddMembersScreen chat={chat} onBack={() => setActiveSubScreen(null)} />;
  if (activeSubScreen === "media") return <ChatMediaScreen chat={chat} onBack={() => setActiveSubScreen(null)} />;
  if (activeSubScreen === "disappearing") return <ChatDisappearingMessagesScreen onBack={() => setActiveSubScreen(null)} />;
  if (activeSubScreen === "theme") return <ChatThemeScreen chat={chat} onBack={() => setActiveSubScreen(null)} />;
  if (activeSubScreen === "createPoll") return <CreatePollScreen chat={chat} onBack={() => setActiveSubScreen(null)} />;
  if (activeSubScreen === "pollVotes" && viewPollVotesMessage) return <ChatPollVotesScreen message={viewPollVotesMessage} reactions={reactionsByMessage ? reactionsByMessage[viewPollVotesMessage.id] : undefined} currentUserId={profile?.id || ""} onBack={() => setActiveSubScreen(null)} />;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.chatBackdrop }} onStartShouldSetResponderCapture={(e) => {
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
          onBack={() => selectedIds.length ? setSelectedIds([]) : onBack()} onOpenChatSettings={onOpenChatSettings}
          onReplyToSelected={() => { setReplyTo(messageMap[selectedIds[0]]); setSelectedIds([]); }}
          onToggleStarSelected={async () => {
             const allStarred = selectedIds.every(id => savedMessageIds.has(id));
             const key = `saved-messages:${profile?.id ?? "guest"}`;
             const raw = await AsyncStorage.getItem(key);
             let saved: any[] = raw ? JSON.parse(raw) : [];
             if (allStarred) saved = saved.filter(m => !selectedIds.includes(m.id));
             else saved = [...saved, ...selectedIds.map(id => ({ id, body: messageMap[id].body_ciphertext, created_at: messageMap[id].created_at, source_chat_title: chat.title, chat_id: chat.id }))];
             await AsyncStorage.setItem(key, JSON.stringify(saved));
             setSavedMessageIds(new Set(saved.map(m => m.id)));
             setSelectedIds([]);
             showToast(allStarred ? "הוסר מההודעות השמורות" : "נשמר בהודעות השמורות");
          }}
          onDeleteSelected={() => setShowDeleteModal(true)}
          onForwardSelected={() => { onForward?.(selectedIds.map(id => messageMap[id]).filter(Boolean)); setSelectedIds([]); }}
          onShowSelectionOverflow={() => setShowSelectionOverflowMenu(true)}
          onShowOverflowMenu={() => setShowOverflowMenu(true)}
        />
      </SafeAreaView>

      <SafeAreaView edges={["left", "right", "bottom"]} style={{ flex: 1, backgroundColor: 'transparent' }}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }} enabled={Platform.OS === "ios"}>
          <View style={{ flex: 1 }}>
            {searchOpen && (
              <View style={styles.searchBar}>
                <Feather color={theme.colors.textMuted} name="search" size={16} />
                <TextInput onChangeText={setSearchQuery} placeholder="חיפוש בצ'אט" placeholderTextColor={theme.colors.textMuted} style={[styles.searchInput, webEmbeddedInputReset]} value={searchQuery} />
                <Pressable onPress={() => { setSearchOpen(false); setSearchQuery(""); }}><Feather color={theme.colors.textMuted} name="x" size={18} /></Pressable>
              </View>
            )}
            {chat?.is_group && screenshotBanner !== "none" && <ScreenshotBanner type={screenshotBanner} secondsLeft={Math.max(0, Math.floor((((activePermissions && chat && activePermissions[chat.id]) ?? 0) - Date.now()) / 1000))} />}
            
            <View style={styles.thread}>
              <ScrollView ref={scrollRef} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} scrollEventThrottle={16}
                onLayout={(e) => { scrollMetricsRef.current.height = e.nativeEvent.layout.height; checkVisibility(); }}
                onContentSizeChange={(w, h) => scrollMetricsRef.current.contentHeight = h}
                onScroll={(e) => { 
                  scrollMetricsRef.current.y = e.nativeEvent.contentOffset.y;
                  scrollMetricsRef.current.height = e.nativeEvent.layoutMeasurement.height || scrollMetricsRef.current.height;
                  scrollMetricsRef.current.contentHeight = e.nativeEvent.contentSize.height || scrollMetricsRef.current.contentHeight;
                }}
                onScrollBeginDrag={() => { if (showReactionsForId) setShowReactionsForId(null); }}
                onMomentumScrollEnd={() => checkVisibility()} onScrollEndDrag={() => checkVisibility()}
              >
                <Pressable style={{ flexGrow: 1 }} onPress={() => { if (showReactionsForId) setShowReactionsForId(null); }}>
                  {groupedMessages.map((item, idx) => {
                    if (item.type === "date") return <View key={`date-${idx}`} style={styles.dateSeparator}><View style={styles.datePill}><Text style={styles.datePillText}>{item.dateLabel}</Text></View></View>;
                    if (item.type === "unread") return <View key={`unread-${idx}`} style={styles.unreadSeparator}><View style={styles.unreadPill}><Text style={styles.unreadPillText}>{item.unreadCount === 1 ? "הודעה אחת שלא נקראה" : `${item.unreadCount} הודעות שלא נקראו`}</Text></View></View>;
                    const msg = item.message;
                    return (
                      <View key={msg.id} onLayout={(e) => messageLayoutsRef.current[msg.id] = e.nativeEvent.layout.y} style={highlightedMessageId === msg.id ? { backgroundColor: theme.colors.selectionModeBackground } : undefined}>
                        <MessageBubble author={profiles && profiles[msg.sender_id]} currentUserId={profile?.id ?? ""} message={msg} onReply={setReplyTo} onRevealViewOnce={() => {
                          if (revealTimeoutRef.current) clearTimeout(revealTimeoutRef.current);
                          setRevealedMessageId(msg.id);
                          revealTimeoutRef.current = setTimeout(() => { void openViewOnceMessage(msg); setRevealedMessageId(c => c === msg.id ? null : c); }, 5000);
                        }} onToggleReaction={(e) => toggleReaction(msg.id, e)} onToggleSelection={(id) => setSelectedIds((current) => current.includes(id) ? current.filter(x => x !== id) : [...current, id])} onShowReactions={setShowReactionsForId} onShowReactionsSheet={setShowReactionsSheetForId} onPlusExtra={setShowEmojiPickerForId}
                        reactions={reactionsByMessage && reactionsByMessage[msg.id]} isSelected={selectedIds.includes(msg.id)} isSelectionMode={selectedIds.length > 0} showReactions={showReactionsForId === msg.id} onReportPickerLayout={setPickerLayout} isSaved={savedMessageIds.has(msg.id)}
                        onOpenPollVotes={(id) => { setViewPollVotesMessage(messageMap[id]); setActiveSubScreen("pollVotes"); }} replyPreview={msg.reply_to_id ? messageMap[msg.reply_to_id]?.body_preview : null}
                        viewOnceState={msg.message_kind === "view_once" && msg.sender_id !== profile?.id ? (revealedMessageId === msg.id ? "revealed" : openedViewOnceIds[msg.id] ? "opened" : "hidden") : undefined} />
                      </View>
                    );
                  })}
                </Pressable>
              </ScrollView>
            </View>
          </View>
          <MessageComposer onInputFocus={() => { setShowReactionsForId(null); if (showEmojiKeyboard) setShowEmojiKeyboard(false); }} onCancelReply={() => setReplyTo(null)}
            onSend={async (body, kind, expireSeconds) => { scrollToBottom(true); const err = await sendMessage({ chatId: chat.id, body, messageKind: kind, replyToId: replyTo?.id ?? null, expireSeconds }); if (!err) { setReplyTo(null); scrollToBottom(true); } }}
            replyPreview={replyTo?.body_preview ?? null} emojiKeyboardOpen={showEmojiKeyboard} focusTrigger={composerFocusTrigger} onAttachmentPress={() => setShowAttachmentMenu(true)}
            onToggleEmojiKeyboard={() => { if (showEmojiKeyboard) setComposerFocusTrigger(n => n + 1); else { setAndroidNativeKeyboardPadding(0); setShowEmojiKeyboard(true); Keyboard.dismiss(); } }} emojiEvent={composerEmojiEvent} />
        </KeyboardAvoidingView>
        
        {showEmojiKeyboard ? (
           <View style={{ height: recordedKeyboardHeight || 300, width: "100%" }}>
             <EmojiKeyboard height={recordedKeyboardHeight || 300} onEmojiSelected={(emoji) => setComposerEmojiEvent({ emoji, ts: Date.now() })} recents={emojiRecents} onRecentsUpdate={setEmojiRecents} />
           </View>
        ) : Platform.OS === "android" && androidNativeKeyboardPadding > 0 ? (
           <View style={{ height: androidNativeKeyboardPadding, width: "100%" }} />
        ) : null}
      </SafeAreaView>

      <ChatOverlayManager
        {...{
          chat, profile, profiles, theme, styles, showOverflowMenu, setShowOverflowMenu, showMoreMenu, setShowMoreMenu, showMuteMenu, setShowMuteMenu, showClearDialog, setShowClearDialog, showExportDialog, setShowExportDialog, showReportDialog, setShowReportDialog, showAttachmentMenu, setShowAttachmentMenu, showSelectionOverflowMenu, setShowSelectionOverflowMenu, showDeleteModal, setShowDeleteModal,
          muteSelection, setMuteSelection, clearSelection, setClearSelection, clearStarred, setClearStarred, reportExit, setReportExit, selectedIds, setSelectedIds, messageMap, viewInfoMessage, setViewInfoMessage, showReactionsSheetForId, setShowReactionsSheetForId, reactionsByMessage, contactNicknames, showEmojiPickerForId, setShowEmojiPickerForId, toastMessage, activeSubScreen, setActiveSubScreen, onOpenChatSettings, onCreateGroupWith, setChatMute, clearChatsLocally, showToast, toggleReaction, toggleSelection: (id) => setSelectedIds((current) => current.includes(id) ? current.filter(x => x !== id) : [...current, id]), requestScreenshotPermission, sendMessage, hasScreenshotPerm, myRequests, groupMembers, setSearchOpen,
          muteSetting: (muteSettings && chat) ? muteSettings[chat.id] : undefined,
          performDelete: async (everyone) => { await deleteMessages(selectedIds, everyone); setSelectedIds([]); setShowDeleteModal(false); }
        }}
      />
    </View>
  );
}
