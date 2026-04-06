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
                  <View style={styles.voteCountRow}>
                    <Text style={styles.voteCountText}>{voterIds.length}</Text>
                    <Text style={styles.voteStar}>★</Text>
                  </View>
                ) : (
                  <Text style={styles.voteCountZero}>0</Text>
                )}
              </View>

              {Array.isArray(voterIds) && voterIds.map((voter) => {
                const uid = voter.userId;
                const userProfile = profiles[uid];
                const isMe = uid === currentUserId;
                const displayName = isMe ? "את/ה" : userProfile?.username || "משתמש אנונימי";

                // Format the relative time
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
                    <View style={styles.avatarEmpty}>
                      <MaterialCommunityIcons name="account" size={30} color={theme.colors.border} style={styles.avatarIcon} />
                    </View>
                    <View style={styles.voterInfo}>
                      <Text style={styles.voterName}>{displayName}</Text>
                      {timeLabel ? <Text style={styles.voterSub}>{timeLabel}</Text> : null}
                    </View>
                  </View>
                );
              })}
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
      flexDirection: "row", // שונה ל-row כדי שהטקסט יהיה בשמאל
      alignItems: "center",
      justifyContent: "space-between",
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    optionHeaderText: {
      fontSize: 16,
      fontWeight: "bold",
      color: theme.colors.text,
    },
    voteCountRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    voteCountText: {
      fontSize: 14,
      color: theme.colors.textMuted,
      fontWeight: "600",
    },
    voteCountZero: {
      fontSize: 14,
      color: theme.colors.textMuted,
    },
    voteStar: {
      color: theme.colors.textMuted,
      fontSize: 14,
    },
    voterRow: {
      flexDirection: "row", // שונה ל-row
      alignItems: "center",
      justifyContent: "flex-start", // מיושר לשמאל
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    voterInfo: {
      flex: 1,
      alignItems: "flex-start", // מיושר לשמאל
    },
    voterName: {
      fontSize: 16,
      fontWeight: "bold",
      color: theme.colors.text,
      textAlign: "left",
    },
    voterSub: {
      fontSize: 13,
      color: theme.colors.textMuted,
      marginTop: 2,
    },
    avatarEmpty: {
      width: 40,
      height: 40,
      borderRadius: 20,
      overflow: "hidden",
      marginRight: 14, // שונה ל-marginRight כדי להרחיק את הטקסט
      backgroundColor: theme.colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarIcon: {
      marginTop: 4,
    },
    divider: {
      height: 8,
      backgroundColor: theme.colors.border,
    },
  });