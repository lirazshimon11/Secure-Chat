import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useRef, useState } from "react";
import { ImageBackground, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useColorScheme } from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { useAuth } from "@/context/AuthContext";
import { useAppTheme } from "@/lib/theme";
import { webEmbeddedInputReset, webNoOutline } from "@/lib/webStyles";

type SavedMessage = {
  id: string;
  body: string;
  created_at: string;
};

type Props = {
  onBack: () => void;
};

const lightBg = require("../../public/images/default_white_background.png");
const darkBg = require("../../public/images/default_dark_background.png");

export function SavedMessagesScreen({ onBack }: Props) {
  const theme = useAppTheme();
  const colorScheme = useColorScheme();
  const styles = createStyles(theme);
  const chatBgSource = colorScheme === "dark" ? darkBg : lightBg;

  const scrollRef = useRef<ScrollView | null>(null);
  const { profile } = useAuth();
  const [messages, setMessages] = useState<SavedMessage[]>([]);
  const [draft, setDraft] = useState("");
  const storageKey = `saved-messages:${profile?.id ?? "guest"}`;

  useEffect(() => {
    let active = true;

    void (async () => {
      const raw = await AsyncStorage.getItem(storageKey);
      if (!active) {
        return;
      }
      setMessages(raw ? (JSON.parse(raw) as SavedMessage[]) : []);
    })();

    return () => {
      active = false;
    };
  }, [storageKey]);

  useEffect(() => {
    void AsyncStorage.setItem(storageKey, JSON.stringify(messages));
    requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    });
  }, [messages, storageKey]);

  function handleSave() {
    const body = draft.trim();
    if (!body) {
      return;
    }

    setMessages((current) => [
      ...current,
      {
        id: `${Date.now()}`,
        body,
        created_at: new Date().toISOString(),
      },
    ]);
    setDraft("");
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.headerButton}>
          <Feather color={theme.colors.textOnAccent} name="arrow-left" size={22} />
        </Pressable>
        <View style={styles.avatar}>
          <MaterialCommunityIcons color={theme.colors.textOnAccent} name="bookmark-outline" size={22} />
        </View>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Saved Messages</Text>
          <Text style={styles.subtitle}>Only visible on this device</Text>
        </View>
      </View>

      <View style={styles.thread}>
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
          {messages.length ? (
            messages.map((message) => (
              <View key={message.id} style={styles.bubbleRow}>
                <View style={styles.bubble}>
                  <Text style={styles.body}>{message.body}</Text>
                  <Text style={styles.meta}>
                    {new Date(message.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </Text>
                </View>
              </View>
            ))
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>Saved Messages</Text>
              <Text style={styles.emptySubtitle}>Drop private notes, reminders, or links here.</Text>
            </View>
          )}
        </ScrollView>
      </View>

      <View style={styles.composer}>
        <TextInput
          onChangeText={setDraft}
          onSubmitEditing={handleSave}
          placeholder="Write a note"
          placeholderTextColor={theme.colors.textMuted}
          returnKeyType="send"
          style={[styles.input, webEmbeddedInputReset]}
          value={draft}
        />
        <Pressable onPress={handleSave} style={[styles.sendButton, webNoOutline]}>
          <Feather color={theme.colors.textOnAccent} name="send" size={18} />
        </Pressable>
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
    headerCopy: {
      flex: 1,
    },
    title: {
      color: theme.colors.textOnAccent,
      fontSize: 18,
      fontWeight: "800",
    },
    subtitle: {
      color: "rgba(255,255,255,0.78)",
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
    },
    bubbleRow: {
      alignItems: "flex-end",
      marginVertical: 4,
    },
    bubble: {
      maxWidth: "84%",
      backgroundColor: theme.colors.mine,
      borderRadius: 12,
      borderTopRightRadius: 3,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    body: {
      color: theme.colors.text,
      fontSize: 15,
      lineHeight: 20,
    },
    meta: {
      color: theme.colors.textMuted,
      fontSize: 11,
      alignSelf: "flex-end",
      marginTop: 5,
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
    composer: {
      backgroundColor: theme.colors.composer,
      borderTopColor: theme.colors.separator,
      borderTopWidth: 1,
      paddingHorizontal: theme.spacing.sm,
      paddingTop: theme.spacing.xs,
      paddingBottom: theme.spacing.sm,
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.xs,
    },
    input: {
      flex: 1,
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.pill,
      paddingHorizontal: 16,
      minHeight: 44,
      color: theme.colors.text,
      fontSize: 16,
    },
    sendButton: {
      width: 46,
      height: 46,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.accentStrong,
      alignItems: "center",
      justifyContent: "center",
    },
  });
