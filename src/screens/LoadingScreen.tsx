import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { theme } from "@/lib/theme";

export function LoadingScreen() {
  return (
    <Screen>
      <View style={styles.container}>
        <View style={styles.logoWrap}>
          <MaterialCommunityIcons color={theme.colors.textOnAccent} name="message-text" size={34} />
        </View>
        <Text style={styles.title}>Private Chat</Text>
        <Text style={styles.subtitle}>Syncing your conversations...</Text>
        <ActivityIndicator color={theme.colors.accentStrong} size="large" />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
  },
  logoWrap: {
    width: 84,
    height: 84,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    color: theme.colors.text,
    fontSize: 28,
    fontWeight: "800",
  },
  subtitle: {
    color: theme.colors.textMuted,
    fontSize: 16,
    textAlign: "center",
  },
});
