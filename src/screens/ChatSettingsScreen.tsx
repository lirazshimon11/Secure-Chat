import { PropsWithChildren, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Platform, Pressable, ScrollView, StyleSheet, Text, View, TextInput, useWindowDimensions } from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { useChats } from "@/context/ChatContext";
import { useAppTheme } from "@/lib/theme";
import { Chat, ChatMuteSetting, Profile } from "@/lib/types";

import { useAuth } from "@/context/AuthContext";

// Sub-screens
import { ChatDescriptionModal } from "./chat-settings/ChatDescriptionModal";
import { ChatMediaVisibilityModal } from "./chat-settings/ChatMediaVisibilityModal";
import { ChatStorageScreen } from "./chat-settings/ChatStorageScreen";
import { ChatAdvancedPrivacyScreen } from "./chat-settings/ChatAdvancedPrivacyScreen";
import { ChatDisappearingMessagesScreen } from "./chat-settings/ChatDisappearingMessagesScreen";
import { ChatNotificationsScreen } from "./chat-settings/ChatNotificationsScreen";
import { ChatMediaScreen } from "./chat-settings/ChatMediaScreen";
import { ChatAddMembersScreen } from "./chat-settings/ChatAddMembersScreen";
import * as ScreenCapture from "expo-screen-capture";
import { ChatPermissionsScreen } from "./chat-settings/ChatPermissionsScreen";
import { ChatRenameModal } from "./chat-settings/ChatRenameModal";
import { ChatThemeScreen } from "./chat-settings/ChatThemeScreen";
import { ChatEditContactScreen } from "./chat-settings/ChatEditContactScreen";
import { ChatMemberActionModal } from "./chat-settings/ChatMemberActionModal";
import { SimpleConfirmModal } from "./chat-settings/SimpleConfirmModal";
import { DecoyContentScreen } from "./chat-settings/DecoyContentScreen";
import { Alert } from "react-native";

type Props = {
  chat: Chat;
  onBack: () => void;
  onOpenChat?: (chat: Chat) => void;
  onOpenChatSettings?: (chat: Chat) => void;
};

