import { useEffect, useMemo, useRef, useState } from "react";
import {
  NativeSyntheticEvent,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputSubmitEditingEventData,
  View,
} from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useAppTheme } from "@/lib/theme";
import { webEmbeddedInputReset, webNoOutline } from "@/lib/webStyles";

type Props = {
  replyPreview: string | null;
  onCancelReply: () => void;
  onSend: (body: string, kind: "standard" | "temporary" | "view_once", expireSeconds: number | null) => void;
  emojiKeyboardOpen?: boolean;
  onToggleEmojiKeyboard?: () => void;
  emojiEvent?: { emoji: string; ts: number } | null;
  onInputFocus?: () => void;
  focusTrigger?: number;
};

export function MessageComposer({ replyPreview, onCancelReply, onSend, emojiKeyboardOpen, onToggleEmojiKeyboard, emojiEvent, onInputFocus, focusTrigger }: Props) {
  const theme = useAppTheme();
  const styles = createStyles(theme);
  const [body, setBody] = useState("");
  const [kind, setKind] = useState<"standard" | "temporary" | "view_once">("standard");
  const inputRef = useRef<TextInput | null>(null);

  useEffect(() => {
    if (emojiEvent) {
      setBody((prev) => prev + emojiEvent.emoji);
    }
  }, [emojiEvent]);

  // When parent asks us to focus (e.g. switching from emoji panel back to keyboard)
  useEffect(() => {
    if (focusTrigger) {
      // Short delay to let the emoji panel unmount first
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [focusTrigger]);

  const expireSeconds = kind === "temporary" ? 60 : null;

  const placeholder = useMemo(() => {
    if (kind === "temporary") {
      return "הקלידו הודעה נעלמת";
    }

    if (kind === "view_once") {
      return "הקלידו הודעה חד-פעמית";
    }

    return "הקלידו הודעה";
  }, [kind]);

  function handleSend() {
    if (!body.trim()) {
      return;
    }

    onSend(body, kind, expireSeconds);
    setBody("");
    setKind("standard");
  }

  function handleSubmit(event: NativeSyntheticEvent<TextInputSubmitEditingEventData>) {
    if (Platform.OS === "web" && event.nativeEvent.text?.includes("\n")) {
      return;
    }

    handleSend();
  }

  return (
    <View style={styles.safeAreaWrapper}>
      <View style={styles.wrapper}>
        {replyPreview ? (
          <View style={styles.replyBanner}>
            <View style={styles.replyAccent} />
            <View style={styles.replyText}>
              <Text style={styles.replyLabel}>תשובה להודעה</Text>
              <Text numberOfLines={1} style={styles.replyPreview}>
                {replyPreview}
              </Text>
            </View>
            <Pressable onPress={onCancelReply} style={styles.closeButton}>
              <Feather color={theme.colors.textMuted} name="x" size={18} />
            </Pressable>
          </View>
        ) : null}

        {!emojiKeyboardOpen ? (
          <View style={styles.modeRow}>
            <ModeChip active={kind === "standard"} icon="message-text-outline" label="הודעה" onPress={() => setKind("standard")} />
            <ModeChip active={kind === "temporary"} icon="timer-sand" label="דקה 1" onPress={() => setKind("temporary")} />
            <ModeChip active={kind === "view_once"} icon="eye-outline" label="צפייה חד-פעמית" onPress={() => setKind("view_once")} />
          </View>
        ) : null}

        <View style={styles.composerRow}>
          <View style={styles.inputContainer}>
            <Pressable onPress={() => onToggleEmojiKeyboard?.()} style={[styles.sideButton, webNoOutline]}>
              <MaterialCommunityIcons color={theme.colors.textMuted} name={emojiKeyboardOpen ? "keyboard-outline" : "emoticon-outline"} size={24} />
            </Pressable>
            <View style={styles.inputShell}>
            <TextInput
              onChangeText={setBody}
              onSubmitEditing={handleSubmit}
              placeholder={placeholder}
              placeholderTextColor={theme.colors.textMuted}
              ref={inputRef}
              onFocus={onInputFocus}
              returnKeyType="send"
              blurOnSubmit={false}
              style={[styles.input, webEmbeddedInputReset]}
              value={body}
            />
            </View>
          </View>
          <Pressable onPress={handleSend} style={[styles.sendButton, webNoOutline]}>
            <Feather color={theme.colors.textOnAccent} name="send" size={18} />
          </Pressable>
        </View>
      </View>
    </View>
  );

  function ModeChip({
    active,
    icon,
    label,
    onPress,
  }: {
    active: boolean;
    icon: keyof typeof MaterialCommunityIcons.glyphMap;
    label: string;
    onPress: () => void;
  }) {
    return (
      <Pressable onPress={onPress} style={[styles.modeChip, active && styles.modeChipActive, webNoOutline]}>
        <MaterialCommunityIcons color={active ? theme.colors.accent : theme.colors.textMuted} name={icon} size={15} />
        <Text style={[styles.modeLabel, active && styles.modeLabelActive]}>{label}</Text>
      </Pressable>
    );
  }
}

const createStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    wrapper: {
      backgroundColor: 'transparent',
      paddingHorizontal: theme.spacing.sm,
      paddingTop: theme.spacing.xs,
      paddingBottom: theme.spacing.xs,
      gap: theme.spacing.xs,
    },
    safeAreaWrapper: {
      backgroundColor: 'transparent',
      borderTopWidth: 0,
    },
    replyBanner: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.md,
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 8,
      paddingHorizontal: 10,
      gap: 10,
    },
    replyAccent: {
      width: 4,
      alignSelf: "stretch",
      backgroundColor: theme.colors.accent,
      borderRadius: theme.radius.pill,
    },
    replyText: {
      flex: 1,
      gap: 2,
    },
    replyLabel: {
      color: theme.colors.accent,
      fontSize: 12,
      fontWeight: "700",
    },
    replyPreview: {
      color: theme.colors.text,
      fontSize: 13,
    },
    closeButton: {
      padding: 4,
    },
    modeRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: theme.spacing.xs,
    },
    modeChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: theme.colors.surface,
      borderRadius: 18,
      borderColor: theme.colors.border,
      borderWidth: 1,
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    modeChipActive: {
      backgroundColor: theme.colors.accentSoft,
      borderColor: theme.colors.accentSoft,
    },
    modeLabel: {
      color: theme.colors.textMuted,
      fontSize: 12,
      fontWeight: "700",
    },
    modeLabelActive: {
      color: theme.colors.accent,
    },
    emojiRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: theme.spacing.xs,
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.md,
      padding: 10,
    },
    emojiChip: {
      width: 36,
      height: 36,
      borderRadius: theme.radius.pill,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.surfaceAlt,
    },
    emojiText: {
      fontSize: 18,
    },
    composerRow: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: theme.spacing.xs,
    },
    inputContainer: {
      flex: 1,
      flexDirection: "row",
      alignItems: "flex-end",
      backgroundColor: theme.colors.surface,
      borderRadius: 24,
    },
    sideButton: {
      width: 42,
      height: 44,
      alignItems: "center",
      justifyContent: "center",
    },
    inputShell: {
      flex: 1,
      paddingLeft: 4,
      paddingRight: 14,
      minHeight: 44,
      justifyContent: "center",
    },
    input: {
      color: theme.colors.text,
      fontSize: 16,
      height: 22,
      paddingVertical: 0,
    },
    sendButton: {
      width: 46,
      height: 46,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.accentStrong,
      alignItems: "center",
      justifyContent: "center",
    },
  });
