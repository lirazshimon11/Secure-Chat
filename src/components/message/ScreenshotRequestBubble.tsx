import React from "react";
import { Pressable, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Message } from "@/lib/types";

type Props = {
  message: Message;
  currentUserId: string;
  allRequests: any;
  theme: any;
  styles: any;
  approveRequest: (id: string) => void;
  denyRequest: (id: string) => void;
};

export const ScreenshotRequestBubble = ({
  message,
  currentUserId,
  allRequests,
  theme,
  styles,
  approveRequest,
  denyRequest,
}: Props) => {
  const reqId = message.body_ciphertext.split(":")[1];
  const scReq = allRequests[reqId];
  if (!scReq) return <Text style={styles.body}>טוען בקשה...</Text>;

  const isApproved = scReq.status === "approved" || (scReq.approvals && scReq.approvals.length > 0);
  const isDenied = scReq.status === "denied";
  const approvedCount = scReq.approvals ? scReq.approvals.length : 0;
  const requesterName = scReq.requesterUsername || "המשתמש";
  const isMine = scReq.requester_id === currentUserId;

  return (
    <View style={styles.pollCard}>
      <Text style={styles.pollTitle}>
        {`האם אתה מאשר ל-${requesterName} לבצע צילום מסך?`}
      </Text>
      <View style={styles.pollSubtitleWrapper}>
        <MaterialCommunityIcons name="camera-outline" size={16} color={theme.colors.textMuted} />
        <Text style={styles.pollSubtitle}>דרוש אישור ממשתתף אחד או יותר</Text>
      </View>

      <Pressable
        style={({ pressed }) => [styles.pollOptionRow, pressed && { opacity: 0.7 }]}
        onPress={() => !isApproved && !isDenied && approveRequest(reqId)}
      >
        <View style={styles.pollOptionInner} pointerEvents="none">
          <View style={styles.pollOptionTextWrapper}>
            <View style={[styles.pollRadioCircle, isApproved && styles.pollRadioCircleChecked]}>
              {isApproved && <MaterialCommunityIcons name="check" size={14} color={theme.colors.textOnAccent} />}
            </View>
            <Text style={styles.pollOptionText}>מאשר</Text>
          </View>
          <Text style={styles.pollVoteCount}>{approvedCount}</Text>
        </View>
      </Pressable>

      <Pressable
        style={({ pressed }) => [styles.pollOptionRow, pressed && { opacity: 0.7 }]}
        onPress={() => !isApproved && !isDenied && denyRequest(reqId)}
      >
        <View style={styles.pollOptionInner} pointerEvents="none">
          <View style={styles.pollOptionTextWrapper}>
            <View style={[styles.pollRadioCircle, isDenied && styles.pollRadioCircleChecked]}>
              {isDenied && <MaterialCommunityIcons name="check" size={14} color={theme.colors.textOnAccent} />}
            </View>
            <Text style={styles.pollOptionText}>מסרב</Text>
          </View>
          <Text style={styles.pollVoteCount}>{isDenied ? "1" : "0"}</Text>
        </View>
      </Pressable>

      <View style={styles.pollFooter}>
        <Text style={styles.pollFooterText}>
          {isApproved ? "✅ הבקשה אושרה" : isDenied ? "❌ הבקשה נדחתה" : "ממתין לתגובה..."}
        </Text>
      </View>
    </View>
  );
};
