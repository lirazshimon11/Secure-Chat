import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Screen } from "@/components/Screen";
import { theme } from "@/lib/theme";

export function LoadingScreen() {
  return (
    <Screen>
      <View style={styles.container}>
        <Text style={styles.title}>Private Chat</Text>
        <Text style={styles.subtitle}>Opening your secure room...</Text>
        <ActivityIndicator color={theme.colors.accent} size="large" />
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
  },
  title: {
    color: theme.colors.text,
    fontSize: 30,
    fontWeight: "800",
  },
  subtitle: {
    color: theme.colors.textMuted,
    fontSize: 16,
  },
});
