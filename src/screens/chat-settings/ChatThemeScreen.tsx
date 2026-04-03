import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { useAppTheme } from "@/lib/theme";
import { Chat } from "@/lib/types";

type Props = {
  chat: Chat;
  onBack: () => void;
};

// Theme preset definitions
const THEME_PRESETS = [
  { id: "default_dark", bg: "#0b141a", bubble: "#005c4b", accent: "#25d366" },
  { id: "default_light", bg: "#e8d5b6", bubble: "#dcf8c6", accent: "#25d366" },
  { id: "purple", bg: "#1a092d", bubble: "#7b2d8b", accent: "#c084fc" },
  { id: "custom_photo", bg: "#1a2744", bubble: "#3b5998", accent: "#4267b2", isPhoto: true },
  { id: "teal", bg: "#0d3b3b", bubble: "#00897b", accent: "#26c6da" },
  { id: "orange", bg: "#2a1500", bubble: "#e65100", accent: "#ff9800" },
  { id: "pink", bg: "#2a0a1a", bubble: "#c2185b", accent: "#f48fb1" },
  { id: "lavender", bg: "#1a1040", bubble: "#7c4dff", accent: "#b39ddb" },
];

export function ChatThemeScreen({ chat, onBack }: Props) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [selectedTheme, setSelectedTheme] = useState("custom_photo");

  const firstRow = THEME_PRESETS.slice(0, 4);
  const secondRow = THEME_PRESETS.slice(4, 8);

  return (
    <Screen>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>ערכת הנושא של הצ'אט</Text>
          <Pressable onPress={onBack} style={styles.backButton}>
            <Feather color={theme.colors.headerIcon} name="arrow-right" size={24} />
          </Pressable>
          <Pressable style={styles.moreButton}>
            <MaterialCommunityIcons name="dots-vertical" size={24} color={theme.colors.headerIcon} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Section label */}
          <Text style={styles.sectionLabel}>ערכות נושא</Text>

          {/* Theme Grid Row 1 */}
          <View style={styles.themeRow}>
            {firstRow.map((t) => (
              <Pressable
                key={t.id}
                style={[styles.themeCard, selectedTheme === t.id && styles.themeCardSelected]}
                onPress={() => setSelectedTheme(t.id)}
              >
                <View style={[styles.previewBg, { backgroundColor: t.bg }]}>
                  <View style={[styles.previewBubbleLeft, { backgroundColor: "rgba(255,255,255,0.15)" }]} />
                  <View style={[styles.previewBubbleRight, { backgroundColor: t.bubble }]} />
                  {(t as any).isPhoto && (
                    <View style={styles.photoOverlay}>
                      <MaterialCommunityIcons name="image-outline" size={18} color="rgba(255,255,255,0.7)" />
                    </View>
                  )}
                </View>
                {selectedTheme === t.id && (
                  <View style={[styles.selectedCheck, { backgroundColor: t.accent }]}>
                    <Feather name="check" size={12} color="#fff" />
                  </View>
                )}
              </Pressable>
            ))}
          </View>

          {/* Theme Grid Row 2 */}
          <View style={styles.themeRow}>
            {secondRow.map((t) => (
              <Pressable
                key={t.id}
                style={[styles.themeCard, selectedTheme === t.id && styles.themeCardSelected]}
                onPress={() => setSelectedTheme(t.id)}
              >
                <View style={[styles.previewBg, { backgroundColor: t.bg }]}>
                  <View style={[styles.previewBubbleLeft, { backgroundColor: "rgba(255,255,255,0.15)" }]} />
                  <View style={[styles.previewBubbleRight, { backgroundColor: t.bubble }]} />
                </View>
                {selectedTheme === t.id && (
                  <View style={[styles.selectedCheck, { backgroundColor: t.accent }]}>
                    <Feather name="check" size={12} color="#fff" />
                  </View>
                )}
              </Pressable>
            ))}
          </View>

          <Text style={styles.helperText}>גם צבע הצ'אט וגם צבע הרקע ישתנו.</Text>

          {/* Personalization section */}
          <Text style={styles.sectionLabel}>התאמה אישית</Text>

          <View style={styles.settingsList}>
            <Pressable style={styles.settingRow}>
              <MaterialCommunityIcons
                name="message-outline"
                size={24}
                color={theme.colors.textMuted}
                style={styles.settingIcon}
              />
              <Text style={styles.settingLabel}>צבע הצ'אט</Text>
              <Feather name="chevron-left" size={18} color={theme.colors.textMuted} />
            </Pressable>
            <View style={styles.divider} />
            <Pressable style={styles.settingRow}>
              <MaterialCommunityIcons
                name="image-outline"
                size={24}
                color={theme.colors.textMuted}
                style={styles.settingIcon}
              />
              <Text style={styles.settingLabel}>רקע</Text>
              <Feather name="chevron-left" size={18} color={theme.colors.textMuted} />
            </Pressable>
          </View>
        </ScrollView>
      </View>
    </Screen>
  );
}

const createStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      backgroundColor: theme.colors.header,
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: theme.spacing.md,
      paddingTop: theme.spacing.sm,
      paddingBottom: theme.spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.separator,
    },
    backButton: {
      width: 36,
      height: 36,
      borderRadius: theme.radius.pill,
      alignItems: "center",
      justifyContent: "center",
      marginLeft: 8,
    },
    moreButton: {
      width: 36,
      height: 36,
      borderRadius: theme.radius.pill,
      alignItems: "center",
      justifyContent: "center",
    },
    headerTitle: {
      color: theme.colors.headerText,
      fontSize: 20,
      fontWeight: "800",
      flex: 1,
    },
    content: {
      padding: theme.spacing.lg,
      paddingBottom: 40,
    },
    sectionLabel: {
      fontSize: 13,
      color: theme.colors.textMuted,
      marginBottom: theme.spacing.md,
      marginTop: theme.spacing.sm,
      fontWeight: "600",
    },
    themeRow: {
      flexDirection: "row",
      gap: 10,
      marginBottom: 10,
    },
    themeCard: {
      flex: 1,
      borderRadius: 12,
      overflow: "visible",
      position: "relative",
    },
    themeCardSelected: {
      borderRadius: 12,
      borderWidth: 2.5,
      borderColor: theme.colors.accent,
    },
    previewBg: {
      height: 88,
      borderRadius: 10,
      padding: 8,
      justifyContent: "space-between",
      overflow: "hidden",
    },
    previewBubbleLeft: {
      height: 16,
      width: "60%",
      borderRadius: 6,
      alignSelf: "flex-start",
      marginTop: 6,
    },
    previewBubbleRight: {
      height: 16,
      width: "55%",
      borderRadius: 6,
      alignSelf: "flex-end",
      marginBottom: 6,
    },
    photoOverlay: {
      ...StyleSheet.absoluteFillObject,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(0,0,0,0.25)",
    },
    selectedCheck: {
      position: "absolute",
      top: -6,
      right: -6,
      width: 22,
      height: 22,
      borderRadius: 11,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 2,
      borderColor: theme.colors.background,
      zIndex: 10,
    },
    helperText: {
      fontSize: 13,
      color: theme.colors.textMuted,
      marginBottom: theme.spacing.xl,
      marginTop: 4,
    },
    settingsList: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.md,
      overflow: "hidden",
    },
    settingRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: theme.spacing.md,
      paddingVertical: 18,
    },
    settingIcon: {
      marginRight: theme.spacing.md,
    },
    settingLabel: {
      flex: 1,
      fontSize: 17,
      color: theme.colors.text,
      fontWeight: "600",
    },
    divider: {
      height: 1,
      backgroundColor: theme.colors.separator,
      marginLeft: theme.spacing.md + 24 + theme.spacing.md,
    },
  });
