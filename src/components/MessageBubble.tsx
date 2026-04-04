import { useEffect, useMemo, useRef } from "react";
import { Animated, PanResponder, Platform, Pressable, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { Message, Profile, ReactionSummary } from "@/lib/types";
import { useAppTheme } from "@/lib/theme";
import { webDefaultCursor } from "@/lib/webStyles";
import { useChats } from "@/context/ChatContext";
import { useScreenshots } from "@/context/ScreenshotContext";

// Extracted modules
import { createStyles } from "./message/MessageBubbleStyles";
import { PollBubble } from "./message/PollBubble";
import { ScreenshotRequestBubble } from "./message/ScreenshotRequestBubble";

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
  currentUserId, message, author, replyPreview, reactions, viewOnceState,
  isSelected, isSelectionMode, onReply, onToggleReaction, onRevealViewOnce,
  onToggleSelection, onShowReactions, onShowReactionsSheet, onPlusExtra,
  showReactions, onReportPickerLayout, isSaved, onOpenPollVotes
}: Props) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { contactNicknames, profiles } = useChats();
  const { allRequests, approveRequest, denyRequest } = useScreenshots();
  const mine = message.sender_id === currentUserId;
  const translateX = useRef(new Animated.Value(0)).current;
  const lastTap = useRef<number>(0);
  const swipeIconOpacity = translateX.interpolate({ inputRange: [0, 40], outputRange: [0, 1], extrapolate: 'clamp' });
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

  const responder = useMemo(() => 
    Platform.OS === "web" || isSelectionMode ? null : PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 8,
      onPanResponderMove: (_, gesture) => { if (gesture.dx > 0) translateX.setValue(Math.min(gesture.dx, 70)); },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dx > 40) onReply(message);
        Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
      },
    }), [isSelectionMode, message, onReply, translateX]);

  const isScreenshotRequest = message.body_ciphertext.startsWith("[SCREENSHOT_REQUEST]:");
  const isPoll = message.body_ciphertext.startsWith("[POLL]:");
  const isSystem = message.message_kind === "system";

  let body = isScreenshotRequest || isPoll ? "" : message.message_kind === "view_once" ? (viewOnceState === "hidden" ? "הקש/י לקריאה. ההודעה תיעלם לאחר הפתיחה." : viewOnceState === "opened" ? "נפתח פעם אחת. התוכן אינו זמין יותר." : message.body_ciphertext) : message.body_ciphertext;
  
  if (isSystem && body.startsWith("[SYSTEM_USER_REMOVED]:")) {
    const targetId = body.split(":")[1];
    const isMe = targetId === currentUserId;
    if (isMe) {
      body = "את/ה הוסרת/ה מהקבוצה";
    } else {
      const nick = contactNicknames && contactNicknames[targetId]?.first_name;
      const prof = profiles && profiles[targetId];
      const displayName = nick || prof?.full_name || prof?.username || "משתתף/ת";
      body = `${displayName} הוסר/ה מהקבוצה`;
    }
  }
  
  const d = new Date(message.created_at);
  const timeLabel = `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")} `;
  const metaLabel = message.message_kind === "temporary" ? "1 דק'" : message.message_kind === "view_once" ? (viewOnceState === "revealed" ? "נפתח" : viewOnceState === "opened" ? "נקרא" : "פעם אחת") : null;
  const hasReactions = reactions && Object.entries(reactions).filter(([e, u]) => Array.isArray(u) && u.length > 0 && !e.startsWith("poll:")).length > 0;

  const handleLongPress = () => { if (!isSelectionMode) { onToggleSelection(message.id); onShowReactions(message.id); } };
  const handlePress = () => {
    if (isSelectionMode) { onToggleSelection(message.id); return; }
    const now = Date.now();
    if (lastTap.current && now - lastTap.current < 300) { onToggleReaction("\u{2764}"); lastTap.current = 0; }
    else { lastTap.current = now; if (message.message_kind === "view_once" && viewOnceState === "hidden") onRevealViewOnce(); }
  };

  return (
    <View style={styles.rowWrapper}>
      {!isSelectionMode && (
        <Animated.View style={[styles.swipeIconContainer, { opacity: swipeIconOpacity, transform: [{ translateX: Animated.multiply(translateX, -0.5) }] }]}>
          <MaterialCommunityIcons color={theme.colors.textMuted} name="reply" size={20} />
        </Animated.View>
      )}
      <Animated.View {...(responder?.panHandlers ?? {})} style={[styles.row, isSystem ? styles.rowSystem : mine ? styles.rowMine : styles.rowTheirs, isSelected && styles.rowSelected, { transform: [{ translateX }] }]}>
        <Pressable delayLongPress={220} onLongPress={handleLongPress} onPress={handlePress} style={[styles.fullWidthSelection, webDefaultCursor]}>
          <View style={[isSystem ? styles.systemBubble : styles.bubble, !isSystem && (mine ? styles.bubbleMine : styles.bubbleTheirs), hasReactions ? { marginBottom: 14 } : null]}>
            {isSystem ? (
               <Text style={styles.systemText}>{body}</Text>
            ) : (
              <>
                {!mine && author && <Text style={styles.author}>{contactNicknames[author.id]?.first_name || author.username}</Text>}
                {replyPreview && <View style={styles.replyBlock}><Text style={styles.replyLabel}>תגובה</Text><Text numberOfLines={2} style={styles.replyBlockText}>{replyPreview}</Text></View>}
                
                {isScreenshotRequest ? <ScreenshotRequestBubble message={message} currentUserId={currentUserId} allRequests={allRequests} theme={theme} styles={styles} approveRequest={approveRequest} denyRequest={denyRequest} /> :
                 isPoll ? <PollBubble message={message} currentUserId={currentUserId} reactions={reactions} theme={theme} styles={styles} onToggleReaction={onToggleReaction} onOpenPollVotes={onOpenPollVotes} /> :
                 <Text style={styles.body}>{body + " "}</Text>}

                <View style={styles.metaRow}>
                  <View style={{ flex: 1 }} />
                  {metaLabel && <View style={styles.kindChip}><Text style={styles.kindChipText}>{metaLabel}</Text></View>}
                  <View style={styles.timeRow}>
                    {message.message_kind === "view_once" && <MaterialCommunityIcons name="eye-outline" size={13} color={theme.colors.textMuted} />}
                    {message.message_kind === "temporary" && <MaterialCommunityIcons name="timer-sand" size={13} color={theme.colors.textMuted} />}
                    {isSaved && <MaterialCommunityIcons name="star" size={13} color={theme.colors.textMuted} />}
                    <Text style={styles.meta}>{timeLabel}</Text>
                  </View>
                </View>

                {showReactions && (
                  <View ref={pickerRef} style={[styles.reactionPicker, mine ? styles.pickerMine : styles.pickerTheirs]}>
                    <View style={styles.pickerInner}>
                      {quickReactions.map((emoji) => (
                        <Pressable key={emoji} onPress={() => { onToggleReaction(emoji); onShowReactions(null); if (isSelected) onToggleSelection(message.id); }} style={({ pressed }) => [styles.quickEmoji, pressed && styles.quickEmojiPressed]}>
                          <Text style={styles.quickEmojiText}>{emoji}</Text>
                        </Pressable>
                      ))}
                      <Pressable style={styles.quickEmoji} onPress={() => { onPlusExtra(message.id); onShowReactions(null); }}><MaterialCommunityIcons color={theme.colors.textMuted} name="plus" size={20} /></Pressable>
                    </View>
                  </View>
                )}

                {reactions && (() => {
                  const entries = Object.entries(reactions).filter(([e, u]) => Array.isArray(u) && u.length > 0 && !e.startsWith("poll:"));
                  if (!entries.length) return null;
                  const total = entries.reduce((sum, [_, u]) => sum + (Array.isArray(u) ? u.length : 0), 0);
                  return (
                    <Pressable onPress={() => onShowReactionsSheet(message.id)} style={[styles.reactionPill, mine ? styles.reactionPillMine : styles.reactionPillTheirs]}>
                      <View style={styles.reactionPillEmojis}>{entries.slice(0, 3).map(([e], idx) => <Text key={e} style={[styles.reactionPillEmoji, idx > 0 && { marginLeft: -4 }]}>{e}</Text>)}</View>
                      {total > 1 && <Text style={styles.reactionPillCount}>{total}</Text>}
                    </Pressable>
                  );
                })()}
              </>
            )}
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
}
