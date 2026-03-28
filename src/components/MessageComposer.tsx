import { useMemo, useRef, useState } from "react";
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

const emojiOptions = ["\u{1F600}", "\u{1F602}", "\u{1F60E}", "\u{1F525}", "\u{1F44D}", "\u{2764}", "\u{1F648}", "\u{1F440}"];

type Props = {
  replyPreview: string | null;
  onCancelReply: () => void;
  onSend: (body: string, kind: "standard" | "temporary" | "view_once", expireSeconds: number | null) => void;
};

export function MessageComposer({ replyPreview, onCancelReply, onSend }: Props) {
  const theme = useAppTheme();
  const styles = createStyles(theme);
  const [body, setBody] = useState("");
  const [kind, setKind] = useState<"standard" | "temporary" | "view_once">("standard");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const inputRef = useRef<TextInput | null>(null);

  const expireSeconds = kind === "temporary" ? 60 : null;

  const placeholder = useMemo(() => {
    if (kind === "temporary") {
      return "Type a disappearing message";
    }

    if (kind === "view_once") {
      return "Type a view-once message";
    }

    return "Type a message";
  }, [kind]);

  function handleSend() {
    if (!body.trim()) {
      return;
    }

    onSend(body, kind, expireSeconds);
    setBody("");
    setKind("standard");
    setShowEmojiPicker(false);
  }

  function handleSubmit(event: NativeSyntheticEvent<TextInputSubmitEditingEventData>) {
    if (Platform.OS === "web" && event.nativeEvent.text?.includes("\n")) {
      return;
    }

    handleSend();
  }

  return (
    <View style={styles.wrapper}>
      {replyPreview ? (
        <View style={styles.replyBanner}>
          <View style={styles.replyAccent} />
          <View style={styles.replyText}>
            <Text style={styles.replyLabel}>Replying to message</Text>
            <Text numberOfLines={1} style={styles.replyPreview}>
              {replyPreview}
            </Text>
          </View>
          <Pressable onPress={onCancelReply} style={styles.closeButton}>
            <Feather color={theme.colors.textMuted} name="x" size={18} />
          </Pressable>
        </View>
      ) : null}

      <View style={styles.modeRow}>
        <ModeChip active={kind === "standard"} icon="message-text-outline" label="Message" onPress={() => setKind("standard")} />
        <ModeChip active={kind === "temporary"} icon="timer-sand" label="1 minute" onPress={() => setKind("temporary")} />
        <ModeChip active={kind === "view_once"} icon="eye-outline" label="View once" onPress={() => setKind("view_once")} />
      </View>

      {showEmojiPicker ? (
        <View style={styles.emojiRow}>
          {emojiOptions.map((emoji) => (
            <Pressable
              key={emoji}
              onPress={() => {
                setBody((current) => `${current}${emoji}`);
                inputRef.current?.focus();
              }}
              style={styles.emojiChip}
            >
              <Text style={styles.emojiText}>{emoji}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <View style={styles.composerRow}>
        <Pressable onPress={() => setShowEmojiPicker((current) => !current)} style={[styles.sideButton, webNoOutline]}>
          <Feather color={theme.colors.textMuted} name={showEmojiPicker ? "x" : "smile"} size={20} />
        </Pressable>
        <View style={styles.inputShell}>
          <TextInput
            onChangeText={setBody}
            onSubmitEditing={handleSubmit}
            placeholder={placeholder}
            placeholderTextColor={theme.colors.textMuted}
            ref={inputRef}
            returnKeyType="send"
            blurOnSubmit={false}
            style={[styles.input, webEmbeddedInputReset]}
            value={body}
          />
        </View>
        <Pressable onPress={handleSend} style={[styles.sendButton, webNoOutline]}>
          <Feather color={theme.colors.textOnAccent} name="send" size={18} />
        </Pressable>
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
      backgroundColor: theme.colors.composer,
      borderTopColor: theme.colors.separator,
      borderTopWidth: 1,
      paddingHorizontal: theme.spacing.sm,
      paddingTop: theme.spacing.xs,
      paddingBottom: theme.spacing.sm,
      gap: theme.spacing.xs,
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
      borderRadius: theme.radius.pill,
      borderColor: theme.colors.border,
      borderWidth: 1,
      paddingHorizontal: 12,
      paddingVertical: 6,
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
      alignItems: "center",
      gap: theme.spacing.xs,
    },
    sideButton: {
      width: 42,
      height: 42,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    inputShell: {
      flex: 1,
      backgroundColor: theme.colors.surface,
      borderRadius: 24,
      paddingHorizontal: 14,
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
