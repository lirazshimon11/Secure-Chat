import { useRef, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
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

  const usernameRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  const [segmentedWidth, setSegmentedWidth] = useState(0);

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
            <MaterialCommunityIcons color={theme.colors.textOnAccent} name="shield-lock" size={38} />
          </View>
          <Text style={styles.title}>SecureApp</Text>
          <Text style={styles.subtitle}>
            שיחות פרטיות ומאובטחות מבוססות שמות משתמש בלבד.
          </Text>
        </View>

        <View style={styles.card}>
          <View 
            style={styles.segmentedContainer}
            onLayout={(e) => setSegmentedWidth(e.nativeEvent.layout.width)}
          >
            <View style={[
              styles.segmentedActiveBg, 
              { 
                width: (segmentedWidth - 12) / 2,
                transform: [{ translateX: mode === "signin" ? 0 : (segmentedWidth - 12) / 2 }] 
              }
            ]} />
            <Text 
              onPress={() => {
                setMode("signin");
                setError(null);
                setNotice(null);
              }}
              style={[styles.segmentedText, mode === "signin" && styles.segmentedTextActive]}
            >
              התחברות
            </Text>
            <Text 
              onPress={() => {
                setMode("signup");
                setError(null);
                setNotice(null);
              }}
              style={[styles.segmentedText, mode === "signup" && styles.segmentedTextActive]}
            >
              הרשמה
            </Text>
          </View>

          <View style={styles.formContainer}>
            {mode === "signin" ? (
              <AppTextInput
                label="אימייל או שם משתמש"
                onChangeText={setIdentifier}
                value={identifier}
                placeholder="you@example.com / username"
                autoCapitalize="none"
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
                blurOnSubmit={false}
              />
            ) : (
              <>
                <AppTextInput
                  label="כתובת אימייל"
                  onChangeText={setEmail}
                  value={email}
                  placeholder="you@example.com"
                  autoCapitalize="none"
                  returnKeyType="next"
                  onSubmitEditing={() => usernameRef.current?.focus()}
                  blurOnSubmit={false}
                />
                <AppTextInput
                  ref={usernameRef}
                  label="שם משתמש"
                  onChangeText={setUsername}
                  value={username}
                  placeholder="secure_user_01"
                  autoCapitalize="none"
                  returnKeyType="next"
                  onSubmitEditing={() => passwordRef.current?.focus()}
                  blurOnSubmit={false}
                />
              </>
            )}

            <AppTextInput
              ref={passwordRef}
              label="סיסמה"
              onChangeText={setPassword}
              secureTextEntry
              value={password}
              placeholder="8 תווים לפחות"
              returnKeyType="go"
              onSubmitEditing={submit}
            />

            {notice ? <Text style={styles.notice}>{notice}</Text> : null}
            {error ? <Text style={styles.error}>{error}</Text> : null}

            <View style={{ marginTop: 10 }}>
              <PrimaryButton 
                label={mode === "signin" ? "כניסה למערכת" : "יצירת חשבון חדש"} 
                onPress={submit} 
              />
            </View>
          </View>
        </View>
      </View>
    </Screen>
  );
}

const createStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    container: {
      flexGrow: 1,
      justifyContent: "flex-start",
      paddingHorizontal: 28,
      paddingTop: 64,
      paddingBottom: 40,
      gap: 32,
    },
    hero: {
      alignItems: "center",
      gap: 8,
    },
    logoWrap: {
      width: 76,
      height: 76,
      borderRadius: 24,
      backgroundColor: theme.colors.accent,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: theme.colors.accent,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.25,
      shadowRadius: 15,
      elevation: 8,
    },
    title: {
      color: theme.colors.text,
      fontSize: 32,
      fontWeight: "bold",
      letterSpacing: -0.8,
    },
    subtitle: {
      color: theme.colors.textMuted,
      fontSize: 15,
      lineHeight: 22,
      textAlign: "center",
      maxWidth: 260,
      opacity: 0.8,
    },
    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: 36,
      padding: 24,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.1,
      shadowRadius: 24,
      elevation: 6,
    },
    segmentedContainer: {
      flexDirection: "row",
      backgroundColor: theme.colors.surfaceAlt,
      borderRadius: 18,
      padding: 6,
      marginBottom: 24,
      position: "relative",
    },
    segmentedActiveBg: {
      position: "absolute",
      top: 6,
      left: 6,
      height: "100%",
      backgroundColor: theme.colors.surface,
      borderRadius: 14,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    },
    segmentedText: {
      flex: 1,
      textAlign: "center",
      paddingVertical: 12,
      fontSize: 15,
      fontWeight: "700",
      color: theme.colors.textMuted,
      zIndex: 1,
    },
    segmentedTextActive: {
      color: theme.colors.text,
    },
    formContainer: {
      gap: 18,
    },
    notice: {
      color: theme.colors.accent,
      fontWeight: "600",
      lineHeight: 22,
      textAlign: "center",
    },
    error: {
      color: theme.colors.danger,
      fontWeight: "600",
      lineHeight: 22,
      textAlign: "center",
    },
  });
