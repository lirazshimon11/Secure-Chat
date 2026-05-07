import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, useColorScheme, View } from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";

import { MessageComposer } from "@/components/MessageComposer";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { useAppTheme } from "@/lib/theme";
import { Chat } from "@/lib/types";
import { ChatBackground } from "@/screens/chat/ChatBackground";

type Props = {
  chat: Chat;
  onBack: () => void;
};

type DecoyMessage = {
  id: string;
  body: string;
  is_me: boolean;
  created_at: string;
  optimistic?: boolean;
};

export function DecoyContentScreen({ chat, onBack }: Props) {
  const theme = useAppTheme();
  const colorScheme = useColorScheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { profile } = useAuth();
  const scrollRef = useRef<ScrollView | null>(null);
  const [messages, setMessages] = useState<DecoyMessage[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const scrollToBottom = useCallback((animated = false) => {
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated }));
  }, []);

  useEffect(() => {
    let active = true;
    setLoadError(null);

    void (async () => {
      const { data, error } = await supabase
        .from("chat_decoy_messages")
        .select("id, body, is_me, created_at")
        .eq("chat_id", chat.id)
        .order("created_at", { ascending: true });

      if (!active) return;

      if (error) {
        setLoadError("לא ניתן לטעון כרגע את תוכן הפיתיון.");
        setMessages([]);
        return;
      }

      setMessages(
        (data ?? []).map((row: any) => ({
          id: String(row.id),
          body: String(row.body ?? ""),
          is_me: Boolean(row.is_me),
          created_at: String(row.created_at ?? new Date().toISOString()),
        })),
      );
      scrollToBottom(false);
    })();

    return () => {
      active = false;
    };
  }, [chat.id, scrollToBottom]);

  const handleSend = useCallback(
    (body: string) => {
      const text = body.trim();
      if (!text || !profile?.id) return;

      const optimisticId = `optimistic-${Date.now()}`;
      const optimisticMessage: DecoyMessage = {
        id: optimisticId,
        body: text,
        is_me: true,
        created_at: new Date().toISOString(),
        optimistic: true,
      };

      setLoadError(null);
      setMessages((current) => [...current, optimisticMessage]);
      scrollToBottom(true);

      void supabase
        .from("chat_decoy_messages")
        .insert([{ chat_id: chat.id, sender_id: profile.id, body: text, is_me: true }])
        .select("id, body, is_me, created_at")
        .single()
        .then(({ data, error }) => {
          if (error || !data) {
            setMessages((current) => current.filter((message) => message.id !== optimisticId));
            setLoadError("ההודעה לא נשמרה בתוכן הפיתיון.");
            return;
          }

          setMessages((current) =>
            current.map((message) =>
              message.id === optimisticId
                ? {
                    id: String(data.id),
                    body: String(data.body ?? text),
                    is_me: Boolean(data.is_me),
                    created_at: String(data.created_at ?? optimisticMessage.created_at),
                  }
                : message,
            ),
          );
          scrollToBottom(true);
        });
    },
    [chat.id, profile?.id, scrollToBottom],
  );

  return (
    <View style={styles.root}>
      <ChatBackground colorScheme={colorScheme} />
      <SafeAreaView edges={["top", "left", "right"]} style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable onPress={onBack} style={styles.headerButton}>
            <Feather name="arrow-left" size={24} color={theme.colors.headerIcon} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text numberOfLines={1} style={styles.title}>
              {chat.title} - תוכן פיתיון
            </Text>
            <Text numberOfLines={1} style={styles.subtitle}>
              צ'אט שיוצג במצב פיתיון
            </Text>
          </View>
          <View style={styles.avatar}>
            <MaterialCommunityIcons name="fish" size={22} color={theme.colors.accent} />
          </View>
        </View>

        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.content}>
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={styles.messagesContent}
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={() => scrollToBottom(false)}
            showsVerticalScrollIndicator={false}
          >
            {loadError ? (
              <View style={styles.notice}>
                <Text style={styles.noticeText}>{loadError}</Text>
              </View>
            ) : null}

            {messages.map((message) => (
              <View key={message.id} style={[styles.bubbleRow, message.is_me ? styles.mineRow : styles.theirsRow]}>
                <View style={[styles.bubble, message.is_me ? styles.mineBubble : styles.theirsBubble]}>
                  <Text style={styles.bubbleText}>{message.body}</Text>
                  <Text style={styles.timeText}>
                    {new Date(message.created_at).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}
                  </Text>
                </View>
              </View>
            ))}
          </ScrollView>

          <MessageComposer
            onSend={(body) => handleSend(body)}
            onCancelReply={() => {}}
            replyToText={null}
            replyToName={null}
            onAttachmentPress={() => {}}
          />
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const createStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: theme.colors.chatBackdrop,
      overflow: "hidden",
    },
    safeArea: {
      flex: 1,
      backgroundColor: "transparent",
    },
    header: {
      minHeight: 72,
      paddingHorizontal: 12,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: theme.colors.header,
      borderBottomColor: theme.colors.separator,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    headerButton: {
      width: 44,
      height: 44,
      alignItems: "center",
      justifyContent: "center",
    },
    headerCopy: {
      flex: 1,
      alignItems: "flex-end",
    },
    title: {
      color: theme.colors.headerText,
      fontSize: 18,
      fontWeight: "800",
      textAlign: "right",
      writingDirection: "rtl",
    },
    subtitle: {
      color: theme.colors.headerSubtitle,
      fontSize: 12,
      marginTop: 2,
      textAlign: "right",
      writingDirection: "rtl",
    },
    avatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.surfaceAlt,
    },
    content: {
      flex: 1,
    },
    messagesContent: {
      flexGrow: 1,
      justifyContent: "flex-end",
      paddingHorizontal: 12,
      paddingTop: 12,
      paddingBottom: 12,
    },
    notice: {
      alignSelf: "center",
      maxWidth: "86%",
      borderRadius: 999,
      paddingHorizontal: 14,
      paddingVertical: 8,
      backgroundColor: theme.colors.datePill,
      marginBottom: 12,
    },
    noticeText: {
      color: theme.colors.datePillText,
      fontSize: 13,
      textAlign: "center",
      writingDirection: "rtl",
    },
    bubbleRow: {
      width: "100%",
      marginVertical: 3,
    },
    mineRow: {
      alignItems: "flex-end",
    },
    theirsRow: {
      alignItems: "flex-start",
    },
    bubble: {
      maxWidth: "78%",
      minWidth: 72,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingTop: 7,
      paddingBottom: 5,
    },
    mineBubble: {
      backgroundColor: theme.colors.mine,
      borderTopRightRadius: 2,
    },
    theirsBubble: {
      backgroundColor: theme.colors.theirs,
      borderTopLeftRadius: 2,
    },
    bubbleText: {
      color: theme.colors.text,
      fontSize: 16,
      lineHeight: 21,
      textAlign: "right",
      writingDirection: "rtl",
    },
    timeText: {
      color: theme.colors.textMuted,
      fontSize: 11,
      marginTop: 3,
      alignSelf: "flex-end",
    },
  });
