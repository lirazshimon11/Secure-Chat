import React, { useEffect, useState, useMemo } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { MaterialCommunityIcons, Feather } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { useAppTheme } from "@/lib/theme";
import { Chat, Profile } from "@/lib/types";

type Props = {
  chat: Chat;
  currentUserId: string;
  groupMembers: Profile[];
  onClose: () => void;
  /** Called after a save that should broadcast a system message */
  onSendSystemMessage: (body: string) => Promise<void>;
};

type MemberGuardState = {
  profile: Profile;
  /** current ON/OFF state shown in the UI */
  isProtected: boolean;
  /** original state fetched from DB — used to detect changes */
  originalProtected: boolean;
  /** DB row id if protection already exists */
  rowId: string | null;
};

export function DecoyManagerOverlay({
  chat,
  currentUserId,
  groupMembers,
  onClose,
  onSendSystemMessage,
}: Props) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [guards, setGuards] = useState<MemberGuardState[]>([]);

  // Only members who are in a relationship are eligible to be protected
  const eligibleMembers = useMemo(
    () => groupMembers.filter((m) => m.is_in_relationship),
    [groupMembers],
  );

  // ── Load current decoy targets from DB ─────────────────────────────────
  useEffect(() => {
    let active = true;
    void (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("chat_decoy_targets")
        .select("id, target_id")
        .eq("chat_id", chat.id);

      if (!active) return;

      const activeTargetMap: Record<string, string> = {};
      for (const row of data ?? []) {
        activeTargetMap[row.target_id] = row.id;
      }

      setGuards(
        eligibleMembers.map((m) => ({
          profile: m,
          isProtected: !!activeTargetMap[m.id],
          originalProtected: !!activeTargetMap[m.id],
          rowId: activeTargetMap[m.id] ?? null,
        })),
      );
      setLoading(false);
    })();
    return () => { active = false; };
  }, [chat.id, eligibleMembers]);

  const toggleGuard = (userId: string) => {
    setErrorMsg(null);
    setGuards((prev) =>
      prev.map((g) =>
        g.profile.id === userId ? { ...g, isProtected: !g.isProtected } : g,
      ),
    );
  };

  // ── Save changes ────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (saving) return;
    setErrorMsg(null);

    // Check if current user is trying to remove protection from themselves
    const selfGuard = guards.find(
      (g) => g.profile.id === currentUserId && g.originalProtected && !g.isProtected,
    );
    if (selfGuard) {
      setErrorMsg("אינך רשאי/ת לבטל את ההגנה עבור עצמך.");
      return;
    }

    setSaving(true);
    const toActivate = guards.filter(
      (g) => g.isProtected && !g.originalProtected,
    );
    const toDeactivate = guards.filter(
      (g) => !g.isProtected && g.originalProtected,
    );

    // Insert new protections
    if (toActivate.length > 0) {
      await supabase.from("chat_decoy_targets").insert(
        toActivate.map((g) => ({
          chat_id: chat.id,
          target_id: g.profile.id,
          enabled_by: currentUserId,
        })),
      );
    }

    // Delete removed protections (server RLS also prevents self-removal)
    for (const g of toDeactivate) {
      if (g.rowId) {
        await supabase
          .from("chat_decoy_targets")
          .delete()
          .eq("id", g.rowId);
      }
    }

    // Send system message(s)
    if (toActivate.length > 0) {
      const names = toActivate
        .map((g) => g.profile.full_name || g.profile.username)
        .join(", ");
      await onSendSystemMessage(`[SYSTEM_DECOY_ON]:${names}`);
    }
    if (toDeactivate.length > 0) {
      const names = toDeactivate
        .map((g) => g.profile.full_name || g.profile.username)
        .join(", ");
      await onSendSystemMessage(`[SYSTEM_DECOY_OFF]:${names}`);
    }

    setSaving(false);
    onClose();
  };

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={onClose} style={styles.closeBtn}>
          <Feather name="x" size={22} color={theme.colors.textMuted} />
        </Pressable>
        <View style={styles.headerTitle}>
          <MaterialCommunityIcons
            name="shield-check"
            size={22}
            color={theme.colors.accent}
          />
          <Text style={styles.headerText}>ניהול מגן הגנה</Text>
        </View>
      </View>

      <Text style={styles.subLabel}>
        חברים בזוגיות — ניתן להפעיל עליהם מסך הגנה
      </Text>

      {/* Error message */}
      {errorMsg && (
        <View style={styles.errorBox}>
          <Feather name="alert-circle" size={16} color="#E91E8C" />
          <Text style={styles.errorText}>{errorMsg}</Text>
        </View>
      )}

      {/* Loading */}
      {loading ? (
        <ActivityIndicator
          color={theme.colors.accent}
          size="large"
          style={{ flex: 1, marginTop: 40 }}
        />
      ) : eligibleMembers.length === 0 ? (
        <View style={styles.emptyState}>
          <MaterialCommunityIcons
            color={theme.colors.textMuted}
            name="heart-off-outline"
            size={48}
          />
          <Text style={styles.emptyTitle}>אין חברים בזוגיות</Text>
          <Text style={styles.emptySub}>
            רק חברים שהגדירו את עצמם כבזוגיות יופיעו כאן.
          </Text>
        </View>
      ) : (
        <FlatList
          data={guards}
          keyExtractor={(item) => item.profile.id}
          renderItem={({ item }) => {
            const displayName =
              item.profile.full_name || item.profile.username;
            const initial = item.profile.username.slice(0, 1).toUpperCase();
            const isSelf = item.profile.id === currentUserId;

            return (
              <View style={styles.memberRow}>
                {/* Avatar */}
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{initial}</Text>
                </View>
                {/* Name */}
                <View style={styles.memberInfo}>
                  <Text style={styles.memberName}>{displayName}</Text>
                  <View style={styles.relBadge}>
                    <MaterialCommunityIcons
                      name="heart"
                      size={12}
                      color="#E91E8C"
                    />
                    <Text style={styles.relText}>בזוגיות</Text>
                  </View>
                </View>
                {/* Guard switch — self cannot deactivate their own protection */}
                <Switch
                  disabled={isSelf && item.originalProtected}
                  onValueChange={() => toggleGuard(item.profile.id)}
                  thumbColor={item.isProtected ? theme.colors.accent : theme.colors.textMuted}
                  trackColor={{
                    false: theme.colors.surfaceMuted,
                    true: theme.colors.accentSoft,
                  }}
                  value={item.isProtected}
                />
              </View>
            );
          }}
          style={styles.list}
        />
      )}

      {/* Save FAB */}
      {!loading && eligibleMembers.length > 0 && (
        <Pressable
          disabled={saving}
          onPress={handleSave}
          style={[styles.saveFab, saving && { opacity: 0.6 }]}
        >
          {saving ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <MaterialCommunityIcons name="shield-check" size={20} color="#fff" />
              <Text style={styles.saveFabText}>שמור</Text>
            </>
          )}
        </Pressable>
      )}
    </View>
  );
}

const createStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      paddingTop: 8,
    },
    header: {
      flexDirection: "row-reverse",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 12,
      gap: 12,
    },
    closeBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.surfaceMuted,
    },
    headerTitle: {
      flexDirection: "row-reverse",
      alignItems: "center",
      gap: 8,
      flex: 1,
      justifyContent: "flex-start",
    },
    headerText: {
      fontSize: 17,
      fontWeight: "800",
      color: theme.colors.text,
      textAlign: "right",
      writingDirection: "rtl",
    },
    subLabel: {
      fontSize: 13,
      color: theme.colors.textMuted,
      paddingHorizontal: 16,
      marginBottom: 8,
      textAlign: "right",
      writingDirection: "rtl",
    },
    errorBox: {
      flexDirection: "row-reverse",
      alignItems: "center",
      gap: 8,
      marginHorizontal: 16,
      marginBottom: 8,
      backgroundColor: "#FFF0F6",
      borderRadius: 10,
      padding: 12,
      borderWidth: 1,
      borderColor: "#E91E8C44",
    },
    errorText: {
      fontSize: 14,
      color: "#E91E8C",
      fontWeight: "600",
      flex: 1,
      textAlign: "right",
      writingDirection: "rtl",
    },
    list: {
      flex: 1,
    },
    memberRow: {
      flexDirection: "row-reverse",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 12,
      gap: 12,
    },
    avatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: theme.colors.surfaceMuted,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarText: {
      fontSize: 20,
      fontWeight: "700",
      color: theme.colors.accent,
    },
    memberInfo: {
      flex: 1,
    },
    memberName: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.text,
      textAlign: "right",
      writingDirection: "rtl",
    },
    relBadge: {
      flexDirection: "row-reverse",
      alignItems: "center",
      gap: 4,
      marginTop: 2,
      justifyContent: "flex-start",
    },
    relText: {
      fontSize: 12,
      color: "#E91E8C",
      fontWeight: "600",
      textAlign: "right",
      writingDirection: "rtl",
    },
    emptyState: {
      flex: 1,
      alignItems: "center",
      paddingTop: 60,
      gap: 12,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.colors.text,
    },
    emptySub: {
      fontSize: 14,
      color: theme.colors.textMuted,
      textAlign: "center",
      paddingHorizontal: 32,
    },
    saveFab: {
      flexDirection: "row-reverse",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: theme.colors.accent,
      margin: 16,
      borderRadius: 14,
      paddingVertical: 14,
      elevation: 4,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 4,
    },
    saveFabText: {
      color: "#fff",
      fontSize: 16,
      fontWeight: "800",
    },
  });
