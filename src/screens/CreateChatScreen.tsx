import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { PrimaryButton } from "@/components/PrimaryButton";
import { Screen } from "@/components/Screen";
import { useChats } from "@/context/ChatContext";
import { useAppTheme } from "@/lib/theme";
import { Chat, Profile } from "@/lib/types";
import { webEmbeddedInputReset, webNoOutline } from "@/lib/webStyles";

type Props = {
  onBack: () => void;
  onOpenChat: (chat: Chat) => void;
};

export function CreateChatScreen({ onBack, onOpenChat }: Props) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { searchUsers, createChat } = useChats();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Profile[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<Profile[]>([]);
  const [groupTitle, setGroupTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loadingResults, setLoadingResults] = useState(true);
  const [creating, setCreating] = useState(false);

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

  const selectedIds = useMemo(() => new Set(selectedUsers.map((user) => user.id)), [selectedUsers]);

  async function handleCreate() {
    if (!selectedUsers.length) {
      setError("Pick at least one user.");
      return;
    }

    if (selectedUsers.length > 1 && !groupTitle.trim()) {
      setError("Add a group name before continuing.");
      return;
    }

    setCreating(true);
    setError(null);

    const result = await createChat(
      selectedUsers.length > 1 ? groupTitle.trim() : selectedUsers[0].username,
      selectedUsers.map((user) => user.username),
    );

    setCreating(false);
    if (result.error || !result.chat) {
      setError(result.error ?? "Could not create chat.");
      return;
    }

    onOpenChat(result.chat);
  }

  function toggleUser(user: Profile) {
    setError(null);
    setSelectedUsers((current) =>
      current.some((item) => item.id === user.id)
        ? current.filter((item) => item.id !== user.id)
        : [...current, user],
    );
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.backButton}>
          <Feather color={theme.colors.textOnAccent} name="arrow-left" size={22} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.headerTitle}>New chat</Text>
          <Text style={styles.headerSubtitle}>Pick people by username</Text>
        </View>
      </View>

      <View style={styles.searchBar}>
        <Feather color={theme.colors.textMuted} name="search" size={18} />
        <TextInput
          onChangeText={setQuery}
          placeholder="Search by username or name"
          placeholderTextColor={theme.colors.textMuted}
          style={[styles.searchInput, webEmbeddedInputReset]}
          value={query}
        />
      </View>

      {selectedUsers.length ? (
        <ScrollView contentContainerStyle={styles.chipRow} horizontal showsHorizontalScrollIndicator={false}>
          {selectedUsers.map((user) => (
            <Pressable key={user.id} onPress={() => toggleUser(user)} style={[styles.selectedChip, webNoOutline]}>
              <Text style={styles.selectedChipText}>@{user.username}</Text>
              <Feather color={theme.colors.accent} name="x" size={14} />
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      <View style={styles.listShell}>
        <Text style={styles.sectionTitle}>{loadingResults ? "Searching users..." : "Users"}</Text>
        <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
          {results.length ? (
            results.map((user, index) => {
              const active = selectedIds.has(user.id);
              return (
                <Pressable key={user.id} onPress={() => toggleUser(user)} style={[styles.userRow, webNoOutline]}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{user.username.slice(0, 1).toUpperCase()}</Text>
                  </View>
                  <View style={[styles.userCopy, index !== results.length - 1 && styles.userCopyBorder]}>
                    <Text style={styles.username}>@{user.username}</Text>
                    <Text style={styles.name}>{user.full_name || user.email}</Text>
                  </View>
                  <View style={[styles.check, active && styles.checkActive]}>
                    <Feather color={active ? theme.colors.textOnAccent : theme.colors.textMuted} name={active ? "check" : "plus"} size={16} />
                  </View>
                </Pressable>
              );
            })
          ) : (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons color={theme.colors.textMuted} name="account-search-outline" size={36} />
              <Text style={styles.emptyTitle}>No users found</Text>
              <Text style={styles.emptySubtitle}>Try a different username or create more test accounts first.</Text>
            </View>
          )}
        </ScrollView>
      </View>

      <View style={styles.bottomPanel}>
        {selectedUsers.length > 1 ? (
          <View style={styles.groupFieldWrap}>
            <Text style={styles.groupLabel}>Group name</Text>
            <TextInput
              autoCapitalize="sentences"
              onChangeText={setGroupTitle}
              placeholder="Weekend crew"
              placeholderTextColor={theme.colors.textMuted}
              style={[styles.groupInput, webNoOutline]}
              value={groupTitle}
            />
          </View>
        ) : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <PrimaryButton
          disabled={!selectedUsers.length || creating}
          label={creating ? "Creating..." : selectedUsers.length > 1 ? "Create group" : "Continue"}
          onPress={() => void handleCreate()}
        />
      </View>
    </Screen>
  );
}

const createStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    header: {
      backgroundColor: theme.colors.header,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: theme.spacing.md,
      paddingTop: theme.spacing.sm,
      paddingBottom: theme.spacing.md,
    },
    backButton: {
      width: 36,
      height: 36,
      borderRadius: theme.radius.pill,
      alignItems: "center",
      justifyContent: "center",
    },
    headerCopy: {
      flex: 1,
    },
    headerTitle: {
      color: theme.colors.textOnAccent,
      fontSize: 20,
      fontWeight: "800",
    },
    headerSubtitle: {
      color: "rgba(255,255,255,0.82)",
      fontSize: 13,
      marginTop: 2,
    },
    searchBar: {
      marginHorizontal: theme.spacing.md,
      marginTop: theme.spacing.sm,
      marginBottom: theme.spacing.xs,
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.pill,
      paddingHorizontal: 14,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    searchInput: {
      flex: 1,
      color: theme.colors.text,
      fontSize: 15,
      paddingVertical: 12,
    },
    chipRow: {
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.xs,
      gap: theme.spacing.xs,
    },
    selectedChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: theme.colors.accentSoft,
      borderRadius: theme.radius.pill,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    selectedChipText: {
      color: theme.colors.accent,
      fontWeight: "700",
    },
    listShell: {
      flex: 1,
      backgroundColor: theme.colors.surface,
      marginTop: theme.spacing.xs,
    },
    sectionTitle: {
      color: theme.colors.textMuted,
      fontSize: 12,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 0.7,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: 10,
    },
    list: {
      flex: 1,
    },
    userRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingLeft: theme.spacing.md,
      paddingRight: theme.spacing.md,
      backgroundColor: theme.colors.surface,
    },
    avatar: {
      width: 48,
      height: 48,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.surfaceMuted,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 12,
    },
    avatarText: {
      color: theme.colors.accent,
      fontSize: 18,
      fontWeight: "800",
    },
    userCopy: {
      flex: 1,
      paddingVertical: 14,
    },
    userCopyBorder: {
      borderBottomColor: theme.colors.separator,
      borderBottomWidth: 1,
    },
    username: {
      color: theme.colors.text,
      fontSize: 16,
      fontWeight: "700",
    },
    name: {
      color: theme.colors.textMuted,
      fontSize: 13,
      marginTop: 3,
    },
    check: {
      width: 30,
      height: 30,
      borderRadius: theme.radius.pill,
      borderColor: theme.colors.border,
      borderWidth: 1,
      alignItems: "center",
      justifyContent: "center",
      marginLeft: 12,
    },
    checkActive: {
      backgroundColor: theme.colors.accentStrong,
      borderColor: theme.colors.accentStrong,
    },
    emptyState: {
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: theme.spacing.xl,
      paddingTop: 80,
      gap: theme.spacing.xs,
    },
    emptyTitle: {
      color: theme.colors.text,
      fontSize: 18,
      fontWeight: "800",
    },
    emptySubtitle: {
      color: theme.colors.textMuted,
      textAlign: "center",
      lineHeight: 21,
    },
    bottomPanel: {
      backgroundColor: theme.colors.background,
      borderTopColor: theme.colors.separator,
      borderTopWidth: 1,
      paddingHorizontal: theme.spacing.md,
      paddingTop: theme.spacing.sm,
      paddingBottom: theme.spacing.md,
      gap: theme.spacing.sm,
    },
    groupFieldWrap: {
      gap: 6,
    },
    groupLabel: {
      color: theme.colors.textMuted,
      fontSize: 13,
      fontWeight: "600",
    },
    groupInput: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.border,
      borderWidth: 1,
      borderRadius: theme.radius.md,
      color: theme.colors.text,
      fontSize: 15,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: 12,
    },
    error: {
      color: theme.colors.danger,
      fontWeight: "600",
    },
  });
