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
  const { loadChatMembers, searchUsers } = useChats();

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
        <Pressable onPress={onBack} style={styles.backBtn}>
          <Feather name="arrow-right" size={24} color={theme.colors.headerIcon} />
        </Pressable>
        <View style={styles.searchShell}>
          <Feather name="search" size={16} color={theme.colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="אפשר לחפש שם או מספר..."
            placeholderTextColor={theme.colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
          />
        </View>
      </View>

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
          return (
            <Pressable style={styles.resultRow} onPress={() => toggleSelect(item.id)}>
              <View style={[styles.radio, selected && styles.radioSelected]}>
                {selected && <Feather name="check" size={14} color="#fff" />}
              </View>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{item.username.slice(0, 1).toUpperCase()}</Text>
              </View>
              <View style={styles.resultCopy}>
                <Text style={styles.resultName}>{item.full_name || item.username}</Text>
                {item.full_name && <Text style={styles.resultSub}>{item.username}</Text>}
              </View>
            </Pressable>
          );
        }}
      />

      {selectedIds.size > 0 && (
        <Pressable style={styles.addBtn} onPress={handleAdd} disabled={saving}>
          <Text style={styles.addBtnText}>
            {saving ? "מוסיף..." : `הוסף ${selectedIds.size} חבר${selectedIds.size > 1 ? "ים" : ""}`}
          </Text>
        </Pressable>
      )}
    </Screen>
  );
}

const createStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    header: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.colors.header,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      gap: theme.spacing.md,
    },
    backBtn: {
      padding: theme.spacing.xs,
    },
    searchShell: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    searchInput: {
      flex: 1,
      color: theme.colors.headerText,
      fontSize: 16,
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
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.separator,
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
    },
    sectionLabel: {
      fontSize: 13,
      color: theme.colors.textMuted,
      paddingHorizontal: theme.spacing.lg,
      paddingTop: theme.spacing.md,
      paddingBottom: theme.spacing.sm,
    },
    resultRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: 12,
      gap: theme.spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.separator,
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
    },
    resultName: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.text,
    },
    resultSub: {
      fontSize: 13,
      color: theme.colors.textMuted,
      marginTop: 2,
    },
    addBtn: {
      backgroundColor: theme.colors.accent,
      margin: theme.spacing.lg,
      borderRadius: theme.radius.pill,
      paddingVertical: 14,
      alignItems: "center",
    },
    addBtnText: {
      color: "#fff",
      fontSize: 16,
      fontWeight: "700",
    },
  });
