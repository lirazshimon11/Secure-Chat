import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { useAuth } from "@/context/AuthContext";
import { useChats } from "@/context/ChatContext";
import { Chat } from "@/lib/types";
import { theme } from "@/lib/theme";

type Props = {
  onOpenChat: (chat: Chat) => void;
  onOpenSettings: () => void;
  onCreateChat: () => void;
};

export function ChatsScreen({ onOpenChat, onOpenSettings, onCreateChat }: Props) {
  const { profile } = useAuth();
  const { chats, loading } = useChats();

  const username = useMemo(() => `@${profile?.username ?? "you"}`, [profile?.username]);

  return (
    <Screen>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Private Chat</Text>
          <Text style={styles.headerSubtitle}>{username}</Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable style={styles.headerIcon}>
            <Feather color={theme.colors.textOnAccent} name="search" size={20} />
          </Pressable>
          <Pressable onPress={onOpenSettings} style={styles.headerIcon}>
            <MaterialCommunityIcons color={theme.colors.textOnAccent} name="dots-vertical" size={22} />
          </Pressable>
        </View>
      </View>

      <View style={styles.tabRow}>
        <Text style={styles.tabActive}>Chats</Text>
        <Text style={styles.tabMuted}>Groups</Text>
        <Text style={styles.tabMuted}>Private</Text>
      </View>

      <View style={styles.searchRow}>
        <Feather color={theme.colors.textMuted} name="search" size={18} />
        <Text style={styles.searchText}>Search or start a new chat</Text>
      </View>

      <View style={styles.listShell}>
        <Pressable onPress={onCreateChat} style={styles.utilityRow}>
          <View style={styles.utilityIconWrap}>
            <Ionicons color={theme.colors.textOnAccent} name="add" size={22} />
          </View>
          <View style={styles.utilityCopy}>
            <Text style={styles.utilityTitle}>New chat</Text>
            <Text style={styles.utilitySubtitle}>Find usernames and add them to a private chat or group</Text>
          </View>
        </Pressable>

        {loading ? <Text style={styles.statusText}>Syncing chats...</Text> : null}

        <View style={styles.chatList}>
          {chats.length ? (
            chats.map((chat, index) => (
              <Pressable key={chat.id} onPress={() => onOpenChat(chat)} style={styles.chatRow}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{chat.title.slice(0, 1).toUpperCase()}</Text>
                </View>
                <View style={[styles.chatMain, index !== chats.length - 1 && styles.chatMainBorder]}>
                  <View style={styles.chatTopRow}>
                    <Text numberOfLines={1} style={styles.chatTitle}>
                      {chat.title}
                    </Text>
                    <Text style={styles.chatTime}>
                      {chat.last_message_at
                        ? new Date(chat.last_message_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                        : "new"}
                    </Text>
                  </View>
                  <Text numberOfLines={1} style={styles.chatPreview}>
                    {chat.last_message_preview ?? "No messages yet"}
                  </Text>
                </View>
              </Pressable>
            ))
          ) : (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons color={theme.colors.textMuted} name="chat-outline" size={36} />
              <Text style={styles.emptyTitle}>No chats yet</Text>
              <Text style={styles.emptySubtitle}>Tap New chat to pick people and start your first conversation.</Text>
            </View>
          )}
        </View>
      </View>

      <Pressable onPress={onCreateChat} style={styles.fab}>
        <MaterialCommunityIcons color={theme.colors.textOnAccent} name="message-text" size={24} />
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: theme.colors.header,
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: {
    color: theme.colors.textOnAccent,
    fontSize: 22,
    fontWeight: "800",
  },
  headerSubtitle: {
    color: "rgba(255,255,255,0.82)",
    fontSize: 13,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: "row",
    gap: 8,
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  tabRow: {
    backgroundColor: theme.colors.header,
    flexDirection: "row",
    gap: theme.spacing.lg,
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
  },
  tabActive: {
    color: theme.colors.textOnAccent,
    fontWeight: "800",
    borderBottomColor: theme.colors.textOnAccent,
    borderBottomWidth: 3,
    paddingBottom: 7,
  },
  tabMuted: {
    color: "rgba(255,255,255,0.82)",
    paddingBottom: 10,
    fontWeight: "600",
  },
  searchRow: {
    marginHorizontal: theme.spacing.md,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  searchText: {
    color: theme.colors.textMuted,
    fontSize: 14,
  },
  listShell: {
    flex: 1,
    backgroundColor: theme.colors.surface,
  },
  utilityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 14,
    borderBottomColor: theme.colors.separator,
    borderBottomWidth: 1,
  },
  utilityIconWrap: {
    width: 48,
    height: 48,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.accentStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  utilityCopy: {
    flex: 1,
  },
  utilityTitle: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: "700",
  },
  utilitySubtitle: {
    color: theme.colors.textMuted,
    fontSize: 13,
    marginTop: 2,
  },
  statusText: {
    color: theme.colors.textMuted,
    fontSize: 12,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 8,
  },
  chatList: {
    flex: 1,
    backgroundColor: theme.colors.surface,
  },
  chatRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: theme.spacing.md,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  avatarText: {
    color: theme.colors.accent,
    fontSize: 20,
    fontWeight: "800",
  },
  chatMain: {
    flex: 1,
    paddingRight: theme.spacing.md,
    paddingVertical: 14,
  },
  chatMainBorder: {
    borderBottomColor: theme.colors.separator,
    borderBottomWidth: 1,
  },
  chatTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: theme.spacing.sm,
  },
  chatTitle: {
    flex: 1,
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: "700",
  },
  chatTime: {
    color: theme.colors.textMuted,
    fontSize: 12,
  },
  chatPreview: {
    color: theme.colors.textMuted,
    fontSize: 14,
    marginTop: 4,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: theme.spacing.xl,
    gap: theme.spacing.xs,
  },
  emptyTitle: {
    color: theme.colors.text,
    fontSize: 20,
    fontWeight: "800",
  },
  emptySubtitle: {
    color: theme.colors.textMuted,
    textAlign: "center",
    lineHeight: 21,
  },
  fab: {
    position: "absolute",
    right: 18,
    bottom: 24,
    width: 58,
    height: 58,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.accentStrong,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000000",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
});
