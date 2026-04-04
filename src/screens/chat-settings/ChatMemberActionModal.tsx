import { useEffect, useRef } from "react";
import { Modal, StyleSheet, Text, View, Pressable, Animated, PanResponder, Dimensions } from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useAppTheme } from "@/lib/theme";
import { Profile } from "@/lib/types";

type Props = {
  visible: boolean;
  onClose: () => void;
  member: Profile | null;
  nickname?: string;
  onMessage: (member: Profile) => void;
  onDetails?: (member: Profile) => void;
  onSetAdmin?: (memberId: string) => void;
  onRemove?: (member: Profile) => void;
};

const SCREEN_HEIGHT = Dimensions.get("window").height;
const MODAL_HEIGHT = 450;

export function ChatMemberActionModal({ visible, onClose, member, nickname, onMessage, onDetails, onSetAdmin, onRemove }: Props) {
  const theme = useAppTheme();
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        bounciness: 0,
      }).start();
    }
  }, [visible, translateY]);

  const closeBottomSheet = () => {
    Animated.timing(translateY, {
      toValue: SCREEN_HEIGHT,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      onClose();
    });
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dy) > 10;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          translateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > MODAL_HEIGHT / 3 || gestureState.vy > 0.5) {
          closeBottomSheet();
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 0,
          }).start();
        }
      },
    })
  ).current;

  if (!member) return null;

  const displayName = nickname || member.full_name || member.username;
  const initial = (nickname || member.username).slice(0, 1).toUpperCase();

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={closeBottomSheet}>
      <View style={styles.overlayRoot}>
        <Pressable style={styles.backdrop} onPress={closeBottomSheet} />

        <Animated.View {...panResponder.panHandlers} style={[styles.sheetContainer, { backgroundColor: theme.colors.surface, transform: [{ translateY }] }]}>
          <View style={styles.dragHandleContainer}>
            <View style={styles.dragHandle} />
          </View>

          <View style={styles.content}>
            <View style={styles.avatar}>
              <Text style={[styles.avatarText, { color: theme.colors.accent }]}>{initial}</Text>
            </View>

            <Text style={[styles.memberName, { color: theme.colors.text }]}>{displayName}</Text>
            <View style={styles.actionsBox}>
              <Pressable style={[styles.actionBtn, { borderColor: theme.colors.separator }]} onPress={() => { }}>
                <View style={styles.actionIconBox}>
                  <MaterialCommunityIcons name="video-outline" size={24} color={theme.colors.accent} />
                </View>
                <Text style={[styles.actionBtnText, { color: theme.colors.text }]}>וידאו</Text>
              </Pressable>

              <Pressable style={[styles.actionBtn, { borderColor: theme.colors.separator }]} onPress={() => { }}>
                <View style={styles.actionIconBox}>
                  <MaterialCommunityIcons name="phone-outline" size={24} color={theme.colors.accent} />
                </View>
                <Text style={[styles.actionBtnText, { color: theme.colors.text }]}>שיחה</Text>
              </Pressable>

              <Pressable style={[styles.actionBtn, { borderColor: theme.colors.separator }]} onPress={() => {
                closeBottomSheet();
                onMessage(member);
              }}>
                <View style={styles.actionIconBox}>
                  <MaterialCommunityIcons name="message-outline" size={24} color={theme.colors.accent} />
                </View>
                <Text style={[styles.actionBtnText, { color: theme.colors.text }]}>הודעה</Text>
              </Pressable>
            </View>

            <View style={styles.settingsList}>
              <Pressable style={styles.settingRow} onPress={() => onDetails?.(member)}>
                <View style={styles.settingIconBox}>
                  <Feather name="info" size={20} color={theme.colors.textMuted} />
                </View>
                <Text style={[styles.settingRowText, { color: theme.colors.text }]}>פרטים</Text>
              </Pressable>

              <Pressable style={styles.settingRow}>
                <View style={styles.settingIconBox}>
                  <Feather name="lock" size={20} color={theme.colors.textMuted} />
                </View>
                <Text style={[styles.settingRowText, { color: theme.colors.text }]}>אימות קוד אבטחה</Text>
              </Pressable>

              {onSetAdmin && (
                <Pressable style={styles.settingRow} onPress={() => onSetAdmin(member.id)}>
                  <View style={styles.settingIconBox}>
                    <Feather name="user-plus" size={20} color={theme.colors.textMuted} />
                  </View>
                  <Text style={[styles.settingRowText, { color: theme.colors.text }]}>הגדרה כמנהל/ת הקבוצה</Text>
                </Pressable>
              )}

              {onRemove && (
                <Pressable style={styles.settingRow} onPress={() => onRemove(member)}>
                  <View style={styles.settingIconBox}>
                    <Feather name="minus-circle" size={20} color={theme.colors.danger} />
                  </View>
                  <Text style={[styles.settingRowText, { color: theme.colors.danger }]}>הסרה מהקבוצה</Text>
                </Pressable>
              )}
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlayRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
  },
  sheetContainer: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    minHeight: MODAL_HEIGHT,
    paddingBottom: 40,
  },
  dragHandleContainer: {
    alignItems: "center",
    paddingVertical: 12,
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#D1D5DB",
  },
  content: {
    alignItems: "center",
    paddingHorizontal: 16,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: "600",
  },
  memberName: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 24,
  },
  memberPhone: {
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 24,
  },
  actionsBox: {
    flexDirection: "row-reverse",
    gap: 12,
    paddingHorizontal: 8,
    width: "100%",
    marginBottom: 24,
  },
  actionBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  actionIconBox: {
    marginBottom: 8,
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: "700",
  },
  settingsList: {
    width: "100%",
    paddingHorizontal: 8,
  },
  settingRow: {
    alignItems: "center",
    paddingVertical: 16,
    flexDirection: "row",
    justifyContent: "flex-start",
    paddingHorizontal: 16,
    gap: 16,
  },
  settingIconBox: {
    width: 32,
    alignItems: "center",
  },
  settingRowText: {
    fontSize: 16,
    fontWeight: "700",
    textAlign: "right",
  },
});
