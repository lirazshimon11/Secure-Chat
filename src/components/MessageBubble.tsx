import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, PanResponder, Platform, Pressable, Text, View, Image } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { Message, Profile, ReactionSummary } from "@/lib/types";
import { useAppTheme } from "@/lib/theme";
import { webDefaultCursor } from "@/lib/webStyles";
import { useChats } from "@/context/ChatContext";
import { useScreenshots } from "@/context/ScreenshotContext";
import { supabase } from "@/lib/supabase";
import { getUserColor, getMessagePreview } from "@/screens/chat/ChatUtils";
import { formatChatPreviewSystemMessage } from "@/lib/chatSecuritySettings";

// Extracted modules
import { createStyles } from "./message/MessageBubbleStyles";
import { PollBubble } from "./message/PollBubble";
import { ScreenshotRequestBubble } from "./message/ScreenshotRequestBubble";
import { SecureCanvasText } from "./SecureCanvasText";

type ViewOnceState = "hidden" | "revealed" | "opened";

type Props = {
  currentUserId: string;
  message: Message;
  author?: Profile;
  replyToText?: string | null;
  replyToName?: string | null;
  reactions?: ReactionSummary;
  viewOnceState?: ViewOnceState;
  isSelected?: boolean;
  isSelectionMode?: boolean;
  onReply: (message: Message) => void;
  onScrollToReply?: (replyToId: string) => void;
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
  onInitiateDragSelect?: (messageId?: string, selectImmediately?: boolean) => void;
  onAvatarPress?: (author: Profile) => void;
  renderSecureText?: boolean;
  allowWebLongPressSelection?: boolean;
};

const quickReactions = ["\u{1F44D}", "\u{2764}", "\u{1F602}", "\u{1F62E}", "\u{1F622}", "\u{1F64F}"];

const TemporaryMessageTimer = ({ expiresAt, theme }: { expiresAt: string; theme: any }) => {
  const [timeLeft, setTimeLeft] = useState<string | null>(null);
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    if (!expiresAt) return;
    const updateTimer = () => {
      const diff = new Date(expiresAt).getTime() - new Date().getTime();
      if (diff <= 0) {
        setTimeLeft("פג תוקף");
        setIsExpired(true);
        return;
      }
      const seconds = Math.floor(diff / 1000);
      setTimeLeft(`00:${seconds < 10 ? '0' : ''}${seconds}`);
    };
    updateTimer();
    const iv = setInterval(updateTimer, 1000);
    return () => clearInterval(iv);
  }, [expiresAt]);

  if (!timeLeft) return null;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isExpired ? theme.colors.surfaceMuted : theme.colors.accentStrong + "15", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 }}>
      <MaterialCommunityIcons name="timer-sand" size={14} color={isExpired ? theme.colors.textMuted : theme.colors.accentStrong} />
      <Text style={{ fontSize: 11, fontWeight: '700', color: isExpired ? theme.colors.textMuted : theme.colors.accentStrong, marginLeft: 4 }}>
        {isExpired ? timeLeft : `נותרו: ${timeLeft}`}
      </Text>
    </View>
  );
};

