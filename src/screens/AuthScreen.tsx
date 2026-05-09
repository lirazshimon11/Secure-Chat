import { useRef, useState } from "react";
import type { ReactNode, Ref } from "react";
import { Platform, Pressable, StyleSheet, Text, TextInput, View, useColorScheme } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { PrimaryButton } from "@/components/PrimaryButton";
import { Screen } from "@/components/Screen";
import { useAuth } from "@/context/AuthContext";
import { useAppTheme } from "@/lib/theme";
import { webNoOutline, webSystemFont } from "@/lib/webStyles";

type AuthMode = "signin" | "signup";

type FieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  secureTextEntry?: boolean;
  returnKeyType?: "next" | "go";
  onSubmitEditing?: () => void;
  inputRef?: Ref<TextInput>;
  right?: ReactNode;
  styles: ReturnType<typeof createStyles>;
};

type SocialButtonProps = {
  icon: ReactNode;
  label: string;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
};

export function AuthScreen() {
  const theme = useAppTheme();
  const isDark = useColorScheme() === "dark";
  const styles = createStyles(theme, isDark);
  const authColors = getAuthColors(isDark);
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<AuthMode>("signin");
  const [identifier, setIdentifier] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const emailRef = useRef<TextInput>(null);
  const usernameRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const isSignin = mode === "signin";

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode);
    setError(null);
    setNotice(null);
    if (Platform.OS === "web" && typeof document !== "undefined") {
      requestAnimationFrame(() => {
        document.querySelectorAll("*").forEach((node) => {
          const el = node as HTMLElement;
          if (el.scrollTop > 0) el.scrollTop = 0;
        });
      });
    }
  }

  async function submit() {
    setError(null);
    setNotice(null);

    if (isSignin) {
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

  return (
    <Screen scroll keyboardAvoiding>
      <View style={styles.page}>
        <View style={styles.topBar}>
          <Pressable
            onPress={() => (isSignin ? undefined : switchMode("signin"))}
            style={[styles.backButton, webNoOutline]}
          >
            <MaterialCommunityIcons name="chevron-left" size={24} color={authColors.icon} />
          </Pressable>
          <Text style={styles.brand}>SecureApp</Text>
          <View style={styles.backButtonPlaceholder} />
        </View>

        <View style={styles.header}>
          <Text style={styles.title}>{isSignin ? "התחברות לחשבון שלך" : "יצירת חשבון חדש"}</Text>
          <Text style={styles.subtitle}>
            {isSignin ? "היכנס/י כדי לנהל את הצ'אטים וההגדרות שלך." : "צרו משתמש חדש והמשיכו לצ'אט מאובטח."}
          </Text>
        </View>

        <View style={styles.form}>
          {isSignin ? (
            <AuthField
              label="אימייל או שם משתמש"
              onChangeText={setIdentifier}
              value={identifier}
              placeholder="you@example.com"
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
              styles={styles}
            />
          ) : (
            <>
              <AuthField
                inputRef={emailRef}
                label="אימייל"
                onChangeText={setEmail}
                value={email}
                placeholder="you@example.com"
                returnKeyType="next"
                onSubmitEditing={() => usernameRef.current?.focus()}
                styles={styles}
              />
              <AuthField
                inputRef={usernameRef}
                label="שם משתמש"
                onChangeText={setUsername}
                value={username}
                placeholder="secure_user_01"
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
                styles={styles}
              />
            </>
          )}

          <AuthField
            inputRef={passwordRef}
            label="סיסמה"
            onChangeText={setPassword}
            secureTextEntry={!passwordVisible}
            value={password}
            placeholder="8 תווים לפחות"
            returnKeyType="go"
            onSubmitEditing={submit}
            styles={styles}
            right={
              <Pressable onPress={() => setPasswordVisible((current) => !current)} style={[styles.eyeButton, webNoOutline]}>
                <MaterialCommunityIcons
                  name={passwordVisible ? "eye-off-outline" : "eye-outline"}
                  size={19}
                  color={authColors.iconMuted}
                />
              </Pressable>
            }
          />
        </View>

        {isSignin ? (
          <View style={styles.utilityRow}>
            <Pressable onPress={() => setRememberMe((current) => !current)} style={[styles.rememberRow, webNoOutline]}>
              <View style={[styles.checkbox, rememberMe && styles.checkboxActive]}>
                {rememberMe ? <MaterialCommunityIcons name="check" size={13} color={authColors.checkboxIcon} /> : null}
              </View>
              <Text style={styles.utilityText}>זכור אותי</Text>
            </Pressable>
            <Pressable onPress={() => {}} style={webNoOutline}>
              <Text style={styles.utilityLink}>שכחת סיסמה?</Text>
            </Pressable>
          </View>
        ) : null}

        {notice ? <Text style={styles.notice}>{notice}</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <PrimaryButton
          label={isSignin ? "Login" : "Sign Up"}
          onPress={submit}
          style={styles.primaryAction}
        />

        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>OR</Text>
          <View style={styles.dividerLine} />
        </View>

        <SocialButton
          icon={<Text style={styles.googleIcon}>G</Text>}
          label={isSignin ? "Sign in with Google" : "Sign up with Google"}
          onPress={() => setError("כניסה עם Google עדיין לא מחוברת במערכת.")}
          styles={styles}
        />
        <SocialButton
          icon={<MaterialCommunityIcons name="apple" size={20} color={authColors.socialIcon} />}
          label={isSignin ? "Continue with Apple" : "Sign up with Apple"}
          onPress={() => setError("כניסה עם Apple עדיין לא מחוברת במערכת.")}
          styles={styles}
        />

        <View style={styles.switchRow}>
          <Text style={styles.switchText}>{isSignin ? "אין לך חשבון?" : "כבר יש לך חשבון?"}</Text>
          <Pressable onPress={() => switchMode(isSignin ? "signup" : "signin")} style={webNoOutline}>
            <Text style={styles.switchLink}>{isSignin ? "הרשמה" : "התחברות"}</Text>
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}

function AuthField({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  returnKeyType,
  onSubmitEditing,
  inputRef,
  right,
  styles,
}: FieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.inputShell}>
        <TextInput
          ref={inputRef}
          autoCapitalize="none"
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={styles.inputPlaceholder.color}
          returnKeyType={returnKeyType}
          secureTextEntry={secureTextEntry}
          onSubmitEditing={onSubmitEditing}
          style={[styles.input, webNoOutline]}
          value={value}
        />
        {right}
      </View>
    </View>
  );
}

function SocialButton({ icon, label, onPress, styles }: SocialButtonProps) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.socialButton, pressed && styles.pressed, webNoOutline]}>
      <View style={styles.socialContent}>
        {icon}
        <Text style={styles.socialLabel}>{label}</Text>
      </View>
    </Pressable>
  );
}

