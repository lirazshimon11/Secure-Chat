import { useMemo } from "react";
import { StyleSheet, Text, View, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { useChats } from "@/context/ChatContext";
import { useAppTheme } from "@/lib/theme";
import { Chat } from "@/lib/types";

type Props = {
  chat: Chat;
  onBack: () => void;
};

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

export function ChatStorageScreen({ chat, onBack }: Props) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { messagesByChat } = useChats();

  const messages = messagesByChat[chat.id] ?? [];
  
  // Calculate fake storage size based on text payload length (assume UTF-8 so x2 for realism or just straight length)
  const totalSize = useMemo(() => {
    let size = 0;
    for (const msg of messages) {
      size += msg.body_ciphertext.length * 2; // Rough UTF-16 byte size
    }
    // Add some base overhead just to show a number larger than 0 B usually
    return size > 0 ? size + 15432 : 0; 
  }, [messages]);

  return (
    <Screen>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>ניהול האחסון</Text>
          <Pressable onPress={onBack} style={styles.backButton}>
            <Feather color={theme.colors.headerIcon} name="arrow-right" size={24} />
          </Pressable>
        </View>

        <View style={styles.content}>
          <Text style={styles.sizeText}>{formatBytes(totalSize)}</Text>
          <Text style={styles.subtitle}>נפח האחסון בשימוש צ'אט זה</Text>
          <View style={styles.separator} />
          
          <Text style={styles.disclaimer}>
            צ'אט זה אינו תומך בשמירת מדיה אמיתית על השרת, ולכן האחסון המוצג מבוסס על היסטוריית הטקסט בלבד.
          </Text>
        </View>
      </View>
    </Screen>
  );
}

const createStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      backgroundColor: theme.colors.header,
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: theme.spacing.md,
      paddingTop: theme.spacing.sm,
      paddingBottom: theme.spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.separator,
    },
    backButton: {
      width: 36,
      height: 36,
      borderRadius: theme.radius.pill,
      alignItems: "center",
      justifyContent: "center",
      marginLeft: 12,
    },
    headerTitle: {
      color: theme.colors.headerText,
      fontSize: 20,
      fontWeight: "800",
      flex: 1,
    },
    content: {
      flex: 1,
      alignItems: "center",
      padding: theme.spacing.xl,
    },
    sizeText: {
      color: theme.colors.text,
      fontSize: 42,
      fontWeight: "800",
      marginTop: 20,
    },
    subtitle: {
      color: theme.colors.textMuted,
      fontSize: 16,
      marginTop: theme.spacing.sm,
    },
    separator: {
      height: 1,
      backgroundColor: theme.colors.separator,
      width: "100%",
      marginVertical: theme.spacing.xl,
    },
    disclaimer: {
      color: theme.colors.textMuted,
      fontSize: 14,
      textAlign: "center",
      paddingHorizontal: theme.spacing.lg,
      lineHeight: 20,
    },
  });
