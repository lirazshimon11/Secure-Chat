import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View, TouchableHighlight, useColorScheme } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMemo, useRef, useState, useEffect } from "react";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { useChats } from "@/context/ChatContext";
import { Chat, ChatLocalPreferences, ChatMuteSetting } from "@/lib/types";
import { useAppTheme } from "@/lib/theme";
import { webEmbeddedInputReset } from "@/lib/webStyles";
import { useScreenshots } from "@/context/ScreenshotContext";

type Props = {
  onOpenChat: (chat: Chat, messageId?: string) => void;
  onOpenSavedMessages: () => void;
  onOpenSettings: () => void;
  onCreateChat: () => void;
};

type ViewMode = "home" | "locked" | "archived";

type DisplayChat = {
  chat: Chat;
  preferences: ChatLocalPreferences;
  unreadCount: number;
  muted: boolean;
  hiddenByClear: boolean;
  preview: string;
  timeLabel: string;
  type: "chat" | "message";
  matchedMessageId?: string;
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

function getDefaultPreferences(): ChatLocalPreferences {
  return {
    archived: false,
    pinned_at: null,
    locked: false,
    cleared_at: null,
    deleted_from_home_at: null,
  };
}

function isHiddenByClear(chat: Chat, preferences: ChatLocalPreferences) {
  if (!preferences.cleared_at) {
    return false;
  }

  if (!chat.last_message_at) {
    return true;
  }

  return new Date(chat.last_message_at).getTime() <= new Date(preferences.cleared_at).getTime();
}

function formatChatTime(chat: Chat, hiddenByClear: boolean) {
  if (hiddenByClear || !chat.last_message_at) {
    return "";
  }

  const d = new Date(chat.last_message_at);
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")} `;
}

function sortDisplayChats(a: DisplayChat, b: DisplayChat) {
  const aPinned = a.preferences.pinned_at ? new Date(a.preferences.pinned_at).getTime() : 0;
  const bPinned = b.preferences.pinned_at ? new Date(b.preferences.pinned_at).getTime() : 0;

  if (aPinned !== bPinned) {
    return bPinned - aPinned;
  }

  const aLastMessageAt = a.chat.last_message_at ? new Date(a.chat.last_message_at).getTime() : 0;
  const bLastMessageAt = b.chat.last_message_at ? new Date(b.chat.last_message_at).getTime() : 0;
  return bLastMessageAt - aLastMessageAt;
}

export function ChatsScreen({ onOpenChat, onOpenSavedMessages, onOpenSettings, onCreateChat }: Props) {
  const theme = useAppTheme();
  const scheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const styles = createStyles(theme, insets);
  const {
    chats,
    muteSettings,
    unreadCounts,
    chatPreferences,
    archiveChats,
    unarchiveChats,
    togglePinnedChats,
    lockChats,
    unlockChats,
    clearChatsLocally,
    deleteChats,
    loading,
    searchMessagesGlobal,
  } = useChats();
  const { incomingRequests, myRequests, approveRequest, denyRequest, screenshotPendingCount } = useScreenshots();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedChatIds, setSelectedChatIds] = useState<string[]>([]);
  const [showGeneralMenu, setShowGeneralMenu] = useState(false);
  const [showSelectionMenu, setShowSelectionMenu] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("home");
  const [activeTab, setActiveTab] = useState<"chats" | "communities" | "updates" | "calls">("chats");
  const searchInputRef = useRef<TextInput | null>(null);

  const selectionMode = selectedChatIds.length > 0;

  const [messageSearchResults, setMessageSearchResults] = useState<{ chat_id: string, message: import("@/lib/types").Message }[]>([]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setMessageSearchResults([]);
      return;
    }
    const timeout = setTimeout(async () => {
      const res = await searchMessagesGlobal(searchQuery);
      setMessageSearchResults(res);
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchQuery, searchMessagesGlobal]);

  const displayChats = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    const regularResults: DisplayChat[] = chats
      .map((chat) => {
        const preferences = chatPreferences[chat.id] ?? getDefaultPreferences();
        const hiddenByClear = isHiddenByClear(chat, preferences);
        const unreadCount = hiddenByClear ? 0 : unreadCounts[chat.id] ?? 0;
        const muted = isChatMuted(muteSettings[chat.id]);

        return {
          chat,
          preferences,
          unreadCount,
          muted,
          hiddenByClear,
          preview: hiddenByClear ? "הצ'אט נוקה במכשיר זה" : chat.last_message_preview ?? "אין הודעות עדיין",
          timeLabel: formatChatTime(chat, hiddenByClear),
          type: "chat",
        } satisfies DisplayChat;
      })
      .filter((item) => {
        // If chat is marked as deleted locally and hasn't received new messages since then, hide it completely.
        const deletedAt = item.preferences.deleted_from_home_at ? new Date(item.preferences.deleted_from_home_at).getTime() : 0;
        const lastActivity = item.chat.last_message_at ? new Date(item.chat.last_message_at).getTime() : 0;

        // Hide if deleted and no newer messages, unless user is actively searching
        if (!normalizedQuery && deletedAt > 0 && deletedAt >= lastActivity) {
          return false;
        }

        if (!normalizedQuery) {
          return true;
        }

        return [item.chat.title, item.preview].some((value) => value.toLowerCase().includes(normalizedQuery));
      });

    const combined = [...regularResults];

    if (normalizedQuery && messageSearchResults.length > 0) {
      for (const { chat_id, message } of messageSearchResults) {
        const chat = chats.find(c => c.id === chat_id);
        if (chat) {
          const preferences = chatPreferences[chat.id] ?? getDefaultPreferences();
          combined.push({
            chat,
            preferences,
            unreadCount: 0,
            muted: isChatMuted(muteSettings[chat.id]),
            hiddenByClear: isHiddenByClear(chat, preferences),
            preview: message.body_ciphertext,
            timeLabel: formatChatTime({ ...chat, last_message_at: message.created_at } as Chat, false),
            type: "message",
            matchedMessageId: message.id,
          });
        }
      }
    }

    return combined.sort((a, b) => {
      if (a.type !== b.type) {
        // show chats first, then messages
        return a.type === "chat" ? -1 : 1;
      }
      return sortDisplayChats(a, b);
    });
  }, [chatPreferences, chats, muteSettings, searchQuery, unreadCounts, messageSearchResults]);

  const lockedChats = useMemo(() => displayChats.filter((item) => item.preferences.locked), [displayChats]);
  const archivedChats = useMemo(
    () => displayChats.filter((item) => item.preferences.archived && !item.preferences.locked),
    [displayChats],
  );
  const regularChats = useMemo(
    () => displayChats.filter((item) => !item.preferences.locked && !item.preferences.archived),
    [displayChats],
  );

  const activeChats = viewMode === "locked" ? lockedChats : viewMode === "archived" ? archivedChats : regularChats;
  const allSelectedArchived = selectionMode && selectedChatIds.every((chatId) => (chatPreferences[chatId] ?? getDefaultPreferences()).archived);
  const allSelectedPinned = selectionMode && selectedChatIds.every((chatId) => Boolean((chatPreferences[chatId] ?? getDefaultPreferences()).pinned_at));
  const allSelectedLocked = selectionMode && selectedChatIds.every((chatId) => (chatPreferences[chatId] ?? getDefaultPreferences()).locked);

  function clearSelection() {
    setSelectedChatIds([]);
    setShowSelectionMenu(false);
  }

  function toggleSelection(chatId: string) {
    setSelectedChatIds((current) =>
      current.includes(chatId) ? current.filter((id) => id !== chatId) : [...current, chatId],
    );
  }

  function handleChatPress(chat: Chat, matchedMessageId?: string) {
    if (selectionMode) {
      toggleSelection(chat.id);
      return;
    }

    onOpenChat(chat, matchedMessageId);
  }

  function handleArchiveToggle() {
    if (!selectedChatIds.length) {
      return;
    }

    if (allSelectedArchived) {
      unarchiveChats(selectedChatIds);
    } else {
      archiveChats(selectedChatIds);
    }

    clearSelection();
  }

  function handlePinToggle() {
    if (!selectedChatIds.length) {
      return;
    }

    togglePinnedChats(selectedChatIds);
    clearSelection();
  }

  function handleLockToggle() {
    if (!selectedChatIds.length) {
      return;
    }

    if (allSelectedLocked) {
      unlockChats(selectedChatIds);
    } else {
      lockChats(selectedChatIds);
    }

    clearSelection();
  }

  function handleDeleteChats() {
    if (!selectedChatIds.length) {
      return;
    }

    Alert.alert(
      "מחיקת צ'אט?",
      "האם אתה אינך בטוח שברצונך למחוק את הצ'אט(ים) שנבחר(ו)? פעולה זו לא ניתנת לביטול.",
      [
        { text: "ביטול", style: "cancel" },
        {
          text: "מחיקה",
          style: "destructive",
          onPress: () => {
            deleteChats(selectedChatIds);
            clearSelection();
          },
        },
      ],
    );
  }

  function renderChatRow(item: DisplayChat) {
    const selected = selectedChatIds.includes(item.chat.id);

    return (
      <TouchableHighlight
        key={item.matchedMessageId ? `msg-${item.matchedMessageId}` : `chat-${item.chat.id}`}
        underlayColor={theme.colors.homeSelection}
        delayPressIn={75}
        delayLongPress={220}
        onLongPress={() => toggleSelection(item.chat.id)}
        onPress={() => handleChatPress(item.chat, item.matchedMessageId)}
        style={[
          styles.chatRow,
          selected && styles.chatRowSelected,
        ]}
      >
        <View style={{ flexDirection: "row", alignItems: "center", width: "100%", gap: 12 }}>
          <View style={styles.avatarWrap}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{item.chat.title.slice(0, 1).toUpperCase()}</Text>
            </View>
            {selected ? (
              <View style={styles.selectedBadge}>
                <MaterialCommunityIcons color={theme.colors.textOnAccent} name="check" size={13} />
              </View>
            ) : null}
          </View>

          <View style={styles.chatMain}>
            <View style={styles.chatTopRow}>
              <View style={styles.titleWrap}>
                <Text numberOfLines={1} style={styles.chatTitle}>
                  {item.chat.title}
                </Text>
                {item.preferences.locked ? <Feather color={theme.colors.textMuted} name="lock" size={13} /> : null}
                {item.preferences.pinned_at ? <MaterialCommunityIcons color={theme.colors.textMuted} name="pin" size={13} /> : null}
                {item.muted ? <Feather color={theme.colors.textMuted} name="bell-off" size={13} /> : null}
              </View>
              <View style={styles.trailingWrap}>
                {item.timeLabel ? <Text style={[styles.chatTime, item.unreadCount > 0 && styles.chatTimeUnread]}>{item.timeLabel}</Text> : null}
                {item.unreadCount > 0 ? (
                  <View style={styles.unreadBadge}>
                    <Text style={styles.unreadBadgeText}>{item.unreadCount > 99 ? "99+" : item.unreadCount}</Text>
                  </View>
                ) : null}
              </View>
            </View>
            <Text numberOfLines={1} style={[styles.chatPreview, item.unreadCount > 0 && styles.chatPreviewUnread, item.hiddenByClear && styles.chatPreviewCleared]}>
              {item.preview}
            </Text>
          </View>
        </View>
      </TouchableHighlight>
    );
  }

  return (
    <Screen>
      <View style={styles.page}>
        <View style={styles.header}>
          {selectionMode ? (
            <>
              <Pressable onPress={clearSelection} style={styles.iconButton}>
                <Feather color={theme.colors.text} name="arrow-left" size={22} />
              </Pressable>
              <Text style={styles.selectionTitle}>{selectedChatIds.length}</Text>
              <View style={styles.selectionActions}>
                <Pressable onPress={handleArchiveToggle} style={styles.iconButton}>
                  <MaterialCommunityIcons color={theme.colors.text} name={allSelectedArchived ? "archive-arrow-up-outline" : "archive-arrow-down-outline"} size={22} />
                </Pressable>
                <Pressable onPress={handlePinToggle} style={styles.iconButton}>
                  <MaterialCommunityIcons color={theme.colors.text} name={allSelectedPinned ? "pin-off-outline" : "pin-outline"} size={21} />
                </Pressable>
                <Pressable onPress={handleDeleteChats} style={styles.iconButton}>
                  <MaterialCommunityIcons color={theme.colors.text} name="trash-can-outline" size={23} />
                </Pressable>
                <Pressable onPress={handleLockToggle} style={styles.iconButton}>
                  <MaterialCommunityIcons color={theme.colors.text} name={allSelectedLocked ? "lock-open-variant-outline" : "lock-outline"} size={22} />
                </Pressable>
                <Pressable onPress={() => setShowSelectionMenu(true)} style={styles.iconButton}>
                  <MaterialCommunityIcons color={theme.colors.text} name="dots-vertical" size={22} />
                </Pressable>
              </View>
            </>
          ) : viewMode === "home" ? (
            <>
              <Text style={styles.brand}>SecureApp</Text>
              <View style={{ flexDirection: "row", gap: 2 }}>
                <Pressable style={styles.iconButton}>
                  <MaterialCommunityIcons color={theme.colors.text} name="camera-outline" size={24} />
                </Pressable>
                <Pressable onPress={() => setShowGeneralMenu(true)} style={styles.iconButton}>
                  <MaterialCommunityIcons color={theme.colors.text} name="dots-vertical" size={24} />
                </Pressable>
              </View>
            </>
          ) : (
            <>
              <Pressable onPress={() => setViewMode("home")} style={styles.iconButton}>
                <Feather color={theme.colors.text} name="arrow-left" size={22} />
              </Pressable>
              <Text style={styles.brand}>{viewMode === "locked" ? "צ'אטים נעולים" : "ארכיון"}</Text>
            </>
          )}
        </View>

        <View style={styles.searchShell}>
          <Feather color={theme.colors.textMuted} name="search" size={18} />
          <TextInput
            onChangeText={setSearchQuery}
            placeholder={viewMode === "home" ? "חיפוש" : `חיפוש ב${viewMode === "locked" ? "צ'אטים נעולים" : "ארכיון"}`}
            placeholderTextColor={theme.colors.textMuted}
            ref={searchInputRef}
            style={[styles.searchInput, webEmbeddedInputReset]}
            value={searchQuery}
          />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {activeTab === "chats" && viewMode === "home" ? (
            <>
              <Pressable onPress={() => setViewMode("locked")} style={styles.sectionButton}>
                <View style={styles.sectionLeft}>
                  <View style={styles.sectionIconWrap}>
                    <Feather color={theme.colors.textMuted} name="lock" size={18} />
                  </View>
                  <Text style={styles.sectionLabel}>צ'אטים נעולים</Text>
                </View>
              </Pressable>

              <Pressable onPress={() => setViewMode("archived")} style={styles.sectionButton}>
                <View style={styles.sectionLeft}>
                  <View style={styles.sectionIconWrap}>
                    <MaterialCommunityIcons color={theme.colors.textMuted} name="archive-arrow-down-outline" size={18} />
                  </View>
                  <Text style={styles.sectionLabel}>ארכיון</Text>
                </View>
              </Pressable>
            </>
          ) : null}

          {activeTab === "updates" ? (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons color={theme.colors.textMuted} name="update" size={48} />
              <Text style={styles.emptyTitle}>אין עדכונים כרגע</Text>
              <Text style={styles.emptySubtitle}>
                עדכונים נוספים יופיעו כאן בעתיד.
              </Text>
            </View>
          ) : activeTab !== "chats" ? (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons color={theme.colors.textMuted} name="tools" size={38} />
              <Text style={styles.emptyTitle}>בקרוב</Text>
              <Text style={styles.emptySubtitle}>תכונה זו תהיה זמינה בקרוב.</Text>
            </View>
          ) : (
            <>
              {loading ? <Text style={styles.statusText}>מסנכרן צ'אטים...</Text> : null}
              {activeChats.length ? (
                activeChats.map((item) => renderChatRow(item))
              ) : !loading ? (
                <View style={styles.emptyState}>
                  <MaterialCommunityIcons color={theme.colors.textMuted} name="message-text-outline" size={38} />
                  <Text style={styles.emptyTitle}>
                    {viewMode === "locked" ? "אין צ'אטים נעולים" : viewMode === "archived" ? "הארכיון ריק" : "אין עדיין צ'אטים"}
                  </Text>
                  <Text style={styles.emptySubtitle}>
                    {viewMode === "home"
                      ? "השתמשו בתפריט לפתיחת קבוצה חדשה או הודעות שמורות."
                      : "לחיצה ארוכה על צ'אט מהרשימה תעביר אותו לכאן."}
                  </Text>
                </View>
              ) : null}
            </>
          )}
        </ScrollView>

        {viewMode === "home" && !selectionMode ? (
          <Pressable style={styles.fab} onPress={onCreateChat}>
            <MaterialCommunityIcons color="#ffffff" name="message-plus" size={26} />
          </Pressable>
        ) : null}

        {/* Bottom Tab Bar — JSX order is RTL-reversed so visual order = שיחות|קהילות|עדכונים|צ'אטים */}
        <View style={styles.tabBar}>
          {/* צ'אטים — rightmost in RTL */}
          <Pressable style={styles.tabItem} onPress={() => setActiveTab("chats")}>
            <View style={[styles.tabIconWrap, activeTab === "chats" && styles.tabIconWrapActive]}>
              <Image
                source={
                  activeTab === "chats"
                    ? require("../../public/images/light mode/chats_icon.png")
                    : scheme === "dark"
                      ? require("../../public/images/dark mode/chats_icon.png")
                      : require("../../public/images/light mode/chats_icon.png")
                }
                style={[styles.tabIcon, { tintColor: activeTab === "chats" ? "#ffffff" : theme.colors.textMuted }]}
              />
            </View>
            <Text style={[styles.tabLabel, activeTab === "chats" && styles.tabLabelActive]}>צ'אטים</Text>
          </Pressable>

          {/* עדכונים */}
          <Pressable style={styles.tabItem} onPress={() => setActiveTab("updates")}>
            <View style={{ position: "relative" }}>
              <Image
                source={
                  scheme === "dark"
                    ? require("../../public/images/dark mode/updates_icon.png")
                    : require("../../public/images/light mode/updates_icon.png")
                }
                style={[styles.tabIcon, { tintColor: activeTab === "updates" ? theme.colors.accentStrong : theme.colors.textMuted }]}
              />
              {screenshotPendingCount > 0 ? (
                <View style={styles.tabBadge}>
                  <Text style={styles.tabBadgeText}>{screenshotPendingCount > 9 ? "9+" : screenshotPendingCount}</Text>
                </View>
              ) : null}
            </View>
            <Text style={[styles.tabLabel, activeTab === "updates" && styles.tabLabelActive]}>עדכונים</Text>
          </Pressable>

          {/* קהילות */}
          <Pressable style={styles.tabItem} onPress={() => setActiveTab("communities")}>
            <Image
              source={
                scheme === "dark"
                  ? require("../../public/images/dark mode/communities_icon.png")
                  : require("../../public/images/light mode/communities_icon.png")
              }
              style={[styles.tabIcon, { tintColor: activeTab === "communities" ? theme.colors.accentStrong : theme.colors.textMuted }]}
            />
            <Text style={[styles.tabLabel, activeTab === "communities" && styles.tabLabelActive]}>קהילות</Text>
          </Pressable>

          {/* שיחות — leftmost in RTL */}
          <Pressable style={styles.tabItem} onPress={() => setActiveTab("calls")}>
            <Image
              source={
                scheme === "dark"
                  ? require("../../public/images/dark mode/voice_call_icon.png")
                  : require("../../public/images/light mode/voice_call_icon.png")
              }
              style={[styles.tabIcon, { tintColor: activeTab === "calls" ? theme.colors.accentStrong : theme.colors.textMuted }]}
            />
            <Text style={[styles.tabLabel, activeTab === "calls" && styles.tabLabelActive]}>שיחות</Text>
          </Pressable>
        </View>

        {showGeneralMenu && !selectionMode ? (
          <View pointerEvents="box-none" style={styles.overlayRoot}>
            <Pressable onPress={() => setShowGeneralMenu(false)} style={styles.backdrop} />
            <View style={styles.menuCard}>
              <MenuItem
                label="קבוצה חדשה"
                onPress={() => {
                  setShowGeneralMenu(false);
                  onCreateChat();
                }}
              />
              <MenuItem
                label="הודעות שמורות"
                onPress={() => {
                  setShowGeneralMenu(false);
                  onOpenSavedMessages();
                }}
              />
              <MenuItem
                label="הגדרות"
                onPress={() => {
                  setShowGeneralMenu(false);
                  onOpenSettings();
                }}
              />
            </View>
          </View>
        ) : null}

        {showSelectionMenu && selectionMode ? (
          <View pointerEvents="box-none" style={styles.overlayRoot}>
            <Pressable onPress={() => setShowSelectionMenu(false)} style={styles.backdrop} />
            <View style={styles.menuCard}>
              <MenuItem label={allSelectedArchived ? "הוצאה מהארכיון" : "העברה לארכיון"} onPress={handleArchiveToggle} />
              <MenuItem label={allSelectedPinned ? "ביטול הצמדה" : "הצמדה"} onPress={handlePinToggle} />
              <MenuItem label={allSelectedLocked ? "ביטול נעילה" : "נעילת צ'אט"} onPress={handleLockToggle} />
              <MenuItem danger label="מחיקת צ'אט" onPress={handleDeleteChats} />
            </View>
          </View>
        ) : null}
      </View>
    </Screen>
  );
}

