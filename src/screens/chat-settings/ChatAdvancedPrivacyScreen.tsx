import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { DEFAULT_CHAT_SECURITY_SETTINGS, fetchChatSecuritySettings, saveChatSecuritySettings, subscribeToChatSecuritySettings } from "@/lib/chatSecuritySettings";
import { useAppTheme } from "@/lib/theme";
import { Chat, ChatSecuritySettings } from "@/lib/types";
import { webSystemFont } from "@/lib/webStyles";

type Props = {
  chat: Chat;
  currentUserId?: string | null;
  isAdmin: boolean;
  onBack: () => void;
  onSendSystemMessage?: (body: string) => Promise<void>;
};

type BooleanSecuritySettingKey = Exclude<keyof ChatSecuritySettings, "shutter_flicker_fps">;

const SHUTTER_FPS_MIN = 5;
const SHUTTER_FPS_MAX = 60;
const SHUTTER_FPS_STEP = 5;

const rows: Array<{
  key: BooleanSecuritySettingKey;
  icon: any;
  title: string;
  subtitle: string;
}> = [
  {
    key: "require_hold_to_reveal",
    icon: "gesture-tap-hold",
    title: "חשיפה בלחיצה ארוכה על הצ׳אט",
    subtitle: "הודעות נשארות מטושטשות עד שמחזיקים אצבע יציבה על אזור תוכן הצ׳אט.",
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

function getSecurityChangeMessages(previous: ChatSecuritySettings, next: ChatSecuritySettings) {
  const messages: string[] = [];
  for (const row of rows) {
    if (previous[row.key] !== next[row.key]) {
      messages.push(`${row.title} - ${next[row.key] ? "הופעלה מחדש" : "הופסקה"}`);
    }
  }
  if (previous.shutter_flicker_fps !== next.shutter_flicker_fps) {
    messages.push(`תעתוע צילום עודכן ל- ${next.shutter_flicker_fps} FPS`);
  }
  return messages;
}

export function ChatAdvancedPrivacyScreen({ chat, currentUserId, isAdmin, onBack, onSendSystemMessage }: Props) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [settings, setSettings] = useState<ChatSecuritySettings>(DEFAULT_CHAT_SECURITY_SETTINGS);
  const [savedSettings, setSavedSettings] = useState<ChatSecuritySettings>(DEFAULT_CHAT_SECURITY_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const dirtyRef = useRef(false);

  const dirty = useMemo(
    () => JSON.stringify(settings) !== JSON.stringify(savedSettings),
    [savedSettings, settings],
  );

  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void fetchChatSecuritySettings(chat.id)
      .then((next) => {
        if (active) {
          setSettings(next);
          setSavedSettings(next);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [chat.id]);

  useEffect(() => {
    let active = true;
    const subscription = subscribeToChatSecuritySettings(chat.id, (next) => {
      if (!active) return;
      setSavedSettings(next);
      if (!dirtyRef.current) {
        setSettings(next);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [chat.id]);

  const updateSetting = (key: BooleanSecuritySettingKey, value: boolean) => {
    if (!isAdmin || !currentUserId || saving) return;
    setSettings((current) => ({ ...current, [key]: value }));
  };

  const updateShutterFps = (nextValue: number) => {
    if (!isAdmin || !currentUserId || saving) return;
    const fps = Math.max(SHUTTER_FPS_MIN, Math.min(SHUTTER_FPS_MAX, Math.round(nextValue / SHUTTER_FPS_STEP) * SHUTTER_FPS_STEP));
    setSettings((current) => ({ ...current, shutter_flicker_fps: fps }));
  };

  const saveChanges = async () => {
    if (!isAdmin || !currentUserId || saving || !dirty) return;
    const previous = savedSettings;
    const next = settings;
    const systemMessages = getSecurityChangeMessages(previous, next);
    setSaving(true);
    const { error } = await saveChatSecuritySettings(chat.id, next, currentUserId);
    if (error) {
      setSettings(previous);
      setSaving(false);
      return;
    }
    setSavedSettings(next);
    for (const body of systemMessages) {
      await onSendSystemMessage?.(body);
    }
    setSaving(false);
  };

  return (
    <Screen>
      <View style={styles.container}>
        <View style={styles.header}>
          {isAdmin ? (
            <Pressable
              disabled={!dirty || saving || loading}
              onPress={() => void saveChanges()}
              style={[styles.saveButton, (!dirty || saving || loading) && styles.saveButtonDisabled]}
            >
              {saving ? <ActivityIndicator color={theme.colors.textOnAccent} size="small" /> : <Text style={[styles.saveButtonText, webSystemFont]}>שמור</Text>}
            </Pressable>
          ) : null}
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
                    disabled={!isAdmin || saving}
                    onValueChange={(value) => updateSetting(row.key, value)}
                    trackColor={{ false: theme.colors.surfaceMuted, true: theme.colors.accentSoft }}
                    thumbColor={settings[row.key] ? theme.colors.accent : theme.colors.textMuted}
                    style={webSystemFont}
                  />
                  {row.key === "shutter_flicker" ? (
                    <View style={styles.fpsControl}>
                      <Text style={[styles.fpsLabel, webSystemFont]}>FPS: {settings.shutter_flicker_fps}</Text>
                      <View style={styles.fpsButtons}>
                        <Pressable
                          disabled={!isAdmin || saving || settings.shutter_flicker_fps <= SHUTTER_FPS_MIN}
                          onPress={() => updateShutterFps(settings.shutter_flicker_fps - SHUTTER_FPS_STEP)}
                          style={[styles.fpsButton, (!isAdmin || settings.shutter_flicker_fps <= SHUTTER_FPS_MIN) && styles.fpsButtonDisabled]}
                        >
                          <Text style={[styles.fpsButtonText, webSystemFont]}>-</Text>
                        </Pressable>
                        <Pressable
                          disabled={!isAdmin || saving || settings.shutter_flicker_fps >= SHUTTER_FPS_MAX}
                          onPress={() => updateShutterFps(settings.shutter_flicker_fps + SHUTTER_FPS_STEP)}
                          style={[styles.fpsButton, (!isAdmin || settings.shutter_flicker_fps >= SHUTTER_FPS_MAX) && styles.fpsButtonDisabled]}
                        >
                          <Text style={[styles.fpsButtonText, webSystemFont]}>+</Text>
                        </Pressable>
                      </View>
                      <Text style={[styles.fpsHint, webSystemFont]}>{SHUTTER_FPS_MIN}-{SHUTTER_FPS_MAX} FPS</Text>
                    </View>
                  ) : null}
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
    saveButton: {
      minWidth: 72,
      height: 36,
      borderRadius: theme.radius.pill,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 14,
      backgroundColor: theme.colors.accent,
      marginRight: 12,
    },
    saveButtonDisabled: {
      opacity: 0.42,
    },
    saveButtonText: {
      color: theme.colors.textOnAccent,
      fontSize: 14,
      fontWeight: "800",
      textAlign: "center",
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
    fpsControl: {
      alignItems: "center",
      gap: 5,
      minWidth: 82,
    },
    fpsLabel: {
      color: theme.colors.text,
      fontSize: 13,
      fontWeight: "700",
      textAlign: "center",
    },
    fpsButtons: {
      flexDirection: "row",
      gap: 6,
    },
    fpsButton: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: theme.colors.accent,
      alignItems: "center",
      justifyContent: "center",
    },
    fpsButtonDisabled: {
      opacity: 0.35,
    },
    fpsButtonText: {
      color: theme.colors.textOnAccent,
      fontSize: 18,
      fontWeight: "800",
      lineHeight: 22,
    },
    fpsHint: {
      color: theme.colors.textMuted,
      fontSize: 11,
      textAlign: "center",
    },
  });
