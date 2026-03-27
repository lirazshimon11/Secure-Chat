import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { MessageBubble } from "@/components/MessageBubble";
import { MessageComposer } from "@/components/MessageComposer";
import { Screen } from "@/components/Screen";
import { useAuth } from "@/context/AuthContext";
import { useChats } from "@/context/ChatContext";
import { Chat, Message } from "@/lib/types";
import { theme } from "@/lib/theme";

type Props = {
  chat: Chat;
  onBack: () => void;
};

export function ChatScreen({ chat, onBack }: Props) {
  const { profile } = useAuth();
  const {
    loadMessages,
    messagesByChat,
    profiles,
    reactionsByMessage,
    openedViewOnceIds,
    sendMessage,
    openViewOnceMessage,
    toggleReaction,
  } = useChats();
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [revealedMessageId, setRevealedMessageId] = useState<string | null>(null);
  const revealTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const messages = messagesByChat[chat.id] ?? [];
  const messageMap = useMemo(() => Object.fromEntries(messages.map((message) => [message.id, message])), [messages]);

  useEffect(() => {
    void loadMessages(chat.id);
  }, [chat.id, loadMessages]);

  useEffect(() => {
    return () => {
      if (revealTimeoutRef.current) {
        clearTimeout(revealTimeoutRef.current);
      }
    };
  }, []);

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.headerButton}>
          <Feather color={theme.colors.textOnAccent} name="arrow-left" size={22} />
        </Pressable>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{chat.title.slice(0, 1).toUpperCase()}</Text>
        </View>
        <View style={styles.headerCopy}>
          <Text numberOfLines={1} style={styles.title}>
            {chat.title}
          </Text>
          <Text style={styles.subtitle}>{chat.is_group ? "Group chat" : "Private chat"}</Text>
        </View>
        <Pressable style={styles.headerButton}>
          <MaterialCommunityIcons color={theme.colors.textOnAccent} name="dots-vertical" size={20} />
        </Pressable>
      </View>

      <View style={styles.noticeBar}>
        <MaterialCommunityIcons color={theme.colors.textMuted} name="shield-lock-outline" size={16} />
        <Text style={styles.noticeText}>Text only. Files, photos, videos, and calls stay disabled here.</Text>
      </View>

      <View style={styles.thread}>
        <ScrollView contentContainerStyle={styles.messages} showsVerticalScrollIndicator={false}>
          {messages.length ? (
            messages.map((message) => {
              const replyPreview = message.reply_to_id ? messageMap[message.reply_to_id]?.body_preview : null;
              const viewOnceState =
                message.message_kind !== "view_once" || message.sender_id === profile?.id
                  ? undefined
                  : revealedMessageId === message.id
                    ? "revealed"
                    : openedViewOnceIds[message.id]
                      ? "opened"
                      : "hidden";

              return (
                <MessageBubble
                  key={message.id}
                  author={profiles[message.sender_id]}
                  currentUserId={profile?.id ?? ""}
                  message={message}
                  onReply={setReplyTo}
                  onRevealViewOnce={() => {
                    if (revealTimeoutRef.current) {
                      clearTimeout(revealTimeoutRef.current);
                    }

                    setRevealedMessageId(message.id);
                    revealTimeoutRef.current = setTimeout(() => {
                      void openViewOnceMessage(message);
                      setRevealedMessageId((current) => (current === message.id ? null : current));
                    }, 4000);
                  }}
                  onToggleReaction={(emoji) => void toggleReaction(message.id, emoji)}
                  reactions={reactionsByMessage[message.id]}
                  replyPreview={replyPreview}
                  viewOnceState={viewOnceState}
                />
              );
            })
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No messages yet</Text>
              <Text style={styles.emptySubtitle}>Start the conversation. Swipe a message later to reply.</Text>
            </View>
          )}
        </ScrollView>
      </View>

      <MessageComposer
        onCancelReply={() => setReplyTo(null)}
        onSend={async (body, kind, expireSeconds) => {
          const error = await sendMessage({
            chatId: chat.id,
            body,
            messageKind: kind,
            replyToId: replyTo?.id ?? null,
            expireSeconds,
          });

          if (!error) {
            setReplyTo(null);
          }
        }}
        replyPreview={replyTo?.body_preview ?? null}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: theme.colors.header,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: theme.spacing.sm,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.sm,
  },
  headerButton: {
    width: 34,
    height: 34,
    borderRadius: theme.radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.pill,
    backgroundColor: "rgba(255,255,255,0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: theme.colors.textOnAccent,
    fontWeight: "800",
  },
  headerCopy: {
    flex: 1,
  },
  title: {
    color: theme.colors.textOnAccent,
    fontSize: 17,
    fontWeight: "700",
  },
  subtitle: {
    color: "rgba(255,255,255,0.82)",
    fontSize: 12,
    marginTop: 1,
  },
  noticeBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 10,
    backgroundColor: "#fff8d6",
    borderBottomColor: theme.colors.separator,
    borderBottomWidth: 1,
  },
  noticeText: {
    flex: 1,
    color: theme.colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  thread: {
    flex: 1,
    backgroundColor: theme.colors.chatBackdrop,
  },
  messages: {
    flexGrow: 1,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.md,
  },
  emptyState: {
    marginTop: "auto",
    marginBottom: "auto",
    alignSelf: "center",
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: theme.radius.lg,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    gap: 4,
  },
  emptyTitle: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
  },
  emptySubtitle: {
    color: theme.colors.textMuted,
    textAlign: "center",
    lineHeight: 20,
  },
});
