import { Pressable, StyleSheet, Text, ViewStyle } from "react-native";
import { useAppTheme } from "@/lib/theme";
import { webNoOutline } from "@/lib/webStyles";

type Props = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  tone?: "primary" | "soft" | "danger";
  style?: ViewStyle;
};

export function PrimaryButton({ label, onPress, disabled, tone = "primary", style }: Props) {
  const theme = useAppTheme();
  const styles = createStyles(theme);

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        tone === "primary" ? styles.primary : styles.soft,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        webNoOutline,
        style,
      ]}
    >
      <Text style={[
        styles.label, 
        tone === "primary" ? styles.primaryLabel : 
        tone === "danger" ? styles.dangerLabel : 
        styles.softLabel
      ]}>{label}</Text>
    </Pressable>
  );
}

const createStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    button: {
      minHeight: 48,
      borderRadius: theme.radius.pill,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 18,
      paddingVertical: 12,
    },
    primary: {
      backgroundColor: theme.colors.accentStrong,
    },
    soft: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.border,
      borderWidth: 1,
    },
    danger: {
      backgroundColor: theme.colors.danger,
    },
    disabled: {
      opacity: 0.45,
    },
    pressed: {
      opacity: 0.88,
    },
    label: {
      fontSize: 15,
      fontWeight: "700",
    },
    primaryLabel: {
      color: theme.colors.textOnAccent,
    },
    softLabel: {
      color: theme.colors.text,
    },
    dangerLabel: {
      color: "#ffffff",
    },
  });
