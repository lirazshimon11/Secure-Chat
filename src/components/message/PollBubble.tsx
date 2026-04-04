import React from "react";
import { Pressable, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Message, ReactionSummary } from "@/lib/types";

type PollBubbleProps = {
  message: Message;
  currentUserId: string;
  reactions?: ReactionSummary;
  theme: any;
  styles: any;
  onToggleReaction: (emoji: string) => void;
  onOpenPollVotes?: (id: string) => void;
};

export const PollBubble = ({
  message,
  currentUserId,
  reactions,
  theme,
  styles,
  onToggleReaction,
  onOpenPollVotes,
}: PollBubbleProps) => {
  let pollData: any;
  try {
    pollData = JSON.parse(message.body_ciphertext.substring(7));
  } catch (e) {
    return <Text style={styles.body}>שגיאה בטעינת סקר</Text>;
  }

  const optsCount = pollData.options.length;
  const votesPerOption = Array(optsCount).fill(0);
  const userVoted = Array(optsCount).fill(false);

  if (reactions) {
    for (let i = 0; i < optsCount; i++) {
        const voterIds = reactions[`poll:${i}`];
        if (Array.isArray(voterIds)) {
          votesPerOption[i] = voterIds.length;
          if (voterIds.includes(currentUserId)) {
            userVoted[i] = true;
          }
        }
    }
  }

  return (
    <View style={styles.pollCard}>
      <Text style={styles.pollTitle}>{pollData.question}</Text>
      <View style={styles.pollSubtitleWrapper}>
        <MaterialCommunityIcons name="check-all" size={16} color={theme.colors.textMuted} />
        <Text style={styles.pollSubtitle}>{pollData.multipleAnswers ? "צריך לבחור אפשרות אחת או יותר" : "יש לבחור אפשרות אחת"}</Text>
      </View>
      {pollData.options.map((opt: string, i: number) => {
        const optionVotes = votesPerOption[i];
        const isChecked = userVoted[i];
        return (
          <Pressable key={i} style={styles.pollOptionRow} onPress={() => onToggleReaction(`poll:${i}`)}>
            <View style={styles.pollOptionInner}>
              <View style={styles.pollOptionTextWrapper}>
                <View style={[styles.pollRadioCircle, isChecked && styles.pollRadioCircleChecked]}>
                  {isChecked && <MaterialCommunityIcons name="check" size={16} color={theme.colors.textOnAccent} />}
                </View>
                <Text style={styles.pollOptionText}>{opt}</Text>
              </View>
              <Text style={styles.pollVoteCount}>{optionVotes}</Text>
            </View>
          </Pressable>
        );
      })}
      <Pressable style={styles.pollFooter} onPress={() => onOpenPollVotes?.(message.id)}>
        <Text style={styles.pollFooterText}>הצגת ההצבעות</Text>
      </Pressable>
    </View>
  );
};
