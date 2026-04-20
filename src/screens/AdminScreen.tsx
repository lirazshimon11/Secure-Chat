import React, { useState, useEffect } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  ActivityIndicator,
  Modal,
  Animated
} from "react-native";
import { MaterialCommunityIcons, Feather } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAppTheme } from "@/lib/theme";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { useChats } from "@/context/ChatContext";

// --- CHANGE THIS PASSWORD IF NEEDED ---
const MASTER_ADMIN_PASS = "H*@_URqFUQ9#-RFX20P3>ge:Erm2FB";

type Props = {
  onBack: () => void;
};

export function AdminScreen({ onBack }: Props) {
  const theme = useAppTheme();
  const { profile } = useAuth();
  const { refreshChats, hardResetChats } = useChats();
  const [loading, setLoading] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showPassModal, setShowPassModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => Promise<void>) | null>(null);
  const [masterPassInput, setMasterPassInput] = useState("");
  const [targetUser, setTargetUser] = useState("");
  const [targetPass, setTargetPass] = useState("");

  // Toast State
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastY = useState(new Animated.Value(-100))[0];

  const styles = createStyles(theme);

  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    Animated.sequence([
      Animated.spring(toastY, { toValue: 40, useNativeDriver: true }),
      Animated.delay(2500),
      Animated.timing(toastY, { toValue: -100, duration: 300, useNativeDriver: true })
    ]).start(() => setToastMsg(null));
  };

  const handleActionClick = (action: () => Promise<void>) => {
    setPendingAction(() => action);
    setMasterPassInput("");
    setShowPassModal(true);
  };

  const checkMasterPass = async () => {
    if (masterPassInput === MASTER_ADMIN_PASS) {
      setShowPassModal(false);
      if (pendingAction) {
        await pendingAction();
        setPendingAction(null);
      }
    } else {
      Alert.alert("שגיאה", "סיסמת מנהל לא נכונה!");
    }
  };

  const wipeAllData = async () => {
    setLoading(true);
    try {
      // Calling the Comprehensive Master RPC we created in Supabase SQL Editor
      const { error } = await supabase.rpc('admin_wipe_everything_totally');

      if (error) throw error;

      // Force an absolute clear locally and wait for DB views to settle
      hardResetChats();
      setTimeout(() => {
        void refreshChats(true);
      }, 1500);

      triggerToast("כל בסיס הנתונים נוקה לחלוטין (מלבד המנהל)");
    } catch (e: any) {
      console.error("Wipe failed:", e);
      Alert.alert("שגיאה", "הפונקציה בשרת לא נמצאה. וודא שהרצת את ה-SQL ב-Supabase.");
    } finally {
      setLoading(false);
    }
  };

  const wipeContentButProfiles = async () => {
    setLoading(true);
    try {
      // Precise Master RPC call for your actual tables
      const { error } = await supabase.rpc('admin_wipe_all_data_except_profiles');

      if (error) throw error;

      // Force an absolute clear locally and wait for DB views to settle
      hardResetChats();
      setTimeout(() => {
        void refreshChats(true);
      }, 1500);

      triggerToast("בוצע ניקוי עמוק! כל הצ'אטים והמידע הוסרו.");
    } catch (e: any) {
      console.error("Wipe failed:", e);
      Alert.alert("שגיאה", "הפונקציה בשרת לא נמצאה. וודא שהרצת את ה-SQL המעודכן ב-Supabase.");
    } finally {
      setLoading(false);
    }
  };

  const deleteSpecificUser = async () => {
    if (!targetUser) return;
    setLoading(true);
    try {
      const { data: targetProfile, error: findError } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", targetUser)
        .single();

      if (findError || !targetProfile) throw new Error("המשתמש לא נמצא");
      await supabase.from("profiles").delete().eq("id", targetProfile.id);

      triggerToast(`המשתמש ${targetUser} הוסר מהמערכת`);
      setShowUserModal(false);
    } catch (e: any) {
      Alert.alert("שגיאה", e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {toastMsg && (
        <Animated.View style={[styles.toastBubble, { transform: [{ translateY: toastY }] }]}>
          <MaterialCommunityIcons name="check-circle" size={20} color="#fff" style={{ marginLeft: 8 }} />
          <Text style={styles.toastText}>{toastMsg}</Text>
        </Animated.View>
      )}

      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.backBtn}>
          <Feather color={theme.colors.headerIcon} name="arrow-right" size={24} />
        </Pressable>
        <Text style={styles.headerTitle}>הרשאות מנהל</Text>
        <View style={{ width: 48 }} />
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.adminBanner}>
          <MaterialCommunityIcons name="shield-crown" size={60} color={theme.colors.accent} />
          <Text style={styles.bannerText}>מרכז בקרה - High Priority Admin</Text>
          <Text style={styles.bannerSubtext}>היזהר! כל הפעולות כאן הן קריטיות ואינן ניתנות לשחזור.</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>פעולות ניקוי מאסיביות</Text>

          <Pressable style={styles.actionItem} onPress={() => handleActionClick(wipeAllData)}>
            <View style={[styles.iconWrap, { backgroundColor: "#FF4B4B15" }]}>
              <MaterialCommunityIcons name="database-remove" size={24} color="#FF4B4B" />
            </View>
            <View style={styles.actionInfo}>
              <Text style={[styles.actionTitle, { color: "#FF4B4B" }]}>מחיקה טוטאלית (DB Wipe)</Text>
              <Text style={styles.actionDesc}>מוחק הכל מלבד המחתית של המערכת (משאיר רק אותך).</Text>
            </View>
            <Feather name="chevron-left" size={20} color={theme.colors.textMuted} />
          </Pressable>

          <Pressable style={styles.actionItem} onPress={() => handleActionClick(wipeContentButProfiles)}>
            <View style={[styles.iconWrap, { backgroundColor: "#FFA50015" }]}>
              <MaterialCommunityIcons name="message-off" size={24} color="#FFA500" />
            </View>
            <View style={styles.actionInfo}>
              <Text style={[styles.actionTitle, { color: "#FFA500" }]}>ניקוי הכל (שומר משתמשים)</Text>
              <Text style={styles.actionDesc}>מוחק קבוצות, הודעות ואנשי קשר. משאיר משתמשים.</Text>
            </View>
            <Feather name="chevron-left" size={20} color={theme.colors.textMuted} />
          </Pressable>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ניהול משתמשים פרטני</Text>

          <Pressable style={styles.actionItem} onPress={() => setShowUserModal(true)}>
            <View style={[styles.iconWrap, { backgroundColor: theme.colors.accent + "15" }]}>
              <MaterialCommunityIcons name="account-remove" size={24} color={theme.colors.accent} />
            </View>
            <View style={styles.actionInfo}>
              <Text style={styles.actionTitle}>מחיקת משתמש ספציפי</Text>
              <Text style={styles.actionDesc}>הסרת משתמש לצמיתות לפי שם.</Text>
            </View>
            <Feather name="chevron-left" size={20} color={theme.colors.textMuted} />
          </Pressable>
        </View>
      </ScrollView>

      {/* Master Password Modal */}
      <Modal visible={showPassModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.lockIconWrap}>
              <MaterialCommunityIcons name="lock-alert" size={32} color="#FFBC2E" />
            </View>
            <Text style={styles.modalTitle}>אימות מנהל נדרש</Text>
            <Text style={styles.modalSub}>הזן את הסיסמה המיוחדת לביצוע פעולת מחיקה</Text>

            <TextInput
              placeholder="סיסמת מנהל"
              placeholderTextColor={theme.colors.textMuted}
              style={styles.input}
              value={masterPassInput}
              onChangeText={setMasterPassInput}
              secureTextEntry
              autoFocus
            />

            <View style={styles.modalBtns}>
              <Pressable style={[styles.modalBtn, styles.cancelBtn]} onPress={() => setShowPassModal(false)}>
                <Text style={styles.cancelBtnText}>ביטול</Text>
              </Pressable>
              <Pressable style={[styles.modalBtn, styles.confirmBtn, { backgroundColor: theme.colors.accent }]} onPress={checkMasterPass}>
                <Text style={styles.confirmActionLabel}>אימות והמשך</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete User Modal */}
      <Modal visible={showUserModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>מחיקת משתמש</Text>
            <Text style={styles.modalSub}>לאחר האישור תתבקש להזין סיסמת מנהל</Text>

            <TextInput
              placeholder="שם משתמש למחיקה"
              placeholderTextColor={theme.colors.textMuted}
              style={styles.input}
              value={targetUser}
              onChangeText={setTargetUser}
              autoCapitalize="none"
            />

            <View style={styles.modalBtns}>
              <Pressable style={[styles.modalBtn, styles.cancelBtn]} onPress={() => setShowUserModal(false)}>
                <Text style={styles.cancelBtnText}>ביטול</Text>
              </Pressable>
              <Pressable style={[styles.modalBtn, styles.confirmBtn]} onPress={() => handleActionClick(deleteSpecificUser)}>
                <Text style={styles.confirmActionLabel}>מחק משתמש</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function createStyles(theme: any) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    toastBubble: {
      position: "absolute",
      top: 50,
      left: 20,
      right: 20,
      backgroundColor: "#00A884",
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 12,
      flexDirection: "row-reverse",
      alignItems: "center",
      zIndex: 9999,
      elevation: 10,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 5,
    },
    toastText: {
      color: "#fff",
      fontSize: 14,
      fontWeight: "700",
      textAlign: "left",
      flex: 1,
    },
    header: {
      flexDirection: "row-reverse",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
      backgroundColor: theme.colors.header,
    },
    backBtn: {
      padding: 8,
      backgroundColor: theme.colors.header + "AA",
      borderRadius: 20,
    },
    headerTitle: {
      color: theme.colors.text,
      fontSize: 20,
      fontWeight: "bold",
      textAlign: "left",
    },
    content: {
      flex: 1,
      paddingHorizontal: 20,
    },
    adminBanner: {
      alignItems: "center",
      paddingVertical: 40,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border + "50",
    },
    bannerText: {
      color: theme.colors.text,
      fontSize: 20,
      fontWeight: "800",
      marginTop: 15,
      textAlign: "center",
    },
    bannerSubtext: {
      color: "#FF4B4B",
      fontSize: 14,
      marginTop: 5,
      textAlign: "center",
      fontWeight: "600",
    },
    section: {
      marginTop: 30,
    },
    sectionTitle: {
      color: theme.colors.accent,
      fontSize: 13,
      fontWeight: "800",
      textTransform: "uppercase",
      marginBottom: 10,
      textAlign: "left",
    },
    actionItem: {
      flexDirection: "row-reverse",
      alignItems: "center",
      paddingVertical: 15,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border + "30",
    },
    iconWrap: {
      width: 44,
      height: 44,
      borderRadius: 12,
      justifyContent: "center",
      alignItems: "center",
      marginLeft: 15,
    },
    actionInfo: {
      flex: 1,
    },
    actionTitle: {
      color: theme.colors.text,
      fontSize: 16,
      fontWeight: "700",
      textAlign: "left",
    },
    actionDesc: {
      color: theme.colors.textMuted,
      fontSize: 13,
      marginTop: 2,
      textAlign: "left",
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.6)",
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 20,
    },
    modalContent: {
      backgroundColor: theme.colors.chatCard,
      borderRadius: 24,
      padding: 24,
      width: "100%",
      maxWidth: 400,
      elevation: 20,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.3,
      shadowRadius: 20,
      borderWidth: 1,
      borderColor: theme.colors.border + "40",
    },
    lockIconWrap: {
      alignSelf: "center",
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: "#FFBC2E20",
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 16,
    },
    modalTitle: {
      color: theme.colors.text,
      fontSize: 20,
      fontWeight: "800",
      textAlign: "center",
    },
    modalSub: {
      color: theme.colors.textMuted,
      fontSize: 15,
      marginTop: 8,
      marginBottom: 24,
      textAlign: "center",
      lineHeight: 20,
    },
    input: {
      backgroundColor: theme.colors.background,
      color: theme.colors.text,
      padding: 16,
      borderRadius: 14,
      marginBottom: 24,
      textAlign: "center",
      borderWidth: 1.5,
      borderColor: theme.colors.border,
      fontSize: 17,
    },
    modalBtns: {
      flexDirection: "row-reverse",
      gap: 12,
    },
    modalBtn: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
    },
    cancelBtn: {
      backgroundColor: theme.colors.surfaceMuted,
    },
    confirmBtn: {
      backgroundColor: "#FF4B4B",
    },
    cancelBtnText: {
      color: theme.colors.text,
      fontWeight: "700",
      fontSize: 16,
    },
    confirmActionLabel: {
      color: "#ffffff",
      fontWeight: "700",
      fontSize: 16,
    },
  });
}
