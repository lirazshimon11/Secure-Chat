import { StyleSheet, Text, TextInput, View } from "react-native";
import { useAppTheme } from "@/lib/theme";
import { webNoOutline } from "@/lib/webStyles";

type Props = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  secureTextEntry?: boolean;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  multiline?: boolean;
  placeholder?: string;
};

export function AppTextInput({
  label,
  value,
  onChangeText,
  secureTextEntry,
  autoCapitalize = "none",
  multiline,
  placeholder,
}: Props) {
  const theme = useAppTheme();
  const styles = createStyles(theme);

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        autoCapitalize={autoCapitalize}
        multiline={multiline}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textMuted}
        secureTextEntry={secureTextEntry}
        style={[styles.input, multiline && styles.multiline, webNoOutline]}
        value={value}
      />
    </View>
  );
}

const createStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    wrapper: {
      gap: theme.spacing.xs,
    },
    label: {
      color: theme.colors.textMuted,
      fontSize: 13,
      fontWeight: "600",
      marginLeft: 2,
    },
    input: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.border,
      borderWidth: 1,
      borderRadius: theme.radius.md,
      color: theme.colors.text,
      fontSize: 16,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: 13,
    },
    multiline: {
      minHeight: 110,
      textAlignVertical: "top",
    },
  });
