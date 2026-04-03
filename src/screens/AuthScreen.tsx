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
  const [identifier, setIdentifier] = useState(""); // Used for login (email or username)
  const [email, setEmail] = useState("");           // Used for signup
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function submit() {
    setError(null);
    setNotice(null);

    if (mode === "signin") {
      if (!identifier.trim()) {
        setError("נדרש אימייל או שם משתמש.");
        return;
      }
      if (!password.trim()) {
        setError("נדרשת סיסמה.");
        return;
      }
      const result = await signIn(identifier.trim(), password);
      setError(result.error);
      return;
    }

    if (mode === "signup") {
      if (!email.trim()) {
        setError("נדרש אימייל להרשמה.");
        return;
      }
      if (!username.trim()) {
        setError("נדרש שם משתמש להרשמה.");
        return;
      }
      if (!password.trim()) {
        setError("נדרשת סיסמה.");
        return;
      }
      const result = await signUp(email.trim(), password, username.trim().toLowerCase());
      setError(result.error);
      setNotice(result.notice);
    }
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
            הודעות פרטיות עם שמות משתמש במקום מספרי טלפון, עם כלי פרטיות וטקסט בלבד.
          </Text>
        </View>

        <View style={styles.card}>
          <View style={styles.segmentedRow}>
            <PrimaryButton
              label="התחברות"
              onPress={() => {
                setMode("signin");
                setError(null);
                setNotice(null);
              }}
              tone={mode === "signin" ? "primary" : "soft"}
              style={styles.segmentButton}
            />
            <PrimaryButton
              label="הרשמה"
              onPress={() => {
                setMode("signup");
                setError(null);
                setNotice(null);
              }}
              tone={mode === "signup" ? "primary" : "soft"}
              style={styles.segmentButton}
            />
          </View>

          {mode === "signin" ? (
            <AppTextInput 
              label="אימייל או שם משתמש" 
              onChangeText={setIdentifier} 
              value={identifier} 
              placeholder="you@example.com / username" 
              autoCapitalize="none"
            />
          ) : (
            <>
              <AppTextInput 
                label="כתובת אימייל" 
                onChangeText={setEmail} 
                value={email} 
                placeholder="you@example.com" 
                autoCapitalize="none"
              />
              <AppTextInput 
                label="שם משתמש" 
                onChangeText={setUsername} 
                value={username} 
                placeholder="secure_user_01" 
                autoCapitalize="none"
              />
            </>
          )}

          <AppTextInput
            label="סיסמה"
            onChangeText={setPassword}
            secureTextEntry
            value={password}
            placeholder="8 תווים לפחות"
          />

          {notice ? <Text style={styles.notice}>{notice}</Text> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}

          <PrimaryButton label={mode === "signin" ? "כניסה לצ'אטים" : "יצירת חשבון"} onPress={submit} />
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
