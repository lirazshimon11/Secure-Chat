import { useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  LayoutAnimation,
  Platform,
  UIManager,
  Share,
} from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { useChats } from "@/context/ChatContext";
import { useAuth } from "@/context/AuthContext";
import { useAppTheme } from "@/lib/theme";
import { Chat, Profile } from "@/lib/types";
import { supabase } from "@/lib/supabase";
import { webEmbeddedInputReset, webNoOutline } from "@/lib/webStyles";

if (Platform.OS === "android") {
  if (UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }
}

type Props = {
  chat: Chat;
  onBack: () => void;
};

export function ChatAddMembersScreen({ chat, onBack }: Props) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { profile } = useAuth();
  const { loadChatMembers, searchUsers, contactNicknames } = useChats();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Profile[]>([]);

  // משתמשים שכבר בקבוצה
  const [existingProfiles, setExistingProfiles] = useState<Profile[]>([]);
  const existingIds = useMemo(() => new Set(existingProfiles.map((p) => p.id)), [existingProfiles]);

  // משתמשים חדשים שנבחרו
  const [selectedUsers, setSelectedUsers] = useState<Profile[]>([]);
  const selectedIds = useMemo(() => new Set(selectedUsers.map((u) => u.id)), [selectedUsers]);

  const [loadingResults, setLoadingResults] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadChatMembers(chat.id).then((members) => {
      setExistingProfiles(members);
    });
  }, [chat.id]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadUsers(query);
    }, 140);
    return () => clearTimeout(timer);
  }, [query, existingIds]);

  async function loadUsers(nextQuery: string) {
    setLoadingResults(true);
    const data = await searchUsers(nextQuery);
    // מוריד מהתוצאות חיפוש משתמשים שכבר נמצאים בקבוצה כדי שיוכלו רק להוסיף חדשים
    setResults(data.filter((u) => !existingIds.has(u.id)));
    setLoadingResults(false);
  }

  function toggleUser(user: Profile) {
    // לא ניתן להסיר או לשנות משתמשים שכבר קיימים על ידי לחיצה פה
    if (existingIds.has(user.id)) return;

    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSelectedUsers((current) =>
      current.some((item) => item.id === user.id)
        ? current.filter((item) => item.id !== user.id)
        : [...current, user],
    );
  }

  const handleAdd = async () => {
    if (!selectedUsers.length || saving) return;
    setSaving(true);
    const rows = selectedUsers.map((user) => ({
      chat_id: chat.id,
      user_id: user.id,
      role: "member",
    }));
    await supabase.from("chat_members").insert(rows);
    setSaving(false);
    onBack();
  };

  const handleShareLink = async () => {
    try {
      await Share.share({
        message: `הצטרפו לקבוצה שלנו ב-SecureApp: https://secureapp.com/join/${chat.id}`,
      });
    } catch (error) {
      console.log(error);
    }
  };

  // מציג למעלה את כל הקיימים ומחבר אליהם את אלו שנבחרו עכשיו להוספה
  const allShownChips = [...existingProfiles, ...selectedUsers];

  return (
    <Screen>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.searchShell}>
          <Pressable onPress={onBack} style={styles.backBtn}>
            <Feather name="arrow-right" size={24} color={theme.colors.headerIcon} />
          </Pressable>
          <TextInput
            style={[styles.searchInput, webEmbeddedInputReset]}
            placeholder="אפשר לחפש שם או מס'..."
            placeholderTextColor={theme.colors.textMuted}
            value={query}
            onChangeText={setQuery}
            autoFocus
          />
        </View>
        <Pressable style={styles.gridBtn}>
          <MaterialCommunityIcons name="dots-grid" size={24} color={theme.colors.headerIcon} />
        </Pressable>
      </View>

      {/* Selected Users Chips */}
      {allShownChips.length > 0 && (
        <View style={styles.selectedContainer}>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={allShownChips}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => {
              const nickname = contactNicknames[item.id]?.first_name;
              const displayName = nickname || item.username;
              const isExisting = existingIds.has(item.id);

              return (
                <Pressable
                  style={[styles.selectedChip, webNoOutline]}
                  onPress={() => toggleUser(item)}
                  disabled={isExisting} // חוסם לחיצה למחיקה למשתמשים קיימים
                >
                  <View style={styles.selectedAvatarContainer}>
                    <View style={styles.selectedAvatar}>
                      <Text style={styles.selectedAvatarText}>
                        {(nickname || item.username || "?").slice(0, 1).toUpperCase()}
                      </Text>
                    </View>
                    {/* אייקון המחיקה "X" יופיע רק לחברים החדשים שנבחרו וניתנים לביטול */}
                    {!isExisting && (
                      <View style={styles.removeIconBadge}>
                        <Feather name="x" size={12} color={theme.colors.textMuted} />
                      </View>
                    )}
                  </View>
                  <Text style={styles.selectedChipName} numberOfLines={1}>
                    {displayName}
                  </Text>
                </Pressable>
              );
            }}
          />
          <View style={styles.thickSeparator} />
        </View>
      )}

      {/* Admin-only note */}
      <Text style={styles.adminNote}>
        רק המנהלים יכולים לצרף אנשים לקבוצה הזו.{" "}
        <Text style={styles.link}>לעריכת הרשאות הקבוצה.</Text>
      </Text>

      {/* Quick-add options */}
      {!query.trim() && (
        <Pressable style={styles.quickRow} onPress={handleShareLink}>
          <View style={[styles.quickIcon, { backgroundColor: theme.colors.accent }]}>
            <MaterialCommunityIcons name="link-variant" size={22} color="#fff" />
          </View>
          <Text style={styles.quickText}>הזמנה באמצעות קישור או קוד QR</Text>
        </Pressable>
      )}

      {/* Section label */}
      <Text style={styles.sectionLabel}>
        {loadingResults ? "מחפש משתמשים..." : results.length > 0 ? "משתמשים" : (query.trim() ? "לא נמצאו משתמשים" : "")}
      </Text>

      {/* Users List */}
      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const selected = selectedIds.has(item.id);
          const nickname = contactNicknames[item.id]?.first_name;
          return (
            <Pressable style={[styles.resultRow, webNoOutline]} onPress={() => toggleUser(item)}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {(nickname || item.username || "?").slice(0, 1).toUpperCase()}
                </Text>
              </View>
              <View style={styles.resultCopy}>
                <Text style={styles.resultName}>{nickname || item.username}</Text>
                <Text style={styles.resultSub}>
                  {nickname ? `@${item.username}` : item.full_name || `@${item.username}`}
                </Text>
              </View>
              <View style={[styles.radio, selected && styles.radioSelected]}>
                {selected && <Feather name="check" size={14} color={theme.colors.textOnAccent} />}
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          !loadingResults && query.trim() ? (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons color={theme.colors.textMuted} name="account-search-outline" size={48} />
              <Text style={styles.emptyTitle}>לא נמצאו משתמשים</Text>
              <Text style={styles.emptySubtitle}>נסו שם משתמש אחר לחפש אותו.</Text>
            </View>
          ) : null
        }
      />

      {/* FAB - הלחצן יופיע רק אם נבחרו משתמשים חדשים בפועל */}
      {selectedUsers.length > 0 && (
        <Pressable style={styles.fabBtn} onPress={handleAdd} disabled={saving}>
          <Feather name="arrow-left" size={24} color={theme.colors.textOnAccent} />
        </Pressable>
      )}
    </Screen>
  );
}

const createStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    header: {
      flexDirection: "row-reverse",
      alignItems: "center",
      backgroundColor: theme.colors.header,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.sm,
      justifyContent: "space-between",
    },
    backBtn: {
      padding: theme.spacing.xs,
    },
    gridBtn: {
      padding: theme.spacing.xs,
      marginLeft: 4,
    },
    searchShell: {
      flex: 1,
      flexDirection: "row-reverse",
      alignItems: "center",
      gap: 12,
    },
    searchInput: {
      flex: 1,
      color: theme.colors.headerText,
      fontSize: 18,
      textAlign: "right",
    },
    selectedContainer: {
      backgroundColor: theme.colors.background,
      paddingTop: theme.spacing.lg,
    },
    selectedChip: {
      alignItems: "center",
      marginHorizontal: 4,
      minWidth: 68,
      maxWidth: 100,
    },
    selectedAvatarContainer: {
      position: "relative",
      marginBottom: 6,
    },
    selectedAvatar: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: theme.colors.surfaceMuted,
      alignItems: "center",
      justifyContent: "center",
    },
    selectedAvatarText: {
      fontSize: 22,
      fontWeight: "700",
      color: theme.colors.accent,
    },
    removeIconBadge: {
      position: "absolute",
      bottom: -2,
      left: -2,
      backgroundColor: theme.colors.surface,
      borderRadius: 10,
      width: 20,
      height: 20,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1.5,
      borderColor: theme.colors.background,
    },
    selectedChipName: {
      fontSize: 13,
      color: theme.colors.text,
      textAlign: "center",
      marginTop: 4,
      width: "100%",
    },
    thickSeparator: {
      height: 1,
      marginTop: theme.spacing.lg,
      backgroundColor: theme.colors.separator,
    },
    adminNote: {
      fontSize: 13,
      color: theme.colors.textMuted,
      textAlign: "center",
      padding: theme.spacing.md,
    },
    link: {
      color: theme.colors.accent,
    },
    quickRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: 14,
      gap: theme.spacing.md,
    },
    quickIcon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: "#25d366",
      alignItems: "center",
      justifyContent: "center",
    },
    quickText: {
      fontSize: 16,
      color: theme.colors.text,
      fontWeight: "600",
      textAlign: "left",
    },
    sectionLabel: {
      fontSize: 13,
      color: theme.colors.textMuted,
      paddingHorizontal: theme.spacing.lg,
      paddingTop: theme.spacing.md,
      paddingBottom: theme.spacing.sm,
      textAlign: "left",
      fontWeight: "600",
    },
    resultRow: {
      flexDirection: "row", // כמו בוואטסאפ: שמאלי -> ימני
      alignItems: "center",
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: 12,
      gap: theme.spacing.md,
    },
    avatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: theme.colors.surfaceMuted,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarText: {
      fontSize: 20,
      fontWeight: "700",
      color: theme.colors.accent,
    },
    resultCopy: {
      flex: 1,
      justifyContent: "center",
    },
    resultName: {
      fontSize: 17,
      fontWeight: "500",
      color: theme.colors.text,
      textAlign: "left",
    },
    resultSub: {
      fontSize: 14,
      color: theme.colors.textMuted,
      marginTop: 2,
      textAlign: "left",
    },
    radio: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: theme.colors.textMuted,
      alignItems: "center",
      justifyContent: "center",
    },
    radioSelected: {
      backgroundColor: theme.colors.accent,
      borderColor: theme.colors.accent,
    },
    emptyState: {
      alignItems: "center",
      paddingTop: 60,
      gap: 12,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.colors.text,
    },
    emptySubtitle: {
      fontSize: 14,
      color: theme.colors.textMuted,
    },
    fabBtn: {
      position: "absolute",
      bottom: 24,
      left: 24,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: theme.colors.accent,
      alignItems: "center",
      justifyContent: "center",
      elevation: 6,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.3,
      shadowRadius: 4.5,
    },
  });
