import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { AppTextInput } from "@/components/AppTextInput";
import { PrimaryButton } from "@/components/PrimaryButton";
import { Screen } from "@/components/Screen";
import { useAuth } from "@/context/AuthContext";
import { useAppTheme } from "@/lib/theme";

export function AuthScreen() {
  const theme = useAppTheme();
  const styles = createStyles(theme);
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
      <View style={styles.container}>
        <View style={styles.hero}>
          <View style={styles.logoWrap}>
            <MaterialCommunityIcons color={theme.colors.textOnAccent} name="shield-lock" size={32} />
          </View>
          <Text style={styles.title}>Secure</Text>
          <Text style={styles.subtitle}>
            Private messaging with usernames instead of phone numbers, with text only and privacy-first tools.
          </Text>
        </View>

        <View style={styles.card}>
          <View style={styles.segmentedRow}>
            <PrimaryButton
              label="Log in"
              onPress={() => {
                setMode("signin");
                setError(null);
                setNotice(null);
              }}
              tone={mode === "signin" ? "primary" : "soft"}
              style={styles.segmentButton}
            />
            <PrimaryButton
              label="Sign up"
              onPress={() => {
                setMode("signup");
                setError(null);
                setNotice(null);
              }}
              tone={mode === "signup" ? "primary" : "soft"}
              style={styles.segmentButton}
            />
          </View>

          <AppTextInput label="Email address" onChangeText={setEmail} value={email} placeholder="you@example.com" />
          {mode === "signup" ? (
            <AppTextInput label="Username" onChangeText={setUsername} value={username} placeholder="secure_user_01" />
          ) : null}
          <AppTextInput
            label="Password"
            onChangeText={setPassword}
            secureTextEntry
            value={password}
            placeholder="At least 8 characters"
          />

          <View style={styles.helperCard}>
            <Text style={styles.helperTitle}>How Secure is different</Text>
            <Text style={styles.helperText}>You log in with email, password, and username.</Text>
            <Text style={styles.helperText}>Images, videos, files, and calls are intentionally disabled.</Text>
          </View>

          {notice ? <Text style={styles.notice}>{notice}</Text> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}

          <PrimaryButton label={mode === "signin" ? "Enter chats" : "Create account"} onPress={submit} />
        </View>
      </View>
    </Screen>
  );
}

const createStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    container: {
      flexGrow: 1,
      justifyContent: "center",
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.xl,
      gap: theme.spacing.lg,
    },
    hero: {
      alignItems: "center",
      gap: theme.spacing.sm,
    },
    logoWrap: {
      width: 88,
      height: 88,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.accent,
      alignItems: "center",
      justifyContent: "center",
    },
    title: {
      color: theme.colors.text,
      fontSize: 30,
      fontWeight: "800",
    },
    subtitle: {
      color: theme.colors.textMuted,
      fontSize: 15,
      lineHeight: 22,
      textAlign: "center",
      maxWidth: 320,
    },
    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.xl,
      padding: theme.spacing.lg,
      gap: theme.spacing.md,
    },
    segmentedRow: {
      flexDirection: "row",
      gap: theme.spacing.sm,
    },
    segmentButton: {
      flex: 1,
    },
    helperCard: {
      backgroundColor: theme.colors.surfaceAlt,
      borderRadius: theme.radius.lg,
      padding: theme.spacing.md,
      gap: 6,
    },
    helperTitle: {
      color: theme.colors.text,
      fontSize: 15,
      fontWeight: "700",
    },
    helperText: {
      color: theme.colors.textMuted,
      lineHeight: 20,
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
