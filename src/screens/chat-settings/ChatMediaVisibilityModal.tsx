import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAppTheme } from "@/lib/theme";

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function ChatMediaVisibilityModal({ visible, onClose }: Props) {
  const theme = useAppTheme();
  const styles = createStyles(theme);

  const handleSelect = () => {
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>להציג מדיה שהורדת לאחרונה מהצ'אט הזה בגלריית המכשיר?</Text>
          
          <Pressable style={styles.option} onPress={handleSelect}>
             <MaterialCommunityIcons name="radiobox-marked" size={24} color={theme.colors.accent} />
             <Text style={styles.optionText}>ברירת מחדל (כן)</Text>
          </Pressable>
          <Pressable style={styles.option} onPress={handleSelect}>
             <MaterialCommunityIcons name="radiobox-blank" size={24} color={theme.colors.textMuted} />
             <Text style={styles.optionText}>כן</Text>
          </Pressable>
          <Pressable style={styles.option} onPress={handleSelect}>
             <MaterialCommunityIcons name="radiobox-blank" size={24} color={theme.colors.textMuted} />
             <Text style={styles.optionText}>לא</Text>
          </Pressable>

          <View style={styles.actions}>
             <Pressable onPress={onClose} style={styles.button}>
               <Text style={styles.buttonText}>ביטול</Text>
             </Pressable>
             <Pressable onPress={onClose} style={styles.button}>
               <Text style={styles.buttonTextPrimary}>אישור</Text>
             </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: theme.colors.overlay,
      justifyContent: "center",
      alignItems: "center",
      padding: theme.spacing.lg,
    },
    card: {
      backgroundColor: theme.colors.surface,
      width: "100%",
      borderRadius: theme.radius.md,
      padding: theme.spacing.lg,
      paddingBottom: theme.spacing.md,
    },
    title: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.colors.text,
      marginBottom: theme.spacing.xl,
      textAlign: "right",
    },
    option: {
      flexDirection: "row-reverse",
      alignItems: "center",
      marginBottom: theme.spacing.lg,
      gap: theme.spacing.md,
    },
    optionText: {
      flex: 1,
      fontSize: 16,
      color: theme.colors.text,
      textAlign: "right",
    },
    actions: {
      flexDirection: "row",
      justifyContent: "flex-start",
      marginTop: theme.spacing.sm,
      gap: theme.spacing.xl,
    },
    button: {
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
    },
    buttonText: {
      color: theme.colors.textMuted,
      fontSize: 16,
      fontWeight: "600",
    },
    buttonTextPrimary: {
      color: theme.colors.accent,
      fontSize: 16,
      fontWeight: "600",
    },
  });