const getAuthColors = (isDark: boolean) => ({
  pageBg: isDark ? "#080808" : "#ffffff",
  pageGradient: isDark
    ? "linear-gradient(180deg, #080808 0%, #080808 100%)"
    : "linear-gradient(180deg, #ffffff 0%, #ffffff 100%)",
  brand: isDark ? "#ffffff" : "#111b21",
  title: isDark ? "#ffffff" : "#111b21",
  subtitle: isDark ? "#a3a3a3" : "#667781",
  fieldLabel: isDark ? "#777777" : "#667781",
  inputBg: isDark ? "#181818" : "#f0f2f5",
  inputBorder: isDark ? "rgba(255,255,255,0.03)" : "#e2e7ea",
  inputText: isDark ? "#ffffff" : "#111b21",
  utilityText: isDark ? "#d8d8d8" : "#111b21",
  link: "#ff3b86",
  primary: "#ff3b86",
  divider: isDark ? "#202020" : "#e9edef",
  dividerText: isDark ? "#ffffff" : "#54656f",
  socialBg: isDark ? "#181818" : "#f0f2f5",
  socialText: isDark ? "#d7d7d7" : "#111b21",
  checkboxBorder: isDark ? "#ffffff" : "#111b21",
  checkboxFill: isDark ? "#ffffff" : "#111b21",
  checkboxIcon: isDark ? "#090909" : "#ffffff",
  notice: isDark ? "#ff4a92" : "#be1f62",
  error: isDark ? "#ff7ba9" : "#b42318",
  icon: isDark ? "#ffffff" : "#111b21",
  iconMuted: isDark ? "#f8f8f8" : "#54656f",
  socialIcon: isDark ? "#ffffff" : "#111b21",
});

