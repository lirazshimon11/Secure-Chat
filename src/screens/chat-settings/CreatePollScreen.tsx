import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, TextInput, KeyboardAvoidingView, Platform, ScrollView, Switch } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useAppTheme } from "@/lib/theme";
import { webEmbeddedInputReset } from "@/lib/webStyles";
import { useChats } from "@/context/ChatContext";
import { Chat } from "@/lib/types";

export function CreatePollScreen({ chat, onBack }: { chat: Chat; onBack: () => void }) {
  const theme = useAppTheme();
  const styles = createStyles(theme);
  const { sendMessage } = useChats();
  const insets = useSafeAreaInsets(); // מביא את השוליים הבטוחים בצורה יציבה

  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [multipleAnswers, setMultipleAnswers] = useState(true);

  // Custom duration state כולל שניות
  const [d, setD] = useState(0);
  const [h, setH] = useState(0);
  const [m, setM] = useState(0);
  const [s, setS] = useState(0);

  // חישוב הזמן הכולל במילישניות
  const totalExpirationMs = (d * 24 * 60 * 60 * 1000) + (h * 60 * 60 * 1000) + (m * 60 * 1000) + (s * 1000);

  const handleOptionChange = (text: string, index: number) => {
    const newOptions = [...options];
    newOptions[index] = text;
    if (index === options.length - 1 && text.trim() !== "" && options.length < 12) {
      newOptions.push("");
    }
    setOptions(newOptions);
  };

  const handleSend = async () => {
    if (!question.trim()) return;
    const validOptions = options.map(o => o.trim()).filter(o => o.length > 0);
    if (validOptions.length < 2) return;

    const pollData = {
      question: question.trim(),
      options: validOptions,
      multipleAnswers,
      expiresAt: totalExpirationMs > 0 ? new Date(Date.now() + totalExpirationMs).toISOString() : null
    };

    sendMessage({
      chatId: chat.id,
      body: `[POLL]:${JSON.stringify(pollData)}`,
      messageKind: "standard"
    });
    onBack();
  };

  const ProgressTimeCard = ({ label, icon, value, onChange, max }: any) => {
    const fillPercentage = max > 0 ? (value / max) * 100 : 0;

    return (
      <View style={styles.cardContainer}>
        <View style={[styles.cardFill, { width: `${fillPercentage}%` }]} />

        <View style={styles.cardContent}>
          <View style={styles.cardLabelGroup}>
            <View style={styles.iconBox}>
              <Feather name={icon} size={18} color={theme.colors.accentStrong} />
            </View>
            <Text style={styles.cardLabel}>{label}</Text>
          </View>

          <View style={styles.cardControls}>
            <Pressable
              onPress={() => onChange(Math.max(0, value - 1))}
              style={({ pressed }) => [styles.controlBtn, pressed && styles.controlBtnPressed]}
            >
              <Feather name="minus" size={18} color={value > 0 ? theme.colors.text : theme.colors.textMuted} />
            </Pressable>

            <Text style={[styles.cardValue, value > 0 && { color: theme.colors.accentStrong }]}>
              {value.toString().padStart(2, '0')}
            </Text>

            <Pressable
              onPress={() => onChange(Math.min(max, value + 1))}
              style={({ pressed }) => [styles.controlBtn, pressed && styles.controlBtnPressed]}
            >
              <Feather name="plus" size={18} color={value < max ? theme.colors.text : theme.colors.textMuted} />
            </Pressable>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.root}>
      <SafeAreaView edges={["top"]} style={styles.header}>
        <View style={styles.headerInner}>
          <Pressable onPress={onBack} style={styles.backButton}>
            <Feather color={theme.colors.headerIcon} name="arrow-right" size={24} />
          </Pressable>
          <Text style={styles.headerTitle}>יצירת סקר</Text>
        </View>
      </SafeAreaView>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          style={styles.content}
          contentContainerStyle={{ paddingBottom: 150 }}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.sectionLabel}>שאלה</Text>
          <View style={styles.questionContainer}>
            <TextInput
              style={[styles.input, webEmbeddedInputReset]}
              placeholder="מה השאלה?"
              placeholderTextColor={theme.colors.textMuted}
              value={question}
              onChangeText={setQuestion}
              textAlign="right"
              multiline
            />
          </View>

          <Text style={styles.sectionLabel}>אפשרויות</Text>
          {options.map((opt, idx) => (
            <View key={idx} style={styles.inputContainer}>
              <MaterialCommunityIcons name="menu" size={20} color={theme.colors.textMuted} style={styles.dragIcon} />
              <TextInput
                style={[styles.input, webEmbeddedInputReset, { flex: 1 }]}
                placeholder={idx < 2 ? "הוספה" : "אופציה נוספת"}
                placeholderTextColor={theme.colors.textMuted}
                value={opt}
                onChangeText={(t) => handleOptionChange(t, idx)}
                textAlign="right"
              />
            </View>
          ))}

          <Text style={styles.sectionLabel}>זמן תפוגה מותאם</Text>

          <View style={styles.timeCardsWrapper}>
            <ProgressTimeCard label="ימים" icon="calendar" value={d} onChange={setD} max={30} />
            <ProgressTimeCard label="שעות" icon="clock" value={h} onChange={setH} max={23} />
            <ProgressTimeCard label="דקות" icon="watch" value={m} onChange={setM} max={59} />
            <ProgressTimeCard label="שניות" icon="zap" value={s} onChange={setS} max={59} />
          </View>

          {totalExpirationMs > 0 && (
            <Text style={styles.timerSummaryText}>
              הסקר ייסגר בעוד: <Text style={{ fontWeight: "800" }}>
                {d > 0 ? `${d} ימים, ` : ""}
                {h > 0 ? `${h} שעות, ` : ""}
                {m > 0 || (d === 0 && h === 0 && s === 0) ? `${m} דקות ו-` : ""}
                {s} שניות
              </Text>
            </Text>
          )}

          <View style={styles.toggleRow}>
            <Switch
              value={multipleAnswers}
              onValueChange={setMultipleAnswers}
              trackColor={{ false: theme.colors.surfaceMuted, true: theme.colors.accentStrong + "80" }}
              thumbColor={multipleAnswers ? theme.colors.accentStrong : theme.colors.textMuted}
            />
            <Text style={styles.toggleText}>לאפשר בחירה במספר תשובות</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={[styles.footer, { bottom: Math.max(30, insets.bottom + 16) }]}>
        <Pressable style={styles.fab} onPress={handleSend}>
          <MaterialCommunityIcons name="send" size={24} color={theme.colors.textOnAccent} style={{ transform: [{ scaleX: -1 }] }} />
        </Pressable>
      </View>
    </View>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      backgroundColor: theme.colors.header,
    },
    headerInner: {
      flexDirection: "row-reverse",
      alignItems: "center",
      justifyContent: "space-between",
      height: 60,
      paddingHorizontal: 16,
    },
    backButton: {
      width: 40,
      height: 40,
      alignItems: "center",
      justifyContent: "center",
    },
    headerTitle: {
      color: theme.colors.headerText,
      fontSize: 20,
      fontWeight: "500",
      flex: 1,
      textAlign: "left",
      paddingRight: 8,
    },
    content: {
      flex: 1,
      paddingHorizontal: 16,
    },
    sectionLabel: {
      color: theme.colors.textMuted,
      fontSize: 14,
      marginTop: 24,
      marginBottom: 12,
      textAlign: "left",
      fontWeight: "600",
      letterSpacing: 0.5,
    },
    questionContainer: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 16,
      backgroundColor: theme.colors.surfaceAlt,
      paddingVertical: 14,
      paddingHorizontal: 16,
    },
    inputContainer: {
      flexDirection: "row-reverse",
      alignItems: "center",
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 16,
      backgroundColor: theme.colors.surfaceAlt,
      marginBottom: 10,
      paddingVertical: 12,
      paddingHorizontal: 16,
    },
    input: {
      color: theme.colors.text,
      fontSize: 16,
    },
    dragIcon: {
      marginLeft: 12,
    },
    timeCardsWrapper: {
      gap: 12,
    },
    cardContainer: {
      height: 64,
      backgroundColor: theme.colors.surfaceAlt,
      borderRadius: 16,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: theme.colors.border,
      position: "relative",
    },
    cardFill: {
      position: "absolute",
      top: 0,
      bottom: 0,
      right: 0,
      backgroundColor: theme.colors.accentStrong + "15",
    },
    cardContent: {
      flex: 1,
      flexDirection: "row-reverse",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
    },
    cardLabelGroup: {
      flexDirection: "row-reverse",
      alignItems: "center",
      gap: 12,
    },
    iconBox: {
      width: 32,
      height: 32,
      borderRadius: 10,
      backgroundColor: theme.colors.background,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
    },
    cardLabel: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.text,
    },
    cardControls: {
      flexDirection: "row-reverse",
      alignItems: "center",
      backgroundColor: theme.colors.background,
      borderRadius: 12,
      paddingHorizontal: 6,
      paddingVertical: 4,
      borderWidth: 1,
      borderColor: theme.colors.border + "50",
    },
    controlBtn: {
      padding: 8,
    },
    controlBtnPressed: {
      opacity: 0.5,
    },
    cardValue: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.colors.text,
      minWidth: 28,
      textAlign: "center",
      marginHorizontal: 4,
    },
    timerSummaryText: {
      color: theme.colors.textMuted,
      fontSize: 14,
      textAlign: "center",
      marginTop: 20,
      lineHeight: 22,
    },
    toggleRow: {
      flexDirection: "row-reverse",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: 24,
      paddingVertical: 10,
    },
    toggleText: {
      color: theme.colors.text,
      fontSize: 16,
      flex: 1,
      textAlign: "left",
      marginRight: 16,
    },
    footer: {
      position: "absolute",
      left: 20,
      right: "auto",
    },
    fab: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: theme.colors.accentStrong,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 6,
    },
  });