import { useMemo } from "react";
import { StyleSheet, Text, View, Pressable, ScrollView } from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { useAppTheme } from "@/lib/theme";

type Props = {
  onBack: () => void;
};

export function ChatDisappearingMessagesScreen({ onBack }: Props) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <Screen>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>הודעות זמניות</Text>
          <Pressable onPress={onBack} style={styles.backButton}>
            <Feather color={theme.colors.headerIcon} name="arrow-right" size={24} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.illustration}>
              <MaterialCommunityIcons name="timer-outline" size={80} color={theme.colors.accent} />
          </View>

          <Text style={styles.mainTitle}>
            להתחיל להתכתב בהודעות זמניות
          </Text>
          
          <Text style={styles.description}>
            השימוש בהודעות זמניות יגביר את הפרטיות שלך ויאפשר שיפור באחסון המכשיר.
          </Text>

          <View style={styles.bulletList}>
             <Bullet icon="timer-sand" text="הודעות חדשות ייעלמו אצל כולם לאחר פרק הזמן שנבחר." theme={theme} />
             <Bullet icon="bookmark-outline" text="כולם יכולים לשמור הודעות או לבטל את השמירה של הודעות בצ'אט. מנהלי הקבוצה יכולים להגביל את האפשרות הזו." theme={theme} />
             <Bullet icon="hand-front-right-outline" text="קיימות דרכים אחרות לשמור הודעות." theme={theme} />
          </View>
          
          <View style={styles.actions}>
             <Pressable style={styles.buttonPrimary} onPress={onBack}>
                <Text style={styles.buttonPrimaryText}>אישור</Text>
             </Pressable>
             <Pressable style={styles.buttonSecondary} onPress={onBack}>
                <Text style={styles.buttonSecondaryText}>למידע נוסף</Text>
             </Pressable>
          </View>
        </ScrollView>
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
      padding: theme.spacing.xl,
    },
    illustration: {
      alignItems: "center",
      marginVertical: theme.spacing.xl,
    },
    mainTitle: {
      fontSize: 22,
      fontWeight: "700",
      color: theme.colors.text,
      textAlign: "center",
      marginBottom: theme.spacing.lg,
    },
    description: {
      fontSize: 15,
      color: theme.colors.text,

      marginBottom: theme.spacing.xl,
      lineHeight: 22,
    },
    bulletList: {
      gap: theme.spacing.xl,
      marginBottom: theme.spacing.xl,
    },
    bulletItem: {
      flexDirection: "row",
      justifyContent: "flex-end",
      alignItems: "flex-start",
      gap: theme.spacing.md,
    },
    bulletIcon: {
      marginLeft: 12,
    },
    bulletText: {
      flex: 1,
      fontSize: 15,
      color: theme.colors.text,

      lineHeight: 22,
    },
    actions: {
      gap: theme.spacing.md,
      marginTop: theme.spacing.xl,
    },
    buttonPrimary: {
      backgroundColor: theme.colors.accent,
      paddingVertical: 14,
      borderRadius: theme.radius.pill,
      alignItems: "center",
    },
    buttonPrimaryText: {
      color: "white",
      fontSize: 16,
      fontWeight: "700",
    },
    buttonSecondary: {
      backgroundColor: "transparent",
      paddingVertical: 14,
      borderRadius: theme.radius.pill,
      borderWidth: 1,
      borderColor: theme.colors.separator,
      alignItems: "center",
    },
    buttonSecondaryText: {
      color: theme.colors.accent,
      fontSize: 16,
      fontWeight: "700",
    },
  });
