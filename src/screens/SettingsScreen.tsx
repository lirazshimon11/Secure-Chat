import { useEffect, useState } from "react";
import * as Clipboard from "expo-clipboard";
import { Alert, Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { PrimaryButton } from "@/components/PrimaryButton";
import { Screen } from "@/components/Screen";
import { useAuth } from "@/context/AuthContext";
import { useAppTheme } from "@/lib/theme";
import { supabase } from "@/lib/supabase";
import { AdminScreen } from "./AdminScreen";

type Props = {
  onBack: () => void;
};

export function SettingsScreen({ onBack }: Props) {
  const theme = useAppTheme();
  const styles = createStyles(theme);
  const { profile, refreshProfile, signOut } = useAuth();
  const [activeSubScreen, setActiveSubScreen] = useState<"admin" | null>(null);
  const [isInRelationship, setIsInRelationship] = useState(
    profile?.is_in_relationship ?? false,
  );
  const [savingRelationship, setSavingRelationship] = useState(false);

  // Keep local state in sync if profile changes (e.g. after reload)
  useEffect(() => {
    setIsInRelationship(profile?.is_in_relationship ?? false);
  }, [profile?.is_in_relationship]);

  const handleRelationshipToggle = async (value: boolean) => {
    if (!profile?.id || savingRelationship) return;
    setSavingRelationship(true);
    setIsInRelationship(value);
    const { error } = await supabase
      .from("profiles")
      .update({ is_in_relationship: value })
      .eq("id", profile.id);
    if (error) {
      Alert.alert("שגיאה", "לא ניתן לעדכן את המצב. נסה שוב.");
      setIsInRelationship(!value); // rollback
    } else {
      await refreshProfile();
    }
    setSavingRelationship(false);
  };

  if (activeSubScreen === "admin") {
    return <AdminScreen onBack={() => setActiveSubScreen(null)} />;
  }

  return (
    <Screen scroll>
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.backButton}>
          <Feather color={theme.colors.headerIcon} name="arrow-right" size={24} />
        </Pressable>
        <Text style={styles.title}>הגדרות</Text>
      </View>

      <View style={styles.body}>
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{profile?.username?.slice(0, 1).toUpperCase() ?? "U"}</Text>
          </View>
          <View style={styles.profileCopy}>
            <Text style={styles.handle}>@{profile?.username ?? "לא ידוע"}</Text>
            <Text style={styles.email}>{profile?.email ?? "אין אימייל"}</Text>
          </View>
        </View>

        {/* Relationship status toggle */}
        <View style={styles.relationshipCard}>
          <View style={styles.relationshipIconWrap}>
            <MaterialCommunityIcons
              color={isInRelationship ? "#E91E8C" : theme.colors.textMuted}
              name={isInRelationship ? "heart" : "heart-outline"}
              size={24}
            />
          </View>
          <View style={styles.relationshipCopy}>
            <Text style={styles.relationshipTitle}>מצב זוגיות</Text>
            <Text style={styles.relationshipSubtitle}>
              {isInRelationship ? "בזוגיות — ניתן להגן עלייך בקבוצות" : "רווק/ה — ברירת מחדל"}
            </Text>
          </View>
          <Switch
            disabled={savingRelationship}
            onValueChange={handleRelationshipToggle}
            thumbColor={isInRelationship ? "#E91E8C" : theme.colors.textMuted}
            trackColor={{ false: theme.colors.surfaceMuted, true: "#F8BBD9" }}
            value={isInRelationship}
          />
        </View>

        <View style={styles.listCard}>
          <SettingRow icon="account-outline" subtitle="הזהות שלך המבוססת על שם משתמש" title="פרופיל" />
          <SettingRow icon="shield-lock-outline" subtitle="הודעות נעלמות וצפייה חד-פעמית" title="פרטיות" />
          <SettingRow icon="message-text-outline" subtitle="רק הודעות טקסט מותרות באפליקציה" title="צ'אטים" />
          {profile?.username === "admin" && (
            <Pressable onPress={() => setActiveSubScreen("admin")}>
              <SettingRow icon="shield-crown-outline" subtitle="ניהול משתמשים והרשאות" title="הרשאות מנהל" />
            </Pressable>
          )}
        </View>

        <View style={styles.actions}>
          <PrimaryButton
            label="העתקת שם משתמש"
            onPress={async () => {
              await Clipboard.setStringAsync(profile?.username ?? "");
              Alert.alert("הועתק", "שם המשתמש הועתק ללוח.");
            }}
            tone="soft"
          />
          <PrimaryButton label="חזר לצ'אטים" onPress={onBack} tone="soft" />
          <View style={{ marginTop: 8 }}>
            <PrimaryButton
              label="התנתקות מהמערכת"
              onPress={() => void signOut()}
              style={{ backgroundColor: 'red' }}
            />
          </View>
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
      color: theme.colors.headerText,
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
    relationshipCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.lg,
      padding: theme.spacing.md,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    relationshipIconWrap: {
      width: 36,
      alignItems: "center",
    },
    relationshipCopy: {
      flex: 1,
    },
    relationshipTitle: {
      color: theme.colors.text,
      fontSize: 16,
      fontWeight: "700",
    },
    relationshipSubtitle: {
      color: theme.colors.textMuted,
      fontSize: 13,
      marginTop: 2,
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
