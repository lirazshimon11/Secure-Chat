import React from "react";
import { Modal, Pressable, StyleSheet, Text, View, Dimensions } from "react-native";
import { useAppTheme } from "@/lib/theme";

type Props = {
  visible: boolean;
  title: string;
  onClose: () => void;
  onConfirm: () => void;
};

export function SimpleConfirmModal({ visible, title, onClose, onConfirm }: Props) {
  const theme = useAppTheme();
  const styles = createStyles(theme);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          
          <View style={styles.actions}>
             <Pressable onPress={onClose} style={styles.button}>
               <Text style={styles.buttonText}>ביטול</Text>
             </Pressable>
             <Pressable onPress={() => { onConfirm(); onClose(); }} style={styles.button}>
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
      backgroundColor: "rgba(0,0,0,0.5)",
      justifyContent: "center",
      alignItems: "center",
      padding: 40,
    },
    card: {
      backgroundColor: theme.colors.surface,
      width: "100%",
      borderRadius: 28,
      padding: 24,
      elevation: 5,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
    },
    title: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.colors.text,
      marginBottom: 32,
      textAlign: "right",
      lineHeight: 24,
    },
    actions: {
      flexDirection: "row",
      justifyContent: "flex-start",
      gap: 32,
    },
    button: {
      paddingVertical: 8,
    },
    buttonText: {
      color: theme.colors.accent,
      fontSize: 15,
      fontWeight: "700",
    },
    buttonTextPrimary: {
      color: theme.colors.accent,
      fontSize: 15,
      fontWeight: "700",
    },
  });
