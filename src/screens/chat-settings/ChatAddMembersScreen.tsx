import { useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { useChats } from "@/context/ChatContext";
import { useAuth } from "@/context/AuthContext";
import { useAppTheme } from "@/lib/theme";
import { Chat, Profile } from "@/lib/types";
import { supabase } from "@/lib/supabase";

type Props = {
  chat: Chat;
  onBack: () => void;
};

export function ChatAddMembersScreen({ chat, onBack }: Props) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { profile } = useAuth();
  const { loadChatMembers, searchUsers, contactNicknames } = useChats();

  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<Profile[]>([]);
  const [currentMembers, setCurrentMembers] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadChatMembers(chat.id).then((members) => {
      setCurrentMembers(new Set(members.map((m) => m.id)));
    });
  }, [chat.id]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      const found = await searchUsers(searchQuery);
      // Exclude already members
      setResults(found.filter((u) => !currentMembers.has(u.id)));
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, currentMembers]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAdd = async () => {
    if (!selectedIds.size || saving) return;
    setSaving(true);
    const rows = [...selectedIds].map((userId) => ({
      chat_id: chat.id,
      user_id: userId,
      role: "member",
    }));
    await supabase.from("chat_members").insert(rows);
    setSaving(false);
    onBack();
  };

  return (
    <Screen>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.searchShell}>
          <Pressable onPress={onBack} style={styles.backBtn}>
            <Feather name="arrow-right" size={24} color={theme.colors.headerIcon} />
          </Pressable>
          <TextInput
            style={styles.searchInput}
            placeholder="אפשר לחפש שם או מספר..."
            placeholderTextColor={theme.colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
          />
        </View>
        <Pressable style={styles.gridBtn}>
          <MaterialCommunityIcons name="dots-grid" size={24} color={theme.colors.headerIcon} />
        </Pressable>
      </View>

      {/* Selected Users Chips */}
      {selectedIds.size > 0 && (
        <View style={styles.selectedContainer}>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            inverted={true} // RTL scroll
            data={[...selectedIds].map(id => results.find(r => r.id === id)).filter(Boolean)}
            keyExtractor={item => item!.id}
            renderItem={({ item }) => {
              if (!item) return null;
              const nickname = contactNicknames[item.id]?.first_name;
              const displayName = nickname || item.username;
              return (
                <Pressable style={styles.selectedChip} onPress={() => toggleSelect(item.id)}>
                  <View style={styles.selectedAvatarContainer}>
                    <View style={styles.selectedAvatar}>
                      <Text style={styles.selectedAvatarText}>{(nickname || item.username).slice(0, 1).toUpperCase()}</Text>
                    </View>
                    <View style={styles.removeIconBadge}>
                      <Feather name="x" size={12} color={theme.colors.textMuted} />
                    </View>
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
      <Pressable style={styles.quickRow}>
        <View style={styles.quickIcon}>
          <MaterialCommunityIcons name="account-plus" size={22} color="#fff" />
        </View>
        <Text style={styles.quickText}>איש קשר חדש</Text>
      </Pressable>
      <Pressable style={styles.quickRow}>
        <View style={[styles.quickIcon, { backgroundColor: theme.colors.accent }]}>
          <MaterialCommunityIcons name="link-variant" size={22} color="#fff" />
        </View>
        <Text style={styles.quickText}>הזמנה באמצעות קישור או קוד QR</Text>
      </Pressable>

      {results.length > 0 && (
        <Text style={styles.sectionLabel}>צ'אטים בשימוש נפוץ</Text>
      )}

      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const selected = selectedIds.has(item.id);
          const nickname = contactNicknames[item.id]?.first_name;
          return (
            <Pressable style={styles.resultRow} onPress={() => toggleSelect(item.id)}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{(nickname || item.username).slice(0, 1).toUpperCase()}</Text>
              </View>
              <View style={styles.resultCopy}>
                <Text style={styles.resultName}>{nickname || item.username}</Text>
                <Text style={styles.resultSub}>{nickname ? `@${item.username}` : (item.full_name || `@${item.username}`)}</Text>
              </View>
              <View style={[styles.radio, selected && styles.radioSelected]}>
                {selected && <Feather name="check" size={14} color="#fff" />}
              </View>
            </Pressable>
          );
        }}
      />

      {/* Floating Action Button (FAB) */}
      {selectedIds.size > 0 && (
        <Pressable style={styles.fabBtn} onPress={handleAdd} disabled={saving}>
          <Feather name="arrow-left" size={24} color="#fff" />
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
      marginHorizontal: 10,
      width: 60,
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
      flexDirection: "row-reverse",
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
      textAlign: "right",
    },
    sectionLabel: {
      fontSize: 13,
      color: theme.colors.textMuted,
      paddingHorizontal: theme.spacing.lg,
      paddingTop: theme.spacing.md,
      paddingBottom: theme.spacing.sm,
      textAlign: "right",
      fontWeight: "600",
    },
    resultRow: {
      flexDirection: "row-reverse",
      alignItems: "center",
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: 12,
      gap: theme.spacing.md,
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
    avatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: theme.colors.surfaceMuted,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarText: {
      fontSize: 18,
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
      textAlign: "right",
    },
    resultSub: {
      fontSize: 14,
      color: theme.colors.textMuted,
      marginTop: 2,
      textAlign: "right",
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
