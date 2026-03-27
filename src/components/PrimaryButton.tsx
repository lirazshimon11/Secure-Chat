import { Pressable, StyleSheet, Text, ViewStyle } from "react-native";
import { theme } from "@/lib/theme";

type Props = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  tone?: "primary" | "soft";
  style?: ViewStyle;
};

export function PrimaryButton({ label, onPress, disabled, tone = "primary", style }: Props) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.button,
        tone === "primary" ? styles.primary : styles.soft,
        disabled && styles.disabled,
        style,
      ]}
    >
      <Text style={[styles.label, tone === "primary" ? styles.primaryLabel : styles.softLabel]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 14,
    alignItems: "center",
  },
  primary: {
    backgroundColor: theme.colors.accent,
  },
  soft: {
    backgroundColor: theme.colors.surfaceStrong,
  },
  disabled: {
    opacity: 0.45,
  },
  label: {
    fontSize: 16,
    fontWeight: "700",
  },
  primaryLabel: {
    color: "#ffffff",
  },
  softLabel: {
    color: theme.colors.text,
  },
});
