import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { AppTextInput } from "@/components/AppTextInput";
import { PrimaryButton } from "@/components/PrimaryButton";
import { Screen } from "@/components/Screen";
import { useAuth } from "@/context/AuthContext";
import { useChats } from "@/context/ChatContext";
import { Chat } from "@/lib/types";
import { theme } from "@/lib/theme";

type Props = {
  onOpenChat: (chat: Chat) => void;
  onOpenSettings: () => void;
};

export function ChatsScreen({ onOpenChat, onOpenSettings }: Props) {
  const { profile } = useAuth();
  const { chats, createChat, loading } = useChats();
  const [title, setTitle] = useState("");
  const [members, setMembers] = useState("");
  const [error, setError] = useState<string | null>(null);

  const greeting = useMemo(() => {
    if (!profile?.username) {
      return "Private rooms";
    }
    return `${profile.username}'s rooms`;
  }, [profile?.username]);

  async function handleCreateChat() {
    const nextError = await createChat(
      title.trim(),
      members
        .split(",")
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean),
    );

    setError(nextError);
    if (!nextError) {
      setTitle("");
      setMembers("");
    }
  }

  return (
    <Screen scroll>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.eyebrow}>Locked rooms</Text>
          <Text style={styles.title}>{greeting}</Text>
          <Text style={styles.subtitle}>Invite only the usernames you trust. No one else gets into the room.</Text>
        </View>
        <PrimaryButton label="Settings" onPress={onOpenSettings} tone="soft" />
      </View>

      <View style={styles.createCard}>
        <Text style={styles.sectionTitle}>Start a new chat</Text>
        <AppTextInput
          autoCapitalize="sentences"
          label="Chat title"
          onChangeText={setTitle}
          placeholder="Weekend plan / Core group / etc."
          value={title}
        />
        <AppTextInput
          label="Members"
          onChangeText={setMembers}
          placeholder="username1, username2"
          value={members}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <PrimaryButton label="Create room" onPress={handleCreateChat} />
      </View>

      <View style={styles.list}>
        <Text style={styles.sectionTitle}>{loading ? "Loading rooms..." : "Your chats"}</Text>
        {chats.length ? (
          chats.map((chat) => (
            <Pressable key={chat.id} onPress={() => onOpenChat(chat)} style={styles.chatCard}>
              <View style={styles.chatInfo}>
                <Text style={styles.chatTitle}>{chat.title}</Text>
                <Text numberOfLines={1} style={styles.chatPreview}>
                  {chat.last_message_preview ?? "No messages yet"}
                </Text>
              </View>
              <Text style={styles.chatMeta}>
                {chat.last_message_at ? new Date(chat.last_message_at).toLocaleDateString() : "New"}
              </Text>
            </Pressable>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No chats yet</Text>
            <Text style={styles.emptySubtitle}>
              Create a room and invite your trusted usernames. That gives you a private place that is separate from WhatsApp and Telegram.
            </Text>
          </View>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    gap: theme.spacing.md,
    justifyContent: "space-between",
  },
  headerText: {
    flex: 1,
    gap: theme.spacing.xs,
  },
  eyebrow: {
    color: theme.colors.accent,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  title: {
    color: theme.colors.text,
    fontSize: 30,
    fontWeight: "800",
  },
  subtitle: {
    color: theme.colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
  },
  createCard: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    gap: theme.spacing.md,
    padding: theme.spacing.md,
  },
  sectionTitle: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: "800",
  },
  list: {
    gap: theme.spacing.sm,
  },
  chatCard: {
    alignItems: "center",
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    flexDirection: "row",
    gap: theme.spacing.sm,
    justifyContent: "space-between",
    padding: theme.spacing.md,
  },
  chatInfo: {
    flex: 1,
    gap: 4,
  },
  chatTitle: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: "700",
  },
  chatPreview: {
    color: theme.colors.textMuted,
    fontSize: 14,
  },
  chatMeta: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
  },
  emptyState: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    gap: theme.spacing.xs,
    padding: theme.spacing.lg,
  },
  emptyTitle: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: "800",
  },
  emptySubtitle: {
    color: theme.colors.textMuted,
    lineHeight: 22,
  },
  error: {
    color: theme.colors.danger,
    fontWeight: "600",
  },
});