export function ChatSettingsScreen({ chat, onBack, onOpenChat, onOpenChatSettings }: Props) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { width } = useWindowDimensions();
  const { profile } = useAuth();
  const { loadChatMembers, messagesByChat, chats, contactNicknames, createChat, setChatMemberRole, removeChatMember } = useChats();
  const [members, setMembers] = useState<Profile[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [confirmData, setConfirmData] = useState<{ visible: boolean; title: string; onConfirm: () => void } | null>(null);

  const liveChat = useMemo(() => chats.find((c) => c.id === chat.id) || chat, [chats, chat.id]);

  const messages = messagesByChat[chat.id] || [];
  const links = useMemo(() => {
    return messages
      .filter((m) => m.body_ciphertext && m.body_ciphertext.includes("http"))
      .map((m) => {
        const match = m.body_ciphertext!.match(/(https?:\/\/[^\s]+)/);
        return match ? match[0] : null;
      })
      .filter(Boolean);
  }, [messages]);

  const mediaCount = links.length;

  // Sub-screen orchestration
  const [activeScreen, setActiveScreen] = useState<
    "storage" | "notifications" | "disappearing" | "advanced" | "media" | "addMembers" | "permissions" | "theme" | "editContact" | "decoyContent" | null
  >(null);
  const [showDescription, setShowDescription] = useState(false);
  const [showVisibility, setShowVisibility] = useState(false);
  const [showOverflowMenu, setShowOverflowMenu] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Profile | null>(null);

  const handleMemberAction = async (member: Profile) => {
    // Navigate to private chat with this member
    // Check if chat exists
    const existing = chats.find(c => !c.is_group && (c.title === member.username || c.title === contactNicknames?.[member.id]?.first_name));
    if (existing && onOpenChat) {
      onOpenChat(existing);
    } else if (onOpenChat) {
      // Create chat if doesn't exist
      const { chat: newChat, error } = await createChat(member.username, [member.username]);
      if (newChat) onOpenChat(newChat);
      else Alert.alert("שגיאה", error || "לא ניתן לפתוח צ'אט כרגע.");
    }
  };

  const handleDetailsAction = async (member: Profile) => {
     setSelectedMember(null);
     // 1. Find or create private chat
     const existing = chats.find(c => !c.is_group && (c.title === member.username || c.title === contactNicknames?.[member.id]?.first_name));
     if (existing && onOpenChatSettings) {
       onOpenChatSettings(existing);
     } else if (onOpenChatSettings) {
       const { chat: newChat } = await createChat(member.username, [member.username]);
       if (newChat) onOpenChatSettings(newChat);
     }
  };

  const handleSetAdmin = (memberId: string) => {
    setSelectedMember(null);
    setConfirmData({
      visible: true,
      title: "האם להפוך משתתף זה למנהל הקבוצה?",
      onConfirm: async () => {
        await setChatMemberRole(chat.id, memberId, "admin");
        void loadChatMembers(chat.id).then(setMembers);
      }
    });
  };

  const handleRemoveMember = (member: Profile) => {
    setSelectedMember(null);
    const displayName = contactNicknames?.[member.id]?.first_name || member.full_name || member.username || "משתתף/ת";
    setConfirmData({
      visible: true,
      title: `האם להסיר את ${displayName} מהקבוצה "${chat.title}"?`,
      onConfirm: async () => {
        await removeChatMember(chat.id, member, chat.title);
        void loadChatMembers(chat.id).then(setMembers);
      }
    });
  };

  useEffect(() => {
    void (async () => {
      const nextMembers = await loadChatMembers(chat.id);
      setMembers(nextMembers || []);
    })();
    // Explicitly unblock screenshots whenever entering a native settings page.
    if (Platform.OS !== "web") {
      void ScreenCapture.allowScreenCaptureAsync();
      void ScreenCapture.allowScreenCaptureAsync(`sc-${chat.id}`);
    }
  }, [chat.id]);

  const filteredMembers = useMemo(() => {
    if (!searchQuery) return members;
    return (members || []).filter((m) =>
      (m.username || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [members, searchQuery]);

  const closeActiveScreen = () => setActiveScreen(null);
  const slideDistance = Math.min(width, 430);
  const activeScreenContent = useMemo(() => {
    if (activeScreen === "storage") return <ChatStorageScreen chat={chat} onBack={closeActiveScreen} />;
    if (activeScreen === "notifications") return <ChatNotificationsScreen chat={chat} onBack={closeActiveScreen} />;
    if (activeScreen === "disappearing") return <ChatDisappearingMessagesScreen onBack={closeActiveScreen} />;
    if (activeScreen === "advanced") {
      return (
        <ChatAdvancedPrivacyScreen
          chat={chat}
          currentUserId={profile?.id}
          isAdmin={profile?.id === liveChat.created_by}
          onBack={closeActiveScreen}
        />
      );
    }
    if (activeScreen === "media") return <ChatMediaScreen chat={chat} onBack={closeActiveScreen} />;
    if (activeScreen === "addMembers") return <ChatAddMembersScreen chat={chat} onBack={closeActiveScreen} />;
    if (activeScreen === "permissions") return <ChatPermissionsScreen chat={chat} onBack={closeActiveScreen} />;
    if (activeScreen === "theme") return <ChatThemeScreen chat={chat} onBack={closeActiveScreen} />;
    if (activeScreen === "editContact") return <ChatEditContactScreen chat={chat} onBack={closeActiveScreen} />;
    if (activeScreen === "decoyContent") return <DecoyContentScreen chat={chat} onBack={closeActiveScreen} />;
    return null;
  }, [activeScreen, chat, liveChat.created_by, profile?.id]);

  return (
    <View style={styles.navigationRoot}>
      <Screen>
      <ScrollView contentContainerStyle={styles.scrollContent}>

        {/* Transparent-like Header Block */}
        <View style={styles.header}>
          <Pressable style={styles.headerIcon} onPress={() => setShowOverflowMenu(true)}>
            <MaterialCommunityIcons name="dots-vertical" size={24} color={theme.colors.text} />
          </Pressable>
          <View style={styles.headerSpacer} />
          <Pressable onPress={onBack} style={styles.headerIcon}>
            <Feather color={theme.colors.text} name="arrow-left" size={24} />
          </Pressable>
        </View>

        {/* Hero Section */}
        <View style={styles.heroSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(liveChat?.title || "?").slice(0, 1).toUpperCase()}</Text>
          </View>
          <Text style={styles.chatTitle}>{liveChat?.title || "ללא שם"}</Text>
          <Text style={styles.chatSubtitle}>{liveChat?.is_group ? `קבוצה · ${(members?.length || 0)} חברים` : "צ'אט פרטי"}</Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionRow}>
          <Pressable style={styles.actionButton} onPress={() => { import('react-native').then(m => m.Alert.alert("חיפוש", "זמין דרך מסך הצ'אט הראשי")); }}>
            <View style={styles.actionIconBox}>
              <Feather name="search" size={28} color={theme.colors.accent} />
            </View>
            <Text style={styles.actionText}>חיפוש</Text>
          </Pressable>
          <Pressable style={styles.actionButton} onPress={() => { import('react-native').then(m => m.Alert.alert("צ'אט קולי", "שירות שיחות קוליות מנותק כעת")); }}>
            <View style={styles.actionIconBox}>
              <MaterialCommunityIcons name="phone-outline" size={28} color={theme.colors.accent} />
            </View>
            <Text style={styles.actionText}>צ'אט קולי</Text>
          </Pressable>
        </View>

        <View style={styles.thickSeparator} />

        {/* Description Section */}
        {liveChat.is_group && (
          <View>
            <Pressable style={styles.descriptionSection} onPress={() => setShowDescription(true)}>
              <Text style={styles.descriptionText} numberOfLines={3}>
                {liveChat.description || "הוסף/י תיאור לקבוצה..."}
              </Text>
              <Text style={styles.descriptionHint}>הקש/י כדי לערוך</Text>
            </Pressable>

            <View style={styles.thickSeparator} />
          </View>
        )}

        {/* Media Block */}
        <Pressable style={styles.mediaBlockBtn} onPress={() => setActiveScreen("media")}>
          <View style={styles.mediaBlockHeader}>
            <Feather name="chevron-left" size={20} color={theme.colors.textMuted} />
            {mediaCount > 0 ? <Text style={styles.mediaBlockCount}>{mediaCount}</Text> : null}
            <Text style={styles.mediaBlockTitle}>מדיה, קישורים ומסמכים</Text>
          </View>
        </Pressable>

        <View style={styles.thickSeparator} />

        {/* Settings List */}
        <View style={styles.listSection}>
          <SettingRow icon="folder-outline" title="ניהול האחסון" subtitle={""} onPress={() => setActiveScreen("storage")} theme={theme} />
          <SettingRow icon="bell-outline" title="התראות" subtitle="מותאם אישית" onPress={() => setActiveScreen("notifications")} theme={theme} />
          <SettingRow icon="image-outline" title="הצגת מדיה" subtitle="" onPress={() => setShowVisibility(true)} theme={theme} />
        </View>

        <View style={styles.thickSeparator} />

        <View style={styles.listSection}>
          <SettingRow icon="lock-outline" title="הצפנה" subtitle="ההודעות והשיחות מוצפנות מקצה לקצה. יש להקיש לקבלת פרטים נוספים." actionIcon={false} theme={theme} onPress={() => { import('react-native').then(m => m.Alert.alert("הצפנה", "הצ'אט מעוגן מאובטח בפרוטוקול קצה-לקצה מלא.")); }} />
          <SettingRow icon="timer-sand" title="הודעות זמניות" subtitle="כבה" onPress={() => setActiveScreen("disappearing")} theme={theme} />
          <SettingRow icon="cellphone-lock" title="נעילת הצ'אט" subtitle="נעילה והסתרה של הצ'אט הזה במכשיר" actionIcon={false} theme={theme} onPress={() => { import('react-native').then(m => m.Alert.alert("נעילת צ'אט", "ניתן לנעול צ'אטים ממסך הבית (לחיצה ארוכה).")); }} />
          <SettingRow icon="shield-outline" title="הגדרה מתקדמת של פרטיות בצ'אט" subtitle="ניהול שכבות אבטחה" onPress={() => setActiveScreen("advanced")} theme={theme} />
          <SettingRow icon="palette-outline" title="ערכת הנושא של הצאט" subtitle="ברירת מחדל" onPress={() => setActiveScreen("theme")} theme={theme} />
          <SettingRow
            icon="fish"
            title="תוכן פיתיון"
            subtitle="ערוך את הצאט שיוצג למוגנים"
            onPress={() => setActiveScreen("decoyContent")}
            theme={theme}
          />
        </View>

        <View style={styles.thickSeparator} />

        {/* Members List */}
        <View style={styles.membersSection}>
          <View style={styles.membersHeader}>
            <Text style={styles.membersCount}>{members.length} חברים</Text>
            <Feather name="search" size={20} color={theme.colors.textMuted} />
          </View>

          {/* Members search bar */}
          <View style={styles.searchBar}>
            <TextInput
              style={styles.searchInput}
              placeholder="חיפוש חברים..."
              placeholderTextColor={theme.colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          <View style={styles.memberRow}>
            <View style={styles.memberAvatar}>
              <Text style={styles.memberAvatarText}>א</Text>
            </View>
            <View style={styles.memberCopy}>
              <Text style={styles.memberName}>את/ה</Text>
              <Text style={styles.memberSubtitlePrimary}>הוספת תג חבר</Text>
            </View>
            {profile?.id === liveChat.created_by && (
              <View style={styles.adminBadge}>
                <Text style={styles.adminBadgeText}>מנהל/ת הקבוצה</Text>
              </View>
            )}
          </View>

          {filteredMembers.map((member) => {
            const nickname = contactNicknames?.[member.id]?.first_name;
            const displayName = nickname || member.full_name || member.username || "משתתף/ת";
            const isAdmin = member.id === liveChat.created_by;
            
            // Skip rendering "You" in the list if already rendered above
            if (member.id === profile?.id) return null;

            return (
              <Pressable key={member.id} style={styles.memberRow} onPress={() => setSelectedMember(member)} onLongPress={() => setSelectedMember(member)}>
                <View style={styles.memberAvatar}>
                  <Text style={styles.memberAvatarText}>{(nickname || member.username || "?").slice(0, 1).toUpperCase()}</Text>
                </View>
                <View style={[styles.memberCopy, { paddingLeft: isAdmin ? 8 : 16 }]}>
                  <Text style={styles.memberName}>{displayName}</Text>
                  <Text style={styles.memberSubtitle}>~ {member.username}</Text>
                </View>
                {isAdmin && (
                  <View style={styles.adminBadge}>
                    <Text style={styles.adminBadgeText}>מנהל/ת הקבוצה</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>

      </ScrollView>

      {/* Modals */}
      <ChatDescriptionModal chat={chat} visible={showDescription} onClose={() => setShowDescription(false)} />
      <ChatMediaVisibilityModal visible={showVisibility} onClose={() => setShowVisibility(false)} />

        {/* Overflow Menu */}
        {showOverflowMenu && (
          <View pointerEvents="box-none" style={styles.overlayRoot}>
            <Pressable onPress={() => setShowOverflowMenu(false)} style={styles.backdrop} />
          <View style={styles.menuCard}>
            {liveChat.is_group ? (
              <>
                <MenuItem label="צירוף חברים" onPress={() => { setShowOverflowMenu(false); setActiveScreen("addMembers"); }} />
                <MenuItem label="שינוי שם הקבוצה" onPress={() => { setShowOverflowMenu(false); setShowRenameModal(true); }} />
                <MenuItem label="הרשאות בקבוצה" onPress={() => { setShowOverflowMenu(false); setActiveScreen("permissions"); }} />
              </>
            ) : (
              <>
                <MenuItem label="שיתוף" onPress={() => { setShowOverflowMenu(false); import('react-native').then(m => m.Alert.alert("שיתוף", "בקרוב")); }} />
                <MenuItem label="עריכה" onPress={() => { setShowOverflowMenu(false); setActiveScreen("editContact"); }} />
                <MenuItem label="אימות קוד אבטחה" onPress={() => { setShowOverflowMenu(false); import('react-native').then(m => m.Alert.alert("קוד אבטחה", "בקרוב")); }} />
              </>
            )}
          </View>
        </View>
      )}

      {/* Rename Modal */}
      <ChatRenameModal chat={chat} visible={showRenameModal} onClose={() => setShowRenameModal(false)} />

      {/* Action Modal */}
      <ChatMemberActionModal 
        visible={!!selectedMember} 
        onClose={() => setSelectedMember(null)} 
        member={selectedMember}
        nickname={selectedMember ? contactNicknames?.[selectedMember.id]?.first_name : undefined}
        onMessage={handleMemberAction}
        onDetails={handleDetailsAction}
        onSetAdmin={profile?.id === chat.created_by ? handleSetAdmin : undefined}
        onRemove={profile?.id === chat.created_by ? handleRemoveMember : undefined}
      />

      {confirmData && (
        <SimpleConfirmModal
          visible={confirmData.visible}
          title={confirmData.title}
          onClose={() => setConfirmData(null)}
          onConfirm={confirmData.onConfirm}
        />
      )}
    </Screen>

      <SlidingSettingsPage visible={!!activeScreen} distance={slideDistance}>
        {activeScreenContent}
      </SlidingSettingsPage>
    </View>
  );
}

function SlidingSettingsPage({ visible, distance, children }: PropsWithChildren<{ visible: boolean; distance: number }>) {
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
          zIndex: 50,
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

function MenuItem({ label, onPress, danger }: { label: string; onPress: () => void; danger?: boolean }) {
  const theme = useAppTheme();

  // Use base sizes similar to screen but padding adapted for dropdowns
  return (
    <Pressable onPress={onPress} style={{ paddingHorizontal: 16, paddingVertical: 14, width: "100%" }}>
      <Text style={{ color: danger ? theme.colors.danger : theme.colors.text, fontSize: 16, fontWeight: "700", textAlign: "right", writingDirection: "rtl" }}>
        {label}
      </Text>
    </Pressable>
  );
}

function SettingRow({ icon, title, subtitle, onPress, actionIcon = true, theme }: any) {
  const styles = useMemo(() => createStyles(theme), [theme]);
  return (
    <Pressable style={styles.settingRow} onPress={onPress}>
      <View style={styles.settingIconBox}>
        <MaterialCommunityIcons name={icon} size={26} color={theme.colors.textMuted} />
      </View>
      <View style={styles.settingCopy}>
        <Text style={styles.settingTitle}>{title}</Text>
        {!!subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
      </View>
    </Pressable>
  );
}

const createStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.surface,
    },
    navigationRoot: {
      flex: 1,
      backgroundColor: theme.colors.background,
      overflow: "hidden",
    },
    overlayRoot: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 40,
      justifyContent: "flex-start",
      alignItems: "flex-start",
      paddingStart: theme.spacing.md,
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "transparent",
    },
    menuCard: {
      marginTop: 58,
      width: 230,
      borderRadius: theme.radius.md,
      overflow: "hidden",
      backgroundColor: theme.colors.surface,
      shadowColor: "#000000",
      shadowOpacity: 0.18,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 6 },
      elevation: 5,
    },
    scrollContent: {
      paddingBottom: 40,
    },
    header: {
      flexDirection: "row",
      paddingHorizontal: theme.spacing.md,
      paddingTop: theme.spacing.md,
      justifyContent: "space-between",
    },
    headerIcon: {
      padding: theme.spacing.sm,
    },
    headerSpacer: {
      flex: 1,
    },
    heroSection: {
      alignItems: "center",
      paddingTop: 10,
      paddingBottom: theme.spacing.xl,
    },
    avatar: {
      width: 140,
      height: 140,
      borderRadius: 70,
      backgroundColor: theme.colors.surfaceMuted,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 16,
    },
    avatarText: {
      fontSize: 54,
      fontWeight: "800",
      color: theme.colors.accent,
    },
    chatTitle: {
      fontSize: 26,
      fontWeight: "700",
      color: theme.colors.text,
      marginBottom: 4,
    },
    chatSubtitle: {
      fontSize: 16,
      color: theme.colors.textMuted,
    },
    actionRow: {
      flexDirection: "row",
      paddingHorizontal: theme.spacing.xl,
      justifyContent: "center",
      gap: theme.spacing.xl,
      marginBottom: theme.spacing.lg,
    },
    actionButton: {
      alignItems: "center",
      justifyContent: "center",
      minWidth: 90,
    },
    actionIconBox: {
      width: 54,
      height: 54,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.accentSoft, // WhatsApp standard green tint
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 8,
    },
    actionText: {
      fontSize: 14,
      color: theme.colors.accent,
      fontWeight: "600",
    },
    thickSeparator: {
      height: 8,
      backgroundColor: theme.colors.separator,
    },
    descriptionSection: {
      padding: theme.spacing.lg,
      paddingVertical: 24,
      backgroundColor: theme.colors.surface,
    },
    descriptionText: {
      fontSize: 16,
      color: theme.colors.text,
      fontWeight: "600",
      lineHeight: 22,
    },
    descriptionHint: {
      fontSize: 13,
      color: theme.colors.textMuted,
      marginTop: 8,
    },
    mediaBlockBtn: {
      padding: theme.spacing.lg,
    },
    mediaBlockHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    mediaBlockTitle: {
      fontSize: 16,
      color: theme.colors.text,
      fontWeight: "600",
      flex: 1,
      textAlign: "right",
      writingDirection: "rtl",
    },
    mediaBlockCount: {
      fontSize: 14,
      color: theme.colors.textMuted,
      marginHorizontal: theme.spacing.sm,
    },
    listSection: {
      // Container for settings rows
    },
    settingRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: 18,
      gap: theme.spacing.lg,
    },
    settingIconBox: {
      width: 28,
      alignItems: "center",
      justifyContent: "center",
    },
    settingCopy: {
      flex: 1,
      justifyContent: "center",
    },
    settingTitle: {
      fontSize: 17,
      color: theme.colors.text,
      fontWeight: "600",
    },
    settingSubtitle: {
      fontSize: 14,
      color: theme.colors.textMuted,
      marginTop: 2,
    },
    membersSection: {
      paddingBottom: theme.spacing.xl,
    },
    membersHeader: {
      flexDirection: "row-reverse",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.md,
    },
    membersCount: {
      fontSize: 15,
      color: theme.colors.textMuted,
      fontWeight: "600",
      textAlign: "right",
      writingDirection: "rtl",
    },
    searchBar: {
      paddingHorizontal: theme.spacing.lg,
      marginBottom: theme.spacing.md,
    },
    searchInput: {
      backgroundColor: theme.colors.surfaceMuted,
      borderRadius: theme.radius.sm,
      padding: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
      fontSize: 15,
      color: theme.colors.text,
      textAlign: "right",
      writingDirection: "rtl",
    },
    memberRow: {
      flexDirection: "row-reverse",
      alignItems: "center",
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: 12,
    },
    memberAvatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: theme.colors.surfaceMuted,
      alignItems: "center",
      justifyContent: "center",
    },
    memberAvatarText: {
      fontSize: 18,
      fontWeight: "800",
      color: theme.colors.accent,
    },
    memberCopy: {
      flex: 1,
      paddingHorizontal: theme.spacing.md,
      justifyContent: "center",
      alignItems: "flex-end",
    },
    memberName: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.text,
      textAlign: "right",
      writingDirection: "rtl",
    },
    memberSubtitle: {
      fontSize: 14,
      color: theme.colors.textMuted,
      marginTop: 2,
      textAlign: "right",
      writingDirection: "rtl",
    },
    memberSubtitlePrimary: {
      fontSize: 14,
      color: theme.colors.accent,
      marginTop: 2,
      textAlign: "right",
      writingDirection: "rtl",
    },
    adminBadge: {
      backgroundColor: theme.colors.accentSoft,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 4,
    },
    adminBadgeText: {
      fontSize: 12,
      color: theme.colors.accent,
      fontWeight: "600",
    },
  });