export function MessageBubble({
  currentUserId, message, author, replyToText, replyToName, reactions, viewOnceState,
  isSelected, isSelectionMode, onReply, onScrollToReply, onToggleReaction, onRevealViewOnce,
  onToggleSelection, onShowReactions, onShowReactionsSheet, onPlusExtra,
  showReactions, onReportPickerLayout, isSaved, onOpenPollVotes, onInitiateDragSelect,
  onAvatarPress, renderSecureText = true, allowWebLongPressSelection = false
}: Props) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { contactNicknames, profiles } = useChats();
  const { allRequests, approveRequest, denyRequest } = useScreenshots();
  const mine = message.sender_id === currentUserId;
  const translateX = useRef(new Animated.Value(0)).current;
  const lastTap = useRef<number>(0);
  const pickerRef = useRef<View>(null);
  const webLongPressRef = useRef<{
    pointerId: number | null;
    startX: number;
    startY: number;
    fired: boolean;
    timer: ReturnType<typeof setTimeout> | null;
  } | null>(null);
  const webSuppressNextPressRef = useRef(false);

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

  const isSelectionModeRef = useRef(isSelectionMode);
  useEffect(() => { isSelectionModeRef.current = isSelectionMode; }, [isSelectionMode]);

  const responder = useMemo(() =>
    Platform.OS === "web" ? null : PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => !isSelectionModeRef.current && Math.abs(gesture.dx) > 8 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
      onPanResponderMove: (_, gesture) => {
        if (!isSelectionModeRef.current && gesture.dx > 0) {
          translateX.setValue(Math.min(gesture.dx, 70));
        }
      },
      onPanResponderRelease: (_, gesture) => {
        if (!isSelectionModeRef.current) {
          if (gesture.dx > 40) onReply(message);
          Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
        }
      },
      onPanResponderTerminate: () => {
        if (!isSelectionModeRef.current) Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
      }
    }), [message, onReply, translateX]);

  const isTemporary = message.message_kind === "temporary";
  const [isTemporaryExpired, setIsTemporaryExpired] = useState(() => {
    if (!isTemporary || !message.expires_at) return false;
    return new Date(message.expires_at).getTime() <= new Date().getTime();
  });

  useEffect(() => {
    if (isTemporary && message.expires_at) {
      if (isTemporaryExpired) return;
      const checkAndSet = () => {
        const diff = new Date(message.expires_at!).getTime() - new Date().getTime();
        if (diff <= 0) {
          setIsTemporaryExpired(true);
          if (message.body_ciphertext !== "הודעה זו פגה תוקף") {
            supabase.from("messages")
              .update({ body_ciphertext: "הודעה זו פגה תוקף", body_preview: "הודעה זו פגה תוקף" })
              .eq("id", message.id)
              .neq("body_ciphertext", "הודעה זו פגה תוקף")
              .then(() => { });
          }
        }
      };
      checkAndSet();
      const iv = setInterval(checkAndSet, 1000);
      return () => clearInterval(iv);
    }
  }, [message.expires_at, isTemporary, isTemporaryExpired]);

  const isScreenshotRequest = message.body_ciphertext.startsWith("[SCREENSHOT_REQUEST]:");
  const isPoll = message.body_ciphertext.startsWith("[POLL]:");
  const isSystem = message.message_kind === "system";

  let body = isScreenshotRequest || isPoll ? "" : message.message_kind === "view_once" ? (viewOnceState === "hidden" ? "הקש/י לקריאה. ההודעה תיעלם לאחר הפתיחה." : viewOnceState === "opened" ? "נפתח פעם אחת. התוכן אינו זמין יותר." : message.body_ciphertext) : message.body_ciphertext;

  if (isTemporaryExpired) {
    body = "הודעה זו פגה תוקף";
  }

  const chatPreviewSystemMessage = isSystem ? formatChatPreviewSystemMessage(body) : null;
  if (chatPreviewSystemMessage) {
    body = chatPreviewSystemMessage;
  } else if (isSystem && body.startsWith("[SYSTEM_USER_REMOVED]:")) {
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
  } else if (isSystem && body.startsWith("[SYSTEM_SCREENSHOT_APPROVED]:")) {
    const parts = body.split(":");
    const requester = parts[1] || "מישהו";
    const approver = parts[2] || "מישהו";
    const durationMin = parts[3] || "1";
    body = `צילום מסך אושר ל-${requester} על ידי ${approver} למשך ${durationMin} דקות`;
  } else if (isSystem && body.startsWith("[SYSTEM_SCREENSHOT_EXPIRED]:")) {
    const parts = body.split(":");
    const requester = parts[1] || "מישהו";
    body = `תם הזמן המוקצב לצילום מסך עבור ${requester}`;
  } else if (isSystem && body.startsWith("[SYSTEM_DECOY_ON]:")) {
    const names = body.substring("[SYSTEM_DECOY_ON]:".length);
    body = `${names} - במצב הסוואה 🔒`;
  } else if (isSystem && body.startsWith("[SYSTEM_DECOY_OFF]:")) {
    const names = body.substring("[SYSTEM_DECOY_OFF]:".length);
    body = `${names} - חזרה לשגרה 🗝️`;
  }

  const d = new Date(message.created_at);
  const timeLabel = `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")} `;
  const metaLabel = message.message_kind === "view_once" ? (viewOnceState === "revealed" ? "נפתח" : viewOnceState === "opened" ? "נקרא" : null) : null;
  const wasEdited = Boolean(message.edited_at);
  const hasReactions = reactions && Object.entries(reactions).filter(([e, u]) => Array.isArray(u) && u.length > 0 && !e.startsWith("poll:")).length > 0;

  const handleLongPress = () => {
    if (isSystem) return;
    if ((Platform.OS as string) === "web") {
      if (!allowWebLongPressSelection) return;
      onInitiateDragSelect?.(message.id, true);
      return;
    }
    onInitiateDragSelect?.(message.id, true);
    if (!isSelected) {
      onToggleSelection(message.id);
    }
    if (!isSelectionMode && Platform.OS !== "web") {
      onShowReactions(message.id);
    }
  };
  const clearWebLongPress = () => {
    if (webLongPressRef.current?.timer) {
      clearTimeout(webLongPressRef.current.timer);
    }
    webLongPressRef.current = null;
  };
  const webLongPressHandlers = Platform.OS === "web"
    ? ({
        onPointerDown: (event: any) => {
          if (isSystem || !allowWebLongPressSelection) return;
          const nativeEvent = event?.nativeEvent ?? event;
          clearWebLongPress();
          const pointerId = typeof nativeEvent.pointerId === "number" ? nativeEvent.pointerId : null;
          const startX = nativeEvent.clientX ?? nativeEvent.pageX ?? 0;
          const startY = nativeEvent.clientY ?? nativeEvent.pageY ?? 0;
          const next = {
            pointerId,
            startX,
            startY,
            fired: false,
            timer: null as ReturnType<typeof setTimeout> | null,
          };
          next.timer = setTimeout(() => {
            const current = webLongPressRef.current;
            if (!current || current.pointerId !== pointerId || current.fired) return;
            current.fired = true;
            webSuppressNextPressRef.current = true;
            handleLongPress();
          }, 450);
          webLongPressRef.current = next;
        },
        onPointerMove: (event: any) => {
          const current = webLongPressRef.current;
          if (!current) return;
          const nativeEvent = event?.nativeEvent ?? event;
          if (current.pointerId !== null && nativeEvent.pointerId !== current.pointerId) return;
          const x = nativeEvent.clientX ?? nativeEvent.pageX ?? current.startX;
          const y = nativeEvent.clientY ?? nativeEvent.pageY ?? current.startY;
          if (Math.hypot(x - current.startX, y - current.startY) > 7) {
            clearWebLongPress();
          }
        },
        onPointerUp: clearWebLongPress,
        onPointerCancel: clearWebLongPress,
        onPointerLeave: clearWebLongPress,
      } as any)
    : {};
  const handlePress = () => {
    if (isSystem) return;
    if (Platform.OS === "web" && webSuppressNextPressRef.current) {
      webSuppressNextPressRef.current = false;
      return;
    }
    if (isSelectionMode) { onToggleSelection(message.id); return; }
    const now = Date.now();
    if (lastTap.current && now - lastTap.current < 300) {
      onInitiateDragSelect?.(message.id, false);
      onToggleSelection(message.id);
      onShowReactions(null);
      lastTap.current = 0;
    }
    else { lastTap.current = now; if (message.message_kind === "view_once" && viewOnceState === "hidden") onRevealViewOnce(); }
  };

  const accentColor = useMemo(() => {
    if (!replyToName) return "#00A884";
    return getUserColor(replyToName);
  }, [replyToName]);

  const authorColor = useMemo(() => {
    if (!author) return "#00A884";
    return getUserColor(author.username || author.id || "?");
  }, [author]);

  const longestUnbrokenTextLength = useMemo(() => {
    return (body || "")
      .split(/\s+/)
      .reduce((maxLength, part) => Math.max(maxLength, part.length), 0);
  }, [body]);
  const bubbleWidthStyle = longestUnbrokenTextLength >= 72
    ? styles.bubbleWide
    : null;
  const messageStartsLtr = useMemo(() => {
    const firstStrongChar = (body || "").match(/[A-Za-z\u0590-\u05FF]/)?.[0];
    return !!firstStrongChar && /[A-Za-z]/.test(firstStrongChar);
  }, [body]);

  // Long unbroken runs need soft breakpoints without forcing visible new lines.
  const formatSpamSafeText = (text: string) => {
    if (!text) return text;
    return text.split(/(\s+)/).map(part => {
      if (/^\s+$/.test(part)) return part;
      if (part.startsWith('http://') || part.startsWith('https://')) return part;

      const hasLongOppositeDirectionRun = messageStartsLtr
        ? /[\u0590-\u05FF]{10,}/.test(part)
        : /[A-Za-z]{10,}/.test(part);

      if (part.length > 36 || hasLongOppositeDirectionRun) {
        return part.split('').join('\u200B');
      }
      return part;
    }).join('');
  };
  const displayBody = useMemo(() => {
    const formattedBody = formatSpamSafeText(body);
    return messageStartsLtr ? `\u202A${formattedBody}\u202C` : `\u202B${formattedBody}\u202C`;
  }, [body, messageStartsLtr]);

  return (
    <View style={styles.rowWrapper}>
      {!isSelectionMode && null}
      <Animated.View {...(responder?.panHandlers ?? {})} style={[styles.row, isSystem ? styles.rowSystem : mine ? styles.rowMine : styles.rowTheirs, isSelected && styles.rowSelected, { transform: [{ translateX }] }]}>
        {isSystem ? (
          <View style={[styles.fullWidthSelection, webDefaultCursor]}>
            <View style={[styles.systemBubble, hasReactions ? { marginBottom: 14 } : null]}>
              <Text style={styles.systemText}>{body}</Text>
            </View>
          </View>
        ) : (
          <Pressable
            delayLongPress={450}
            onLongPress={Platform.OS === "web" ? undefined : handleLongPress}
            onPress={handlePress}
            {...webLongPressHandlers}
            {...(Platform.OS === "web" ? ({ dataSet: { messageId: message.id } } as any) : {})}
            style={[styles.fullWidthSelection, webDefaultCursor]}
          >
            <View style={[mine ? styles.bubbleWrapperMine : styles.bubbleWrapperTheirs]}>
              <View style={[styles.bubble, bubbleWidthStyle, mine ? styles.bubbleMine : styles.bubbleTheirs, hasReactions ? { marginBottom: 14 } : null]}>
                {(!mine && author) || (message.message_kind === "temporary" && message.expires_at) || (message.message_kind === "view_once") ? (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    {!mine && author ? (
                      <Text style={[styles.author, { color: authorColor, marginBottom: 0 }]}>
                        {contactNicknames?.[author.id]?.first_name || author.full_name || author.username}
                      </Text>
                    ) : <View />}
                    {message.message_kind === "temporary" && message.expires_at && (
                      <TemporaryMessageTimer expiresAt={message.expires_at} theme={theme} />
                    )}
                    {message.message_kind === "view_once" && (
                      <View style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: viewOnceState === "opened" ? theme.colors.surfaceMuted : theme.colors.accentStrong + "15",
                        paddingHorizontal: 8,
                        paddingVertical: 4,
                        borderRadius: 10
                      }}>
                        <MaterialCommunityIcons
                          name={viewOnceState === "opened" ? "eye-off-outline" : "eye-outline"}
                          size={14}
                          color={viewOnceState === "opened" ? theme.colors.textMuted : theme.colors.accentStrong}
                        />
                        <Text style={{
                          fontSize: 11,
                          fontWeight: '700',
                          color: viewOnceState === "opened" ? theme.colors.textMuted : theme.colors.accentStrong,
                          marginLeft: 4
                        }}>
                          פעם אחת
                        </Text>
                      </View>
                )}
              </View>
                ) : null}
                {replyToText && !isTemporaryExpired && (
                  <Pressable
                    style={styles.replyBlock}
                    onPress={() => { if (message.reply_to_id && onScrollToReply) onScrollToReply(message.reply_to_id); }}
                  >
                    <View style={styles.replyBlockContent}>
                      <View style={[styles.replyBlockAccent, { backgroundColor: accentColor }]} />
                      <View style={styles.replyBlockTextContainer}>
                        <Text numberOfLines={1} style={[styles.replyLabel, { color: accentColor }]}>{replyToName || "תגובה"}</Text>
                        <Text numberOfLines={2} style={styles.replyBlockText}>{getMessagePreview(replyToText)}</Text>
                      </View>
                    </View>
                  </Pressable>
                )}

                {isScreenshotRequest ? <ScreenshotRequestBubble message={message} currentUserId={currentUserId} allRequests={allRequests} theme={theme} styles={styles}
                  approveRequest={(reqId) => {
                    const scReq = allRequests[reqId];
                    const nick = contactNicknames[currentUserId]?.first_name;
                    const prof = profiles[currentUserId];
                    const myName = nick || prof?.full_name || prof?.username || "משתתף/ת";
                    approveRequest(reqId, message.chat_id, scReq?.requesterUsername || "מישהו", myName);
                  }}
                  denyRequest={denyRequest} /> :
                  isPoll ? <PollBubble message={message} currentUserId={currentUserId} reactions={reactions} theme={theme} styles={styles} onToggleReaction={onToggleReaction} onOpenPollVotes={onOpenPollVotes} /> :

                    <View style={[styles.messageTextContainer, bubbleWidthStyle && styles.messageTextContainerWide]}>
                      {renderSecureText ? (
                        <SecureCanvasText
                          text={displayBody}
                          color={isTemporaryExpired ? theme.colors.textMuted : theme.colors.text}
                          direction={messageStartsLtr ? "ltr" : "rtl"}
                          style={[
                            styles.body,
                            messageStartsLtr ? styles.bodyLtr : styles.bodyRtl,
                            isTemporaryExpired && { color: theme.colors.textMuted, fontStyle: 'italic' },
                          ]}
                        />
                      ) : (
                        <Text
                          selectable={false}
                          style={[
                            styles.body,
                            messageStartsLtr ? styles.bodyLtr : styles.bodyRtl,
                            isTemporaryExpired && { color: theme.colors.textMuted, fontStyle: 'italic' },
                          ]}
                        >
                          {displayBody}
                        </Text>
                      )}
                    </View>
                }

                <View style={styles.metaLine}>
                  <View style={styles.metaRow}>
                    {metaLabel && <View style={styles.kindChip}><Text style={styles.kindChipText}>{metaLabel}</Text></View>}
                    <View style={styles.timeRow}>
                      {isSaved && <MaterialCommunityIcons name="star" size={13} color={theme.colors.textMuted} />}
                      <Text style={styles.meta}>{timeLabel}</Text>
                    </View>
                  </View>
                  {wasEdited ? <Text style={styles.editedMeta}>נערכה</Text> : null}
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
              </View>
              {!mine && author && (
                <Pressable onPress={() => onAvatarPress && onAvatarPress(author)} style={[styles.messageAvatarWrap, styles.messageAvatarAfterBubble, { backgroundColor: authorColor }]}>
                  {(author as any).avatar_url ? (
                    <Image source={{ uri: (author as any).avatar_url }} style={styles.messageAvatarImage} />
                  ) : (
                    <Text style={[styles.messageAvatarText, { color: "#FFF" }]}>
                      {(contactNicknames?.[author.id]?.first_name || author.full_name || author.username || "?").slice(0, 1).toUpperCase()}
                    </Text>
                  )}
                </Pressable>
              )}
            </View>
          </Pressable>
        )}
      </Animated.View>
    </View>
  );
}
