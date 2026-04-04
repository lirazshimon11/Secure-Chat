import { useMemo, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons, Feather } from "@expo/vector-icons";
import { useAppTheme } from "@/lib/theme";
import { useChats } from "@/context/ChatContext";
import { Message } from "@/lib/types";

type Props = {
  messages: Message[];
  onCancel: () => void;
  onSend: (chatIds: string[]) => void;
};

export function ForwardScreen({ messages, onCancel, onSend }: Props) {
  const insets = useSafeAreaInsets();
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme, insets), [theme, insets]);
  const { chats } = useChats();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedChatIds, setSelectedChatIds] = useState<Set<string>>(new Set());

  const filteredChats = chats.filter((c) => 
    c.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  function handleToggle(chatId: string) {
    const next = new Set(selectedChatIds);
    if (next.has(chatId)) {
      next.delete(chatId);
    } else {
      next.add(chatId);
    }
    setSelectedChatIds(next);
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Pressable onPress={onCancel} style={styles.backButton}>
            <Feather color={theme.colors.headerIcon} name="arrow-right" size={22} />
          </Pressable>
          <Text style={styles.title}>
            העברת {messages.length} הודעות
          </Text>
        </View>
        <TextInput
          style={styles.searchInput}
          placeholder="חיפוש באנשי קשר"
          placeholderTextColor={theme.colors.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType="search"
        />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.sectionHeader}>צ'אטים אחרונים</Text>
        {filteredChats.map((chat) => {
          const isSelected = selectedChatIds.has(chat.id);
          return (
            <Pressable
              key={chat.id}
              style={[styles.chatRow, isSelected && styles.chatRowSelected]}
              onPress={() => handleToggle(chat.id)}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{chat.title.slice(0, 1).toUpperCase()}</Text>
              </View>
              <View style={styles.chatMain}>
                <Text style={styles.chatTitle} numberOfLines={1}>
                  {chat.title}
                </Text>
              </View>
              {isSelected ? (
                <View style={styles.checkboxSelected}>
                  <MaterialCommunityIcons name="check" size={16} color={theme.colors.textOnAccent} />
                </View>
              ) : (
                <View style={styles.checkboxUnselected} />
              )}
            </Pressable>
          );
        })}
      </ScrollView>

      {selectedChatIds.size > 0 && (
        <View style={styles.footer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.selectedPills}>
            {Array.from<string>(selectedChatIds).map(id => {
              const chat = chats.find(c => c.id === id);
              if (!chat) return null;
              return (
                <View key={id} style={styles.pill}>
                  <Text style={styles.pillText}>{chat.title}</Text>
                </View>
              );
            })}
          </ScrollView>
          <Pressable style={styles.sendButton} onPress={() => onSend(Array.from(selectedChatIds))}>
            <MaterialCommunityIcons name="send" size={24} color={theme.colors.textOnAccent} style={{ transform: [{ scaleX: -1 }] }} />
          </Pressable>
        </View>
      )}
    </View>
  );
}

function createStyles(theme: any, insets: any) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      backgroundColor: theme.colors.header,
      paddingTop: insets.top + (theme.isAndroid ? 10 : 0),
      paddingBottom: 16,
      paddingHorizontal: 16,
    },
    headerTop: {
      flexDirection: "row-reverse", // RTL
      alignItems: "center",
      gap: 20,
      marginBottom: 16,
    },
    backButton: {
      padding: 4,
    },
    title: {
      color: theme.colors.headerText,
      fontSize: 20,
      fontWeight: "600",
      textAlign: "right",
    },
    searchInput: {
      backgroundColor: theme.colors.homeSearch,
      borderRadius: 8,
      paddingHorizontal: 16,
      paddingVertical: 10,
      color: theme.colors.text,
      fontSize: 16,
      textAlign: "right", // RTL
    },
    scrollContent: {
      paddingVertical: 10,
      paddingBottom: 80,
    },
    sectionHeader: {
      color: theme.colors.textMuted,
      fontSize: 14,
      fontWeight: "600",
      textAlign: "right",
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    chatRow: {
      flexDirection: "row-reverse", // RTL
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 10,
      gap: 12,
    },
    chatRowSelected: {
      backgroundColor: theme.colors.homeSelection,
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
      color: theme.colors.accent,
      fontSize: 18,
      fontWeight: "800",
    },
    chatMain: {
      flex: 1,
    },
    chatTitle: {
      color: theme.colors.text,
      fontSize: 16,
      textAlign: "right",
      fontWeight: "600",
    },
    checkboxUnselected: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: theme.colors.separator,
    },
    checkboxSelected: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: theme.colors.accentStrong,
      alignItems: "center",
      justifyContent: "center",
    },
    footer: {
      position: "absolute",
      bottom: insets.bottom + 16,
      left: 16,
      right: 16,
      flexDirection: "row-reverse", // RTL
      alignItems: "center",
      gap: 12,
    },
    selectedPills: {
      flex: 1,
      flexDirection: "row-reverse",
    },
    pill: {
      backgroundColor: theme.colors.surfaceMuted,
      borderRadius: 16,
      paddingHorizontal: 12,
      paddingVertical: 6,
      marginLeft: 8, // space between pills (since we are using horizontal scroll)
    },
    pillText: {
      color: theme.colors.text,
      fontSize: 14,
    },
    sendButton: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: theme.colors.accentStrong,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: "#000",
      shadowOpacity: 0.2,
      shadowRadius: 5,
      elevation: 5,
    },
  });
}
