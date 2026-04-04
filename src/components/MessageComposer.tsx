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
  onAttachmentPress?: () => void;
};

export function MessageComposer({ replyPreview, onCancelReply, onSend, emojiKeyboardOpen, onToggleEmojiKeyboard, emojiEvent, onInputFocus, focusTrigger, onAttachmentPress }: Props) {
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

  return (
    <View style={styles.safeAreaWrapper}>
      <View style={styles.wrapper}>
        {replyPreview ? (
          <View style={styles.replyBanner}>
            <View style={styles.replyText}>
              <Text numberOfLines={1} style={styles.replyLabel}>תשובה להודעה</Text>
              <Text numberOfLines={2} style={styles.replyPreview}>
                {replyPreview}
              </Text>
            </View>
            <View style={styles.replyAccent} />
            <Pressable onPress={onCancelReply} style={styles.closeButton}>
              <Feather color={theme.colors.textMuted} name="x" size={16} />
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
          {/* Input field - FIRST in JSX = rightmost visually in RTL */}
          <View style={styles.inputContainer}>
            {/* Emoji toggle - FIRST inside = rightmost visually */}
            <Pressable onPress={() => onToggleEmojiKeyboard?.()} style={[styles.sideButton, webNoOutline]}>
              <MaterialCommunityIcons color={theme.colors.textMuted} name={emojiKeyboardOpen ? "keyboard-outline" : "emoticon-outline"} size={24} />
            </Pressable>
            <View style={styles.inputShell}>
              <TextInput
                onChangeText={setBody}
                onSubmitEditing={handleSubmit}
                placeholder={placeholder}
                placeholderTextColor={theme.colors.textMuted + "80"} // add transparency to muted text color
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
              <Feather color={theme.colors.textMuted} name="paperclip" size={20} />
            </Pressable>
            <Pressable onPress={() => { }} style={[styles.innerSideButton, webNoOutline]}>
              <Feather color={theme.colors.textMuted} name="camera" size={20} />
            </Pressable>
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
        <MaterialCommunityIcons color={active ? theme.colors.textOnAccent : theme.colors.textMuted} name={icon} size={15} />
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
      backgroundColor: theme.colors.bubbleBackground,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      borderBottomLeftRadius: 4,
      borderBottomRightRadius: 4,
      flexDirection: "row-reverse",
      alignItems: "center",
      paddingVertical: 10,
      paddingHorizontal: 12,
      marginBottom: -4,
      borderWidth: 1,
      borderColor: theme.colors.bubbleBorder,
    },
    replyAccent: {
      width: 4,
      alignSelf: "stretch",
      backgroundColor: "#00A884",
      borderRadius: 2,
      marginLeft: 12,
    },
    replyText: {
      flex: 1,
      gap: 1,
      alignItems: "flex-end",
    },
    replyLabel: {
      color: "#00A884",
      fontSize: 12,
      fontWeight: "800",
    },
    replyPreview: {
      color: theme.colors.textMuted,
      fontSize: 13,
      textAlign: "right",
      lineHeight: 18,
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
      backgroundColor: theme.colors.bubbleBackground,
      borderRadius: 18,
      borderColor: theme.colors.bubbleBorder,
      borderWidth: 1,
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    modeChipActive: {
      backgroundColor: "rgba(0, 168, 132, 0.88)",
      borderColor: "rgba(0, 168, 132, 0.5)",
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
