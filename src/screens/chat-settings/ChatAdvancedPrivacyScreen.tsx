import { useMemo } from "react";
import { StyleSheet, Text, View, Pressable, Switch } from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { useAppTheme } from "@/lib/theme";

type Props = {
  onBack: () => void;
};

export function ChatAdvancedPrivacyScreen({ onBack }: Props) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <Screen>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>הגדרה מתקדמת של פרטיות בצ'אט</Text>
          <Pressable onPress={onBack} style={styles.backButton}>
            <Feather color={theme.colors.headerIcon} name="arrow-right" size={24} />
          </Pressable>
        </View>

        <View style={styles.content}>
          <View style={styles.banner}>
            <MaterialCommunityIcons name="information-outline" size={24} color={theme.colors.accent} />
            <View style={styles.bannerCopy}>
              <Text style={styles.bannerText}>כל הצ'אטים הם פרטיים כברירת מחדל, גם אם הפעלת את ההגדרה הזאת וגם אם לא.</Text>
              <Text style={styles.bannerLink}>מידע נוסף</Text>
            </View>
          </View>

          <View style={styles.illustration}>
              <MaterialCommunityIcons name="shield-lock-outline" size={80} color={theme.colors.accent} />
          </View>

          <Text style={styles.mainDescription}>
            יש לך אפשרות להגביל את אופן השיתוף של הודעות ומדיה בצ'אט הזה מחוץ לאפליקציה
          </Text>
          
          <Text style={styles.subDescription}>
            אם בחרת להפעיל את ההגדרה המתקדמת של פרטיות, אנשים בצ'אט הזה:
          </Text>

          <View style={styles.bulletList}>
             <Bullet icon="download-off-outline" text="לא יכולים לשמור מדיה בגלריית המכשיר באופן אוטומטי" theme={theme} />
             <Bullet icon="file-export-outline" text="לא יכולים לייצא את הצ'אט" theme={theme} />
          </View>
          
          <View style={styles.switchRow}>
            <View style={styles.switchCopy}>
              <Text style={styles.switchTitle}>הגדרה מתקדמת של פרטיות בצ'אט</Text>
            </View>
            <Switch value={false} disabled />
          </View>
        </View>
      </View>
    </Screen>
  );
}

function Bullet({ icon, text, theme }: { icon: any; text: string; theme: any }) {
  const styles = useMemo(() => createStyles(theme), [theme]);
  return (
    <View style={styles.bulletItem}>
      <Text style={styles.bulletText}>{text}</Text>
      <MaterialCommunityIcons name={icon} size={24} color={theme.colors.textMuted} style={styles.bulletIcon} />
    </View>
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
      padding: theme.spacing.md,
    },
    banner: {
      backgroundColor: theme.colors.surfaceMuted,
      borderRadius: theme.radius.md,
      padding: theme.spacing.md,
      flexDirection: "row",
      gap: theme.spacing.md,
      marginBottom: theme.spacing.xl,
    },
    bannerCopy: {
      flex: 1,
    },
    bannerText: {
      fontSize: 14,
      color: theme.colors.text,

    },
    bannerLink: {
      fontSize: 14,
      color: theme.colors.accent,

      fontWeight: "700",
      marginTop: 4,
    },
    illustration: {
      alignItems: "center",
      marginVertical: theme.spacing.xl,
    },
    mainDescription: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.colors.text,
      textAlign: "center",
      marginBottom: theme.spacing.lg,
      lineHeight: 26,
    },
    subDescription: {
      fontSize: 15,
      color: theme.colors.text,

      marginBottom: theme.spacing.lg,
    },
    bulletList: {
      gap: theme.spacing.lg,
      marginBottom: theme.spacing.xl,
      borderColor: theme.colors.separator,
      borderBottomWidth: 1,
      paddingBottom: theme.spacing.xl,
    },
    bulletItem: {
      flexDirection: "row",
      justifyContent: "flex-end",
      alignItems: "center",
      gap: theme.spacing.md,
    },
    bulletIcon: {
      marginLeft: 8,
    },
    bulletText: {
      flex: 1,
      fontSize: 15,
      color: theme.colors.text,

    },
    switchRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: theme.spacing.md,
    },
    switchCopy: {
      flex: 1,
    },
    switchTitle: {
      fontSize: 16,
      color: theme.colors.text,

      fontWeight: "600",
    },
  });
