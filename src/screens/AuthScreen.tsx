import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { AppTextInput } from "@/components/AppTextInput";
import { PrimaryButton } from "@/components/PrimaryButton";
import { Screen } from "@/components/Screen";
import { useAuth } from "@/context/AuthContext";
import { theme } from "@/lib/theme";

export function AuthScreen() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function submit() {
    setError(null);
    setNotice(null);

    if (!email.trim()) {
      setError("Email is required.");
      return;
    }

    if (!password.trim()) {
      setError("Password is required.");
      return;
    }

    if (mode === "signup" && !username.trim()) {
      setError("Username is required.");
      return;
    }

    if (mode === "signin") {
      const result = await signIn(email.trim(), password);
      setError(result.error);
      return;
    }

    const result = await signUp(email.trim(), password, username.trim().toLowerCase());
    setError(result.error);
    setNotice(result.notice);
  }

  return (
    <Screen scroll>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Privacy first</Text>
        <Text style={styles.title}>A chat app built for close friends, not accidental audiences.</Text>
        <Text style={styles.subtitle}>
          No images, no calls, no noisy extras. Just text chat, protected rooms, disappearing messages, and one-time reveals.
        </Text>
      </View>

      <View style={styles.card}>
        <View style={styles.toggleRow}>
          <PrimaryButton
            label="Sign in"
            onPress={() => {
              setMode("signin");
              setError(null);
              setNotice(null);
            }}
            tone={mode === "signin" ? "primary" : "soft"}
            style={styles.toggleButton}
          />
          <PrimaryButton
            label="Create account"
            onPress={() => {
              setMode("signup");
              setError(null);
              setNotice(null);
            }}
            tone={mode === "signup" ? "primary" : "soft"}
            style={styles.toggleButton}
          />
        </View>

        <AppTextInput label="Email" onChangeText={setEmail} value={email} placeholder="you@example.com" />
        {mode === "signup" ? (
          <AppTextInput
            label="Username"
            onChangeText={setUsername}
            value={username}
            placeholder="avi-proof-handle"
          />
        ) : null}
        <AppTextInput
          label="Password"
          onChangeText={setPassword}
          secureTextEntry
          value={password}
          placeholder="At least 8 characters"
        />

        {notice ? <Text style={styles.notice}>{notice}</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <PrimaryButton
          label={mode === "signin" ? "Enter chats" : "Create secure account"}
          onPress={submit}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    gap: theme.spacing.sm,
    paddingTop: theme.spacing.xl,
  },
  eyebrow: {
    color: theme.colors.accent,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  title: {
    color: theme.colors.text,
    fontSize: 34,
    fontWeight: "800",
    lineHeight: 38,
  },
  subtitle: {
    color: theme.colors.textMuted,
    fontSize: 16,
    lineHeight: 23,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    gap: theme.spacing.md,
    padding: theme.spacing.md,
  },
  toggleRow: {
    flexDirection: "row",
    gap: theme.spacing.sm,
  },
  toggleButton: {
    flex: 1,
  },
  notice: {
    color: theme.colors.accent,
    fontWeight: "600",
    lineHeight: 22,
  },
  error: {
    color: theme.colors.danger,
    fontWeight: "600",
    lineHeight: 22,
  },
});
