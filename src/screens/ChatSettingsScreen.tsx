import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { useChats } from "@/context/ChatContext";
import { useAppTheme } from "@/lib/theme";
import { Chat, ChatMuteSetting, Profile } from "@/lib/types";

type Props = {
  chat: Chat;
  onBack: () => void;
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
    return "Notifications are on";
  }

  if (setting?.mute_always) {
    return "Muted forever";
  }

  return setting?.mute_until ? `Muted until ${new Date(setting.mute_until).toLocaleString()}` : "Muted";
}

export function ChatSettingsScreen({ chat, onBack }: Props) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { loadChatMembers, muteSettings, setChatMute, clearChatMute } = useChats();
  const [members, setMembers] = useState<Profile[]>([]);

  useEffect(() => {
    void (async () => {
      const nextMembers = await loadChatMembers(chat.id);
      setMembers(nextMembers);
    })();
  }, [chat.id, loadChatMembers]);

  const muteSetting = muteSettings[chat.id];
  const muteLabel = useMemo(() => describeMute(muteSetting), [muteSetting]);

  return (
    <Screen scroll>
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.backButton}>
          <Feather color={theme.colors.textOnAccent} name="arrow-left" size={22} />
        </Pressable>
        <Text style={styles.headerTitle}>Chat info</Text>
      </View>

      <View style={styles.heroCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{chat.title.slice(0, 1).toUpperCase()}</Text>
        </View>
        <Text style={styles.chatTitle}>{chat.title}</Text>
        <Text style={styles.chatSubtitle}>{chat.is_group ? "Private group" : "Private 1-on-1 chat"}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notifications</Text>
        <SettingRow icon="bell-outline" subtitle={muteLabel} theme={theme} title="Mute notifications" />
        <View style={styles.muteActions}>
          <MuteChip label="8 hours" onPress={() => setChatMute(chat.id, "8_hours")} theme={theme} />
          <MuteChip label="7 days" onPress={() => setChatMute(chat.id, "7_days")} theme={theme} />
          <MuteChip label="Always" onPress={() => setChatMute(chat.id, "always")} theme={theme} />
          <MuteChip danger label="Unmute" onPress={() => clearChatMute(chat.id)} theme={theme} />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Chat settings</Text>
        <SettingRow icon="timer-sand" subtitle="1-minute disappearing option available" theme={theme} title="Temporary messages" />
        <SettingRow icon="eye-outline" subtitle="One-time reveal for sensitive messages" theme={theme} title="View once" />
        <SettingRow icon="message-text-outline" subtitle="Only plain text is allowed in this app" theme={theme} title="Text only" />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Members</Text>
        {members.length ? (
          <ScrollView scrollEnabled={false}>
            {members.map((member, index) => (
              <View key={member.id} style={[styles.memberRow, index !== members.length - 1 && styles.memberBorder]}>
                <View style={styles.memberAvatar}>
                  <Text style={styles.memberAvatarText}>{member.username.slice(0, 1).toUpperCase()}</Text>
                </View>
                <View style={styles.memberCopy}>
                  <Text style={styles.memberName}>@{member.username}</Text>
                  <Text style={styles.memberEmail}>{member.full_name || member.email}</Text>
                </View>
              </View>
            ))}
          </ScrollView>
        ) : (
          <Text style={styles.emptyText}>Loading members...</Text>
        )}
      </View>
    </Screen>
  );
}

function SettingRow({
  icon,
  title,
  subtitle,
  theme,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  title: string;
  subtitle: string;
  theme: ReturnType<typeof useAppTheme>;
}) {
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.settingRow}>
      <MaterialCommunityIcons color={theme.colors.textMuted} name={icon} size={22} />
      <View style={styles.settingCopy}>
        <Text style={styles.settingTitle}>{title}</Text>
        <Text style={styles.settingSubtitle}>{subtitle}</Text>
      </View>
    </View>
  );
}

function MuteChip({
  label,
  onPress,
  danger,
  theme,
}: {
  label: string;
  onPress: () => void;
  danger?: boolean;
  theme: ReturnType<typeof useAppTheme>;
}) {
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <Pressable onPress={onPress} style={[styles.muteChip, danger && styles.muteChipDanger]}>
      <Text style={[styles.muteChipText, danger && styles.muteChipTextDanger]}>{label}</Text>
    </Pressable>
  );
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
    headerTitle: {
      color: theme.colors.textOnAccent,
      fontSize: 20,
      fontWeight: "800",
    },
    heroCard: {
      alignItems: "center",
      backgroundColor: theme.colors.surface,
      margin: theme.spacing.md,
      borderRadius: theme.radius.lg,
      padding: theme.spacing.lg,
      gap: 6,
      borderColor: theme.colors.separator,
      borderWidth: 1,
    },
    avatar: {
      width: 72,
      height: 72,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.surfaceMuted,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 6,
    },
    avatarText: {
      color: theme.colors.accent,
      fontSize: 28,
      fontWeight: "800",
    },
    chatTitle: {
      color: theme.colors.text,
      fontSize: 24,
      fontWeight: "800",
    },
    chatSubtitle: {
      color: theme.colors.textMuted,
      fontSize: 14,
    },
    section: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.lg,
      marginHorizontal: theme.spacing.md,
      marginBottom: theme.spacing.md,
      overflow: "hidden",
      borderColor: theme.colors.separator,
      borderWidth: 1,
    },
    sectionTitle: {
      color: theme.colors.textMuted,
      fontSize: 12,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 0.7,
      paddingHorizontal: theme.spacing.md,
      paddingTop: theme.spacing.md,
      paddingBottom: 8,
    },
    settingRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: 14,
      borderTopColor: theme.colors.separator,
      borderTopWidth: 1,
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
    muteActions: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: theme.spacing.xs,
      paddingHorizontal: theme.spacing.md,
      paddingBottom: theme.spacing.md,
    },
    muteChip: {
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.surfaceAlt,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    muteChipDanger: {
      backgroundColor: theme.colors.surfaceAlt,
      borderColor: theme.colors.danger,
      borderWidth: 1,
    },
    muteChipText: {
      color: theme.colors.text,
      fontWeight: "600",
    },
    muteChipTextDanger: {
      color: theme.colors.danger,
    },
    memberRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: theme.spacing.md,
      paddingVertical: 14,
    },
    memberBorder: {
      borderBottomColor: theme.colors.separator,
      borderBottomWidth: 1,
    },
    memberAvatar: {
      width: 44,
      height: 44,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.surfaceMuted,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 12,
    },
    memberAvatarText: {
      color: theme.colors.accent,
      fontWeight: "800",
      fontSize: 18,
    },
    memberCopy: {
      flex: 1,
    },
    memberName: {
      color: theme.colors.text,
      fontSize: 16,
      fontWeight: "700",
    },
    memberEmail: {
      color: theme.colors.textMuted,
      fontSize: 13,
      marginTop: 2,
    },
    emptyText: {
      color: theme.colors.textMuted,
      paddingHorizontal: theme.spacing.md,
      paddingBottom: theme.spacing.md,
    },
  });
