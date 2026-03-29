import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View, TouchableHighlight } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMemo, useRef, useState } from "react";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { useChats } from "@/context/ChatContext";
import { Chat, ChatLocalPreferences, ChatMuteSetting } from "@/lib/types";
import { useAppTheme } from "@/lib/theme";
import { webEmbeddedInputReset } from "@/lib/webStyles";

type Props = {
  onOpenChat: (chat: Chat) => void;
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
    loading,
  } = useChats();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedChatIds, setSelectedChatIds] = useState<string[]>([]);
  const [showGeneralMenu, setShowGeneralMenu] = useState(false);
  const [showSelectionMenu, setShowSelectionMenu] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("home");
  const searchInputRef = useRef<TextInput | null>(null);

  const selectionMode = selectedChatIds.length > 0;

  const displayChats = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return chats
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
        } satisfies DisplayChat;
      })
      .filter((item) => {
        if (!normalizedQuery) {
          return true;
        }

        return [item.chat.title, item.preview].some((value) => value.toLowerCase().includes(normalizedQuery));
      })
      .sort(sortDisplayChats);
  }, [chatPreferences, chats, muteSettings, searchQuery, unreadCounts]);

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

  function handleChatPress(chat: Chat) {
    if (selectionMode) {
      toggleSelection(chat.id);
      return;
    }

    onOpenChat(chat);
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

  function handleClearLocally() {
    if (!selectedChatIds.length) {
      return;
    }

    Alert.alert(
      "לנקות צ'אט במכשיר זה?",
      "פעולה זו תסתיר את ההודעות הקיימות רק במכשיר זה. הודעות חדשות ימשיכו להגיע כרגיל.",
      [
        { text: "ביטול", style: "cancel" },
        {
          text: "ניקוי",
          style: "destructive",
          onPress: () => {
            clearChatsLocally(selectedChatIds);
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
        key={item.chat.id}
        underlayColor={theme.colors.homeSelection}
        delayPressIn={75}
        delayLongPress={220}
        onLongPress={() => toggleSelection(item.chat.id)}
        onPress={() => handleChatPress(item.chat)}
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
              <Text style={styles.brand}>Secure</Text>
              <View style={{ flexDirection: "row", gap: 6 }}>
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
          {viewMode === "home" ? (
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
        </ScrollView>

        {viewMode === "home" && !selectionMode ? (
          <Pressable style={styles.fab} onPress={onCreateChat}>
            <MaterialCommunityIcons color="#ffffff" name="message-plus" size={26} />
          </Pressable>
        ) : null}

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
              <MenuItem danger label="ניקוי במכשיר זה" onPress={handleClearLocally} />
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
      color: theme.colors.text,
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
      paddingBottom: 40,
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
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: theme.colors.overlay,
    },
    menuCard: {
      position: "absolute",
      top: 54 + insets.top,
      right: 10,
      minWidth: 220,
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
    },
    menuItemText: {
      color: theme.colors.text,
      fontSize: 15,
      fontWeight: "600",
    },
    menuItemDanger: {
      color: theme.colors.danger,
    },
    fab: {
      position: "absolute",
      bottom: 24,
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
  });
