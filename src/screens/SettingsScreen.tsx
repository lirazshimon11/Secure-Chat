import * as Clipboard from "expo-clipboard";
import { Alert, StyleSheet, Text, View } from "react-native";
import { PrimaryButton } from "@/components/PrimaryButton";
import { Screen } from "@/components/Screen";
import { useAuth } from "@/context/AuthContext";
import { theme } from "@/lib/theme";

type Props = {
  onBack: () => void;
};

export function SettingsScreen({ onBack }: Props) {
  const { profile, signOut } = useAuth();

  return (
    <Screen scroll>
      <View style={styles.card}>
        <Text style={styles.title}>Privacy settings</Text>
        <Text style={styles.copy}>
          This version is text-only on purpose. No images, no video, no call metadata, and no link previews.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.section}>Your invite handle</Text>
        <Text style={styles.handle}>@{profile?.username ?? "unknown"}</Text>
        <PrimaryButton
          label="Copy username"
          onPress={async () => {
            await Clipboard.setStringAsync(profile?.username ?? "");
            Alert.alert("Copied", "Your username was copied to the clipboard.");
          }}
          tone="soft"
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.section}>Security reminders</Text>
        <Text style={styles.copy}>View-once messages disappear after opening, but screenshots and a second phone camera can never be fully prevented.</Text>
        <Text style={styles.copy}>Use disappearing messages for sensitive context and keep membership tight.</Text>
      </View>

      <PrimaryButton label="Back to chats" onPress={onBack} tone="soft" />
      <PrimaryButton label="Sign out" onPress={() => void signOut()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
  },
  title: {
    color: theme.colors.text,
    fontSize: 24,
    fontWeight: "800",
  },
  section: {
    color: theme.colors.text,
    fontSize: 17,
    fontWeight: "800",
  },
  handle: {
    color: theme.colors.accent,
    fontSize: 28,
    fontWeight: "800",
  },
  copy: {
    color: theme.colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
  },
});
