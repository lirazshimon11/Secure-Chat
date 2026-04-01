import { useMemo } from "react";
import { StyleSheet, Text, View, Pressable, Switch } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { useChats } from "@/context/ChatContext";
import { useAppTheme } from "@/lib/theme";
import { Chat } from "@/lib/types";

type Props = {
  chat: Chat;
  onBack: () => void;
};

export function ChatNotificationsScreen({ chat, onBack }: Props) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { muteSettings, setChatMute, clearChatMute } = useChats();

  const muteSetting = muteSettings[chat.id];
  const isMuted = Boolean(muteSetting?.mute_always || (muteSetting?.mute_until && new Date(muteSetting.mute_until).getTime() > Date.now()));

  const handleToggleMute = () => {
    if (isMuted) {
      clearChatMute(chat.id);
    } else {
      // In a real app we would show a dialog allowing '8 hours, 1 week, always'. Defaulting to always here.
      setChatMute(chat.id, "always");
    }
  };

  return (
    <Screen>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>התראות</Text>
          <Pressable onPress={onBack} style={styles.backButton}>
            <Feather color={theme.colors.headerIcon} name="arrow-right" size={24} />
          </Pressable>
        </View>

        <View style={styles.content}>
          <Text style={styles.sectionLabel}>הודעה</Text>
          
          <View style={styles.settingRow}>
            <View style={styles.settingCopy}>
              <Text style={styles.settingTitle}>השתקה</Text>
            </View>
            <Switch value={isMuted} onValueChange={handleToggleMute} />
          </View>

          <Pressable style={styles.settingRow}>
            <View style={styles.settingCopy}>
              <Text style={styles.settingTitle}>התראות על</Text>
              <Text style={styles.settingSubtitle}>כל ההודעות</Text>
            </View>
          </Pressable>

          <Pressable style={styles.settingRow}>
            <View style={styles.settingCopy}>
              <Text style={styles.settingTitle}>צליל התראה</Text>
              <Text style={styles.settingSubtitle}>ברירת מחדל (Conclusion)</Text>
            </View>
          </Pressable>

          <Pressable style={styles.settingRow}>
            <View style={styles.settingCopy}>
              <Text style={styles.settingTitle}>רטט</Text>
              <Text style={styles.settingSubtitle}>ברירת מחדל</Text>
            </View>
          </Pressable>

          <Pressable style={styles.settingRow}>
            <View style={styles.settingCopy}>
              <Text style={styles.settingTitle}>הגדרות מתקדמות</Text>
            </View>
          </Pressable>

          <View style={styles.separator} />
          
          <Text style={styles.sectionLabel}>צ'אט קולי</Text>
          <View style={styles.settingRow}>
            <View style={styles.settingCopy}>
              <Text style={styles.settingTitle}>השתקה</Text>
            </View>
            <Switch value={false} disabled />
          </View>

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
    },
    sectionLabel: {
      fontSize: 14,
      fontWeight: "700",
      color: theme.colors.textMuted,
      paddingHorizontal: theme.spacing.lg,
      paddingTop: theme.spacing.lg,
      paddingBottom: theme.spacing.xs,
    },
    settingRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: 14,
    },
    settingCopy: {
      flex: 1,
    },
    settingTitle: {
      fontSize: 16,
      color: theme.colors.text,
      fontWeight: "600",
    },
    settingSubtitle: {
      fontSize: 14,
      color: theme.colors.textMuted,
      marginTop: 2,
    },
    separator: {
      height: 1,
      backgroundColor: theme.colors.separator,
      marginTop: theme.spacing.md,
      marginBottom: theme.spacing.sm,
    },
  });
