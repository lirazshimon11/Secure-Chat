import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, TextInput, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useAppTheme } from "@/lib/theme";
import { webEmbeddedInputReset, webNoOutline } from "@/lib/webStyles";
import { useChats } from "@/context/ChatContext";
import { Chat } from "@/lib/types";

export function CreatePollScreen({ chat, onBack }: { chat: Chat; onBack: () => void }) {
  const theme = useAppTheme();
  const styles = createStyles(theme);
  const { sendMessage } = useChats();
  
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [multipleAnswers, setMultipleAnswers] = useState(true);

  const handleSend = async () => {
    if (!question.trim()) return;
    const validOptions = options.map(o => o.trim()).filter(o => o.length > 0);
    if (validOptions.length < 2) return;
    const pollData = { question: question.trim(), options: validOptions, multipleAnswers };
    
    sendMessage({ 
      chatId: chat.id, 
      body: `[POLL]:${JSON.stringify(pollData)}`, 
      messageKind: "standard" 
    });
    onBack();
  };

  return (
    <View style={styles.root}>
      <SafeAreaView edges={["top"]} style={styles.header}>
        <View style={styles.headerInner}>
          <Pressable onPress={onBack} style={styles.backButton}>
            <Feather color="#fff" name="arrow-right" size={24} />
          </Pressable>
          <Text style={styles.headerTitle}>יצירת סקר</Text>
        </View>
      </SafeAreaView>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
          
          <Text style={styles.sectionLabel}>שאלה</Text>
          <View style={styles.inputContainerActive}>
            <TextInput
              style={[styles.input, webEmbeddedInputReset]}
              placeholder="מה השאלה?"
              placeholderTextColor="#666"
              value={question}
              onChangeText={setQuestion}
              textAlign="right"
              autoFocus
            />
          </View>

          <Text style={styles.sectionLabel}>אפשרויות</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={[styles.input, webEmbeddedInputReset]}
              placeholder="+ הוספה"
              placeholderTextColor="#666"
              value={options[0]}
              onChangeText={(t) => setOptions([t, options[1]])}
              textAlign="right"
            />
          </View>
          <View style={styles.inputContainer}>
            <TextInput
              style={[styles.input, webEmbeddedInputReset]}
              placeholder="+ הוספה"
              placeholderTextColor="#666"
              value={options[1]}
              onChangeText={(t) => setOptions([options[0], t])}
              textAlign="right"
            />
          </View>

          <View style={styles.toggleRow}>
            <Pressable 
              style={[styles.toggleTrack, multipleAnswers && styles.toggleTrackActive]} 
              onPress={() => setMultipleAnswers(!multipleAnswers)}
            >
              <View style={[styles.toggleThumb, multipleAnswers && styles.toggleThumbActive]} />
            </Pressable>
            <Text style={styles.toggleText}>לאפשר בחירה במספר תשובות</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <SafeAreaView edges={["bottom"]} style={styles.footer}>
        <Pressable style={styles.fab} onPress={handleSend}>
          <MaterialCommunityIcons name="send" size={24} color="#000" style={{ transform: [{ scaleX: -1 }] }} />
        </Pressable>
      </SafeAreaView>
    </View>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: "#0B141A", // deep dark theme color from whatsapp Create Poll
    },
    header: {
      backgroundColor: "#0B141A",
    },
    headerInner: {
      flexDirection: "row-reverse",
      alignItems: "center",
      justifyContent: "space-between",
      height: 60,
      paddingHorizontal: 16,
    },
    backButton: {
      width: 40,
      height: 40,
      alignItems: "center",
      justifyContent: "center",
    },
    headerTitle: {
      color: "#fff",
      fontSize: 20,
      fontWeight: "500",
      flex: 1,
      textAlign: "right",
      paddingRight: 8,
    },
    content: {
      flex: 1,
      paddingHorizontal: 16,
      paddingTop: 20,
    },
    sectionLabel: {
      color: "#00A884", // green label text
      fontSize: 14,
      marginBottom: 8,
      textAlign: "right",
    },
    inputContainerActive: {
      borderWidth: 2,
      borderColor: "#00A884", // green border for active/first input
      borderRadius: 8,
      backgroundColor: "#111B21", // slightly lighter than bg
      marginBottom: 30,
      paddingVertical: 12,
      paddingHorizontal: 16,
    },
    inputContainer: {
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.2)",
      borderRadius: 8,
      backgroundColor: "#111B21",
      marginBottom: 16,
      paddingVertical: 12,
      paddingHorizontal: 16,
    },
    input: {
      color: "#fff",
      fontSize: 16,
    },
    toggleRow: {
      flexDirection: "row-reverse",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: 20,
      paddingVertical: 10,
    },
    toggleText: {
      color: "#fff",
      fontSize: 16,
      flex: 1,
      textAlign: "right",
      marginRight: 16,
    },
    toggleTrack: {
      width: 40,
      height: 24,
      borderRadius: 12,
      backgroundColor: "#444",
      justifyContent: "center",
      paddingHorizontal: 2,
    },
    toggleTrackActive: {
      backgroundColor: "#00A884",
    },
    toggleThumb: {
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: "#111B21",
      alignSelf: "flex-start",
    },
    toggleThumbActive: {
      alignSelf: "flex-end",
    },
    footer: {
      position: "absolute",
      bottom: 20,
      left: 20,
    },
    fab: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: "#00A884",
      alignItems: "center",
      justifyContent: "center",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 6,
    },
  });
