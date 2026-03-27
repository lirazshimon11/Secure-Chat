import { useMemo, useRef, useState } from "react";
import { Animated, PanResponder, Pressable, StyleSheet, Text, View } from "react-native";
import { Message, Profile, ReactionSummary } from "@/lib/types";
import { theme } from "@/lib/theme";

type ViewOnceState = "hidden" | "revealed" | "opened";

type Props = {
  currentUserId: string;
  message: Message;
  author?: Profile;
  replyPreview?: string | null;
  reactions?: ReactionSummary;
  viewOnceState?: ViewOnceState;
  onReply: (message: Message) => void;
  onToggleReaction: (emoji: string) => void;
  onRevealViewOnce: () => void;
};

const quickReactions = ["??", "??", "??", "??"];

export function MessageBubble({
  currentUserId,
  message,
  author,
  replyPreview,
  reactions,
  viewOnceState,
  onReply,
  onToggleReaction,
  onRevealViewOnce,
}: Props) {
  const mine = message.sender_id === currentUserId;
  const translateX = useRef(new Animated.Value(0)).current;
  const [showReactions, setShowReactions] = useState(false);

  const responder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_evt, gesture) => Math.abs(gesture.dx) > 8,
        onPanResponderMove: (_evt, gesture) => {
          if (gesture.dx > 0) {
            translateX.setValue(Math.min(gesture.dx, 72));
          }
        },
        onPanResponderRelease: (_evt, gesture) => {
          if (gesture.dx > 44) {
            onReply(message);
          }

          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        },
      }),
    [message, onReply, translateX],
  );

  const body =
    message.message_kind === "view_once" && viewOnceState === "hidden"
      ? "Tap to reveal. It disappears after opening."
      : message.message_kind === "view_once" && viewOnceState === "opened"
        ? "Opened once. Content is no longer available."
        : message.body_ciphertext;

  const meta =
    message.message_kind === "temporary" && message.expires_at
      ? `Vanishes at ${new Date(message.expires_at).toLocaleTimeString()}`
      : message.message_kind === "view_once" && viewOnceState === "revealed"
        ? "Visible for a moment"
        : message.message_kind === "view_once" && viewOnceState === "opened"
          ? "Already opened"
          : message.message_kind === "view_once"
            ? "One-time view"
            : "Protected";

  return (
    <Animated.View
      {...responder.panHandlers}
      style={[
        styles.row,
        mine ? styles.rowMine : styles.rowTheirs,
        { transform: [{ translateX }] },
      ]}
    >
      <Pressable
        onLongPress={() => setShowReactions((value) => !value)}
        onPress={message.message_kind === "view_once" && viewOnceState === "hidden" ? onRevealViewOnce : undefined}
        style={[
          styles.bubble,
          mine ? styles.bubbleMine : styles.bubbleTheirs,
          message.message_kind === "view_once" && styles.viewOnceBubble,
        ]}
      >
        {!mine ? <Text style={styles.author}>{author?.username ?? "member"}</Text> : null}
        {replyPreview ? (
          <View style={styles.replyBlock}>
            <Text numberOfLines={2} style={styles.replyBlockText}>
              {replyPreview}
            </Text>
          </View>
        ) : null}
        <Text style={styles.body}>{body}</Text>
        <Text style={styles.meta}>{meta}</Text>
        {showReactions ? (
          <View style={styles.quickRow}>
            {quickReactions.map((emoji) => (
              <Pressable key={emoji} onPress={() => onToggleReaction(emoji)} style={styles.quickChip}>
                <Text style={styles.quickChipText}>{emoji}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        {reactions ? (
          <View style={styles.reactionRow}>
            {Object.entries(reactions).map(([emoji, users]) =>
              users.length ? (
                <Pressable key={emoji} onPress={() => onToggleReaction(emoji)} style={styles.reactionChip}>
                  <Text style={styles.reactionText}>
                    {emoji} {users.length}
                  </Text>
                </Pressable>
              ) : null,
            )}
          </View>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    marginVertical: 6,
  },
  rowMine: {
    alignItems: "flex-end",
  },
  rowTheirs: {
    alignItems: "flex-start",
  },
  bubble: {
    borderRadius: theme.radius.lg,
    gap: theme.spacing.xs,
    maxWidth: "84%",
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  bubbleMine: {
    backgroundColor: theme.colors.mine,
  },
  bubbleTheirs: {
    backgroundColor: theme.colors.theirs,
  },
  viewOnceBubble: {
    borderColor: theme.colors.warning,
    borderWidth: 1,
  },
  author: {
    color: theme.colors.accent,
    fontSize: 12,
    fontWeight: "700",
  },
  replyBlock: {
    backgroundColor: "rgba(255,255,255,0.6)",
    borderLeftColor: theme.colors.accent,
    borderLeftWidth: 3,
    borderRadius: theme.radius.sm,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 8,
  },
  replyBlockText: {
    color: theme.colors.textMuted,
    fontSize: 12,
  },
  body: {
    color: theme.colors.text,
    fontSize: 16,
    lineHeight: 22,
  },
  meta: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: "600",
  },
  quickRow: {
    flexDirection: "row",
    gap: theme.spacing.xs,
    marginTop: 6,
  },
  quickChip: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  quickChipText: {
    fontSize: 16,
  },
  reactionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.xs,
  },
  reactionChip: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  reactionText: {
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: "600",
  },
});
