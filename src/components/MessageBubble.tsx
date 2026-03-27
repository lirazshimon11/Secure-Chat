import { useMemo, useRef, useState } from "react";
import { Animated, PanResponder, Pressable, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
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

const quickReactions = ["\u{1F44D}", "\u{1F602}", "\u{2764}", "\u{1F440}"];

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
            translateX.setValue(Math.min(gesture.dx, 70));
          }
        },
        onPanResponderRelease: (_evt, gesture) => {
          if (gesture.dx > 40) {
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

  const timeLabel = new Date(message.created_at).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  const metaLabel =
    message.message_kind === "temporary"
      ? "1 min"
      : message.message_kind === "view_once"
        ? viewOnceState === "revealed"
          ? "open"
          : viewOnceState === "opened"
            ? "used"
            : "once"
        : null;

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
        style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}
      >
        {!mine ? <Text style={styles.author}>{author?.username ?? "member"}</Text> : null}

        {replyPreview ? (
          <View style={styles.replyBlock}>
            <Text style={styles.replyLabel}>Reply</Text>
            <Text numberOfLines={2} style={styles.replyBlockText}>
              {replyPreview}
            </Text>
          </View>
        ) : null}

        <Text style={styles.body}>{body}</Text>

        <View style={styles.metaRow}>
          {metaLabel ? (
            <View style={styles.kindChip}>
              <Text style={styles.kindChipText}>{metaLabel}</Text>
            </View>
          ) : null}
          <View style={styles.timeRow}>
            {message.message_kind === "view_once" ? (
              <MaterialCommunityIcons name="eye-outline" size={13} color={theme.colors.textMuted} />
            ) : null}
            {message.message_kind === "temporary" ? (
              <MaterialCommunityIcons name="timer-sand" size={13} color={theme.colors.textMuted} />
            ) : null}
            <Text style={styles.meta}>{timeLabel}</Text>
          </View>
        </View>

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
    marginVertical: 3,
  },
  rowMine: {
    alignItems: "flex-end",
  },
  rowTheirs: {
    alignItems: "flex-start",
  },
  bubble: {
    borderRadius: 10,
    maxWidth: "83%",
    minWidth: 96,
    paddingHorizontal: 10,
    paddingTop: 7,
    paddingBottom: 6,
    shadowColor: "#000000",
    shadowOpacity: 0.05,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
  },
  bubbleMine: {
    backgroundColor: theme.colors.mine,
    borderTopRightRadius: 2,
  },
  bubbleTheirs: {
    backgroundColor: theme.colors.theirs,
    borderTopLeftRadius: 2,
  },
  author: {
    color: "#8b5cf6",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 4,
  },
  replyBlock: {
    backgroundColor: "rgba(17,27,33,0.06)",
    borderLeftColor: theme.colors.accent,
    borderLeftWidth: 3,
    borderRadius: theme.radius.sm,
    marginBottom: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  replyLabel: {
    color: theme.colors.accent,
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 2,
  },
  replyBlockText: {
    color: theme.colors.textMuted,
    fontSize: 12,
    lineHeight: 16,
  },
  body: {
    color: theme.colors.text,
    fontSize: 15,
    lineHeight: 20,
  },
  metaRow: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  kindChip: {
    backgroundColor: "rgba(17,27,33,0.06)",
    borderRadius: theme.radius.pill,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  kindChipText: {
    color: theme.colors.textMuted,
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginLeft: "auto",
  },
  meta: {
    color: theme.colors.textMuted,
    fontSize: 11,
  },
  quickRow: {
    flexDirection: "row",
    gap: theme.spacing.xs,
    marginTop: 8,
  },
  quickChip: {
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  quickChipText: {
    fontSize: 15,
  },
  reactionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.xs,
    marginTop: 6,
  },
  reactionChip: {
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  reactionText: {
    color: theme.colors.text,
    fontSize: 11,
    fontWeight: "600",
  },
});
