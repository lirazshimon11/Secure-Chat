import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, PanResponder, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Message, Profile, ReactionSummary } from "@/lib/types";
import { useAppTheme } from "@/lib/theme";
import { webDefaultCursor } from "@/lib/webStyles";
import { useChats } from "@/context/ChatContext";
import { useScreenshots } from "@/context/ScreenshotContext";

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
  onReportPickerLayout?: (layout: { x: number; y: number; width: number; height: number } | null) => void;
  isSaved?: boolean;
  onOpenPollVotes?: (id: string) => void;
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
  onReportPickerLayout,
  isSaved,
  onOpenPollVotes,
}: Props) {
  const theme = useAppTheme();
  const styles = createStyles(theme);
  const { contactNicknames } = useChats();
  const { allRequests, approveRequest, denyRequest } = useScreenshots();
  const mine = message.sender_id === currentUserId;
  const translateX = useRef(new Animated.Value(0)).current;
  const lastTap = useRef<number>(0);
  const swipeIconOpacity = translateX.interpolate({
    inputRange: [0, 40],
    outputRange: [0, 1],
    extrapolate: 'clamp'
  });
  const pickerRef = useRef<View>(null);

  useEffect(() => {
    if (showReactions && pickerRef.current && onReportPickerLayout) {
      setTimeout(() => {
        pickerRef.current?.measure((x, y, w, h, pageX, pageY) => {
          onReportPickerLayout({ x: pageX, y: pageY, width: w, height: h });
        });
      }, 50);
    } else if (!showReactions && onReportPickerLayout) {
      onReportPickerLayout(null);
    }
  }, [showReactions, onReportPickerLayout]);

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

  const isScreenshotRequest = message.body_ciphertext.startsWith("[SCREENSHOT_REQUEST]:");
  const isPoll = message.body_ciphertext.startsWith("[POLL]:");

  const body = isScreenshotRequest || isPoll
    ? ""
    : message.message_kind === "view_once" && viewOnceState === "hidden"
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
      return;
    }

    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;
    if (lastTap.current && now - lastTap.current < DOUBLE_TAP_DELAY) {
      onToggleReaction("\u{2764}"); // ❤️
      lastTap.current = 0;
    } else {
      lastTap.current = now;
      if (message.message_kind === "view_once" && viewOnceState === "hidden") {
        onRevealViewOnce();
      }
    }
  }

  const hasReactions = reactions && Object.entries(reactions).filter(([e, u]) => u.length > 0 && !e.startsWith("poll:")).length > 0;

  return (
    <View style={styles.rowWrapper}>
      {/* Swipe to reply icon indicator */}
      {!isSelectionMode && (
        <Animated.View
          style={[
            styles.swipeIconContainer,
            { opacity: swipeIconOpacity, transform: [{ translateX: Animated.multiply(translateX, -0.5) }] }
          ]}
        >
          <MaterialCommunityIcons color={theme.colors.textMuted} name="reply" size={20} />
        </Animated.View>
      )}

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
            { opacity: 1 },
            webDefaultCursor,
          ]}
        >
          <View style={[
            styles.bubble,
            mine ? styles.bubbleMine : styles.bubbleTheirs,
            hasReactions ? { marginBottom: 14 } : null
          ]}>
            {!mine && author ? <Text style={styles.author}>{contactNicknames[author.id]?.first_name || author.username}</Text> : null}

            {replyPreview ? (
              <View style={styles.replyBlock}>
                <Text style={styles.replyLabel}>תגובה</Text>
                <Text numberOfLines={2} style={styles.replyBlockText}>
                  {replyPreview}
                </Text>
              </View>
            ) : null}

            {isScreenshotRequest ? (() => {
              const reqId = message.body_ciphertext.split(":")[1];
              const scReq = allRequests[reqId];
              if (!scReq) return <Text style={styles.body}>טוען בקשה...</Text>;

              const isApproved = scReq.status === "approved";
              const isDenied = scReq.status === "denied";
              const requesterName = scReq.requesterUsername || "המשתמש";
              const isMine = scReq.requester_id === currentUserId;

              return (
                <View style={styles.pollCard}>
                  <Text style={styles.pollTitle}>
                    {`האם אתה מאשר ל-${requesterName} לבצע צילום מסך?`}
                  </Text>
                  <View style={styles.pollSubtitleWrapper}>
                    <MaterialCommunityIcons name="camera-outline" size={16} color={theme.colors.textMuted} />
                    <Text style={styles.pollSubtitle}>דרוש אישור ממשתתף אחד או יותר</Text>
                  </View>

                  <Pressable
                    style={styles.pollOptionRow}
                    onPress={() => !isApproved && !isDenied && !isMine && approveRequest(reqId)}
                  >
                    <View style={styles.pollOptionInner}>
                      <View style={styles.pollOptionTextWrapper}>
                        <View style={[styles.pollRadioCircle, isApproved && styles.pollRadioCircleChecked]}>
                          {isApproved && <MaterialCommunityIcons name="check" size={14} color={theme.colors.textOnAccent} />}
                        </View>
                        <Text style={styles.pollOptionText}>מאשר</Text>
                      </View>
                      <Text style={styles.pollVoteCount}>{isApproved ? "1" : "0"}</Text>
                    </View>
                  </Pressable>

                  <Pressable
                    style={styles.pollOptionRow}
                    onPress={() => !isApproved && !isDenied && !isMine && denyRequest(reqId)}
                  >
                    <View style={styles.pollOptionInner}>
                      <View style={styles.pollOptionTextWrapper}>
                        <View style={[styles.pollRadioCircle, isDenied && styles.pollRadioCircleChecked]}>
                          {isDenied && <MaterialCommunityIcons name="check" size={14} color={theme.colors.textOnAccent} />}
                        </View>
                        <Text style={styles.pollOptionText}>מסרב</Text>
                      </View>
                      <Text style={styles.pollVoteCount}>{isDenied ? "1" : "0"}</Text>
                    </View>
                  </Pressable>

                  <View style={styles.pollFooter}>
                    <Text style={styles.pollFooterText}>
                      {isApproved ? "✅ הבקשה אושרה" : isDenied ? "❌ הבקשה נדחתה" : "ממתין לתגובה..."}
                    </Text>
                  </View>
                </View>
              );
            })() : isPoll ? (() => {
              let pollData: any;
              try {
                pollData = JSON.parse(message.body_ciphertext.substring(7));
              } catch (e) {
                return <Text style={styles.body}>שגיאה בטעינת סקר</Text>;
              }

              const optsCount = pollData.options.length;
              let totalVotes = 0;
              const votesPerOption = Array(optsCount).fill(0);
              const userVoted = Array(optsCount).fill(false);

              if (reactions) {
                for (let i = 0; i < optsCount; i++) {
                  const voterIds = reactions[`poll:${i}`] || [];
                  votesPerOption[i] = voterIds.length;
                  totalVotes += voterIds.length;
                  if (voterIds.includes(currentUserId)) {
                    userVoted[i] = true;
                  }
                }
              }

              return (
                <View style={styles.pollCard}>
                  <Text style={styles.pollTitle}>{pollData.question}</Text>
                  <View style={styles.pollSubtitleWrapper}>
                    <MaterialCommunityIcons name="check-all" size={16} color={theme.colors.textMuted} />
                    <Text style={styles.pollSubtitle}>{pollData.multipleAnswers ? "צריך לבחור אפשרות אחת או יותר" : "יש לבחור אפשרות אחת"}</Text>
                  </View>
                  {pollData.options.map((opt: string, i: number) => {
                    const optionVotes = votesPerOption[i];
                    const isChecked = userVoted[i];
                    return (
                      <Pressable key={i} style={styles.pollOptionRow} onPress={() => onToggleReaction(`poll:${i}`)}>
                        <View style={styles.pollOptionInner}>
                          <View style={styles.pollOptionTextWrapper}>
                            <View style={[styles.pollRadioCircle, isChecked && styles.pollRadioCircleChecked]}>
                              {isChecked && <MaterialCommunityIcons name="check" size={16} color={theme.colors.textOnAccent} />}
                            </View>
                            <Text style={styles.pollOptionText}>{opt}</Text>
                          </View>
                          <Text style={styles.pollVoteCount}>{optionVotes}</Text>
                        </View>
                      </Pressable>
                    );
                  })}
                  <Pressable style={styles.pollFooter} onPress={() => onOpenPollVotes?.(message.id)}>
                    <Text style={styles.pollFooterText}>הצגת ההצבעות</Text>
                  </Pressable>
                </View>
              );
            })() : (
              <Text style={styles.body}>{message.body_ciphertext + " "}</Text>
            )}

            <View style={styles.metaRow}>
              <View style={{ flex: 1 }} />
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
                {isSaved ? (
                  <MaterialCommunityIcons name="star" size={13} color={theme.colors.textMuted} />
                ) : null}
                <Text style={styles.meta}>{timeLabel}</Text>
              </View>
            </View>

            {showReactions ? (
              <View ref={pickerRef} style={[styles.reactionPicker, mine ? styles.pickerMine : styles.pickerTheirs]}>
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
              const entries = Object.entries(reactions).filter(([emoji, users]) => users.length > 0 && !emoji.startsWith("poll:"));
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
    </View>
  );
}

const createStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    rowWrapper: {
      flex: 1,
      position: "relative",
      flexDirection: "row",
      alignItems: "center",
      zIndex: 1,
    },
    swipeIconContainer: {
      position: "absolute",
      right: 15,
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: "rgba(0,0,0,0.08)",
      alignItems: "center",
      justifyContent: "center",
      zIndex: -1,
    },
    row: {
      flex: 1,
      flexDirection: "row",
      marginVertical: 1,
      paddingVertical: 2,
    },
    rowMine: {
      justifyContent: "flex-end",
    },
    rowTheirs: {
      justifyContent: "flex-start",
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
      minWidth: 180,
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
      textAlign: "auto",
      flexShrink: 1,
    },
    metaRow: {
      marginTop: 2,
      flexDirection: "row",
      alignItems: "center",
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
      backgroundColor: theme.colors.bubbleBackground,
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
      right: -4,
    },
    reactionPillTheirs: {
      right: -4,
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
    pollCard: {
      backgroundColor: "transparent",
      minWidth: 240,
    },
    pollTitle: {
      fontSize: 16,
      fontWeight: "bold",
      color: theme.colors.text,
      textAlign: "right",
      marginBottom: 6,
      flexShrink: 1,
    },
    pollSubtitleWrapper: {
      flexDirection: "row-reverse",
      alignItems: "center",
      gap: 4,
      marginBottom: 14,
    },
    pollSubtitle: {
      fontSize: 13,
      color: theme.colors.textMuted,
      textAlign: "right",
      flexShrink: 1,
    },
    pollOptionRow: {
      paddingVertical: 10,
      borderTopWidth: 1,
      borderColor: theme.colors.border,
      position: "relative",
    },
    pollOptionInner: {
      flexDirection: "row-reverse",
      alignItems: "center",
      justifyContent: "space-between",
      width: "100%",
      zIndex: 2,
    },
    pollOptionTextWrapper: {
      flexDirection: "row-reverse",
      alignItems: "center",
      gap: 12,
      flex: 1,
    },
    pollOptionText: {
      fontSize: 16,
      color: theme.colors.text,
      textAlign: "right",
      flex: 1,
    },
    pollRadioCircle: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 2,
      borderColor: theme.colors.textMuted,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "transparent",
    },
    pollRadioCircleChecked: {
      backgroundColor: theme.colors.accentStrong,
      borderColor: theme.colors.accentStrong,
      borderWidth: 0,
    },
    pollVoteCount: {
      color: theme.colors.textMuted,
      fontSize: 14,
    },
    pollFooter: {
      borderTopWidth: 1,
      borderColor: theme.colors.border,
      paddingVertical: 10,
      alignItems: "center",
      marginTop: 4,
    },
    pollFooterText: {
      color: theme.colors.accent,
      fontSize: 14,
      fontWeight: "500",
    },
  });
