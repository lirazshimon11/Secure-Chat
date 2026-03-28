import { useEffect, useMemo, useRef, useState } from "react";
import { ImageBackground, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useColorScheme } from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { MessageBubble } from "@/components/MessageBubble";
import { MessageComposer } from "@/components/MessageComposer";
import { Screen } from "@/components/Screen";
import { useAuth } from "@/context/AuthContext";
import { useChats } from "@/context/ChatContext";
import { useAppTheme } from "@/lib/theme";
import { Chat, ChatMuteSetting, Message } from "@/lib/types";
import { webEmbeddedInputReset } from "@/lib/webStyles";

type Props = {
  chat: Chat;
  onBack: () => void;
  onOpenChatSettings: () => void;
};

function isChatMuted(setting?: ChatMuteSetting) {
  if (!setting) {
    return false;
  }

  if (setting.mute_always) {
    return true;
  }

  return Boolean(setting.mute_until && new Date(setting.mute_until).getTime() > Date.now());
}

function describeMute(setting?: ChatMuteSetting) {
  if (!isChatMuted(setting)) {
    return "Off";
  }

  if (setting?.mute_always) {
    return "Always";
  }

  return setting?.mute_until ? `Until ${new Date(setting.mute_until).toLocaleString()}` : "Muted";
}

const lightBg = require("../../public/images/default_white_background.png");
const darkBg = require("../../public/images/default_dark_background.png");

export function ChatScreen({ chat, onBack, onOpenChatSettings }: Props) {
  const theme = useAppTheme();
  const colorScheme = useColorScheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const chatBgSource = colorScheme === "dark" ? darkBg : lightBg;
  const { profile } = useAuth();
  const {
    loadMessages,
    markChatSeen,
    messagesByChat,
    profiles,
    reactionsByMessage,
    openedViewOnceIds,
    muteSettings,
    chatPreferences,
    setChatMute,
    clearChatMute,
    sendMessage,
    openViewOnceMessage,
    toggleReaction,
  } = useChats();
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [revealedMessageId, setRevealedMessageId] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showOverflowMenu, setShowOverflowMenu] = useState(false);
  const [showMuteMenu, setShowMuteMenu] = useState(false);
  const revealTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollRef = useRef<ScrollView | null>(null);

  const visibleMessages = useMemo(() => {
    const allMessages = messagesByChat[chat.id] ?? [];
    const clearedAt = chatPreferences[chat.id]?.cleared_at;

    if (!clearedAt) {
      return allMessages;
    }

    const clearedAtMs = new Date(clearedAt).getTime();
    return allMessages.filter((message) => new Date(message.created_at).getTime() > clearedAtMs);
  }, [chat.id, chatPreferences, messagesByChat]);

  const messageMap = useMemo(
    () => Object.fromEntries(visibleMessages.map((message) => [message.id, message])),
    [visibleMessages],
  );
  const muteSetting = muteSettings[chat.id];
  const chatMuted = isChatMuted(muteSetting);

  const filteredMessages = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    if (!normalizedQuery) {
      return visibleMessages;
    }

    return visibleMessages.filter((message) => {
      const replyPreview = message.reply_to_id ? messageMap[message.reply_to_id]?.body_preview ?? "" : "";
      return [message.body_ciphertext, message.body_preview ?? "", replyPreview].some((value) =>
        value.toLowerCase().includes(normalizedQuery),
      );
    });
  }, [messageMap, searchQuery, visibleMessages]);

  function scrollToBottom(animated = true) {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated });
    });
  }

  useEffect(() => {
    void (async () => {
      await loadMessages(chat.id);
      await markChatSeen(chat.id);
      scrollToBottom(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat.id]);

  useEffect(() => {
    if (!visibleMessages.length) {
      return;
    }

    void markChatSeen(chat.id);
    scrollToBottom(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat.id, visibleMessages.length]);

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
        <Pressable onPress={onOpenChatSettings} style={styles.avatar}>
          <Text style={styles.avatarText}>{chat.title.slice(0, 1).toUpperCase()}</Text>
        </Pressable>
        <Pressable onPress={onOpenChatSettings} style={styles.headerCopy}>
          <Text numberOfLines={1} style={styles.title}>
            {chat.title}
          </Text>
          <Text style={styles.subtitle}>
            {chatPreferences[chat.id]?.locked
              ? "Locked on this device"
              : chatMuted
                ? `Muted · ${describeMute(muteSetting)}`
                : chat.is_group
                  ? "Group chat"
                  : "Private chat"}
          </Text>
        </Pressable>
        <Pressable onPress={() => setShowOverflowMenu(true)} style={styles.headerButton}>
          <MaterialCommunityIcons color={theme.colors.textOnAccent} name="dots-vertical" size={20} />
        </Pressable>
      </View>

      {searchOpen ? (
        <View style={styles.searchBar}>
          <Feather color={theme.colors.textMuted} name="search" size={16} />
          <TextInput
            onChangeText={setSearchQuery}
            placeholder="Search in chat"
            placeholderTextColor={theme.colors.textMuted}
            style={[styles.searchInput, webEmbeddedInputReset]}
            value={searchQuery}
          />
          <Pressable
            onPress={() => {
              setSearchOpen(false);
              setSearchQuery("");
            }}
          >
            <Feather color={theme.colors.textMuted} name="x" size={18} />
          </Pressable>
        </View>
      ) : null}



      <View style={styles.thread}>
        {/* Completely static, high-performance repeating background (no scroll tracking resistance) */}
        <ImageBackground
          source={chatBgSource}
          style={StyleSheet.absoluteFillObject}
          resizeMode="repeat"
        />

        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {filteredMessages.length ? (
            filteredMessages.map((message) => {
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
              <Text style={styles.emptyTitle}>{searchQuery ? "No matching messages" : "No messages yet"}</Text>
              <Text style={styles.emptySubtitle}>
                {chatPreferences[chat.id]?.cleared_at && !searchQuery
                  ? "This chat was cleared on this device. New messages will appear here."
                  : searchQuery
                    ? "Try a different word."
                    : "Start the conversation. Swipe a message later to reply."}
              </Text>
            </View>
          )}
        </ScrollView>
      </View>

      <MessageComposer
        onCancelReply={() => setReplyTo(null)}
        onSend={async (body, kind, expireSeconds) => {
          scrollToBottom(true);
          const error = await sendMessage({
            chatId: chat.id,
            body,
            messageKind: kind,
            replyToId: replyTo?.id ?? null,
            expireSeconds,
          });

          if (!error) {
            setReplyTo(null);
            scrollToBottom(true);
          }
        }}
        replyPreview={replyTo?.body_preview ?? null}
      />

      {showOverflowMenu ? (
        <View pointerEvents="box-none" style={styles.overlayRoot}>
          <Pressable onPress={() => setShowOverflowMenu(false)} style={styles.backdrop} />
          <View style={styles.menuCard}>
            <MenuItem
              label="Search in chat"
              onPress={() => {
                setShowOverflowMenu(false);
                setSearchOpen(true);
              }}
            />
            <MenuItem
              label="Mute notifications"
              secondary={describeMute(muteSetting)}
              onPress={() => {
                setShowOverflowMenu(false);
                setShowMuteMenu(true);
              }}
            />
            <MenuItem
              label="Chat info"
              onPress={() => {
                setShowOverflowMenu(false);
                onOpenChatSettings();
              }}
            />
          </View>
        </View>
      ) : null}

      {showMuteMenu ? (
        <View pointerEvents="box-none" style={styles.overlayRoot}>
          <Pressable onPress={() => setShowMuteMenu(false)} style={styles.backdrop} />
          <View style={styles.sheetCard}>
            <Text style={styles.sheetTitle}>Mute notifications</Text>
            <SheetButton label="8 hours" onPress={() => {
              setChatMute(chat.id, "8_hours");
              setShowMuteMenu(false);
            }} />
            <SheetButton label="7 days" onPress={() => {
              setChatMute(chat.id, "7_days");
              setShowMuteMenu(false);
            }} />
            <SheetButton label="Always" onPress={() => {
              setChatMute(chat.id, "always");
              setShowMuteMenu(false);
            }} />
            <SheetButton danger label="Unmute" onPress={() => {
              clearChatMute(chat.id);
              setShowMuteMenu(false);
            }} />
          </View>
        </View>
      ) : null}
    </Screen>
  );
}

function MenuItem({ label, secondary, onPress }: { label: string; secondary?: string; onPress: () => void }) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <Pressable onPress={onPress} style={styles.menuItem}>
      <Text style={styles.menuItemText}>{label}</Text>
      {secondary ? <Text style={styles.menuItemSecondary}>{secondary}</Text> : null}
    </Pressable>
  );
}

function SheetButton({ label, onPress, danger }: { label: string; onPress: () => void; danger?: boolean }) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <Pressable onPress={onPress} style={styles.sheetButton}>
      <Text style={[styles.sheetButtonText, danger && styles.sheetButtonDanger]}>{label}</Text>
    </Pressable>
  );
}

const createStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
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
    searchBar: {
      backgroundColor: theme.colors.surface,
      marginHorizontal: theme.spacing.md,
      marginTop: theme.spacing.sm,
      borderRadius: theme.radius.pill,
      paddingHorizontal: 14,
      minHeight: 44,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    searchInput: {
      flex: 1,
      color: theme.colors.text,
      fontSize: 14,
      paddingVertical: 10,
    },

    thread: {
      flex: 1,
      backgroundColor: theme.colors.chatBackdrop,
    },
    scrollContent: {
      flexGrow: 1,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.md,
    },
    emptyState: {
      marginTop: "auto",
      marginBottom: "auto",
      alignSelf: "center",
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.lg,
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.md,
      gap: 4,
      borderColor: theme.colors.separator,
      borderWidth: 1,
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
    overlayRoot: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 30,
      justifyContent: "flex-start",
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: theme.colors.overlay,
    },
    menuCard: {
      position: "absolute",
      top: 58,
      right: 12,
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.md,
      minWidth: 210,
      overflow: "hidden",
      shadowColor: "#000000",
      shadowOpacity: 0.18,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 6 },
    },
    menuItem: {
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomColor: theme.colors.separator,
      borderBottomWidth: 1,
    },
    menuItemText: {
      color: theme.colors.text,
      fontSize: 15,
      fontWeight: "600",
    },
    menuItemSecondary: {
      color: theme.colors.textMuted,
      fontSize: 12,
      marginTop: 3,
    },
    sheetCard: {
      marginTop: "auto",
      backgroundColor: theme.colors.surface,
      borderTopLeftRadius: theme.radius.xl,
      borderTopRightRadius: theme.radius.xl,
      paddingHorizontal: theme.spacing.md,
      paddingTop: theme.spacing.md,
      paddingBottom: theme.spacing.xl,
      gap: 2,
    },
    sheetTitle: {
      color: theme.colors.text,
      fontSize: 18,
      fontWeight: "800",
      marginBottom: 8,
    },
    sheetButton: {
      paddingVertical: 14,
    },
    sheetButtonText: {
      color: theme.colors.text,
      fontSize: 16,
      fontWeight: "600",
    },
    sheetButtonDanger: {
      color: theme.colors.danger,
    },
  });
