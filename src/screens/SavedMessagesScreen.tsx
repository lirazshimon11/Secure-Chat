import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useRef, useState } from "react";
import { ImageBackground, Pressable, ScrollView, StyleSheet, Text, View, useColorScheme } from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { useAuth } from "@/context/AuthContext";
import { useAppTheme } from "@/lib/theme";

export type SavedMessage = {
  id: string;
  body: string;
  created_at: string;
  source_chat_title?: string;
  /** The chat ID needed to navigate back to the source chat. */
  chat_id?: string;
};

type Props = {
  onBack: () => void;
  onNavigateToChat?: (chatId: string, messageId: string) => void;
};

const lightBg = require("../../public/images/default_white_background.png");
const darkBg = require("../../public/images/default_dark_background.png");

export function SavedMessagesScreen({ onBack, onNavigateToChat }: Props) {
  const theme = useAppTheme();
  const colorScheme = useColorScheme();
  const styles = createStyles(theme);
  const chatBgSource = colorScheme === "dark" ? darkBg : lightBg;

  const scrollRef = useRef<ScrollView | null>(null);
  const { profile } = useAuth();
  const [messages, setMessages] = useState<SavedMessage[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const storageKey = `saved-messages:${profile?.id ?? "guest"}`;

  const isSelectionMode = selectedIds.length > 0;

  useEffect(() => {
    let active = true;

    void (async () => {
      const raw = await AsyncStorage.getItem(storageKey);
      if (!active) return;
      setMessages(raw ? (JSON.parse(raw) as SavedMessage[]) : []);
    })();

    return () => { active = false; };
  }, [storageKey]);

  function toggleSelection(id: string) {
    setSelectedIds((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]
    );
  }

  async function handleUnsaveSelected() {
    const updated = messages.filter((m) => !selectedIds.includes(m.id));
    await AsyncStorage.setItem(storageKey, JSON.stringify(updated));
    setMessages(updated);
    setSelectedIds([]);
  }

  function handleBack() {
    if (isSelectionMode) {
      setSelectedIds([]);
    } else {
      onBack();
    }
  }

  function handleMessageTap(msg: SavedMessage) {
    if (isSelectionMode) {
      toggleSelection(msg.id);
      return;
    }
    if (msg.chat_id && onNavigateToChat) {
      onNavigateToChat(msg.chat_id, msg.id);
    }
  }

  function handleMessageLongPress(id: string) {
    if (!isSelectionMode) {
      setSelectedIds([id]);
    }
  }

  return (
    <Screen>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={handleBack} style={styles.headerButton}>
          <Feather color={theme.colors.headerIcon} name="arrow-left" size={22} />
        </Pressable>

        {isSelectionMode ? (
          <>
            <Text style={styles.selectionCount}>{selectedIds.length}</Text>
            <View style={styles.selectionActions}>
              <Pressable onPress={handleUnsaveSelected} style={styles.headerButton}>
                <MaterialCommunityIcons
                  color={theme.colors.headerIcon}
                  name="star-off"
                  size={22}
                />
              </Pressable>
            </View>
          </>
        ) : (
          <>
            <View style={styles.avatar}>
              <MaterialCommunityIcons color={theme.colors.headerIcon} name="bookmark-outline" size={22} />
            </View>
            <View style={styles.headerCopy}>
              <Text style={styles.title}>הודעות שמורות</Text>
              <Text style={styles.subtitle}>גלוי רק במכשיר זה</Text>
            </View>
          </>
        )}
      </View>

      {/* Thread area */}
      <View style={styles.thread}>
        {/* Same tiled background as regular chat */}
        <View style={[StyleSheet.absoluteFillObject, { overflow: "hidden" }]} pointerEvents="none">
          <ImageBackground
            source={chatBgSource}
            style={{ width: "100%", height: "100%", transform: [{ scale: 1.8 }] }}
            resizeMode="repeat"
          />
        </View>

        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {messages.length ? (
            messages.map((message) => {
              const isSelected = selectedIds.includes(message.id);
              const d = new Date(message.created_at);
              const timeLabel = `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
              const canNavigate = Boolean(message.chat_id && onNavigateToChat);

              return (
                <Pressable
                  key={message.id}
                  delayLongPress={220}
                  onPress={() => handleMessageTap(message)}
                  onLongPress={() => handleMessageLongPress(message.id)}
                  style={[styles.bubbleRow, isSelected && styles.bubbleRowSelected]}
                >
                  <View style={styles.bubble}>
                    {/* Source chat label */}
                    {message.source_chat_title ? (
                      <Text style={styles.sourceLabel}>{message.source_chat_title}</Text>
                    ) : null}

                    <Text style={styles.body}>{message.body}</Text>

                    {/* Time + star + navigate hint */}
                    <View style={styles.metaRow}>
                      <MaterialCommunityIcons name="star" size={12} color={theme.colors.textMuted} />
                      <Text style={styles.meta}>{timeLabel}</Text>
                      {canNavigate && !isSelectionMode ? (
                        <MaterialCommunityIcons
                          name="arrow-top-right"
                          size={12}
                          color={theme.colors.accent}
                          style={{ marginLeft: 2 }}
                        />
                      ) : null}
                    </View>
                  </View>
                </Pressable>
              );
            })
          ) : (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="star-outline" size={40} color={theme.colors.textMuted} />
              <Text style={styles.emptyTitle}>הודעות שמורות</Text>
              <Text style={styles.emptySubtitle}>
                סמן הודעה בצ'אט כדי שתופיע כאן.{"\n"}לחץ עליה כדי לחזור למקומה בצ'אט.
              </Text>
            </View>
          )}
        </ScrollView>
      </View>
    </Screen>
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
      height: 58,
    },
    headerButton: {
      width: 40,
      height: 40,
      borderRadius: theme.radius.pill,
      alignItems: "center",
      justifyContent: "center",
    },
    selectionCount: {
      color: theme.colors.headerText,
      fontSize: 20,
      fontWeight: "700",
      marginLeft: 4,
    },
    selectionActions: {
      flexDirection: "row",
      alignItems: "center",
      marginLeft: "auto",
      gap: 2,
    },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.surfaceAlt,
      alignItems: "center",
      justifyContent: "center",
    },
    headerCopy: {
      flex: 1,
    },
    title: {
      color: theme.colors.headerText,
      fontSize: 18,
      fontWeight: "800",
    },
    subtitle: {
      color: theme.colors.headerSubtitle,
      fontSize: 12,
      marginTop: 2,
    },
    thread: {
      flex: 1,
      backgroundColor: theme.colors.chatBackdrop,
    },
    scrollContent: {
      flexGrow: 1,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.md,
      gap: 6,
    },
    bubbleRow: {
      alignItems: "flex-end",
    },
    bubbleRowSelected: {
      backgroundColor: theme.colors.selectionModeBackground,
    },
    bubble: {
      maxWidth: "84%",
      backgroundColor: theme.colors.mine,
      borderRadius: 12,
      borderTopRightRadius: 3,
      paddingHorizontal: 12,
      paddingTop: 8,
      paddingBottom: 6,
      shadowColor: "#000000",
      shadowOpacity: theme.colors.background === "#0b141a" ? 0.16 : 0.05,
      shadowRadius: 2,
      shadowOffset: { width: 0, height: 1 },
      elevation: 1,
    },
    sourceLabel: {
      fontSize: 12,
      color: theme.colors.accent,
      fontWeight: "700",
      marginBottom: 3,
    },
    body: {
      color: theme.colors.text,
      fontSize: 15,
      lineHeight: 20,
    },
    metaRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      marginTop: 4,
    },
    meta: {
      color: theme.colors.textMuted,
      fontSize: 11,
    },
    emptyState: {
      marginTop: "auto",
      marginBottom: "auto",
      alignSelf: "center",
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.lg,
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.md,
      gap: 8,
      alignItems: "center",
    },
    emptyTitle: {
      color: theme.colors.text,
      fontSize: 16,
      fontWeight: "800",
      textAlign: "center",
    },
    emptySubtitle: {
      color: theme.colors.textMuted,
      textAlign: "center",
      lineHeight: 20,
    },
  });
