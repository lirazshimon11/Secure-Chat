import React, { useState, useEffect } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Message, ReactionSummary } from "@/lib/types";
import { useChats } from "@/context/ChatContext";
import { getUserColor } from "@/screens/chat/ChatUtils";

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
  const { profiles, contactNicknames } = useChats();
  const [timeLeft, setTimeLeft] = useState<string | null>(null);
  const [isExpired, setIsExpired] = useState(false);

  let pollData: any;
  try {
    const rawBody = message.body_ciphertext.startsWith("[POLL]:")
      ? message.body_ciphertext.substring(7)
      : message.body_ciphertext;
    pollData = JSON.parse(rawBody);
  } catch (e) {
    return <Text style={styles.body}>שגיאה בטעינת סקר</Text>;
  }

  const optsCount = pollData.options.length;
  const expiresAt = pollData.expiresAt ? new Date(pollData.expiresAt) : null;

  // Real-time timer logic
  useEffect(() => {
    if (!expiresAt) return;

    const updateTimer = () => {
      const now = new Date();
      const diff = expiresAt.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeLeft("הסקר נסגר");
        setIsExpired(true);
        return;
      }

      const hoursTotal = Math.floor(diff / (1000 * 60 * 60));
      const days = Math.floor(hoursTotal / 24);
      const hours = hoursTotal % 24;
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      if (days > 0) {
        setTimeLeft(`${days} ימים ו-${hours} שעות`);
      } else if (hours > 0) {
        setTimeLeft(`${hours}ש ו-${minutes}ד`);
      } else if (minutes > 0) {
        setTimeLeft(`${minutes}:${seconds < 10 ? '0' : ''}${seconds}`);
      } else {
        setTimeLeft(`${seconds} שניות`);
      }
    };

    updateTimer();
    const iv = setInterval(updateTimer, 1000);
    return () => clearInterval(iv);
  }, [pollData.expiresAt]);

  const [localOverride, setLocalOverride] = useState<Record<string, boolean>>({});

  useEffect(() => {
    // Sync logic
  }, [reactions]);

  const votesPerOption = Array(optsCount).fill(0);
  const userVoted = Array(optsCount).fill(false);
  let userVoteCount = 0;

  for (let i = 0; i < optsCount; i++) {
    const key = `poll:${i}`;
    const voterIds = reactions?.[key] || [];

    let count = Array.isArray(voterIds) ? voterIds.length : 0;
    let voted = Array.isArray(voterIds) && voterIds.some(v => v.userId === currentUserId);

    if (localOverride[key] !== undefined) {
      if (localOverride[key] && !voted) {
        count++;
        voted = true;
      } else if (!localOverride[key] && voted) {
        count = Math.max(0, count - 1);
        voted = false;
      }
    }

    votesPerOption[i] = count;
    userVoted[i] = voted;
    if (voted) userVoteCount++;
  }

  const handleOptionPress = (i: number) => {
    if (isExpired) return;

    const key = `poll:${i}`;
    const currentlyVoted = userVoted[i];

    setLocalOverride(prev => {
      const next = { ...prev };
      if (!pollData.multipleAnswers && !currentlyVoted) {
        for (let j = 0; j < optsCount; j++) next[`poll:${j}`] = false;
      }
      next[key] = !currentlyVoted;
      return next;
    });

    if (!pollData.multipleAnswers && userVoteCount > 0 && !currentlyVoted) {
      const currentVoteIdx = userVoted.findIndex(v => v === true);
      if (currentVoteIdx !== -1 && currentVoteIdx !== i) {
        onToggleReaction(`poll:${currentVoteIdx}`);
      }
    }
    onToggleReaction(key);
  };

  const totalVotes = votesPerOption.reduce((a, b) => a + b, 0);

  return (
    <View style={[styles.pollCard, isExpired && { opacity: 0.6 }]}>
      <View style={{ flexDirection: Platform.OS === "web" ? 'row-reverse' : 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <Text style={[styles.pollTitle, { flex: 1, marginLeft: Platform.OS === "web" ? 8 : 0, marginRight: Platform.OS === "web" ? 0 : 8, textAlign: Platform.OS === "web" ? 'right' : 'left', writingDirection: 'rtl' }]}>{pollData.question}</Text>
        {timeLeft && (
          <View style={{ flexDirection: Platform.OS === "web" ? 'row-reverse' : 'row', alignItems: 'center', backgroundColor: isExpired ? theme.colors.surfaceMuted : theme.colors.accentStrong + "15", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 }}>
            <MaterialCommunityIcons name="clock-outline" size={14} color={isExpired ? theme.colors.textMuted : theme.colors.accentStrong} />
            <Text style={{ fontSize: 11, fontWeight: '700', color: isExpired ? theme.colors.textMuted : theme.colors.accentStrong, marginLeft: Platform.OS === "web" ? 0 : 4, marginRight: Platform.OS === "web" ? 4 : 0, writingDirection: 'rtl' }}>{isExpired ? timeLeft : `נותרו: ${timeLeft}`}</Text>
          </View>
        )}
      </View>

      <View style={[styles.pollSubtitleWrapper, { flexDirection: Platform.OS === "web" ? 'row-reverse' : 'row', justifyContent: Platform.OS === "web" ? 'flex-start' : 'flex-end', alignItems: 'center' }]}>
        <Text style={[styles.pollSubtitle, { textAlign: Platform.OS === "web" ? 'right' : 'left', writingDirection: 'rtl', marginLeft: Platform.OS === "web" ? 6 : 0, marginRight: Platform.OS === "web" ? 0 : 6 }]}>
          {pollData.isScreenshotRequest
            ? "יש לבחור כדי לאפשר צילום מסך זמני"
            : (pollData.multipleAnswers ? "צריך לבחור אפשרות אחת או יותר" : "יש לבחור אפשרות אחת")}
        </Text>
        <MaterialCommunityIcons name={pollData.isScreenshotRequest ? "shield-check-outline" : "check-all"} size={16} color={theme.colors.textMuted} />
      </View>

      {pollData.options.map((opt: string, i: number) => {
        const optionVotes = votesPerOption[i];
        const isChecked = userVoted[i];
        const progress = totalVotes > 0 ? (optionVotes / totalVotes) * 100 : 0;

        return (
          <Pressable key={i} style={styles.pollOptionRow} onPress={() => handleOptionPress(i)}>

            {/* כופה כיווניות LTR מוחלטת כדי לחסום את ההיפוכים האוטומטיים של המכשיר */}
            <View style={[styles.pollOptionInner, { flexDirection: 'row', direction: 'ltr', justifyContent: 'space-between', alignItems: 'center' }]}>

              {/* צד שמאל: המספר יהיה תמיד הכי שמאלי */}
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ minWidth: 24, alignItems: 'flex-start' }}>
                  <Text style={[styles.pollVoteCount, { textAlign: 'left' }]}>{optionVotes}</Text>
                </View>

                {/* Avatars of voters (up to 3) */}
                {optionVotes > 0 && (
                  <View style={{ flexDirection: 'row', marginLeft: 4 }}>
                    {(reactions?.[`poll:${i}`] || []).slice(0, 3).map((voter: any, idx: number) => {
                      const voterId = voter.userId;
                      const profile = profiles?.[voterId];
                      const nick = contactNicknames?.[voterId];
                      const initial = (nick?.first_name || profile?.full_name || profile?.username || "?")
                        .slice(0, 1).toUpperCase();

                      const bgColor = getUserColor(profile?.username || profile?.id || "?");

                      return (
                        <View key={voterId} style={{
                          width: 16, height: 16, borderRadius: 8, backgroundColor: bgColor,
                          marginLeft: idx > 0 ? -6 : 0, alignItems: 'center', justifyContent: 'center',
                          borderWidth: 1, borderColor: theme.colors.chatBackdrop, zIndex: 3 - idx
                        }}>
                          <Text style={{ fontSize: 8, fontWeight: '700', color: "#FFF" }}>{initial}</Text>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>

              {/* צד ימין: הטקסט והעיגול נדחפים לימין בכוח */}
              <View style={[styles.pollOptionTextWrapper, { flexDirection: 'row', direction: 'ltr', alignItems: 'center', flex: 1, justifyContent: 'flex-end' }]}>

                {/* טקסט (מופיע לפני העיגול) */}
                <Text style={[styles.pollOptionText, { marginRight: 12, textAlign: 'right', flexShrink: 1 }]}>{opt}</Text>

                {/* עיגול (מופיע אחרון - הכי ימני במסך) */}
                <View style={[styles.pollRadioCircle, isChecked && styles.pollRadioCircleChecked]}>
                  {isChecked && <MaterialCommunityIcons name="check" size={16} color={theme.colors.textOnAccent} />}
                </View>

              </View>
            </View>

            {/* כופה על פס ההתקדמות להיצמד ימינה ולהתמלא משם */}
            <View style={[styles.pollProgressContainer, { flexDirection: 'row', justifyContent: 'flex-end', width: '100%' }]}>
              <View style={[styles.pollProgressBar, { width: `${progress}%` }, isChecked && styles.pollProgressBarChecked]} />
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
