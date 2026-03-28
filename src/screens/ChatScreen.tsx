import { useEffect, useMemo, useRef, useState } from "react";
import * as Clipboard from "expo-clipboard";
import { Alert, ImageBackground, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useColorScheme } from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAvoidingView, Platform, Keyboard } from "react-native";
import { EmojiKeyboard, RECENT_KEY } from "@/components/EmojiKeyboard";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { MessageBubble } from "@/components/MessageBubble";
import { MessageComposer } from "@/components/MessageComposer";
import { useAuth } from "@/context/AuthContext";
import { useChats } from "@/context/ChatContext";
import { useAppTheme } from "@/lib/theme";
import { Chat, ChatMuteSetting, Message } from "@/lib/types";
import { webEmbeddedInputReset } from "@/lib/webStyles";

type Props = {
  chat: Chat;
  onBack: () => void;
  onOpenChatSettings: () => void;
};

function isChatMuted(setting?: ChatMuteSetting) {
  if (!setting) {
    return false;
  }

  if (setting.mute_always) {
    return true;
  }

  return Boolean(setting.mute_until && new Date(setting.mute_until).getTime() > Date.now());
}

function describeMute(setting?: ChatMuteSetting) {
  if (!isChatMuted(setting)) {
    return "Off";
  }

  if (setting?.mute_always) {
    return "תמיד";
  }

  return setting?.mute_until ? `עד ${new Date(setting.mute_until).toLocaleString("he-IL")}` : "מושתק";
}

const lightBg = require("../../public/images/default_white_background.png");
const darkBg = require("../../public/images/default_dark_background.png");

const ChatBackground = React.memo(({ source, scale }: { source: any; scale: number }) => (
  <View style={[StyleSheet.absoluteFillObject, { zIndex: -1, overflow: 'hidden' }]} pointerEvents="none">
    <ImageBackground
      fadeDuration={0}
      source={source}
      style={{ width: "100%", height: "100%", transform: [{ scale }] }}
      resizeMode="repeat"
    />
  </View>
));