const createStyles = (_theme: ReturnType<typeof useAppTheme>, isDark: boolean) => {
  const colors = getAuthColors(isDark);
  return (
  StyleSheet.create({
    page: {
      flexGrow: 1,
      backgroundColor: colors.pageBg,
      paddingHorizontal: 18,
      paddingTop: 18,
      paddingBottom: 34,
      ...webSystemFont,
      ...(Platform.OS === "web"
        ? ({
            backgroundImage: colors.pageGradient,
          } as any)
        : null),
    },
    topBar: {
      minHeight: 34,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 24,
    },
    backButton: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: "center",
      justifyContent: "center",
    },
    backButtonPlaceholder: {
      width: 34,
      height: 34,
    },
    brand: {
      color: colors.brand,
      fontSize: 18,
      fontWeight: "700",
      letterSpacing: 0,
      ...webSystemFont,
    },
    header: {
      gap: 8,
      marginBottom: 24,
      alignItems: "flex-end",
    },
    title: {
      color: colors.title,
      fontSize: 25,
      lineHeight: 31,
      fontWeight: "700",
      letterSpacing: 0,
      textAlign: "right",
      writingDirection: "rtl",
      ...webSystemFont,
    },
    subtitle: {
      color: colors.subtitle,
      fontSize: 14,
      lineHeight: 21,
      maxWidth: 305,
      textAlign: "right",
      writingDirection: "rtl",
      ...webSystemFont,
    },
    form: {
      gap: 16,
    },
    field: {
      gap: 8,
    },
    fieldLabel: {
      color: colors.fieldLabel,
      fontSize: 13,
      fontWeight: "500",
      textAlign: "right",
      writingDirection: "rtl",
      ...webSystemFont,
    },
    inputShell: {
      minHeight: 54,
      borderRadius: 27,
      backgroundColor: colors.inputBg,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      paddingHorizontal: 18,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    input: {
      flex: 1,
      color: colors.inputText,
      fontSize: 15,
      paddingVertical: 15,
      textAlign: "right",
      writingDirection: "rtl",
      ...webSystemFont,
    },
    inputPlaceholder: {
      color: colors.fieldLabel,
    },
    eyeButton: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: "center",
      justifyContent: "center",
    },
    utilityRow: {
      marginTop: 16,
      marginBottom: 18,
      flexDirection: "row-reverse",
      alignItems: "center",
      justifyContent: "space-between",
    },
    rememberRow: {
      flexDirection: "row-reverse",
      alignItems: "center",
      gap: 8,
    },
    checkbox: {
      width: 16,
      height: 16,
      borderRadius: 8,
      borderWidth: 1.5,
      borderColor: colors.checkboxBorder,
      alignItems: "center",
      justifyContent: "center",
    },
    checkboxActive: {
      backgroundColor: colors.checkboxFill,
    },
    utilityText: {
      color: colors.utilityText,
      fontSize: 13,
      ...webSystemFont,
    },
    utilityLink: {
      color: colors.link,
      fontSize: 13,
      fontWeight: "600",
      ...webSystemFont,
    },
    notice: {
      color: colors.notice,
      marginBottom: 10,
      lineHeight: 20,
      textAlign: "right",
      writingDirection: "rtl",
      ...webSystemFont,
    },
    error: {
      color: colors.error,
      marginBottom: 10,
      lineHeight: 20,
      textAlign: "right",
      writingDirection: "rtl",
      ...webSystemFont,
    },
    primaryAction: {
      minHeight: 56,
      borderRadius: 28,
      backgroundColor: colors.primary,
    },
    dividerRow: {
      marginTop: 28,
      marginBottom: 20,
      flexDirection: "row",
      alignItems: "center",
      gap: 20,
    },
    dividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: colors.divider,
    },
    dividerText: {
      color: colors.dividerText,
      fontSize: 13,
      ...webSystemFont,
    },
    socialButton: {
      minHeight: 52,
      borderRadius: 26,
      backgroundColor: colors.socialBg,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 12,
    },
    pressed: {
      opacity: 0.82,
    },
    socialContent: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    googleIcon: {
      color: "#4285f4",
      fontSize: 18,
      fontWeight: "700",
      ...webSystemFont,
    },
    socialLabel: {
      color: colors.socialText,
      fontSize: 14,
      ...webSystemFont,
    },
    switchRow: {
      marginTop: 10,
      flexDirection: "row-reverse",
      justifyContent: "center",
      alignItems: "center",
      gap: 5,
    },
    switchText: {
      color: colors.subtitle,
      fontSize: 14,
      ...webSystemFont,
    },
    switchLink: {
      color: colors.link,
      fontSize: 14,
      fontWeight: "700",
      ...webSystemFont,
    },
  })
  );
};
