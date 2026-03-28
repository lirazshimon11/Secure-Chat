import { useMemo, useRef, useState } from "react";
import { Animated, PanResponder, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Message, Profile, ReactionSummary } from "@/lib/types";
import { useAppTheme } from "@/lib/theme";
import { webDefaultCursor } from "@/lib/webStyles";

type ViewOnceState = "hidden" | "revealed" | "opened";

type Props = {
  currentUserId: string;
  message: Message;
  author?: Profile;
  replyPreview?: string | null;
  reactions?: ReactionSummary;
  viewOnceState?: ViewOnceState;
  isSelected?: boolean;
  isSelectionMode?: boolean;
  onReply: (message: Message) => void;
  onToggleReaction: (emoji: string) => void;
  onRevealViewOnce: () => void;
  onToggleSelection: (id: string) => void;
  onShowReactions: (id: string | null) => void;
  onShowReactionsSheet: (id: string) => void;
  onPlusExtra: (id: string) => void;
  showReactions: boolean;
};

const quickReactions = ["\u{1F44D}", "\u{2764}", "\u{1F602}", "\u{1F62E}", "\u{1F622}", "\u{1F64F}"];

export function MessageBubble({
  currentUserId,
  message,
  author,
  replyPreview,
  reactions,
  viewOnceState,
  isSelected,
  isSelectionMode,
  onReply,
  onToggleReaction,
  onRevealViewOnce,
  onToggleSelection,
  onShowReactions,
  onShowReactionsSheet,
  onPlusExtra,
  showReactions,
}: Props) {
  const theme = useAppTheme();
  const styles = createStyles(theme);
  const mine = message.sender_id === currentUserId;
  const translateX = useRef(new Animated.Value(0)).current;

  const responder = useMemo(
    () =>
      Platform.OS === "web" || isSelectionMode
        ? null
        : PanResponder.create({
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
    [isSelectionMode, message, onReply, translateX],
  );

  const body =
    message.message_kind === "view_once" && viewOnceState === "hidden"
      ? "הקש/י לקריאה. ההודעה תיעלם לאחר הפתיחה."
      : message.message_kind === "view_once" && viewOnceState === "opened"
        ? "נפתח פעם אחת. התוכן אינו זמין יותר."
        : message.body_ciphertext;

  const d = new Date(message.created_at);
  const timeLabel = `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")} `;
  const metaLabel =
    message.message_kind === "temporary"
      ? "1 דק'"
      : message.message_kind === "view_once"
        ? viewOnceState === "revealed"
          ? "נפתח"
          : viewOnceState === "opened"
            ? "נקרא"
            : "פעם אחת"
        : null;

  function handleLongPress() {
    if (!isSelectionMode) {
      onToggleSelection(message.id);
      onShowReactions(message.id);
    }
  }

  function handlePress() {
    if (isSelectionMode) {
      onToggleSelection(message.id);
    } else if (message.message_kind === "view_once" && viewOnceState === "hidden") {
      onRevealViewOnce();
    }
  }

  return (
    <Animated.View
      {...(responder?.panHandlers ?? {})}
      style={[
        styles.row,
        mine ? styles.rowMine : styles.rowTheirs,
        isSelected && styles.rowSelected,
        { transform: [{ translateX }] },
      ]}
    >
      <Pressable
        delayLongPress={220}
        onLongPress={handleLongPress}
        onPress={handlePress}
        android_ripple={{ color: "transparent" }}
        style={({ pressed }) => [
          styles.fullWidthSelection,
          { opacity: 1 }, // Prevent default iOS press feedback
          webDefaultCursor,
        ]}
      >
        <View style={[
          styles.bubble,
          mine ? styles.bubbleMine : styles.bubbleTheirs,
          reactions && Object.keys(reactions).length > 0 ? { marginBottom: 14 } : null
        ]}>
          {!mine ? <Text style={styles.author}>{author?.username ?? "member"}</Text> : null}

          {replyPreview ? (
            <View style={styles.replyBlock}>
              <Text style={styles.replyLabel}>תגובה</Text>
              <Text numberOfLines={2} style={styles.replyBlockText}>
                {replyPreview}
              </Text>
            </View>
          ) : null}

          <Text style={styles.body}>{body}</Text>

          <View style={styles.metaRow}>
            <View style={styles.timeRow}>
              {message.message_kind === "view_once" ? (
                <MaterialCommunityIcons name="eye-outline" size={13} color={theme.colors.textMuted} />
              ) : null}
              {message.message_kind === "temporary" ? (
                <MaterialCommunityIcons name="timer-sand" size={13} color={theme.colors.textMuted} />
              ) : null}
              <Text style={styles.meta}>{timeLabel}</Text>
            </View>
            {metaLabel ? (
              <View style={styles.kindChip}>
                <Text style={styles.kindChipText}>{metaLabel}</Text>
              </View>
            ) : null}
          </View>

          {showReactions ? (
            <View style={[styles.reactionPicker, mine ? styles.pickerMine : styles.pickerTheirs]}>
              <View style={styles.pickerInner}>
                {quickReactions.map((emoji) => (
                  <Pressable
                    key={emoji}
                    onPress={() => {
                      onToggleReaction(emoji);
                      onShowReactions(null);
                      if (isSelected) {
                        onToggleSelection(message.id);
                      }
                    }}
                    style={({ pressed }) => [styles.quickEmoji, pressed && styles.quickEmojiPressed]}
                  >
                    <Text style={styles.quickEmojiText}>{emoji}</Text>
                  </Pressable>
                ))}
                <Pressable
                  style={styles.quickEmoji}
                  onPress={() => {
                    onPlusExtra(message.id);
                    onShowReactions(null);
                  }}
                >
                  <MaterialCommunityIcons color={theme.colors.textMuted} name="plus" size={20} />
                </Pressable>
              </View>
            </View>
          ) : null}

          {reactions && (() => {
            const entries = Object.entries(reactions).filter(([_, users]) => users.length > 0);
            if (entries.length === 0) return null;

            const total = entries.reduce((sum, [_, users]) => sum + users.length, 0);
            const topEmojis = entries.slice(0, 3).map(([e]) => e);

            return (
              <Pressable
                onPress={() => onShowReactionsSheet(message.id)}
                style={[styles.reactionPill, mine ? styles.reactionPillMine : styles.reactionPillTheirs]}
              >
                <View style={styles.reactionPillEmojis}>
                  {topEmojis.map((e, idx) => (
                    <Text key={e} style={[styles.reactionPillEmoji, idx > 0 && { marginLeft: -4 }]}>{e}</Text>
                  ))}
                </View>
                {total > 1 && <Text style={styles.reactionPillCount}>{total}</Text>}
              </Pressable>
            );
          })()}
        </View>
      </Pressable>
    </Animated.View>
  );
}

const createStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    row: {
      marginVertical: 1,
      paddingVertical: 2,
    },
    rowMine: {
      // Alignment moved to selection container
    },
    rowTheirs: {
      // Alignment moved to selection container
    },
    rowSelected: {
      backgroundColor: "rgba(0,168,132,0.38)",
    },
    fullWidthSelection: {
      width: "100%",
      paddingHorizontal: 12,
    },
    bubble: {
      borderRadius: 12,
      maxWidth: "83%",
      minWidth: 80,
      paddingHorizontal: 9,
      paddingTop: 6,
      paddingBottom: 5,
      shadowColor: "#000000",
      shadowOpacity: theme.colors.background === "#0b141a" ? 0.16 : 0.05,
      shadowRadius: 2,
      shadowOffset: { width: 0, height: 1 },
      elevation: 1,
    },
    bubbleMine: {
      backgroundColor: theme.colors.mine,
      borderTopRightRadius: 4,
      alignSelf: "flex-end",
    },
    bubbleTheirs: {
      backgroundColor: theme.colors.theirs,
      borderTopLeftRadius: 4,
      alignSelf: "flex-start",
    },
    author: {
      color: "#8b5cf6",
      fontSize: 12,
      fontWeight: "700",
      marginBottom: 3,
    },
    replyBlock: {
      backgroundColor: theme.colors.surfaceAlt,
      borderLeftColor: theme.colors.accent,
      borderLeftWidth: 4,
      borderRadius: 6,
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
      marginTop: 2,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 6,
    },
    kindChip: {
      backgroundColor: theme.colors.surfaceAlt,
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
      marginRight: "auto",
    },
    meta: {
      color: theme.colors.textMuted,
      fontSize: 11,
      paddingRight: 3,
    },
    reactionPicker: {
      position: "absolute",
      top: -50,
      zIndex: 100,
    },
    pickerMine: {
      right: 0,
    },
    pickerTheirs: {
      left: 0,
    },
    pickerInner: {
      backgroundColor: theme.colors.surface,
      borderRadius: 30,
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 8,
      paddingVertical: 6,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.2,
      shadowRadius: 12,
      elevation: 10,
    },
    quickEmoji: {
      width: 36,
      height: 36,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 18,
    },
    quickEmojiPressed: {
      backgroundColor: theme.colors.surfaceAlt,
    },
    quickEmojiText: {
      fontSize: 22,
    },
    reactionPill: {
      position: "absolute",
      bottom: -18,
      backgroundColor: "#202c33",
      borderRadius: 16,
      borderColor: theme.colors.background,
      borderWidth: 2,
      paddingHorizontal: 4,
      paddingVertical: 1,
      flexDirection: "row",
      alignItems: "center",
      zIndex: 10,
    },
    reactionPillMine: {
      left: -4,
    },
    reactionPillTheirs: {
      left: -4,
    },
    reactionPillEmojis: {
      flexDirection: "row",
      alignItems: "center",
    },
    reactionPillEmoji: {
      fontSize: 12,
    },
    reactionPillCount: {
      color: theme.colors.textMuted,
      fontSize: 11,
      fontWeight: "700",
      marginLeft: 4,
    },
  });

