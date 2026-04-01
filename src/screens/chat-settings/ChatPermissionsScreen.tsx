import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Switch, Text, View, Pressable } from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { useAppTheme } from "@/lib/theme";
import { Chat } from "@/lib/types";

type Props = {
  chat: Chat;
  onBack: () => void;
};

export function ChatPermissionsScreen({ chat, onBack }: Props) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [editGroupInfo, setEditGroupInfo] = useState(true);
  const [sendMessages, setSendMessages] = useState(true);
  const [addMembers, setAddMembers] = useState(false);
  const [approveNew, setApproveNew] = useState(false);

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.backBtn}>
          <Feather name="arrow-right" size={24} color={theme.colors.headerIcon} />
        </Pressable>
        <View style={styles.headerTextWrap}>
          <Text style={styles.headerTitle}>הרשאות בקבוצה</Text>
          <Text style={styles.headerSub}>{chat.title}</Text>
        </View>
      </View>

      <ScrollView>
        <Text style={styles.sectionLabel}>פעולות שמינות לחברים:</Text>

        <PermissionRow
          icon="pencil-outline"
          title="עריכת הגדרות הקבוצה"
          subtitle={"ההגדרה הזו כוללת את השם,\nהתמונה והתיאור, הטיימר להודעות זמניות, הגדרה מתקדמת של פרטיות בצ'אט וגם את האפשרות להצמיד הודעות, לשמור אותן ולבטל את השמירה שלהן."}
          value={editGroupInfo}
          onToggle={setEditGroupInfo}
          theme={theme}
        />

        <PermissionRow
          icon="message-text-outline"
          title="שליחת הודעות חדשות"
          value={sendMessages}
          onToggle={setSendMessages}
          theme={theme}
        />

        <PermissionRow
          icon="account-plus-outline"
          title="צירוף חברים אחרים"
          value={addMembers}
          onToggle={setAddMembers}
          theme={theme}
        />

        <Text style={styles.sectionLabel}>פעולות שמינות למנהלים:</Text>

        <PermissionRow
          icon="account-check-outline"
          title="אישור חברים חדשים"
          subtitle={"כשההגדרה הזו מופעלת,\nהמנהלים חייבים לאשר את כל מי שרוצה להצטרף לקבוצה הזו. למידע נוסף"}
          value={approveNew}
          onToggle={setApproveNew}
          theme={theme}
        />

        <Text style={styles.sectionLabel}>מנהלי הקבוצה</Text>

        <Pressable style={styles.row}>
          <MaterialCommunityIcons name="account-cog-outline" size={24} color={theme.colors.textMuted} style={styles.rowIcon} />
          <Text style={styles.rowTitle}>עריכת מנהלי הקבוצה</Text>
          <Text style={styles.rowSub}>את/ה</Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

function PermissionRow({ icon, title, subtitle, value, onToggle, theme }: any) {
  const styles = useMemo(() => createStyles(theme), [theme]);
  return (
    <View style={styles.permRow}>
      <View style={styles.permLeft}>
        <Switch
          value={value}
          onValueChange={onToggle}
          trackColor={{ true: theme.colors.accent }}
          thumbColor="#fff"
        />
      </View>
      <View style={styles.permCopy}>
        <Text style={styles.rowTitle}>{title}</Text>
        {subtitle ? <Text style={styles.permSub}>{subtitle}</Text> : null}
      </View>
      <MaterialCommunityIcons name={icon} size={26} color={theme.colors.textMuted} style={styles.rowIcon} />
    </View>
  );
}

const createStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    header: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.colors.header,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      gap: theme.spacing.md,
    },
    backBtn: {
      padding: theme.spacing.xs,
    },
    headerTextWrap: {
      flex: 1,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.colors.headerText,
    },
    headerSub: {
      fontSize: 13,
      color: theme.colors.headerText,
      opacity: 0.7,
    },
    sectionLabel: {
      fontSize: 13,
      color: theme.colors.accent,
      fontWeight: "600",
      paddingHorizontal: theme.spacing.lg,
      paddingTop: theme.spacing.lg,
      paddingBottom: theme.spacing.sm,
    },
    permRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: 14,
      gap: theme.spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.separator,
    },
    permLeft: {
      paddingTop: 2,
    },
    permCopy: {
      flex: 1,
    },
    rowTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.text,
    },
    permSub: {
      fontSize: 13,
      color: theme.colors.textMuted,
      marginTop: 4,
      lineHeight: 18,
    },
    rowIcon: {
      marginTop: 2,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: 14,
      gap: theme.spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.separator,
    },
    rowSub: {
      fontSize: 13,
      color: theme.colors.textMuted,
    },
  });
