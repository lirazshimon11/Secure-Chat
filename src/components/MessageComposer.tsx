import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { theme } from "@/lib/theme";
import { PrimaryButton } from "@/components/PrimaryButton";

type Props = {
  replyPreview: string | null;
  onCancelReply: () => void;
  onSend: (body: string, kind: "standard" | "temporary" | "view_once", expireSeconds: number | null) => void;
};

export function MessageComposer({ replyPreview, onCancelReply, onSend }: Props) {
  const [body, setBody] = useState("");
  const [kind, setKind] = useState<"standard" | "temporary" | "view_once">("standard");

  const expireSeconds = kind === "temporary" ? 60 : null;

  return (
    <View style={styles.container}>
      {replyPreview ? (
        <View style={styles.replyBanner}>
          <View style={styles.replyText}>
            <Text style={styles.replyLabel}>Replying to</Text>
            <Text numberOfLines={1} style={styles.replyPreview}>
              {replyPreview}
            </Text>
          </View>
          <Pressable onPress={onCancelReply}>
            <Text style={styles.replyCancel}>Cancel</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.modeRow}>
        <ComposerModeChip active={kind === "standard"} label="Normal" onPress={() => setKind("standard")} />
        <ComposerModeChip active={kind === "temporary"} label="60s vanish" onPress={() => setKind("temporary")} />
        <ComposerModeChip active={kind === "view_once"} label="View once" onPress={() => setKind("view_once")} />
      </View>

      <TextInput
        multiline
        onChangeText={setBody}
        placeholder="Write a message..."
        placeholderTextColor={theme.colors.textMuted}
        style={styles.input}
        value={body}
      />

      <PrimaryButton
        label="Send"
        onPress={() => {
          onSend(body, kind, expireSeconds);
          setBody("");
          setKind("standard");
        }}
      />
    </View>
  );
}

function ComposerModeChip({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
  },
  replyBanner: {
    alignItems: "center",
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    flexDirection: "row",
    justifyContent: "space-between",
    padding: theme.spacing.sm,
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
  replyCancel: {
    color: theme.colors.danger,
    fontWeight: "700",
  },
  modeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.xs,
  },
  chip: {
    backgroundColor: theme.colors.surfaceStrong,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipActive: {
    backgroundColor: theme.colors.accent,
  },
  chipText: {
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: "700",
  },
  chipTextActive: {
    color: "#ffffff",
  },
  input: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    color: theme.colors.text,
    fontSize: 16,
    minHeight: 72,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    textAlignVertical: "top",
  },
});
