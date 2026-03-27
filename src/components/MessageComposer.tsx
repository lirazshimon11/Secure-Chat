import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { theme } from "@/lib/theme";

type Props = {
  replyPreview: string | null;
  onCancelReply: () => void;
  onSend: (body: string, kind: "standard" | "temporary" | "view_once", expireSeconds: number | null) => void;
};

export function MessageComposer({ replyPreview, onCancelReply, onSend }: Props) {
  const [body, setBody] = useState("");
  const [kind, setKind] = useState<"standard" | "temporary" | "view_once">("standard");

  const expireSeconds = kind === "temporary" ? 60 : null;

  function handleSend() {
    if (!body.trim()) {
      return;
    }

    onSend(body, kind, expireSeconds);
    setBody("");
    setKind("standard");
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

      <View style={styles.composerRow}>
        <Pressable style={styles.sideButton}>
          <Feather color={theme.colors.textMuted} name="smile" size={20} />
        </Pressable>
        <View style={styles.inputShell}>
          <TextInput
            multiline
            onChangeText={setBody}
            placeholder="Type a message"
            placeholderTextColor={theme.colors.textMuted}
            style={styles.input}
            value={body}
          />
        </View>
        <Pressable onPress={handleSend} style={styles.sendButton}>
          <Feather color={theme.colors.textOnAccent} name="send" size={18} />
        </Pressable>
      </View>
    </View>
  );
}

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
    <Pressable onPress={onPress} style={[styles.modeChip, active && styles.modeChipActive]}>
      <MaterialCommunityIcons color={active ? theme.colors.accent : theme.colors.textMuted} name={icon} size={15} />
      <Text style={[styles.modeLabel, active && styles.modeLabelActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: theme.colors.background,
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
  composerRow: {
    flexDirection: "row",
    alignItems: "flex-end",
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
    maxHeight: 120,
    paddingTop: 10,
    paddingBottom: 10,
    textAlignVertical: "center",
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
