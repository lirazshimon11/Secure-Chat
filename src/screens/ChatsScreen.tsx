import { Alert, Image, Pressable, ScrollView, Text, TextInput, View, useColorScheme } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMemo, useRef, useState, useEffect } from "react";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { useChats } from "@/context/ChatContext";
import { Chat } from "@/lib/types";
import { useAppTheme } from "@/lib/theme";
import { webEmbeddedInputReset } from "@/lib/webStyles";
import { useScreenshots } from "@/context/ScreenshotContext";

// Extracted modules
import { DisplayChat, isChatMuted, getDefaultPreferences, isHiddenByClear, formatChatTime, sortDisplayChats } from "./chats/ChatsUtils";
import { createStyles, chipStyles } from "./chats/ChatsStyles";
import { ChatRow } from "./chats/ChatRow";

type Props = {
  onOpenChat: (chat: Chat, messageId?: string) => void;
  onOpenSavedMessages: () => void;
  onOpenSettings: () => void;
  onCreateChat: () => void;
};

type ViewMode = "home" | "locked" | "archived";
type FilterTab = "all" | "unread" | "favorites" | "groups";

export function ChatsScreen({ onOpenChat, onOpenSavedMessages, onOpenSettings, onCreateChat }: Props) {
  const theme = useAppTheme();
  const scheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(theme, insets, scheme), [theme, insets, scheme]);
  
  const {
    chats, muteSettings, unreadCounts, chatPreferences, archiveChats, unarchiveChats,
    togglePinnedChats, lockChats, unlockChats, deleteChats, loading, searchMessagesGlobal
  } = useChats();
  
  const { screenshotPendingCount } = useScreenshots();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedChatIds, setSelectedChatIds] = useState<string[]>([]);
  const [showGeneralMenu, setShowGeneralMenu] = useState(false);
  const [showSelectionMenu, setShowSelectionMenu] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("home");
  const [activeTab, setActiveTab] = useState<"chats" | "communities" | "updates" | "calls">("chats");
  const [activeFilter, setActiveFilter] = useState<FilterTab>("all");
  const [messageSearchResults, setMessageSearchResults] = useState<any[]>([]);

  useEffect(() => {
    if (!searchQuery.trim()) { setMessageSearchResults([]); return; }
    const timeout = setTimeout(async () => {
      const res = await searchMessagesGlobal(searchQuery);
      setMessageSearchResults(res);
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchQuery, searchMessagesGlobal]);

  const displayChats = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    const regularResults: DisplayChat[] = chats.map((chat) => {
      const preferences = chatPreferences[chat.id] ?? getDefaultPreferences();
      const hiddenByClear = isHiddenByClear(chat, preferences);
      return {
        chat, preferences, unreadCount: hiddenByClear ? 0 : unreadCounts[chat.id] ?? 0,
        muted: isChatMuted(muteSettings[chat.id]), hiddenByClear,
        preview: hiddenByClear ? "הצ'אט נוקה במכשיר זה" : chat.last_message_preview ?? "אין הודעות עדיין",
        timeLabel: formatChatTime(chat, hiddenByClear), type: "chat",
      } satisfies DisplayChat;
    }).filter((item) => {
      const deletedAt = item.preferences.deleted_from_home_at ? new Date(item.preferences.deleted_from_home_at).getTime() : 0;
      const lastActivity = item.chat.last_message_at ? new Date(item.chat.last_message_at).getTime() : 0;
      if (!normalizedQuery && deletedAt > 0 && deletedAt >= lastActivity) return false;
      return !normalizedQuery || [item.chat.title, item.preview].some((v) => v.toLowerCase().includes(normalizedQuery));
    });

    const combined = [...regularResults];
    if (normalizedQuery && messageSearchResults.length > 0) {
      for (const { chat_id, message } of messageSearchResults) {
        const chat = chats.find(c => c.id === chat_id);
        if (chat) {
          const preferences = chatPreferences[chat.id] ?? getDefaultPreferences();
          combined.push({
            chat, preferences, unreadCount: 0, muted: isChatMuted(muteSettings[chat.id]),
            hiddenByClear: isHiddenByClear(chat, preferences), preview: message.body_ciphertext,
            timeLabel: formatChatTime({ ...chat, last_message_at: message.created_at } as Chat, false),
            type: "message", matchedMessageId: message.id,
          });
        }
      }
    }
    return combined.sort((a, b) => a.type !== b.type ? (a.type === "chat" ? -1 : 1) : sortDisplayChats(a, b));
  }, [chatPreferences, chats, muteSettings, searchQuery, unreadCounts, messageSearchResults]);

  const activeChats = useMemo(() => {
    let base = viewMode === "locked" ? displayChats.filter(c => c.preferences.locked) : viewMode === "archived" ? displayChats.filter(c => c.preferences.archived && !c.preferences.locked) : displayChats.filter(c => !c.preferences.locked && !c.preferences.archived);
    if (viewMode === "home") {
      if (activeFilter === "unread") return base.filter(c => (unreadCounts[c.chat.id] ?? 0) > 0);
      if (activeFilter === "favorites") return base.filter(c => c.preferences.pinned_at);
      if (activeFilter === "groups") return base.filter(c => c.chat.is_group);
    }
    return base;
  }, [viewMode, displayChats, activeFilter, unreadCounts]);

  const unreadTotal = useMemo(() => displayChats.filter(c => !c.preferences.locked && !c.preferences.archived && c.unreadCount > 0).length, [displayChats]);
  const selectionMode = selectedChatIds.length > 0;
  const allSelectedArchived = selectionMode && selectedChatIds.every(id => (chatPreferences[id] ?? getDefaultPreferences()).archived);
  const allSelectedPinned = selectionMode && selectedChatIds.every(id => Boolean((chatPreferences[id] ?? getDefaultPreferences()).pinned_at));
  const allSelectedLocked = selectionMode && selectedChatIds.every(id => (chatPreferences[id] ?? getDefaultPreferences()).locked);

  const handleChatPress = (chat: Chat, matchedMessageId?: string) => {
    if (selectionMode) setSelectedChatIds(current => current.includes(chat.id) ? current.filter(id => id !== chat.id) : [...current, chat.id]);
    else onOpenChat(chat, matchedMessageId);
  };

  return (
    <Screen keyboardAvoiding={false}>
      <View style={styles.page}>
        <View style={styles.header}>
          <View style={styles.headerInner}>
            {viewMode === "home" ? (
              <>
                <Text style={styles.brand}>SecureApp</Text>
                <View style={{ flexDirection: "row", gap: 2 }}>
                  <Pressable style={styles.iconButton}><MaterialCommunityIcons color={theme.colors.headerIcon} name="camera-outline" size={24} /></Pressable>
                  <Pressable onPress={() => setShowGeneralMenu(true)} style={styles.iconButton}><MaterialCommunityIcons color={theme.colors.headerIcon} name="dots-vertical" size={24} /></Pressable>
                </View>
              </>
            ) : (
              <>
                <Pressable onPress={() => setViewMode("home")} style={styles.iconButton}><Feather color={theme.colors.headerIcon} name="arrow-left" size={22} /></Pressable>
                <Text style={styles.brand}>{viewMode === "locked" ? "צ'אטים נעולים" : "ארכיון"}</Text>
              </>
            )}
          </View>

          {selectionMode && (
            <View style={styles.selectionHeader}>
              <Pressable onPress={() => setSelectedChatIds([])} style={styles.iconButton}><Feather color={theme.colors.headerIcon} name="arrow-left" size={22} /></Pressable>
              <Text style={styles.selectionTitle}>{selectedChatIds.length}</Text>
              <View style={styles.selectionActions}>
                <Pressable onPress={() => { allSelectedArchived ? unarchiveChats(selectedChatIds) : archiveChats(selectedChatIds); setSelectedChatIds([]); }} style={styles.iconButton}><MaterialCommunityIcons color={theme.colors.headerIcon} name={allSelectedArchived ? "archive-arrow-up-outline" : "archive-arrow-down-outline"} size={22} /></Pressable>
                <Pressable onPress={() => { togglePinnedChats(selectedChatIds); setSelectedChatIds([]); }} style={styles.iconButton}><MaterialCommunityIcons color={theme.colors.headerIcon} name={allSelectedPinned ? "pin-off-outline" : "pin-outline"} size={21} /></Pressable>
                <Pressable onPress={() => { Alert.alert("מחיקת צ'אט?", "האם למחוק?", [{text: "ביטול"}, {text: "מחיקה", style:"destructive", onPress: () => { deleteChats(selectedChatIds); setSelectedChatIds([]); }}]); }} style={styles.iconButton}><MaterialCommunityIcons color={theme.colors.headerIcon} name="trash-can-outline" size={23} /></Pressable>
                <Pressable onPress={() => { allSelectedLocked ? unlockChats(selectedChatIds) : lockChats(selectedChatIds); setSelectedChatIds([]); }} style={styles.iconButton}><MaterialCommunityIcons color={theme.colors.headerIcon} name={allSelectedLocked ? "lock-open-variant-outline" : "lock-outline"} size={22} /></Pressable>
                <Pressable onPress={() => setShowSelectionMenu(true)} style={styles.iconButton}><MaterialCommunityIcons color={theme.colors.headerIcon} name="dots-vertical" size={22} /></Pressable>
              </View>
            </View>
          )}
        </View>

        <View style={styles.searchShell}>
          <Feather color={theme.colors.textMuted} name="search" size={18} />
          <TextInput onChangeText={setSearchQuery} placeholder="חיפוש" placeholderTextColor={theme.colors.textMuted} style={[styles.searchInput, webEmbeddedInputReset]} value={searchQuery} />
        </View>

        {viewMode === "home" && activeTab === "chats" && (
          <View style={styles.filterBar}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
              {[ {id: "all", label: "הכול"}, {id: "unread", label: "לא נקראו", count: unreadTotal}, {id: "favorites", label: "מועדפים"}, {id: "groups", label: "קבוצות"} ].map(f => (
                <Pressable key={f.id} onPress={() => setActiveFilter(f.id as any)} style={[chipStyles.chip, activeFilter === f.id ? { backgroundColor: scheme === "dark" ? "#0F3528" : "#E7FCE3" } : { backgroundColor: scheme === "dark" ? "#202C33" : "#FFFFFF", borderWidth: scheme === "dark" ? 0 : 0.8, borderColor: "#E9EDF0" }]}>
                  <Text style={[chipStyles.label, { color: activeFilter === f.id ? (scheme === "dark" ? "#ffffff" : "#008069") : (scheme === "dark" ? "#8696A0" : "#667781") }]}>{f.label}{f.count ? ` ${f.count}` : ""}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {activeTab === "chats" && viewMode === "home" && (
            <>
              <SectionButton icon="lock" label="צ'אטים נעולים" onPress={() => setViewMode("locked")} theme={theme} styles={styles} />
              <SectionButton icon="archive-arrow-down-outline" label="ארכיון" isMCI onPress={() => setViewMode("archived")} theme={theme} styles={styles} />
            </>
          )}
          {activeTab !== "chats" ? (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons color={theme.colors.headerIcon} name="tools" size={38} />
              <Text style={styles.emptyTitle}>בקרוב</Text>
            </View>
          ) : activeChats.length ? (
            activeChats.map((item) => <ChatRow key={item.chat.id} item={item} theme={theme} styles={styles} selected={selectedChatIds.includes(item.chat.id)} onPress={() => handleChatPress(item.chat, item.matchedMessageId)} onLongPress={() => setSelectedChatIds(c => [...c, item.chat.id])} />)
          ) : (
            <View style={styles.emptyState}><Text style={styles.emptyTitle}>{loading ? "טוען..." : "אין צ'אטים"}</Text></View>
          )}
        </ScrollView>

        {viewMode === "home" && !selectionMode && <Pressable style={styles.fab} onPress={onCreateChat}><MaterialCommunityIcons color="#ffffff" name="message-plus" size={26} /></Pressable>}

        <View style={styles.tabBar}>
          {[ {id: "chats", label: "צ'אטים", icon: require("../../public/images/light mode/chats_icon.png")}, {id: "updates", label: "עדכונים", icon: scheme === "dark" ? require("../../public/images/dark mode/updates_icon.png") : require("../../public/images/light mode/updates_icon.png"), badge: screenshotPendingCount}, {id: "communities", label: "קהילות", icon: scheme === "dark" ? require("../../public/images/dark mode/communities_icon.png") : require("../../public/images/light mode/communities_icon.png")}, {id: "calls", label: "שיחות", icon: scheme === "dark" ? require("../../public/images/dark mode/voice_call_icon.png") : require("../../public/images/light mode/voice_call_icon.png")} ].map(t => (
            <Pressable key={t.id} style={styles.tabItem} onPress={() => setActiveTab(t.id as any)}>
              <View style={[styles.tabIconWrap, activeTab === t.id && styles.tabIconWrapActive]}>
                <Image source={t.icon} style={[styles.tabIcon, { tintColor: theme.colors.headerIcon }]} />
                {t.badge ? <View style={styles.tabBadge}><Text style={styles.tabBadgeText}>{t.badge > 9 ? "9+" : t.badge}</Text></View> : null}
              </View>
              <Text style={[styles.tabLabel, activeTab === t.id && styles.tabLabelActive]}>{t.label}</Text>
            </Pressable>
          ))}
        </View>

        {showGeneralMenu && (
          <View pointerEvents="box-none" style={styles.overlayRoot}>
            <Pressable onPress={() => setShowGeneralMenu(false)} style={styles.backdrop} />
            <View style={styles.menuCard}>
              <MenuItem label="קבוצה חדשה" onPress={() => { setShowGeneralMenu(false); onCreateChat(); }} theme={theme} styles={styles} />
              <MenuItem label="הודעות שמורות" onPress={() => { setShowGeneralMenu(false); onOpenSavedMessages(); }} theme={theme} styles={styles} />
              <MenuItem label="הגדרות" onPress={() => { setShowGeneralMenu(false); onOpenSettings(); }} theme={theme} styles={styles} />
            </View>
          </View>
        )}

        {showSelectionMenu && (
          <View pointerEvents="box-none" style={styles.overlayRoot}>
            <Pressable onPress={() => setShowSelectionMenu(false)} style={styles.backdrop} />
            <View style={styles.menuCard}>
              <MenuItem label={allSelectedArchived ? "הוצאה מהארכיון" : "העברה לארכיון"} onPress={() => { allSelectedArchived ? unarchiveChats(selectedChatIds) : archiveChats(selectedChatIds); setSelectedChatIds([]); setShowSelectionMenu(false); }} theme={theme} styles={styles} />
              <MenuItem label={allSelectedPinned ? "ביטול הצמדה" : "הצמדה"} onPress={() => { togglePinnedChats(selectedChatIds); setSelectedChatIds([]); setShowSelectionMenu(false); }} theme={theme} styles={styles} />
              <MenuItem danger label="מחיקת צ'אט" onPress={() => { Alert.alert("מחיקה", "בטוח?", [{text: "ביטול"}, {text: "מחיקה", style: "destructive", onPress: () => { deleteChats(selectedChatIds); setSelectedChatIds([]); setShowSelectionMenu(false); }}]); }} theme={theme} styles={styles} />
            </View>
          </View>
        )}
      </View>
    </Screen>
  );
}

function SectionButton({ icon, label, onPress, isMCI, theme, styles }: { icon: any, label: string, onPress: () => void, isMCI?: boolean, theme: any, styles: any }) {
  return (
    <Pressable onPress={onPress} style={styles.sectionButton}>
      <View style={styles.sectionLeft}>
        <View style={styles.sectionIconContainer}>
          <View style={styles.sectionIconWrap}>
            {isMCI ? <MaterialCommunityIcons color={theme.colors.headerIcon} name={icon} size={20} /> : <Feather color={theme.colors.headerIcon} name={icon} size={20} />}
          </View>
        </View>
        <Text style={styles.sectionLabel}>{label}</Text>
      </View>
    </Pressable>
  );
}

function MenuItem({ label, onPress, danger, theme, styles }: { label: string, onPress: () => void, danger?: boolean, theme: any, styles: any }) {
  return (
    <Pressable onPress={onPress} style={styles.menuItem}>
      <Text style={[styles.menuItemText, danger && styles.menuItemDanger]}>{label}</Text>
    </Pressable>
  );
}
