import * as Clipboard from "expo-clipboard";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { PrimaryButton } from "@/components/PrimaryButton";
import { Screen } from "@/components/Screen";
import { useAuth } from "@/context/AuthContext";
import { useAppTheme } from "@/lib/theme";

type Props = {
  onBack: () => void;
};

export function SettingsScreen({ onBack }: Props) {
  const theme = useAppTheme();
  const styles = createStyles(theme);
  const { profile, signOut } = useAuth();

  return (
    <Screen scroll>
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.backButton}>
          <Feather color={theme.colors.textOnAccent} name="arrow-left" size={22} />
        </Pressable>
        <Text style={styles.title}>Settings</Text>
      </View>

      <View style={styles.body}>
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{profile?.username?.slice(0, 1).toUpperCase() ?? "U"}</Text>
          </View>
          <View style={styles.profileCopy}>
            <Text style={styles.handle}>@{profile?.username ?? "unknown"}</Text>
            <Text style={styles.email}>{profile?.email ?? "No email"}</Text>
          </View>
        </View>

        <View style={styles.listCard}>
          <SettingRow icon="account-outline" subtitle="Your username-based identity" title="Profile" />
          <SettingRow icon="shield-lock-outline" subtitle="Disappearing and view-once tools" title="Privacy" />
          <SettingRow icon="message-text-outline" subtitle="Only text messages are allowed" title="Chats" />
        </View>

        <View style={styles.actions}>
          <PrimaryButton
            label="Copy username"
            onPress={async () => {
              await Clipboard.setStringAsync(profile?.username ?? "");
              Alert.alert("Copied", "Your username was copied to the clipboard.");
            }}
            tone="soft"
          />
          <PrimaryButton label="Back to chats" onPress={onBack} tone="soft" />
          <PrimaryButton label="Sign out" onPress={() => void signOut()} />
        </View>
      </View>
    </Screen>
  );

  function SettingRow({
    icon,
    title,
    subtitle,
  }: {
    icon: keyof typeof MaterialCommunityIcons.glyphMap;
    title: string;
    subtitle: string;
  }) {
    return (
      <View style={styles.settingRow}>
        <View style={styles.settingIconWrap}>
          <MaterialCommunityIcons color={theme.colors.textMuted} name={icon} size={22} />
        </View>
        <View style={styles.settingCopy}>
          <Text style={styles.settingTitle}>{title}</Text>
          <Text style={styles.settingSubtitle}>{subtitle}</Text>
        </View>
        <Feather color={theme.colors.textMuted} name="chevron-right" size={18} />
      </View>
    );
  }
}

const createStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    header: {
      backgroundColor: theme.colors.header,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: theme.spacing.md,
      paddingTop: theme.spacing.sm,
      paddingBottom: theme.spacing.md,
    },
    backButton: {
      width: 36,
      height: 36,
      borderRadius: theme.radius.pill,
      alignItems: "center",
      justifyContent: "center",
    },
    title: {
      color: theme.colors.textOnAccent,
      fontSize: 21,
      fontWeight: "800",
    },
    body: {
      flexGrow: 1,
      gap: theme.spacing.md,
      padding: theme.spacing.md,
    },
    profileCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.lg,
      padding: theme.spacing.md,
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
    },
    avatar: {
      width: 58,
      height: 58,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.surfaceMuted,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarText: {
      color: theme.colors.accent,
      fontSize: 24,
      fontWeight: "800",
    },
    profileCopy: {
      flex: 1,
    },
    handle: {
      color: theme.colors.text,
      fontSize: 20,
      fontWeight: "800",
    },
    email: {
      color: theme.colors.textMuted,
      marginTop: 3,
    },
    listCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.lg,
      overflow: "hidden",
    },
    settingRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: 14,
      borderBottomColor: theme.colors.separator,
      borderBottomWidth: 1,
    },
    settingIconWrap: {
      width: 36,
      alignItems: "center",
    },
    settingCopy: {
      flex: 1,
    },
    settingTitle: {
      color: theme.colors.text,
      fontSize: 16,
      fontWeight: "700",
    },
    settingSubtitle: {
      color: theme.colors.textMuted,
      fontSize: 13,
      marginTop: 2,
    },
    actions: {
      gap: theme.spacing.sm,
      marginTop: theme.spacing.sm,
    },
  });
