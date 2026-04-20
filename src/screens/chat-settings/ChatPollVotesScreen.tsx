import React from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useAppTheme } from "@/lib/theme";
import { Message, Profile, ReactionSummary } from "@/lib/types";
import { useChats } from "@/context/ChatContext";

type Props = {
  message: Message;
  reactions?: ReactionSummary;
  onBack: () => void;
  currentUserId: string;
};

export function ChatPollVotesScreen({ message, reactions, onBack, currentUserId }: Props) {
  const theme = useAppTheme();
  const styles = createStyles(theme);
  const { profiles } = useChats();

  let pollData: any;
  try {
    pollData = JSON.parse(message.body_ciphertext.substring(7));
  } catch (e) {
    pollData = { question: "שגיאה", options: [] };
  }

  return (
    <View style={styles.root}>
      <SafeAreaView edges={["top"]} style={styles.headerSafeArea}>
        <View style={styles.header}>
          <Pressable onPress={onBack} style={styles.backButton}>
            <Feather color={theme.colors.headerIcon} name="arrow-right" size={24} />
          </Pressable>
          <Text style={styles.headerTitle}>הצבעות בסקרים</Text>
        </View>
      </SafeAreaView>
      <ScrollView style={styles.content}>
        <View style={styles.questionSection}>
          <Text style={styles.questionText}>{pollData.question}</Text>
        </View>

        {pollData.options.map((opt: string, i: number) => {
          const voterIds = reactions?.[`poll:${i}`] || [];
          
          return (
            <View key={i}>
              <View style={styles.optionHeader}>
                <Text style={styles.optionHeaderText}>{opt}</Text>
                {voterIds.length > 0 ? (
                  <View style={styles.voteCountBadge}>
                    <Text style={styles.voteCountTextBadge}>{voterIds.length}</Text>
                  </View>
                ) : (
                  <Text style={styles.voteCountZero}>0</Text>
                )}
              </View>

              {voterIds.length === 0 ? (
                <View style={styles.noVotesRow}>
                  <Text style={styles.noVotesText}>אין הצבעות עדיין</Text>
                </View>
              ) : (
                Array.isArray(voterIds) && voterIds.map((voter) => {
                  const uid = voter.userId;
                  const userProfile = profiles[uid];
                  const isMe = uid === currentUserId;
                  const rawName = userProfile?.full_name || userProfile?.username || "משתתף/ת";
                  const displayName = isMe ? "את/ה" : rawName;
                  
                  const colors = ["#34B7F1", "#53D669", "#FFBC2E", "#FF5B5B", "#A529E7", "#E91E63", "#F28C28", "#8E44AD"];
                  let hash = 0;
                  const keyForColor = userProfile?.username || userProfile?.id || "?";
                  for (let k = 0; k < (keyForColor?.length || 0); k++) hash = keyForColor.charCodeAt(k) + ((hash << 5) - hash);
                  const bgColor = colors[Math.abs(hash) % colors.length];
                  const initial = rawName.slice(0, 1).toUpperCase();

                  let timeLabel = "";
                  if (voter.createdAt) {
                     const diff = Date.now() - new Date(voter.createdAt).getTime();
                     if (diff < 60000) timeLabel = "ממש עכשיו";
                     else {
                        const mins = Math.floor(diff / 60000);
                        if (mins < 60) timeLabel = `לפני ${mins} דקות`;
                        else {
                           const hours = Math.floor(mins / 60);
                           if (hours < 24) timeLabel = `לפני ${hours} שעות`;
                           else timeLabel = new Date(voter.createdAt).toLocaleDateString("he-IL");
                        }
                     }
                  }

                  return (
                    <View key={uid} style={styles.voterRow}>
                      <View style={[styles.avatarCircle, { backgroundColor: bgColor }]}>
                        {(userProfile as any)?.avatar_url ? (
                          <Image source={{ uri: (userProfile as any).avatar_url }} style={styles.avatarImage} />
                        ) : (
                          <Text style={styles.avatarInitial}>{initial}</Text>
                        )}
                      </View>
                      <View style={styles.voterInfo}>
                        <Text style={styles.voterName}>{displayName}</Text>
                        {timeLabel ? <Text style={styles.voterSub}>{timeLabel}</Text> : null}
                      </View>
                    </View>
                  );
                })
              )}
              <View style={styles.divider} />
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    headerSafeArea: {
      backgroundColor: theme.colors.header,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    header: {
      flexDirection: "row-reverse",
      alignItems: "center",
      justifyContent: "space-between",
      height: 60,
      paddingHorizontal: 16,
    },
    backButton: {
      padding: 8,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: "bold",
      color: theme.colors.text,
      flex: 1,
      textAlign: "left", // שונה לימין
      paddingRight: 16,
    },
    content: {
      flex: 1,
    },
    questionSection: {
      padding: 16,
      borderBottomWidth: 4,
      borderBottomColor: theme.colors.border,
    },
    questionText: {
      fontSize: 16,
      fontWeight: "bold",
      color: theme.colors.text,
      textAlign: "left",
    },
    optionHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    optionHeaderText: {
      fontSize: 15,
      fontWeight: "700",
      color: theme.colors.accent,
    },
    voteCountBadge: {
      backgroundColor: theme.colors.accent + "20",
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 12,
    },
    voteCountTextBadge: {
      fontSize: 14,
      color: theme.colors.accent,
      fontWeight: "700",
    },
    voteCountZero: {
      fontSize: 14,
      color: theme.colors.textMuted,
      fontWeight: "600",
    },
    voterRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-start",
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    noVotesRow: {
      paddingHorizontal: 16,
      paddingVertical: 20,
      alignItems: "center",
    },
    noVotesText: {
      color: theme.colors.textMuted,
      fontSize: 14,
    },
    avatarCircle: {
      width: 44,
      height: 44,
      borderRadius: 22,
      overflow: "hidden",
      marginRight: 14,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarImage: {
      width: "100%",
      height: "100%",
    },
    avatarInitial: {
      color: "#FFF",
      fontSize: 20,
      fontWeight: "600",
    },
    voterInfo: {
      flex: 1,
      alignItems: "flex-start",
    },
    voterName: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.text,
      textAlign: "left",
    },
    voterSub: {
      fontSize: 13,
      color: theme.colors.textMuted,
      marginTop: 2,
    },
    divider: {
      height: 8,
      backgroundColor: theme.colors.chatBackdrop,
    },
  });