export function ChatScreen({ chat, onBack, onOpenChatSettings }: Props) {
  const insets = useSafeAreaInsets();
  const theme = useAppTheme();
  const colorScheme = useColorScheme();
  const styles = useMemo(() => createStyles(theme, insets), [theme, insets]);
  const chatBgSource = colorScheme === "dark" ? darkBg : lightBg;
  const { profile } = useAuth();
  const {
    loadMessages,
    markChatSeen,
    messagesByChat,
    profiles,
    reactionsByMessage,
    openedViewOnceIds,
    muteSettings,
    chatPreferences,
    setChatMute,
    clearChatMute,
    sendMessage,
    openViewOnceMessage,
    toggleReaction,
    deleteMessages,
  } = useChats();

  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [revealedMessageId, setRevealedMessageId] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showOverflowMenu, setShowOverflowMenu] = useState(false);
  const [showMuteMenu, setShowMuteMenu] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showReactionsForId, setShowReactionsForId] = useState<string | null>(null);
  const [showSelectionOverflowMenu, setShowSelectionOverflowMenu] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
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

  // Load recent emojis from storage
  useEffect(() => {
    AsyncStorage.getItem(RECENT_KEY).then((raw) => {
      if (raw) {
        try { setEmojiRecents(JSON.parse(raw)); } catch {}
      }
    });
  }, []);

  useEffect(() => {
    if (Platform.OS !== "android") return;
    const s1 = Keyboard.addListener("keyboardDidShow", (e) => {
      setAndroidNativeKeyboardPadding(e.endCoordinates.height);
      setRecordedKeyboardHeight(e.endCoordinates.height);
      // Native keyboard took over — dismiss emoji panel seamlessly
      setShowEmojiKeyboard(false);
    });
    const s2 = Keyboard.addListener("keyboardDidHide", () => {
      setAndroidNativeKeyboardPadding(0);
    });
    return () => {
      s1.remove();
      s2.remove();
    };
  }, []);

  const revealTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollRef = useRef<ScrollView | null>(null);

  const visibleMessages = useMemo(() => {
    const allMessages = messagesByChat[chat.id] ?? [];
    const clearedAt = chatPreferences[chat.id]?.cleared_at;

    if (!clearedAt) {
      return allMessages;
    }

    const clearedAtMs = new Date(clearedAt).getTime();
    return allMessages.filter((message) => new Date(message.created_at).getTime() > clearedAtMs);
  }, [chat.id, chatPreferences, messagesByChat]);

  const messageMap = useMemo(
    () => Object.fromEntries(visibleMessages.map((message) => [message.id, message])),
    [visibleMessages],
  );
  const muteSetting = muteSettings[chat.id];
  const chatMuted = isChatMuted(muteSetting);

  const isSelectionMode = selectedIds.length > 0;

  const groupedMessages = useMemo(() => {
    const groups: { type: "date" | "message"; dateLabel?: string; message?: Message }[] = [];
    let lastDateLabel = "";

    const normalizedQuery = searchQuery.trim().toLowerCase();
    const messagesToGroup = visibleMessages.filter((msg) => {
      if (!normalizedQuery) return true;
      const replyPreview = msg.reply_to_id ? messageMap[msg.reply_to_id]?.body_preview ?? "" : "";
      return [msg.body_ciphertext, msg.body_preview ?? "", replyPreview].some((v) =>
        v.toLowerCase().includes(normalizedQuery),
      );
    });

    messagesToGroup.forEach((msg) => {
      const date = new Date(msg.created_at);
      const label = date.toLocaleDateString("he-IL", { day: "numeric", month: "long", year: "numeric" });

      if (label !== lastDateLabel) {
        groups.push({ type: "date", dateLabel: label });
        lastDateLabel = label;
      }
      groups.push({ type: "message", message: msg });
    });

    return groups;
  }, [messageMap, searchQuery, visibleMessages]);

  function scrollToBottom(animated = true) {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated });
    });
  }

  useEffect(() => {
    void (async () => {
      await loadMessages(chat.id);
      await markChatSeen(chat.id);
      scrollToBottom(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat.id]);

  useEffect(() => {
    if (!visibleMessages.length) {
      return;
    }

    void markChatSeen(chat.id);
    scrollToBottom(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat.id, visibleMessages.length]);

  useEffect(() => {
    return () => {
      if (revealTimeoutRef.current) clearTimeout(revealTimeoutRef.current);
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, []);

  function showToast(text: string) {
    setToastMessage(text);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => setToastMessage(null), 2500);
  }

  function toggleSelection(id: string) {
    setSelectedIds((current) => {
      const isAlreadySelected = current.includes(id);
      if (isAlreadySelected) {
        const next = current.filter((x) => x !== id);
        if (next.length === 0) {
          setShowReactionsForId(null);
        }
        return next;
      } else {
        return [...current, id];
      }
    });
  }

  function handleBack() {
    if (isSelectionMode) {
      setSelectedIds([]);
      setShowReactionsForId(null);
    } else {
      onBack();
    }
  }

  function handleDeleteSelected() {
    if (!selectedIds.length) return;
    setShowDeleteModal(true);
  }

  async function performDelete(everyone: boolean) {
    await deleteMessages(selectedIds);
    setSelectedIds([]);
    setShowReactionsForId(null);
    setShowDeleteModal(false);
  }

  function handleReplyToSelected() {
    if (selectedIds.length !== 1) return;
    const msg = messageMap[selectedIds[0]];
    if (msg) {
      setReplyTo(msg);
      setSelectedIds([]);
      setShowReactionsForId(null);
    }
  }

  function handleGenericAction(name: string) {
    Alert.alert("Action", `${name} performed on ${selectedIds.length} message(s).`);
    setSelectedIds([]);
    setShowReactionsForId(null);
  }

  const renderHeader = () => {
    return (
      <View style={styles.header}>
        <Pressable onPress={handleBack} style={styles.headerButton}>
          <Feather color={theme.colors.textOnAccent} name="arrow-left" size={22} />
        </Pressable>

        {isSelectionMode ? (
          <>
            <Text style={styles.selectionCount}>{selectedIds.length}</Text>
            <View style={styles.selectionActions}>
              {selectedIds.length === 1 && (
                <Pressable onPress={handleReplyToSelected} style={styles.headerButton}>
                  <MaterialCommunityIcons color={theme.colors.textOnAccent} name="reply" size={22} />
                </Pressable>
              )}
              <Pressable onPress={() => handleGenericAction("Star")} style={styles.headerButton}>
                <MaterialCommunityIcons color={theme.colors.textOnAccent} name="star" size={22} />
              </Pressable>
              <Pressable onPress={handleDeleteSelected} style={styles.headerButton}>
                <MaterialCommunityIcons color={theme.colors.textOnAccent} name="trash-can" size={22} />
              </Pressable>
              <Pressable onPress={() => handleGenericAction("Forward")} style={styles.headerButton}>
                <MaterialCommunityIcons color={theme.colors.textOnAccent} name="share-outline" size={22} style={{ transform: [{ scaleX: -1 }] }} />
              </Pressable>
              <Pressable onPress={() => setShowSelectionOverflowMenu(true)} style={styles.headerButton}>
                <MaterialCommunityIcons color={theme.colors.textOnAccent} name="dots-vertical" size={22} />
              </Pressable>
            </View>
          </>
        ) : (
          <>
            <Pressable onPress={onOpenChatSettings} style={styles.avatar}>
              <Text style={styles.avatarText}>{chat.title.slice(0, 1).toUpperCase()}</Text>
            </Pressable>
            <Pressable onPress={onOpenChatSettings} style={styles.headerCopy}>
              <Text numberOfLines={1} style={styles.title}>
                {chat.title}
              </Text>
              <Text style={styles.subtitle}>
                {chatPreferences[chat.id]?.locked
                  ? "נעול במכשיר זה"
                  : chatMuted
                    ? `מושתק · ${describeMute(muteSetting)}`
                    : chat.is_group
                      ? "קבוצה"
                      : "צ'אט פרטי"}
              </Text>
            </Pressable>
            <Pressable onPress={() => setShowOverflowMenu(true)} style={styles.headerButton}>
              <MaterialCommunityIcons color={theme.colors.textOnAccent} name="dots-vertical" size={20} />
            </Pressable>
          </>
        )}
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <SafeAreaView edges={["top"]} style={{ backgroundColor: theme.colors.header, zIndex: 10 }}>
        {renderHeader()}
      </SafeAreaView>

      <SafeAreaView edges={["left", "right", "bottom"]} style={{ flex: 1, backgroundColor: theme.colors.composer }}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ 
            flex: 1, 
            paddingBottom: Platform.OS === "android" && androidNativeKeyboardPadding > 0
              ? Math.max(0, androidNativeKeyboardPadding - insets.bottom + 15) 
              : 0 
          }}
        >

        <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        {searchOpen ? (
          <View style={styles.searchBar}>
            <Feather color={theme.colors.textMuted} name="search" size={16} />
            <TextInput
              onChangeText={setSearchQuery}
              placeholder="חיפוש בצ'אט"
              placeholderTextColor={theme.colors.textMuted}
              style={[styles.searchInput, webEmbeddedInputReset]}
              value={searchQuery}
            />
            <Pressable
              onPress={() => {
                setSearchOpen(false);
                setSearchQuery("");
              }}
            >
            <Feather color={theme.colors.textMuted} name="x" size={18} />
          </Pressable>
        </View>
      ) : null}

      <View style={styles.thread}>
        <ChatBackground source={chatBgSource} scale={1.8} />
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          onScrollBeginDrag={() => {
            if (showReactionsForId) setShowReactionsForId(null);
          }}
        >
          {groupedMessages.length ? (
            groupedMessages.map((item, idx) => {
              if (item.type === "date") {
                return (
                  <View key={`date-${item.dateLabel}-${idx}`} style={styles.dateSeparator}>
                    <View style={styles.datePill}>
                      <Text style={styles.datePillText}>{item.dateLabel}</Text>
                    </View>
                  </View>
                );
              }

              const message = item.message!;
              const replyPreview = message.reply_to_id ? messageMap[message.reply_to_id]?.body_preview : null;
              const viewOnceState =
                message.message_kind !== "view_once" || message.sender_id === profile?.id
                  ? undefined
                  : revealedMessageId === message.id
                    ? "revealed"
                    : openedViewOnceIds[message.id]
                      ? "opened"
                      : "hidden";

              return (
                <MessageBubble
                  key={message.id}
                  author={profiles[message.sender_id]}
                  currentUserId={profile?.id ?? ""}
                  message={message}
                  onReply={setReplyTo}
                  onRevealViewOnce={() => {
                    if (revealTimeoutRef.current) clearTimeout(revealTimeoutRef.current);
                    setRevealedMessageId(message.id);
                    revealTimeoutRef.current = setTimeout(() => {
                      void openViewOnceMessage(message);
                      setRevealedMessageId((c) => (c === message.id ? null : c));
                    }, 5000);
                  }}
                  onToggleReaction={(e) => toggleReaction(message.id, e)}
                  onToggleSelection={toggleSelection}
                  onShowReactions={setShowReactionsForId}
                  onShowReactionsSheet={setShowReactionsSheetForId}
                  onPlusExtra={setShowEmojiPickerForId}
                  reactions={reactionsByMessage[message.id]}
                  replyPreview={replyPreview}
                  isSelected={selectedIds.includes(message.id)}
                  isSelectionMode={isSelectionMode}
                  showReactions={showReactionsForId === message.id}
                  viewOnceState={viewOnceState}
                />
              );
            })
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>{searchQuery ? "אין הודעות מתאימות" : "אין הודעות עדיין"}</Text>
              <Text style={styles.emptySubtitle}>
                {chatPreferences[chat.id]?.cleared_at && !searchQuery
                  ? "הצ'אט נוקה במכשיר זה. הודעות חדשות יופיעו כאן."
                  : searchQuery
                    ? "נסו מילה אחרת."
                    : "התחילו את השיחה. החליקו הודעה מאוחר יותר כדי להשיב."}
              </Text>
            </View>
          )}
        </ScrollView>
      </View>
      </View>

      <MessageComposer
        onCancelReply={() => setReplyTo(null)}
        onSend={async (body, kind, expireSeconds) => {
          scrollToBottom(true);
          const error = await sendMessage({
            chatId: chat.id,
            body,
            messageKind: kind,
            replyToId: replyTo?.id ?? null,
            expireSeconds,
          });

          if (!error) {
            setReplyTo(null);
            scrollToBottom(true);
          }
        }}
        replyPreview={replyTo?.body_preview ?? null}
        emojiKeyboardOpen={showEmojiKeyboard}
        focusTrigger={composerFocusTrigger}
        onToggleEmojiKeyboard={() => {
          if (showEmojiKeyboard) {
            // Emoji → Keyboard: focus input, keyboardDidShow will close panel when keyboard is fully up
            setComposerFocusTrigger((n) => n + 1);
          } else {
            // Keyboard → Emoji: zero the padding NOW so emoji panel takes over the space
            // without a frame where both paddingBottom and emoji panel height are active
            setAndroidNativeKeyboardPadding(0);
            setShowEmojiKeyboard(true);
            Keyboard.dismiss();
          }
        }}
        onInputFocus={() => {
          if (showEmojiKeyboard) setShowEmojiKeyboard(false);
        }}
        emojiEvent={composerEmojiEvent}
      />
      </KeyboardAvoidingView>

      {/* Fixed-height bottom zone — always present when emoji panel OR keyboard is active */}
      {showEmojiKeyboard ? (
         <View style={{ height: recordedKeyboardHeight || 300, width: "100%" }}>
           <EmojiKeyboard
             height={recordedKeyboardHeight || 300}
             onEmojiSelected={(emoji) => {
               setComposerEmojiEvent({ emoji, ts: Date.now() });
             }}
             recents={emojiRecents}
             onRecentsUpdate={setEmojiRecents}
           />
         </View>
      ) : null}

      </SafeAreaView>

      {showOverflowMenu ? (
        <View pointerEvents="box-none" style={styles.overlayRoot}>
          <Pressable onPress={() => setShowOverflowMenu(false)} style={styles.backdrop} />
          <View style={styles.menuCard}>
            <MenuItem
              label="חיפוש בצ'אט"
              onPress={() => {
                setShowOverflowMenu(false);
                setSearchOpen(true);
              }}
            />
            <MenuItem
              label="השתקת התראות"
              secondary={describeMute(muteSetting)}
              onPress={() => {
                setShowOverflowMenu(false);
                setShowMuteMenu(true);
              }}
            />
            <MenuItem
              label={chat.is_group ? "פרטי קבוצה" : "פרטי צ'אט"}
              onPress={() => {
                setShowOverflowMenu(false);
                onOpenChatSettings();
              }}
            />
          </View>
        </View>
      ) : null}

      {showMuteMenu ? (
        <View pointerEvents="box-none" style={styles.overlayRoot}>
          <Pressable onPress={() => setShowMuteMenu(false)} style={styles.backdrop} />
          <View style={styles.sheetCard}>
            <Text style={styles.sheetTitle}>השתקת התראות</Text>
            <SheetButton
              label="8 שעות"
              onPress={() => {
                setChatMute(chat.id, "8_hours");
                setShowMuteMenu(false);
              }}
            />
            <SheetButton
              label="7 ימים"
              onPress={() => {
                setChatMute(chat.id, "7_days");
                setShowMuteMenu(false);
              }}
            />
            <SheetButton
              label="תמיד"
              onPress={() => {
                setChatMute(chat.id, "always");
                setShowMuteMenu(false);
              }}
            />
            <SheetButton
              danger
              label="ביטול השתקה"
              onPress={() => {
                clearChatMute(chat.id);
                setShowMuteMenu(false);
              }}
            />
          </View>
        </View>
      ) : null}

      {showSelectionOverflowMenu ? (
        <View pointerEvents="box-none" style={styles.overlayRoot}>
          <Pressable onPress={() => setShowSelectionOverflowMenu(false)} style={styles.backdrop} />
          <View style={styles.menuCard}>
            {selectedIds.length === 1 && (
              <MenuItem
                label="פרטים"
                onPress={() => {
                  const msg = messageMap[selectedIds[0]];
                  if (msg) setViewInfoMessage(msg);
                  setShowSelectionOverflowMenu(false);
                  setSelectedIds([]);
                }}
              />
            )}
            <MenuItem
              label="העתקה"
              onPress={async () => {
                const text = selectedIds.map((id) => messageMap[id]?.body_ciphertext || "").join("\n");
                await Clipboard.setStringAsync(text);
                showToast("ההודעה הועתקה");
                setShowSelectionOverflowMenu(false);
                setSelectedIds([]);
              }}
            />
            <MenuItem
              label="הצמדה"
              onPress={() => {
                showToast("ההודעה הוצמדה");
                setShowSelectionOverflowMenu(false);
                setSelectedIds([]);
              }}
            />
          </View>
        </View>
      ) : null}

      {showDeleteModal ? (
        <View pointerEvents="box-none" style={styles.overlayRootCenter}>
          <Pressable onPress={() => setShowDeleteModal(false)} style={styles.backdrop} />
          <View style={styles.deleteModalCard}>
            <Text style={styles.deleteModalTitle}>האם למחוק את ההודעה?</Text>
            <View style={styles.deleteModalActions}>
              {selectedIds.every((id) => messageMap[id]?.sender_id === profile?.id) && (
                <Pressable style={styles.deleteModalAction} onPress={() => performDelete(true)}>
                  <Text style={styles.deleteModalActionText}>למחוק אצל כולם</Text>
                </Pressable>
              )}
              <Pressable style={styles.deleteModalAction} onPress={() => performDelete(false)}>
                <Text style={styles.deleteModalActionText}>למחוק אצלי</Text>
              </Pressable>
              <Pressable style={styles.deleteModalAction} onPress={() => setShowDeleteModal(false)}>
                <Text style={styles.deleteModalActionText}>ביטול</Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}

      {viewInfoMessage ? (
        <View style={styles.fullscreenOverlay}>
          <View style={styles.infoTitleRow}>
            <Pressable onPress={() => setViewInfoMessage(null)} style={styles.headerButton}>
              <Feather color={theme.colors.textOnAccent} name="arrow-right" size={24} />
            </Pressable>
            <Text style={styles.infoTitle}>פרטי הודעה</Text>
          </View>
          <ScrollView contentContainerStyle={styles.infoScroll}>
            <View style={styles.infoBubbleRow}>
              <MessageBubble
                author={profiles[viewInfoMessage.sender_id]}
                currentUserId={profile?.id ?? ""}
                message={viewInfoMessage}
                isSelectionMode={false}
                isSelected={false}
                onReply={() => { }}
                onRevealViewOnce={() => { }}
                reactions={reactionsByMessage[viewInfoMessage.id]}
                onShowReactions={() => { }}
                onShowReactionsSheet={() => { }}
                onPlusExtra={() => { }}
                onToggleReaction={() => { }}
                onToggleSelection={() => { }}
                showReactions={false}
              />
            </View>

            <View style={styles.infoSection}>
              <View style={styles.infoSectionHeader}>
                <MaterialCommunityIcons name="check-all" color="#34b7f1" size={18} />
                <Text style={styles.infoSectionTitle}>נקראה על ידי</Text>
              </View>
              <View style={styles.infoUserRow}>
                <View style={[styles.avatar, { width: 44, height: 44 }]}>
                  <MaterialCommunityIcons name="account" color={theme.colors.textOnAccent} size={28} />
                </View>
                <View style={styles.infoUserText}>
                  <Text style={styles.infoUsername}>אבי צייד הסקווידווידיות</Text>
                  <Text style={styles.infoUserTime}>היום, 18:53</Text>
                </View>
              </View>
            </View>

            <View style={styles.infoSection}>
              <View style={[styles.infoSectionHeader, { borderTopWidth: 1, borderColor: theme.colors.separator, paddingTop: 16 }]}>
                <MaterialCommunityIcons name="check-all" color={theme.colors.textMuted} size={18} />
                <Text style={styles.infoSectionTitle}>נמסרה אל</Text>
              </View>
              {["יאיר פדר", "יהונתן פייגל", "ליעדון הבולבולון"].map(name => (
                <View key={name} style={styles.infoUserRow}>
                  <View style={[styles.avatar, { width: 44, height: 44, backgroundColor: "#63472b" }]}>
                    <Text style={styles.avatarText}>{name[0]}</Text>
                  </View>
                  <View style={styles.infoUserText}>
                    <Text style={styles.infoUsername}>{name}</Text>
                    <Text style={styles.infoUserTime}>היום, 18:53</Text>
                  </View>
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      ) : null}

      {showReactionsSheetForId ? (
        <View pointerEvents="box-none" style={styles.overlayRoot}>
          <Pressable onPress={() => setShowReactionsSheetForId(null)} style={styles.backdrop} />
          <View style={styles.reactionsSheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.reactionsSheetHeader}>תגובת אמוג'י אחת (1)</Text>
            <View style={styles.reactionTabs}>
              <View style={styles.reactionTabActive}>
                <Text style={styles.reactionTabText}>1 😜</Text>
              </View>
            </View>
            <View style={styles.reactionUserList}>
              <View style={styles.reactionUserRow}>
                <View style={[styles.avatar, { width: 44, height: 44 }]}>
                  <MaterialCommunityIcons name="account" color={theme.colors.textOnAccent} size={28} />
                </View>
                <View style={styles.reactionUserInfo}>
                  <Text style={styles.reactionUserName}>התגובה שלך</Text>
                  <Text style={styles.reactionUserAction}>יש להקיש כדי להסיר</Text>
                </View>
                <Text style={styles.reactionEmoji}>😜</Text>
              </View>
            </View>
          </View>
        </View>
      ) : null}

      {showEmojiPickerForId ? (
        <View pointerEvents="box-none" style={styles.overlayRoot}>
          <Pressable onPress={() => setShowEmojiPickerForId(null)} style={styles.backdrop} />
          <View style={styles.emojiPickerSheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.emojiPickerSearch}>
              <MaterialCommunityIcons name="magnify" color={theme.colors.textMuted} size={24} />
              <Text style={styles.emojiPickerSearchText}>חיפוש</Text>
            </View>
            <ScrollView>
              <Text style={styles.emojiCategoryTitle}>בשימוש תדיר</Text>
              <View style={styles.emojiGrid}>
                {["👍", "❤️", "😂", "😮", "😢", "🙏", "😜", "🔥", "💯", "✅", "🙌", "✨", "🎉", "🎈", "🎂", "🚀", "🎸", "🍕", "🍔", "🍦"].map(e => (
                  <Pressable key={e} onPress={() => { toggleReaction(showEmojiPickerForId, e); setShowEmojiPickerForId(null); if (selectedIds.includes(showEmojiPickerForId)) toggleSelection(showEmojiPickerForId); }} style={styles.emojiCell}>
                    <Text style={styles.emojiCellText}>{e}</Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </View>
        </View>
      ) : null}

      {toastMessage ? (
        <View pointerEvents="none" style={styles.toastContainer}>
          <View style={styles.toastPill}>
            <ImageBackground
              source={require("../../public/images/black_icon.png")}
              style={styles.toastIcon}
              imageStyle={{ opacity: 0.7 }}
            />
            <Text style={styles.toastText}>{toastMessage}</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

function MenuItem({ label, secondary, onPress }: { label: string; secondary?: string; onPress: () => void }) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme, { top: 0, bottom: 0, left: 0, right: 0 }), [theme]);

  return (
    <Pressable onPress={onPress} style={styles.menuItem}>
      <Text style={styles.menuItemText}>{label}</Text>
      {secondary ? <Text style={styles.menuItemSecondary}>{secondary}</Text> : null}
    </Pressable>
  );
}

function SheetButton({ label, onPress, danger }: { label: string; onPress: () => void; danger?: boolean }) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme, { top: 0, bottom: 0, left: 0, right: 0 }), [theme]);

  return (
    <Pressable onPress={onPress} style={styles.sheetButton}>
      <Text style={[styles.sheetButtonText, danger && styles.sheetButtonDanger]}>{label}</Text>
    </Pressable>
  );
}

const createStyles = (theme: ReturnType<typeof useAppTheme>, insets: { top: number; bottom: number; left: number; right: number }) =>
  StyleSheet.create({
    rowSelected: {
      backgroundColor: "rgba(0,168,132,0.18)",
    },
    header: {
      backgroundColor: theme.colors.header,
      flexDirection: "row",
      alignItems: "center",
      gap: 16,
      paddingHorizontal: 12,
      height: 58, // STRICT FIXED HEIGHT
    },
    headerButton: {
      width: 40,
      height: 40,
      borderRadius: theme.radius.pill,
      alignItems: "center",
      justifyContent: "center",
    },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: theme.radius.pill,
      backgroundColor: "rgba(255,255,255,0.22)",
      alignItems: "center",
      justifyContent: "center",
    },
    avatarText: {
      color: theme.colors.textOnAccent,
      fontWeight: "800",
    },
    headerCopy: {
      flex: 1,
    },
    title: {
      color: theme.colors.textOnAccent,
      fontSize: 17,
      fontWeight: "700",
    },
    subtitle: {
      color: "rgba(255,255,255,0.82)",
      fontSize: 12,
      marginTop: 1,
    },
    selectionCount: {
      color: theme.colors.textOnAccent,
      fontSize: 20,
      fontWeight: "700",
      marginLeft: 4,
    },
    selectionActions: {
      flexDirection: "row",
      alignItems: "center",
      marginLeft: "auto",
      gap: 2,
    },
    searchBar: {
      backgroundColor: theme.colors.surface,
      marginHorizontal: theme.spacing.md,
      marginTop: theme.spacing.sm,
      borderRadius: theme.radius.pill,
      paddingHorizontal: 14,
      minHeight: 44,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    searchInput: {
      flex: 1,
      color: theme.colors.text,
      fontSize: 14,
      paddingVertical: 10,
    },

    thread: {
      flex: 1,
      backgroundColor: "transparent",
      overflow: "hidden",
    },
    backgroundLayer: {
      ...StyleSheet.absoluteFillObject,
      transform: [{ scale: 1.8 }], // Increase scale for zoomed doodles on mobile
      zIndex: -1,
    },
    backgroundImage: {
      width: "100%",
      height: "100%",
    },
    scrollContent: {
      flexGrow: 1,
      paddingHorizontal: 0,
      paddingVertical: theme.spacing.md,
    },
    dateSeparator: {
      alignItems: "center",
      marginVertical: 12,
      width: "100%",
    },
    datePill: {
      backgroundColor: "rgba(32,44,51,0.92)",
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: 8,
    },
    datePillText: {
      color: theme.colors.textMuted,
      fontSize: 12,
      fontWeight: "600",
    },
    emptyState: {
      marginTop: "auto",
      marginBottom: "auto",
      alignSelf: "center",
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.lg,
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.md,
      gap: 4,
      borderColor: theme.colors.separator,
      borderWidth: 1,
    },
    emptyTitle: {
      color: theme.colors.text,
      fontSize: 16,
      fontWeight: "700",
      textAlign: "center",
    },
    emptySubtitle: {
      color: theme.colors.textMuted,
      textAlign: "center",
      lineHeight: 20,
    },
    overlayRoot: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 100, // Increased z-index
      justifyContent: "flex-start",
    },
    overlayRootCenter: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 100,
      justifyContent: "center",
      alignItems: "center",
      padding: theme.spacing.xl,
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: theme.colors.overlay,
    },
    menuCard: {
      position: "absolute",
      top: insets.top + 56, // status bar + header height → right below the 3-dot button
      right: 8,
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.md,
      minWidth: 160, // Adjusted width
      overflow: "hidden",
      shadowColor: "#000000",
      shadowOpacity: 0.18,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 6 },
      elevation: 5,
    },
    menuItem: {
      paddingHorizontal: 20,
      paddingVertical: 14,
    },
    menuItemText: {
      color: theme.colors.text,
      fontSize: 16,
      fontWeight: "500",
    },
    menuItemSecondary: {
      color: theme.colors.textMuted,
      fontSize: 12,
      marginTop: 3,
    },
    sheetCard: {
      marginTop: "auto",
      backgroundColor: theme.colors.surface,
      borderTopLeftRadius: theme.radius.xl,
      borderTopRightRadius: theme.radius.xl,
      paddingHorizontal: theme.spacing.md,
      paddingTop: theme.spacing.md,
      paddingBottom: theme.spacing.xl,
      gap: 2,
    },
    sheetTitle: {
      color: theme.colors.text,
      fontSize: 18,
      fontWeight: "800",
      marginBottom: 8,
    },
    sheetButton: {
      paddingVertical: 14,
    },
    sheetButtonText: {
      color: theme.colors.text,
      fontSize: 16,
      fontWeight: "600",
    },
    sheetButtonDanger: {
      color: theme.colors.danger,
    },
    deleteModalCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
      width: "100%",
      maxWidth: 320,
      padding: 24,
      shadowColor: "#000",
      shadowOpacity: 0.25,
      shadowRadius: 15,
      elevation: 20,
    },
    deleteModalTitle: {
      color: theme.colors.text,
      fontSize: 17,
      fontWeight: "600",
      marginBottom: 20,
      textAlign: "right",
    },
    deleteModalActions: {
      gap: 16,
      alignItems: "flex-end",
    },
    deleteModalAction: {
      paddingVertical: 8,
    },
    deleteModalActionText: {
      color: "#00A884", // WhatsApp green
      fontSize: 16,
      fontWeight: "700",
    },
    fullscreenOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: theme.colors.background,
      zIndex: 200,
    },
    infoTitleRow: {
      height: 58,
      backgroundColor: theme.colors.header,
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 12,
      gap: 16,
    },
    infoTitle: {
      color: theme.colors.textOnAccent,
      fontSize: 20,
      fontWeight: "700",
      textAlign: "right",
      flex: 1,
    },
    infoScroll: {
      paddingBottom: 40,
    },
    infoBubbleRow: {
      paddingVertical: 20,
      backgroundColor: "rgba(0,0,0,0.1)",
    },
    infoSection: {
      paddingHorizontal: 24,
      marginTop: 24,
    },
    infoSectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginBottom: 16,
    },
    infoSectionTitle: {
      color: "#00A884",
      fontSize: 15,
      fontWeight: "700",
    },
    infoUserRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 16,
      marginBottom: 20,
    },
    infoUserText: {
      flex: 1,
    },
    infoUsername: {
      color: theme.colors.text,
      fontSize: 16,
      fontWeight: "600",
      textAlign: "right",
    },
    infoUserTime: {
      color: theme.colors.textMuted,
      fontSize: 13,
      textAlign: "right",
      marginTop: 2,
    },
    reactionsSheet: {
      marginTop: "auto",
      backgroundColor: "#0b141a",
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingBottom: 40,
      minHeight: 400,
      width: "100%",
    },
    sheetHandle: {
      width: 40,
      height: 4,
      backgroundColor: "rgba(255,255,255,0.1)",
      borderRadius: 2,
      alignSelf: "center",
      marginTop: 12,
    },
    reactionsSheetHeader: {
      color: theme.colors.text,
      fontSize: 16,
      fontWeight: "700",
      textAlign: "right",
      padding: 24,
    },
    reactionTabs: {
      flexDirection: "row",
      paddingHorizontal: 24,
      marginBottom: 16,
      borderBottomWidth: 1,
      borderColor: "rgba(255,255,255,0.05)",
    },
    reactionTabActive: {
      paddingBottom: 12,
      borderBottomWidth: 3,
      borderColor: "#00A884",
    },
    reactionTabText: {
      color: "#00A884",
      fontSize: 15,
      fontWeight: "700",
    },
    reactionUserList: {
      paddingHorizontal: 24,
    },
    reactionUserRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 16,
    },
    reactionUserInfo: {
      flex: 1,
    },
    reactionUserName: {
      color: theme.colors.text,
      fontSize: 16,
      fontWeight: "600",
      textAlign: "right",
    },
    reactionUserAction: {
      color: theme.colors.textMuted,
      fontSize: 13,
      textAlign: "right",
    },
    reactionEmoji: {
      fontSize: 16,
      marginRight: 8,
    },
    emojiPickerSheet: {
      marginTop: "auto",
      backgroundColor: "#0b141a",
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingBottom: 40,
      height: "70%",
      width: "100%",
    },
    emojiPickerSearch: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: "rgba(255,255,255,0.05)",
      margin: 20,
      borderRadius: 30,
      paddingHorizontal: 16,
      paddingVertical: 10,
      gap: 12,
    },
    emojiPickerSearchText: {
      color: theme.colors.textMuted,
      fontSize: 16,
    },
    emojiCategoryTitle: {
      color: theme.colors.textMuted,
      fontSize: 13,
      fontWeight: "700",
      textAlign: "right",
      paddingHorizontal: 24,
      marginBottom: 16,
    },
    emojiGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      paddingHorizontal: 16,
    },
    emojiCell: {
      width: "14.28%", // 7 columns
      aspectRatio: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    emojiCellText: {
      fontSize: 28,
    },
    toastContainer: {
      position: "absolute",
      bottom: 100,
      left: 0,
      right: 0,
      alignItems: "center",
      zIndex: 1000,
    },
    toastPill: {
      backgroundColor: "rgba(32,44,51,0.92)",
      borderRadius: 30,
      paddingHorizontal: 20,
      paddingVertical: 10,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      shadowColor: "#000",
      shadowOpacity: 0.3,
      shadowRadius: 10,
      elevation: 10,
    },
    toastIcon: {
      width: 20,
      height: 20,
    },
    toastText: {
      color: "#ffffff",
      fontSize: 14,
      fontWeight: "600",
    },
  });

