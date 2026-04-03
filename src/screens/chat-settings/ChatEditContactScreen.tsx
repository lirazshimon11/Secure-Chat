import { useMemo, useState, useEffect } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, TextInput, Switch } from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { useAppTheme } from "@/lib/theme";
import { useChats } from "@/context/ChatContext";
import { useAuth } from "@/context/AuthContext";
import { Chat, Profile } from "@/lib/types";

type Props = {
  chat: Chat;
  onBack: () => void;
};

export function ChatEditContactScreen({ chat, onBack }: Props) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { profile } = useAuth();
  const { contactNicknames, setContactNickname, loadChatMembers } = useChats();
  
  const [otherUser, setOtherUser] = useState<Profile | null>(null);
  const [nickname, setNickname] = useState("");

  useEffect(() => {
    // For private chats, the other user is the one who isn't the current user.
    // We can find them by loading chat members.
    loadChatMembers(chat.id).then(members => {
      // Find the member who is NOT the current profile (handled by logic inside loadChatMembers usually or we filter here)
      // Actually loadChatMembers returns all.
      // But we can just find any profile that is NOT us.
      // For simplicity, we'll assume the chat.id's membership is already known.
      // In private chats, directTitles logic usually knows.
    });
    
    // Fallback: look at profiles we have
    // Actually, in private chats, there's usually only 2 members.
  }, [chat.id]);

  // Try to find the other user from the profiles map
  useEffect(() => {
    // In ChatContext, we have profiles. We need to find the one that is in this chat.
    // This is a bit indirect, but we can assume the other user's ID is stored or we can find it.
    // Let's use a simpler heuristic for now: find the first profile that isn't the current user? 
    // No, better to wait for loadChatMembers.
    
    const init = async () => {
      const members = await loadChatMembers(chat.id);
      // Find the other person (not me)
      const other = members.find(m => m.id !== profile?.id);
      
      if (other) {
        setOtherUser(other);
        const nick = contactNicknames[other.id];
        if (nick) {
          setNickname(`${nick.first_name || ""} ${nick.last_name || ""}`.trim());
        } else {
          // Initialize with current profile info as baseline
          setNickname(other.full_name || other.username);
        }
      }
    };
    if (profile?.id) init();
  }, [chat.id, profile?.id]);

  const handleSave = async () => {
    if (otherUser) {
      await setContactNickname(otherUser.id, {
        first_name: nickname.trim(),
        last_name: "",
        phone: "",
        sync_enabled: true,
      });
    }
    onBack();
  };

  return (
    <Screen>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={onBack} style={styles.backButton}>
            <Feather color={theme.colors.headerIcon} name="arrow-right" size={24} />
          </Pressable>
          <Text style={styles.headerTitle}>עריכת איש הקשר</Text>
          <Pressable style={styles.moreButton}>
            <MaterialCommunityIcons name="dots-vertical" size={24} color={theme.colors.headerIcon} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Username (ReadOnly) */}
          <View style={styles.usernameSection}>
             <Text style={styles.usernameLabel}>שם משתמש (לא ניתן לשינוי)</Text>
             <Text style={styles.usernameValue}>@{otherUser?.username || "..."}</Text>
          </View>

          {/* Nickname */}
          <View style={styles.inputSection}>
            <View style={styles.iconContainer}>
              <Feather name="user" size={22} color={theme.colors.textMuted} />
            </View>
            <View style={styles.inputWrapper}>
              <View style={styles.floatingLabelContainer}>
                <Text style={styles.floatingLabel}>כינוי לאיש הקשר</Text>
              </View>
              <TextInput
                style={styles.input}
                value={nickname}
                onChangeText={setNickname}
                placeholderTextColor={theme.colors.textMuted}
                textAlign="right"
              />
            </View>
          </View>
        </ScrollView>

        <Pressable onPress={handleSave} style={styles.saveButton}>
          <Text style={styles.saveButtonText}>שמירה</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const createStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      backgroundColor: theme.colors.header,
      flexDirection: "row-reverse", // RTL
      alignItems: "center",
      paddingHorizontal: theme.spacing.md,
      paddingTop: theme.spacing.sm,
      paddingBottom: theme.spacing.md,
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
    },
    headerTitle: {
      flex: 1,
      color: theme.colors.headerText,
      fontSize: 20,
      fontWeight: "700",
      textAlign: "right",
      marginRight: 12,
    },
    moreButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
    },
    content: {
      padding: theme.spacing.lg,
    },
    inputSection: {
      flexDirection: "row-reverse", // RTL
      alignItems: "flex-end",
      marginBottom: 30,
      gap: 16,
    },
    iconContainer: {
      width: 24,
      alignItems: "center",
      marginBottom: 12,
    },
    iconSpacer: {
      width: 24,
    },
    inputWrapper: {
      flex: 1,
      borderBottomWidth: 1.5,
      borderBottomColor: theme.colors.textMuted,
      paddingBottom: 4,
    },
    floatingLabelContainer: {
      position: "relative",
      height: 14,
    },
    floatingLabel: {
      position: "absolute",
      right: 0,
      top: -4,
      fontSize: 12,
      color: theme.colors.textMuted,
    },
    input: {
      fontSize: 18,
      color: theme.colors.text,
      paddingVertical: 4,
      fontWeight: "500",
    },
    phoneInputRow: {
      flex: 1,
      flexDirection: "row-reverse",
      gap: 12,
    },
    countryCodeContainer: {
      width: 100,
      borderBottomWidth: 1.5,
      borderBottomColor: theme.colors.textMuted,
      paddingBottom: 4,
    },
    countrySelector: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 4,
    },
    countryText: {
      fontSize: 16,
      color: theme.colors.text,
      fontWeight: "600",
    },
    phoneInputContainer: {
      flex: 1,
      borderBottomWidth: 1.5,
      borderBottomColor: theme.colors.textMuted,
      paddingBottom: 4,
    },
    syncSection: {
      flexDirection: "row-reverse",
      alignItems: "center",
      marginTop: 20,
      gap: 16,
    },
    syncRow: {
      flex: 1,
      flexDirection: "row-reverse",
      justifyContent: "space-between",
      alignItems: "center",
    },
    syncLabel: {
      fontSize: 17,
      color: theme.colors.text,
    },
    saveButton: {
      backgroundColor: theme.colors.accent,
      margin: 20,
      paddingVertical: 14,
      borderRadius: 100,
      alignItems: "center",
      justifyContent: "center",
    },
    saveButtonText: {
      color: "#fff",
      fontSize: 16,
      fontWeight: "700",
    },
    usernameSection: {
      marginBottom: 32,
      paddingHorizontal: 4,
      alignItems: 'flex-end',
    },
    usernameLabel: {
      fontSize: 12,
      color: theme.colors.textMuted,
      marginBottom: 4,
    },
    usernameValue: {
      fontSize: 18,
      color: theme.colors.text,
      fontWeight: '700',
      opacity: 0.6,
    }
  });
