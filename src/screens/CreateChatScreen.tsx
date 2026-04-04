import { useEffect, useMemo, useState } from "react";
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { useChats } from "@/context/ChatContext";
import { useAppTheme } from "@/lib/theme";
import { Chat, Profile } from "@/lib/types";
import { webEmbeddedInputReset, webNoOutline } from "@/lib/webStyles";

type Props = {
  onBack: () => void;
  onOpenChat: (chat: Chat) => void;
  initialSelectedUsers?: Profile[];
};

export function CreateChatScreen({ onBack, onOpenChat, initialSelectedUsers }: Props) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { searchUsers, createChat, contactNicknames } = useChats();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Profile[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<Profile[]>(initialSelectedUsers || []);
  const [loadingResults, setLoadingResults] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Group name modal
  const [showGroupNameModal, setShowGroupNameModal] = useState(false);
  const [groupTitle, setGroupTitle] = useState("");

  useEffect(() => {
    const timeout = setTimeout(() => {
      void loadUsers(query);
    }, 140);
    return () => clearTimeout(timeout);
  }, [query]);

  async function loadUsers(nextQuery: string) {
    setLoadingResults(true);
    const data = await searchUsers(nextQuery);
    setResults(data);
    setLoadingResults(false);
  }

  const selectedIds = useMemo(() => new Set(selectedUsers.map((u) => u.id)), [selectedUsers]);

  function toggleUser(user: Profile) {
    setError(null);
    setSelectedUsers((current) =>
      current.some((item) => item.id === user.id)
        ? current.filter((item) => item.id !== user.id)
        : [...current, user],
    );
  }

  async function handleFabPress() {
    if (!selectedUsers.length) return;
    if (selectedUsers.length === 1) {
      // Direct private chat
      setCreating(true);
      const result = await createChat(selectedUsers[0].username, [selectedUsers[0].username]);
      setCreating(false);
      if (result.chat) onOpenChat(result.chat);
    } else {
      // Need group name
      setShowGroupNameModal(true);
    }
  }

  async function handleCreateGroup() {
    if (!groupTitle.trim()) {
      setError("יש להוסיף שם קבוצה.");
      return;
    }
    setCreating(true);
    setError(null);
    const result = await createChat(
      groupTitle.trim(),
      selectedUsers.map((u) => u.username),
    );
    setCreating(false);
    if (result.error || !result.chat) {
      setError(result.error ?? "לא ניתן ליצור קבוצה.");
      return;
    }
    setShowGroupNameModal(false);
    onOpenChat(result.chat);
  }

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
            placeholder="אפשר לחפש שם או שם משתמש..."
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
      {selectedUsers.length > 0 && (
        <View style={styles.selectedContainer}>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            inverted={true}
            data={selectedUsers}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => {
              const nickname = contactNicknames[item.id]?.first_name;
              const displayName = nickname || item.username;
              return (
                <Pressable style={[styles.selectedChip, webNoOutline]} onPress={() => toggleUser(item)}>
                  <View style={styles.selectedAvatarContainer}>
                    <View style={styles.selectedAvatar}>
                      <Text style={styles.selectedAvatarText}>
                        {(nickname || item.username).slice(0, 1).toUpperCase()}
                      </Text>
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

      {/* Section label */}
      <Text style={styles.sectionLabel}>
        {loadingResults ? "מחפש משתמשים..." : results.length > 0 ? "משתמשים" : "לא נמצאו משתמשים"}
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
                  {(nickname || item.username).slice(0, 1).toUpperCase()}
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
          !loadingResults ? (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons color={theme.colors.textMuted} name="account-search-outline" size={48} />
              <Text style={styles.emptyTitle}>לא נמצאו משתמשים</Text>
              <Text style={styles.emptySubtitle}>נסו שם משתמש אחר לחפש אותו.</Text>
            </View>
          ) : null
        }
      />

      {/* FAB */}
      {selectedUsers.length > 0 && (
        <Pressable style={styles.fabBtn} onPress={() => void handleFabPress()} disabled={creating}>
          <Feather name="arrow-left" size={24} color={theme.colors.textOnAccent} />
        </Pressable>
      )}

      {/* Group Name Modal */}
      <Modal visible={showGroupNameModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>שם הקבוצה</Text>
            <TextInput
              style={[styles.modalInput, webEmbeddedInputReset]}
              placeholder="לדוגמה: צוות סופ״ש"
              placeholderTextColor={theme.colors.textMuted}
              value={groupTitle}
              onChangeText={setGroupTitle}
              autoFocus
              textAlign="right"
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <View style={styles.modalActions}>
              <Pressable onPress={() => setShowGroupNameModal(false)} style={styles.modalCancelBtn}>
                <Text style={styles.modalCancelText}>ביטול</Text>
              </Pressable>
              <Pressable onPress={() => void handleCreateGroup()} style={styles.modalConfirmBtn} disabled={creating}>
                <Text style={styles.modalConfirmText}>{creating ? "יוצר..." : "יצירה"}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
      textAlign: "right",
    },
    resultSub: {
      fontSize: 14,
      color: theme.colors.textMuted,
      marginTop: 2,
      textAlign: "right",
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
    modalOverlay: {
      flex: 1,
      backgroundColor: theme.colors.overlay,
      justifyContent: "center",
      alignItems: "center",
      padding: 32,
    },
    modalCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.md,
      padding: 24,
      width: "100%",
      maxWidth: 420,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: "700",
      color: theme.colors.text,
      textAlign: "right",
      marginBottom: 16,
    },
    modalInput: {
      fontSize: 17,
      color: theme.colors.text,
      borderBottomWidth: 2,
      borderBottomColor: theme.colors.accent,
      paddingVertical: 8,
      marginBottom: 12,
    },
    error: {
      color: theme.colors.danger ?? "#ef4444",
      fontSize: 13,
      textAlign: "right",
      marginBottom: 8,
    },
    modalActions: {
      flexDirection: "row",
      justifyContent: "flex-start",
      gap: 16,
      marginTop: 8,
    },
    modalCancelBtn: {
      paddingVertical: 10,
      paddingHorizontal: 16,
    },
    modalCancelText: {
      fontSize: 15,
      color: theme.colors.textMuted,
      fontWeight: "600",
    },
    modalConfirmBtn: {
      paddingVertical: 10,
      paddingHorizontal: 16,
    },
    modalConfirmText: {
      fontSize: 15,
      color: theme.colors.accent,
      fontWeight: "700",
    },
  });
