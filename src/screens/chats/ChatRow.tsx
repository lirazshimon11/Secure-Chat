import React from "react";
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
              const { isPoll, question } = parsePollPreview(item.preview);
              if (isPoll) {
                return (
                  <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
                    <MaterialCommunityIcons 
                      name="poll" 
                      size={18} 
                      color={theme.colors.textMuted} 
                      style={{ marginRight: 4 }}
                    />
                    <Text 
                      numberOfLines={1} 
                      style={[styles.chatPreview, { marginTop: 0, flex: 1 }, item.unreadCount > 0 && styles.chatPreviewUnread, item.hiddenByClear && styles.chatPreviewCleared]}
                    >
                      {question}
                    </Text>
                  </View>
                );
              }
              return (
                <Text numberOfLines={1} style={[styles.chatPreview, { flex: 1 }, item.unreadCount > 0 && styles.chatPreviewUnread, item.hiddenByClear && styles.chatPreviewCleared]}>
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
