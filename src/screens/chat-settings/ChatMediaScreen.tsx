import { useMemo, useState } from "react";
import { StyleSheet, Text, View, Pressable, ScrollView } from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { useChats } from "@/context/ChatContext";
import { useAppTheme } from "@/lib/theme";
import { Chat } from "@/lib/types";

type Props = {
  chat: Chat;
  onBack: () => void;
};

// Simple URL extractor regex for links
const URL_REGEX = /(https?:\/\/[^\s]+)/g;

export function ChatMediaScreen({ chat, onBack }: Props) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [activeTab, setActiveTab] = useState<"media" | "docs" | "links">("media");
  const { messagesByChat } = useChats();

  const messages = messagesByChat[chat.id] ?? [];
  const links = useMemo(() => {
    const found: string[] = [];
    for (const msg of messages) {
      if (msg.message_kind === "standard" && msg.body_ciphertext) {
        const matches = msg.body_ciphertext.match(URL_REGEX);
        if (matches) {
          found.push(...matches);
        }
      }
    }
    return found.reverse();
  }, [messages]);

  return (
    <Screen>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{chat.title}</Text>
          <Pressable onPress={onBack} style={styles.backButton}>
            <Feather color={theme.colors.headerIcon} name="arrow-right" size={24} />
          </Pressable>
        </View>

        <View style={styles.tabsContainer}>
          <Pressable style={[styles.tab, activeTab === "links" && styles.activeTab]} onPress={() => setActiveTab("links")}>
            <Text style={[styles.tabText, activeTab === "links" && styles.activeTabText]}>קישורים</Text>
          </Pressable>
          <Pressable style={[styles.tab, activeTab === "docs" && styles.activeTab]} onPress={() => setActiveTab("docs")}>
            <Text style={[styles.tabText, activeTab === "docs" && styles.activeTabText]}>מסמכים</Text>
          </Pressable>
          <Pressable style={[styles.tab, activeTab === "media" && styles.activeTab]} onPress={() => setActiveTab("media")}>
            <Text style={[styles.tabText, activeTab === "media" && styles.activeTabText]}>מדיה</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          {activeTab === "media" && (
             <View style={styles.emptyState}>
               <MaterialCommunityIcons name="image-off-outline" size={64} color={theme.colors.textMuted} />
               <Text style={styles.emptyText}>לא נמצאה מדיה</Text>
             </View>
          )}
          
          {activeTab === "docs" && (
             <View style={styles.emptyState}>
               <MaterialCommunityIcons name="file-document-outline" size={64} color={theme.colors.textMuted} />
               <Text style={styles.emptyText}>לא נמצאו מסמכים</Text>
             </View>
          )}

          {activeTab === "links" && (
             links.length > 0 ? (
               links.map((link, i) => (
                  <View key={i} style={styles.linkCard}>
                     <View style={styles.linkIconBox}>
                        <MaterialCommunityIcons name="link-variant" size={24} color={theme.colors.textMuted} />
                     </View>
                     <View style={styles.linkCopy}>
                        <Text style={styles.linkUrl} numberOfLines={1}>{link}</Text>
                     </View>
                  </View>
               ))
             ) : (
               <View style={styles.emptyState}>
                 <MaterialCommunityIcons name="link-off" size={64} color={theme.colors.textMuted} />
                 <Text style={styles.emptyText}>לא נמצאו קישורים</Text>
               </View>
             )
          )}
        </ScrollView>
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
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: theme.spacing.md,
      paddingTop: theme.spacing.sm,
      paddingBottom: theme.spacing.md,
    },
    backButton: {
      width: 36,
      height: 36,
      borderRadius: theme.radius.pill,
      alignItems: "center",
      justifyContent: "center",
      marginLeft: 12,
    },
    headerTitle: {
      color: theme.colors.headerText,
      fontSize: 20,
      fontWeight: "800",
      flex: 1,
    },
    tabsContainer: {
      flexDirection: "row",
      backgroundColor: theme.colors.header,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.separator,
    },
    tab: {
      flex: 1,
      alignItems: "center",
      paddingVertical: 14,
      borderBottomWidth: 3,
      borderBottomColor: "transparent",
    },
    activeTab: {
      borderBottomColor: theme.colors.accent,
    },
    tabText: {
      fontSize: 16,
      color: theme.colors.textMuted,
      fontWeight: "600",
    },
    activeTabText: {
      color: theme.colors.accent,
    },
    content: {
      flexGrow: 1,
    },
    emptyState: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingTop: 80,
    },
    emptyText: {
      fontSize: 16,
      color: theme.colors.textMuted,
      marginTop: 16,
      fontWeight: "600",
    },
    linkCard: {
      flexDirection: "row",
      padding: theme.spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.separator,
      alignItems: "center",
    },
    linkIconBox: {
      width: 50,
      height: 50,
      backgroundColor: theme.colors.surfaceMuted,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: theme.radius.sm,
      marginLeft: theme.spacing.md,
    },
    linkCopy: {
      flex: 1,
    },
    linkUrl: {
      fontSize: 15,
      color: theme.colors.accent,
    },
  });
