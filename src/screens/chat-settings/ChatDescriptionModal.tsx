import { useState, useEffect } from "react";
import { Modal, StyleSheet, Text, TextInput, View, Pressable } from "react-native";
import { useChats } from "@/context/ChatContext";
import { useAppTheme } from "@/lib/theme";
import { Chat } from "@/lib/types";

type Props = {
  chat: Chat;
  visible: boolean;
  onClose: () => void;
};

export function ChatDescriptionModal({ chat, visible, onClose }: Props) {
  const theme = useAppTheme();
  const styles = createStyles(theme);
  const { updateChatDescription } = useChats();
  const [description, setDescription] = useState(chat.description ?? "");

  // Hydrate local state if the live chat prop updates underneath!
  useEffect(() => {
    setDescription(chat.description ?? "");
  }, [chat.description, visible]);

  const handleSave = async () => {
    await updateChatDescription(chat.id, description);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>תיאור הקבוצה</Text>
          <TextInput
            style={styles.input}
            multiline
            value={description}
            onChangeText={setDescription}
            placeholder="הקלד/י תיאור הקבוצה כאן..."
            placeholderTextColor={theme.colors.textMuted}
            autoFocus
          />
          <Text style={styles.helper}>תיאור הקבוצה גלוי רק לחברי הקבוצה ולאנשים שהוזמנו אליה.</Text>
          <View style={styles.actions}>
             <Pressable onPress={onClose} style={styles.button}>
               <Text style={styles.buttonText}>ביטול</Text>
             </Pressable>
             <Pressable onPress={handleSave} style={styles.button}>
               <Text style={styles.buttonTextPrimary}>אישור</Text>
             </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: theme.colors.overlay,
      justifyContent: "center",
      alignItems: "center",
      padding: theme.spacing.lg,
    },
    card: {
      backgroundColor: theme.colors.surface,
      width: "100%",
      borderRadius: theme.radius.md,
      padding: theme.spacing.lg,
    },
    title: {
      fontSize: 20,
      fontWeight: "700",
      color: theme.colors.text,
      marginBottom: theme.spacing.md,

    },
    input: {
      borderWidth: 1,
      borderColor: theme.colors.separator,
      borderRadius: theme.radius.sm,
      padding: theme.spacing.md,
      minHeight: 120,
      textAlignVertical: "top",

      color: theme.colors.text,
      fontSize: 16,
      marginBottom: theme.spacing.sm,
    },
    helper: {
      fontSize: 13,
      color: theme.colors.textMuted,

      marginBottom: theme.spacing.lg,
    },
    actions: {
      flexDirection: "row",
      justifyContent: "flex-start",
      gap: theme.spacing.xl,
    },
    button: {
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
    },
    buttonText: {
      color: theme.colors.textMuted,
      fontSize: 16,
      fontWeight: "600",
    },
    buttonTextPrimary: {
      color: theme.colors.accent,
      fontSize: 16,
      fontWeight: "600",
    },
  });
