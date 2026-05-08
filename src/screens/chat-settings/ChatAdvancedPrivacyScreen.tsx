import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { DEFAULT_CHAT_SECURITY_SETTINGS, fetchChatSecuritySettings, saveChatSecuritySettings } from "@/lib/chatSecuritySettings";
import { useAppTheme } from "@/lib/theme";
import { Chat, ChatSecuritySettings } from "@/lib/types";
import { webSystemFont } from "@/lib/webStyles";

type Props = {
  chat: Chat;
  currentUserId?: string | null;
  isAdmin: boolean;
  onBack: () => void;
};

const rows: Array<{
  key: keyof ChatSecuritySettings;
  icon: any;
  title: string;
  subtitle: string;
}> = [
  {
    key: "require_hold_to_reveal",
    icon: "eye-lock-outline",
    title: "חשיפה רק בלחיצה על העין",
    subtitle: "הודעות נשארות מטושטשות עד שמחזיקים את כפתור העין.",
  },
  {
    key: "identity_magnet",
    icon: "fingerprint",
    title: "חותמת זהות בזמן צפייה",
    subtitle: "מצמיד סימון אדום עם שם המשתמש בזמן שהצ׳אט גלוי.",
  },
  {
    key: "shutter_flicker",
    icon: "camera-burst",
    title: "תעתוע צילום",
    subtitle: "שכבת רעש מהירה מעל תוכן הצ׳אט בזמן חשיפה.",
  },
  {
    key: "app_switcher_blackout",
    icon: "cellphone-lock",
    title: "טשטוש במעבר אפליקציות",
    subtitle: "מסתיר מיד את הצ׳אט כשעוזבים את הטאב או האפליקציה.",
  },
  {
    key: "fake_screenshot_warning",
    icon: "alert-octagon-outline",
    title: "התראת הרתעה",
    subtitle: "מציג אזהרה במסך מלא כשמזוהה ניסיון חשוד.",
  },
  {
    key: "anti_copy_canvas",
    icon: "text-box-search-outline",
    title: "Canvas נגד העתקה ו-OCR",
    subtitle: "מרנדר טקסט הודעות כקנבס עם רעש דיגיטלי.",
  },
];

export function ChatAdvancedPrivacyScreen({ chat, currentUserId, isAdmin, onBack }: Props) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [settings, setSettings] = useState<ChatSecuritySettings>(DEFAULT_CHAT_SECURITY_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<keyof ChatSecuritySettings | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void fetchChatSecuritySettings(chat.id)
      .then((next) => {
        if (active) setSettings(next);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [chat.id]);

  const updateSetting = async (key: keyof ChatSecuritySettings, value: boolean) => {
    if (!isAdmin || !currentUserId) return;
    const previous = settings;
    const next = { ...settings, [key]: value };
    setSettings(next);
    setSavingKey(key);
    const { error } = await saveChatSecuritySettings(chat.id, next, currentUserId);
    if (error) {
      setSettings(previous);
    }
    setSavingKey(null);
  };

  return (
    <Screen>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={[styles.headerTitle, webSystemFont]}>הגנות אבטחה בצ׳אט</Text>
          <Pressable onPress={onBack} style={styles.backButton}>
            <Feather color={theme.colors.headerIcon} name="arrow-right" size={24} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.notice}>
            <MaterialCommunityIcons name={isAdmin ? "shield-check-outline" : "shield-lock-outline"} size={24} color={theme.colors.accent} />
            <Text style={[styles.noticeText, webSystemFont]}>
              {isAdmin
                ? "כמנהל/ת הקבוצה אפשר להדליק ולכבות כל שכבת אבטחה בכל רגע. השינוי חל על הצ׳אט הזה."
                : "רק מנהל/ת הקבוצה יכול/ה לשנות את שכבות האבטחה. כאן אפשר לראות מה פעיל כרגע."}
            </Text>
          </View>

          {loading ? (
            <View style={styles.loading}>
              <ActivityIndicator color={theme.colors.accent} />
            </View>
          ) : (
            <View style={styles.list}>
              {rows.map((row) => (
                <View key={row.key} style={styles.row}>
                  <View style={styles.iconBox}>
                    <MaterialCommunityIcons name={row.icon} size={24} color={theme.colors.textMuted} />
                  </View>
                  <View style={styles.rowCopy}>
                    <Text style={[styles.rowTitle, webSystemFont]}>{row.title}</Text>
                    <Text style={[styles.rowSubtitle, webSystemFont]}>{row.subtitle}</Text>
                  </View>
                  <Switch
                    value={settings[row.key]}
                    disabled={!isAdmin || savingKey === row.key}
                    onValueChange={(value) => void updateSetting(row.key, value)}
                    trackColor={{ false: theme.colors.surfaceMuted, true: theme.colors.accentSoft }}
                    thumbColor={settings[row.key] ? theme.colors.accent : theme.colors.textMuted}
                    style={webSystemFont}
                  />
                </View>
              ))}
            </View>
          )}
        </ScrollView>
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
      fontWeight: "700",
      flex: 1,
      textAlign: "right",
      writingDirection: "rtl",
    },
    content: {
      padding: theme.spacing.md,
      paddingBottom: theme.spacing.xl,
    },
    notice: {
      backgroundColor: theme.colors.surfaceMuted,
      borderRadius: theme.radius.md,
      padding: theme.spacing.md,
      flexDirection: "row-reverse",
      gap: theme.spacing.md,
      alignItems: "flex-start",
      marginBottom: theme.spacing.md,
    },
    noticeText: {
      flex: 1,
      color: theme.colors.text,
      fontSize: 14,
      lineHeight: 21,
      textAlign: "right",
      writingDirection: "rtl",
    },
    loading: {
      paddingVertical: 40,
    },
    list: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.md,
      overflow: "hidden",
    },
    row: {
      flexDirection: "row-reverse",
      alignItems: "center",
      gap: theme.spacing.md,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.separator,
    },
    iconBox: {
      width: 34,
      alignItems: "center",
    },
    rowCopy: {
      flex: 1,
      alignItems: "flex-end",
    },
    rowTitle: {
      color: theme.colors.text,
      fontSize: 16,
      fontWeight: "600",
      textAlign: "right",
      writingDirection: "rtl",
    },
    rowSubtitle: {
      color: theme.colors.textMuted,
      fontSize: 13,
      lineHeight: 18,
      marginTop: 3,
      textAlign: "right",
      writingDirection: "rtl",
    },
  });
