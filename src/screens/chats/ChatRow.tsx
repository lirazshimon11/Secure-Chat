import React, { useState, useEffect } from "react";
import { Text, View, TouchableHighlight } from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { DisplayChat, parsePollPreview } from "./ChatsUtils";

type ChatRowProps = {
  item: DisplayChat;
  theme: any;
  styles: any;
  selected: boolean;
  onPress: () => void;
  onLongPress: () => void;
};

const PreviewTimer = ({ lastMessageAt, styles, theme, unread }: { lastMessageAt: string | null, styles: any, theme: any, unread: boolean }) => {
  const [timeLeft, setTimeLeft] = useState<string | null>(null);

  useEffect(() => {
    if (!lastMessageAt) return;
    const expiresAt = new Date(new Date(lastMessageAt).getTime() + 60000).toISOString();
    const updateTimer = () => {
      const diff = new Date(expiresAt).getTime() - new Date().getTime();
      if (diff <= 0) {
        setTimeLeft(null);
        return;
      }
      const seconds = Math.floor(diff / 1000);
      setTimeLeft(`00:${seconds < 10 ? '0' : ''}${seconds}`);
    };
    updateTimer();
    const iv = setInterval(updateTimer, 1000);
    return () => clearInterval(iv);
  }, [lastMessageAt]);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, justifyContent: "flex-start" }}>
      <MaterialCommunityIcons name="timer-sand" size={15} color={theme.colors.textMuted} style={{ marginHorizontal: 2 }} />
      <Text numberOfLines={1} style={[styles.chatPreview, { marginTop: 0, flex: 1, textAlign: "left" }, unread && styles.chatPreviewUnread]}>
        {timeLeft ? `הודעה זמנית (נותרו: ${timeLeft})` : 'הודעה זמנית'}
      </Text>
    </View>
  );
};

export const ChatRow = ({ item, theme, styles, selected, onPress, onLongPress }: ChatRowProps) => {
  return (
    <TouchableHighlight
      underlayColor={theme.colors.homeSelection}
      delayPressIn={75}
      delayLongPress={220}
      onLongPress={onLongPress}
      onPress={onPress}
      style={[styles.chatRow, selected && styles.chatRowSelected]}
    >
      <View style={{ flexDirection: "row", alignItems: "center", width: "100%", gap: 12 }}>
        <View style={styles.avatarWrap}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(item.chat.title || "?").slice(0, 1).toUpperCase()}</Text>
          </View>
          {selected ? (
            <View style={styles.selectedBadge}>
              <MaterialCommunityIcons color={theme.colors.textOnAccent} name="check" size={13} />
            </View>
          ) : null}
        </View>

        <View style={styles.chatMain}>
          <View style={styles.chatTopRow}>
            <View style={styles.titleWrap}>
              <Text numberOfLines={1} style={styles.chatTitle}>
                {item.chat.title}
              </Text>
              {item.preferences.locked ? <Feather color={theme.colors.textMuted} name="lock" size={13} /> : null}
              {item.preferences.pinned_at ? <MaterialCommunityIcons color={theme.colors.textMuted} name="pin" size={13} /> : null}
              {item.muted ? <Feather color={theme.colors.textMuted} name="bell-off" size={13} /> : null}
              {item.chat.is_group ? <MaterialCommunityIcons color={theme.colors.textMuted} name="account-group" size={14} /> : null}
            </View>
            <View style={styles.trailingWrap}>
              {item.timeLabel ? <Text style={[styles.chatTime, item.unreadCount > 0 && styles.chatTimeUnread]}>{item.timeLabel}</Text> : null}
              {item.unreadCount > 0 ? (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadBadgeText}>{item.unreadCount > 99 ? "99+" : item.unreadCount}</Text>
                </View>
              ) : null}
            </View>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4, flex: 1 }}>
            {(() => {
              const { isPoll, isScreenshot, question } = parsePollPreview(item.preview);
              if (isPoll) {
                return (
                  <View style={{ flexDirection: "row", alignItems: "center", flex: 1, justifyContent: "flex-start" }}>
                    <MaterialCommunityIcons 
                      name="poll" 
                      size={18} 
                      color={theme.colors.textMuted} 
                      style={{ marginHorizontal: 2 }}
                    />
                    {isScreenshot && (
                      <MaterialCommunityIcons 
                        name="camera-outline" 
                        size={17} 
                        color={theme.colors.textMuted} 
                        style={{ marginHorizontal: 2 }}
                      />
                    )}
                    <Text 
                      numberOfLines={1} 
                      style={[styles.chatPreview, { marginTop: 0, flex: 1, textAlign: "left" }, item.unreadCount > 0 && styles.chatPreviewUnread, item.hiddenByClear && styles.chatPreviewCleared]}
                    >
                      {question}
                    </Text>
                  </View>
                );
              }
              if (item.preview === "[TEMP_TIMER]") {
                return (
                  <PreviewTimer 
                    lastMessageAt={item.chat.last_message_at} 
                    styles={styles} 
                    theme={theme} 
                    unread={item.unreadCount > 0} 
                  />
                );
              }
              return (
                <Text numberOfLines={1} style={[styles.chatPreview, { flex: 1, textAlign: "left" }, item.unreadCount > 0 && styles.chatPreviewUnread, item.hiddenByClear && styles.chatPreviewCleared]}>
                  {item.preview}
                </Text>
              );
            })()}
          </View>
        </View>
      </View>
    </TouchableHighlight>
  );
};
