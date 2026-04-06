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
  replyToText?: string | null;
  replyToName?: string | null;
  onCancelReply: () => void;
  onSend: (body: string, kind: "standard" | "temporary" | "view_once", expireSeconds: number | null) => void;
  emojiKeyboardOpen?: boolean;
  onToggleEmojiKeyboard?: () => void;
  emojiEvent?: { emoji: string; ts: number } | null;
  onInputFocus?: () => void;
  focusTrigger?: number;
  onAttachmentPress?: () => void;
};

export function MessageComposer({ replyToText, replyToName, onCancelReply, onSend, emojiKeyboardOpen, onToggleEmojiKeyboard, emojiEvent, onInputFocus, focusTrigger, onAttachmentPress }: Props) {
  const theme = useAppTheme();
  const styles = createStyles(theme, !!replyToText);
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

  const placeholder = "הקלידו הודעה";

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

  const accentColor = useMemo(() => {
    if (!replyToName) return "#00A884";
    const colors = ["#34B7F1", "#53D669", "#FFBC2E", "#FF5B5B", "#A529E7", "#E91E63"];
    let hash = 0;
    for (let i = 0; i < replyToName.length; i++) hash = replyToName.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  }, [replyToName]);

  return (
    <View style={styles.safeAreaWrapper}>
      <View style={styles.wrapper}>
        <View style={styles.modeRow}>
          <ModeChip
            active={kind === "standard"}
            activeColor={theme.colors.mine}
            textColor={theme.colors.text}
            icon="message-text-outline"
            label="הודעה"
            onPress={() => setKind("standard")}
          />
          <ModeChip
            active={kind === "temporary"}
            activeColor="#8b5cf6" // Elegant Purple
            textColor="#ffffff"
            icon="timer-sand"
            label="דקה 1"
            onPress={() => setKind("temporary")}
          />
          <ModeChip
            active={kind === "view_once"}
            activeColor="#ff4444" // True Red
            textColor="#ffffff"
            icon="eye-outline"
            label="צפייה חד-פעמית"
            onPress={() => setKind("view_once")}
          />
        </View>

        <View style={styles.composerRow}>
          <View style={styles.mainStack}>
            {replyToText ? (
              <View style={styles.replyBanner}>
                <View style={styles.replyContent}>
                  {/* Accent bar on the RIGHT in RTL */}
                  <View style={[styles.replyAccent, { backgroundColor: accentColor }]} />

                  {/* Body taking full MIDDLE space */}
                  <View style={styles.replyText}>
                    <Text numberOfLines={1} style={[styles.replyLabel, { color: accentColor }]}>{replyToName || "תשובה להודעה"}</Text>
                    <Text numberOfLines={1} style={styles.replyPreview}>
                      {replyToText}
                    </Text>
                  </View>

                  {/* Close button on the LEFT in RTL */}
                  <Pressable onPress={onCancelReply} style={styles.closeButton}>
                    <Feather color={theme.colors.headerIcon} name="x" size={18} />
                  </Pressable>
                </View>
              </View>
            ) : null}

            <View style={styles.inputContainer}>
              {/* Emoji toggle - FIRST inside = rightmost visually */}
              <Pressable onPress={() => onToggleEmojiKeyboard?.()} style={[styles.sideButton, webNoOutline]}>
                <MaterialCommunityIcons color={theme.colors.headerIcon} name={emojiKeyboardOpen ? "keyboard-outline" : "emoticon-outline"} size={24} />
              </Pressable>
              <View style={styles.inputShell}>
                <TextInput
                  onChangeText={setBody}
                  onSubmitEditing={handleSubmit}
                  placeholder={placeholder}
                  placeholderTextColor={theme.colors.textMuted + "80"}
                  ref={inputRef}
                  onFocus={onInputFocus}
                  returnKeyType="default"
                  blurOnSubmit={false}
                  multiline
                  style={[styles.input, webEmbeddedInputReset]}
                  value={body}
                />
              </View>
              {/* Camera & Paperclip - LAST inside = leftmost visually in RTL */}
              <Pressable onPress={() => onAttachmentPress?.()} style={[styles.innerSideButton, webNoOutline]}>
                <Feather color={theme.colors.headerIcon} name="paperclip" size={20} />
              </Pressable>
              <Pressable onPress={() => { }} style={[styles.innerSideButton, webNoOutline]}>
                <Feather color={theme.colors.headerIcon} name="camera" size={20} />
              </Pressable>
            </View>
          </View>

          {/* Send button when typing */}
          {body.trim().length > 0 && (
            <Pressable onPress={handleSend} style={[styles.sendButton, webNoOutline]}>
              <Feather color={theme.colors.textOnAccent} name="send" size={18} />
            </Pressable>
          )}

          {/* Mic FAB - LAST in JSX = leftmost visually in RTL */}
          {body.trim().length === 0 && (
            <Pressable onPress={() => { }} style={[styles.micFab, webNoOutline]}>
              <MaterialCommunityIcons color={theme.colors.textOnAccent} name="microphone" size={22} />
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );

  function ModeChip({
    active,
    activeColor,
    textColor,
    icon,
    label,
    onPress,
  }: {
    active: boolean;
    activeColor: string;
    textColor: string;
    icon: keyof typeof MaterialCommunityIcons.glyphMap;
    label: string;
    onPress: () => void;
  }) {
    return (
      <Pressable
        onPress={onPress}
        style={[
          styles.modeChip,
          active && { backgroundColor: activeColor, borderColor: activeColor },
          active && styles.modeChipActive,
          webNoOutline
        ]}
      >
        <MaterialCommunityIcons color={active ? (theme.colors.background === "#0b141a" ? "#ffffff" : textColor) : theme.colors.headerIcon} name={icon} size={15} />
        <Text style={[styles.modeLabel, active && { color: theme.colors.background === "#0b141a" ? "#ffffff" : textColor }]}>{label}</Text>
      </Pressable>
    );
  }
}

const createStyles = (theme: ReturnType<typeof useAppTheme>, isReplying: boolean = false) =>
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
    mainStack: {
      flex: 1,
      backgroundColor: theme.colors.surface,
      borderRadius: 24,
      overflow: "hidden",
      borderWidth: 0,
    },
    replyBanner: {
      backgroundColor: theme.colors.background === "#0b141a" ? "#1d272d" : "#e0e0e0",
      paddingVertical: 8,
      paddingHorizontal: 8,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.background === "#0b141a" ? "rgba(0,0,0,0.25)" : "rgba(0,0,0,0.05)",
    },
    replyContent: {
      flexDirection: "row", // RTL: 1st is Right, LAST is Left
      alignItems: "stretch",
      backgroundColor: theme.colors.background === "#0b141a" ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)",
      borderRadius: 8,
      overflow: "hidden",
    },
    replyAccent: {
      width: 4,
    },
    replyText: {
      flex: 1, // Fills space between Accent (Right) and Close (Left)
      paddingVertical: 6,
      paddingHorizontal: 10,
      justifyContent: "center",
      alignItems: "flex-start", // Hebrew Right
    },
    replyLabel: {
      fontSize: 12,
      fontWeight: "800",
      marginBottom: 2,
      textAlign: "right",
      width: "100%",
    },
    replyPreview: {
      color: theme.colors.textMuted,
      fontSize: 13,
      textAlign: "right",
      width: "100%",
    },
    closeButton: {
      paddingHorizontal: 12,
      justifyContent: "center",
      alignItems: "center",
    },
    modeRow: {
      flexDirection: "row",
      gap: 8,
      alignSelf: "flex-start", // Hebrew Right
      marginBottom: 10,
    },
    modeChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      borderRadius: 18,
      paddingHorizontal: 14,
      paddingVertical: 7,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    modeChipActive: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 3,
      elevation: 3,
    },
    modeLabel: {
      color: theme.colors.textMuted,
      fontSize: 12,
      fontWeight: "700",
    },
    modeLabelActive: {
      color: theme.colors.textOnAccent,
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
      gap: 6,
    },
    micFab: {
      width: 46,
      height: 46,
      borderRadius: 23,
      backgroundColor: theme.colors.accent,
      alignItems: "center",
      justifyContent: "center",
    },
    outerSideButton: {
      width: 36,
      height: 44,
      alignItems: "center",
      justifyContent: "center",
    },
    inputContainer: {
      flexDirection: "row",
      alignItems: "flex-end",
      backgroundColor: "transparent",
    },
    sideButton: {
      width: 42,
      height: 44,
      alignItems: "center",
      justifyContent: "center",
    },
    innerSideButton: {
      width: 38,
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
      minHeight: 22,
      maxHeight: 120,
      paddingVertical: Platform.OS === "ios" ? 8 : 4,
      textAlign: "right", // Hebrew Support
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
