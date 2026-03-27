import { useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { PrimaryButton } from "@/components/PrimaryButton";
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
  }, [chat.id]);

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
        <View>
          <Text style={styles.title}>{chat.title}</Text>
          <Text style={styles.subtitle}>Swipe right on a message to reply. Long press for reactions.</Text>
        </View>
        <PrimaryButton label="Back" onPress={onBack} tone="soft" />
      </View>

      <ScrollView contentContainerStyle={styles.messages}>
        {messages.map((message) => {
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
        })}
      </ScrollView>

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
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: theme.spacing.md,
  },
  title: {
    color: theme.colors.text,
    fontSize: 24,
    fontWeight: "800",
  },
  subtitle: {
    color: theme.colors.textMuted,
    fontSize: 13,
    marginTop: 4,
  },
  messages: {
    flexGrow: 1,
    paddingBottom: theme.spacing.md,
  },
});