function MenuItem({ label, onPress, danger }: { label: string; onPress: () => void; danger?: boolean }) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const styles = createStyles(theme, insets);

  return (
    <Pressable onPress={onPress} style={styles.menuItem}>
      <Text style={[styles.menuItemText, danger && styles.menuItemDanger]}>{label}</Text>
    </Pressable>
  );
}

const createStyles = (theme: ReturnType<typeof useAppTheme>, insets: ReturnType<typeof useSafeAreaInsets>) =>
  StyleSheet.create({
    page: {
      flex: 1,
      backgroundColor: theme.colors.homeBackground,
      paddingTop: insets.top,
    },
    header: {
      minHeight: 58,
      backgroundColor: theme.colors.homeHeader,
      paddingHorizontal: theme.spacing.md,
      paddingTop: theme.spacing.sm,
      paddingBottom: theme.spacing.sm,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    brand: {
      flex: 1,
      color: "#008069",
      fontSize: 24,
      fontWeight: "700",
    },
    selectionTitle: {
      color: theme.colors.text,
      fontSize: 24,
      fontWeight: "800",
      marginLeft: 10,
    },
    selectionActions: {
      marginLeft: "auto",
      flexDirection: "row",
      alignItems: "center",
      gap: 2,
    },
    iconButton: {
      width: 38,
      height: 38,
      borderRadius: theme.radius.pill,
      alignItems: "center",
      justifyContent: "center",
    },
    searchShell: {
      marginHorizontal: theme.spacing.md,
      marginTop: theme.spacing.xs,
      marginBottom: theme.spacing.md,
      backgroundColor: theme.colors.homeSearch,
      borderRadius: theme.radius.xl,
      minHeight: 46,
      paddingHorizontal: 16,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    searchInput: {
      flex: 1,
      color: theme.colors.text,
      fontSize: 15,
      paddingVertical: 10,
    },
    scrollContent: {
      paddingBottom: 90,
    },
    sectionButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: theme.spacing.md,
      paddingVertical: 14,
      backgroundColor: theme.colors.homeRow,
    },
    sectionLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    sectionIconWrap: {
      width: 36,
      height: 36,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.surfaceAlt,
      alignItems: "center",
      justifyContent: "center",
    },
    sectionLabel: {
      color: theme.colors.text,
      fontSize: 17,
      fontWeight: "700",
    },
    sectionRight: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    sectionCount: {
      color: theme.colors.textMuted,
      fontSize: 13,
      fontWeight: "700",
    },
    statusText: {
      color: theme.colors.textMuted,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: 10,
    },
    chatRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingLeft: theme.spacing.md,
      paddingRight: theme.spacing.md,
      paddingVertical: 11,
      backgroundColor: theme.colors.homeRow,
    },
    chatRowSelected: {
      backgroundColor: theme.colors.homeSelection,
    },
    avatarWrap: {
      position: "relative",
    },
    avatar: {
      width: 54,
      height: 54,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.surfaceMuted,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarText: {
      color: theme.colors.accent,
      fontSize: 20,
      fontWeight: "800",
    },
    selectedBadge: {
      position: "absolute",
      right: -2,
      bottom: -2,
      width: 22,
      height: 22,
      borderRadius: theme.radius.pill,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.accentStrong,
      borderWidth: 2,
      borderColor: theme.colors.homeRow,
    },
    chatMain: {
      flex: 1,
      justifyContent: "center",
    },
    chatTopRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      gap: theme.spacing.sm,
    },
    titleWrap: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    chatTitle: {
      flexShrink: 1,
      color: theme.colors.text,
      fontSize: 17,
      fontWeight: "700",
    },
    trailingWrap: {
      alignItems: "flex-end",
      gap: 6,
    },
    chatTime: {
      color: theme.colors.textMuted,
      fontSize: 12,
    },
    chatTimeUnread: {
      color: theme.colors.accent,
      fontWeight: "700",
    },
    unreadBadge: {
      minWidth: 22,
      height: 22,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.accentStrong,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 6,
    },
    unreadBadgeText: {
      color: theme.colors.textOnAccent,
      fontSize: 11,
      fontWeight: "800",
    },
    chatPreview: {
      color: theme.colors.textMuted,
      fontSize: 14,
      marginTop: 4,
    },
    chatPreviewUnread: {
      color: theme.colors.text,
      fontWeight: "600",
    },
    chatPreviewCleared: {
      fontStyle: "italic",
    },
    emptyState: {
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: theme.spacing.xl,
      paddingTop: 90,
      gap: 8,
    },
    emptyTitle: {
      color: theme.colors.text,
      fontSize: 20,
      fontWeight: "800",
    },
    emptySubtitle: {
      color: theme.colors.textMuted,
      textAlign: "center",
      lineHeight: 22,
    },
    overlayRoot: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 40,
      justifyContent: "flex-start",
      alignItems: "flex-end",
      paddingEnd: 10,
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: theme.colors.overlay,
    },
    menuCard: {
      marginTop: 54 + insets.top,
      width: 230,
      borderRadius: theme.radius.md,
      overflow: "hidden",
      backgroundColor: theme.colors.surface,
      shadowColor: "#000000",
      shadowOpacity: 0.18,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 6 },
    },
    menuItem: {
      paddingHorizontal: 16,
      paddingVertical: 15,
      width: "100%",
      alignSelf: "stretch",
    },
    menuItemText: {
      color: theme.colors.text,
      fontSize: 15,
      fontWeight: "700",
      textAlign: "left",
    },
    menuItemDanger: {
      color: theme.colors.danger,
    },
    fab: {
      position: "absolute",
      bottom: 95 + insets.bottom,
      right: 20,
      width: 56,
      height: 56,
      borderRadius: 16,
      backgroundColor: theme.colors.accentStrong || "#00A884",
      alignItems: "center",
      justifyContent: "center",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 5,
    },
    tabBar: {
      flexDirection: "row",
      backgroundColor: theme.colors.homeHeader,
      borderTopWidth: 0.5,
      borderTopColor: theme.colors.border,
      paddingBottom: insets.bottom,
      paddingTop: 10,
    },
    tabItem: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingBottom: 6,
      gap: 4,
    },
    tabIcon: {
      width: 30,
      height: 30,
      resizeMode: "contain",
    },
    tabIconWrap: {
      width: 58,
      height: 32,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
    },
    tabIconWrapActive: {
      backgroundColor: theme.colors.accentStrong,
    },
    tabLabel: {
      color: theme.colors.textMuted,
      fontSize: 13,
      fontWeight: "700",
    },
    tabLabelActive: {
      color: theme.colors.accentStrong,
    },
    tabBadge: {
      position: "absolute",
      top: -4,
      right: -6,
      minWidth: 16,
      height: 16,
      borderRadius: 8,
      backgroundColor: "#E53935",
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 3,
    },
    tabBadgeText: {
      color: "#fff",
      fontSize: 10,
      fontWeight: "800",
    },
    // Screenshot request cards in Updates tab
    screenshotCard: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
      backgroundColor: theme.colors.homeRow,
      borderBottomWidth: 0.5,
      borderBottomColor: theme.colors.border,
    },
    screenshotAvatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: "#7B5000",
      alignItems: "center",
      justifyContent: "center",
    },
    screenshotAvatarText: {
      color: "#fff",
      fontWeight: "800",
      fontSize: 17,
    },
    screenshotCardTitle: {
      color: theme.colors.text,
      fontSize: 15,
      fontWeight: "700",
    },
    screenshotCardGroup: {
      color: theme.colors.textMuted,
      fontSize: 13,
    },
    screenshotCardSub: {
      color: theme.colors.textMuted,
      fontSize: 12,
    },
    screenshotCardActions: {
      flexDirection: "row",
      gap: 10,
      marginTop: 4,
    },
    screenshotBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingVertical: 7,
      paddingHorizontal: 18,
      borderRadius: 20,
    },
    screenshotBtnApprove: {
      backgroundColor: "#1B9D55",
    },
    screenshotBtnDeny: {
      backgroundColor: "#C0392B",
    },
    screenshotBtnText: {
      color: "#fff",
      fontWeight: "700",
      fontSize: 14,
    },
    screenshotMyCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: "#3D2A00",
      borderBottomWidth: 0.5,
      borderBottomColor: "#C87F00",
    },
    screenshotMyTitle: {
      color: "#FFD580",
      fontWeight: "700",
      fontSize: 14,
    },
    screenshotMyChat: {
      color: "#FFA726",
      fontSize: 13,
    },
    screenshotMySub: {
      color: "#FFCC80",
      fontSize: 12,
    },
  });

