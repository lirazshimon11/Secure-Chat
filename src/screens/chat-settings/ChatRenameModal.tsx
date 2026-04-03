import { useState, useEffect, useRef } from "react";
import { Modal, StyleSheet, Text, TextInput, View, Pressable, KeyboardAvoidingView, Platform } from "react-native";
import { useChats } from "@/context/ChatContext";
import { useAppTheme } from "@/lib/theme";
import { Chat } from "@/lib/types";
import { supabase } from "@/lib/supabase";

type Props = {
  chat: Chat;
  visible: boolean;
  onClose: () => void;
  onRenamed?: (newTitle: string) => void;
};

const MAX = 100;

export function ChatRenameModal({ chat, visible, onClose, onRenamed }: Props) {
  const theme = useAppTheme();
  const styles = createStyles(theme);
  const { chats, updateChatTitle } = useChats();
  const liveChat = chats.find((c) => c.id === chat.id) || chat;
  const [name, setName] = useState(liveChat.title);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (visible) {
      setName(liveChat.title);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [visible, liveChat.title]);

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    await updateChatTitle(chat.id, trimmed);
    onRenamed?.(trimmed);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <View style={styles.overlay}>
          <View style={styles.card}>
            <Text style={styles.title}>שם הקבוצה</Text>
            <View style={styles.inputRow}>
              <Pressable onPress={() => setName("")} style={styles.emoji}>
                <Text style={{ fontSize: 22 }}>🙂</Text>
              </Pressable>
              <Text style={styles.counter}>{MAX - name.length}</Text>
              <TextInput
                ref={inputRef}
                style={styles.input}
                value={name}
                onChangeText={(t) => setName(t.slice(0, MAX))}
                maxLength={MAX}
                selectTextOnFocus
                autoFocus
              />
            </View>
            <View style={styles.actions}>
              <Pressable onPress={handleSave} style={styles.btn}>
                <Text style={styles.btnText}>אישור</Text>
              </Pressable>
              <Pressable onPress={onClose} style={styles.btn}>
                <Text style={styles.btnText}>ביטול</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const createStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: theme.colors.background,
      justifyContent: "flex-start",
      paddingTop: 60,
    },
    card: {
      backgroundColor: theme.colors.surface,
      padding: theme.spacing.xl,
    },
    title: {
      fontSize: 20,
      fontWeight: "700",
      color: theme.colors.text,
      marginBottom: theme.spacing.xl,
      textAlign: "right",
    },
    inputRow: {
      flexDirection: "row",
      alignItems: "center",
      borderBottomWidth: 2,
      borderBottomColor: theme.colors.accent,
      paddingBottom: 8,
      gap: theme.spacing.md,
    },
    emoji: {
      padding: 4,
    },
    counter: {
      color: theme.colors.textMuted,
      fontSize: 14,
      minWidth: 28,
      textAlign: "center",
    },
    input: {
      flex: 1,
      fontSize: 18,
      color: theme.colors.text,
      textAlign: "right",
    },
    actions: {
      flexDirection: "row",
      justifyContent: "flex-start",
      gap: theme.spacing.xl,
      marginTop: theme.spacing.xl,
    },
    btn: {
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
    },
    btnText: {
      color: theme.colors.accent,
      fontSize: 16,
      fontWeight: "600",
    },
  });
