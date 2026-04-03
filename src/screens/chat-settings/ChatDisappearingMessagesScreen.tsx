import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { useAppTheme } from "@/lib/theme";

type TimerOption = "24h" | "7d" | "90d" | "off";

type Props = {
  onBack: () => void;
};

const TIMER_OPTIONS: { id: TimerOption; label: string }[] = [
  { id: "24h", label: "24 שעות" },
  { id: "7d", label: "7 ימים" },
  { id: "90d", label: "90 ימים" },
  { id: "off", label: "כבוי" },
];

export function ChatDisappearingMessagesScreen({ onBack }: Props) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [selected, setSelected] = useState<TimerOption>("off");

  return (
    <Screen>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>הודעות זמניות</Text>
          <Pressable onPress={onBack} style={styles.backButton}>
            <Feather color={theme.colors.headerIcon} name="arrow-right" size={24} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Illustration */}
          <View style={styles.illustration}>
            <View style={styles.illustrationCircle}>
              <MaterialCommunityIcons name="timer-sand" size={54} color={theme.colors.accent} />
            </View>
          </View>

          {/* Description text */}
          <Text style={styles.descriptionText}>
            הגדרת הודעות זמניות בצ'אט הזה להגברת הפרטיות וכולות האחסון. הודעות חדשות ייעלמו מכאן, מהצ'אט הזה לאחר פרק הזמן שנבחר, למעט הודעות שיבחרו לשמירה. מנהלי הקבוצה הם שקובעים מי יכול לשנות את ההגדרה הזו.{" "}
            <Text style={styles.learnMoreLink}>למידע נוסף</Text>
          </Text>

          {/* Timer section label */}
          <Text style={styles.timerLabel}>טיימר להודעות זמניות</Text>

          {/* Timer radio options */}
          <View style={styles.optionsList}>
            {TIMER_OPTIONS.map((opt) => (
              <Pressable
                key={opt.id}
                style={styles.optionRow}
                onPress={() => setSelected(opt.id)}
              >
                <Text style={styles.optionLabel}>{opt.label}</Text>
                <View style={[styles.radioOuter, selected === opt.id && styles.radioOuterActive]}>
                  {selected === opt.id && <View style={styles.radioInner} />}
                </View>
              </Pressable>
            ))}
          </View>

          {/* Default timer row */}
          <View style={styles.thickSeparator} />
          <Pressable style={styles.defaultTimerRow}>
            <View style={styles.defaultTimerIcon}>
              <MaterialCommunityIcons name="timer-cog-outline" size={26} color={theme.colors.textMuted} />
            </View>
            <View style={styles.defaultTimerCopy}>
              <Text style={styles.defaultTimerTitle}>טיימר ברירת מחדל להודעות זמניות</Text>
              <Text style={styles.defaultTimerSub}>אפשר להתחיל צ'אטים חדשים עם הודעות זמניות</Text>
            </View>
          </Pressable>
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
      fontWeight: "800",
      flex: 1,
    },
    content: {
      paddingBottom: 40,
    },
    illustration: {
      alignItems: "center",
      paddingTop: 36,
      paddingBottom: 24,
    },
    illustrationCircle: {
      width: 110,
      height: 110,
      borderRadius: 55,
      backgroundColor: `${theme.colors.accent}22`,
      alignItems: "center",
      justifyContent: "center",
    },
    descriptionText: {
      fontSize: 14,
      color: theme.colors.textMuted,
      textAlign: "right",
      lineHeight: 22,
      paddingHorizontal: theme.spacing.lg,
      marginBottom: theme.spacing.xl,
    },
    learnMoreLink: {
      color: theme.colors.accent,
    },
    timerLabel: {
      fontSize: 13,
      color: theme.colors.textMuted,
      fontWeight: "600",
      paddingHorizontal: theme.spacing.lg,
      marginBottom: 6,
    },
    optionsList: {
      backgroundColor: theme.colors.surface,
    },
    optionRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: 18,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.separator,
    },
    optionLabel: {
      fontSize: 17,
      color: theme.colors.text,
      fontWeight: "600",
    },
    radioOuter: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 2,
      borderColor: theme.colors.textMuted,
      alignItems: "center",
      justifyContent: "center",
    },
    radioOuterActive: {
      borderColor: theme.colors.accent,
    },
    radioInner: {
      width: 11,
      height: 11,
      borderRadius: 6,
      backgroundColor: theme.colors.accent,
    },
    thickSeparator: {
      height: 8,
      backgroundColor: theme.colors.separator,
      marginBottom: 2,
    },
    defaultTimerRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: 18,
      gap: theme.spacing.md,
    },
    defaultTimerIcon: {
      width: 40,
      height: 40,
      alignItems: "center",
      justifyContent: "center",
    },
    defaultTimerCopy: {
      flex: 1,
    },
    defaultTimerTitle: {
      fontSize: 16,
      color: theme.colors.text,
      fontWeight: "600",
    },
    defaultTimerSub: {
      fontSize: 13,
      color: theme.colors.textMuted,
      marginTop: 2,
    },
  });
