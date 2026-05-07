import { useEffect, useMemo, useRef, useState } from "react";
import {
  NativeSyntheticEvent,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputSubmitEditingEventData,
  View,
} from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useAppTheme } from "@/lib/theme";
import { webEmbeddedInputReset, webNoOutline } from "@/lib/webStyles";
import { getUserColor, getMessagePreview } from "@/screens/chat/ChatUtils";

type Props = {
  replyToText?: string | null;
  replyToName?: string | null;
  onCancelReply: () => void;
  onSend: (body: string, kind: "standard" | "temporary" | "view_once", expireSeconds: number | null) => void;
  emojiKeyboardOpen?: boolean;
  onToggleEmojiKeyboard?: () => void;
  emojiEvent?: { emoji: string; ts: number } | null;
  onInputFocus?: () => void;
  focusTrigger?: number;
  onAttachmentPress?: () => void;
};

export function MessageComposer({ replyToText, replyToName, onCancelReply, onSend, emojiKeyboardOpen, onToggleEmojiKeyboard, emojiEvent, onInputFocus, focusTrigger, onAttachmentPress }: Props) {
  const theme = useAppTheme();
  const styles = createStyles(theme, !!replyToText);
  const [body, setBody] = useState("");
  const [inputHeight, setInputHeight] = useState(42);
  const [kind, setKind] = useState<"standard" | "temporary" | "view_once">("standard");
  const inputRef = useRef<TextInput | null>(null);
  const resizeInputRef = useRef<(nextBody?: string) => void>(() => {});

  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    const styleId = "secureapp-message-composer-scrollbar";
    if (document.getElementById(styleId)) return;
    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
      textarea[data-secureapp-composer="true"] {
        scrollbar-width: none;
        -ms-overflow-style: none;
      }
      textarea[data-secureapp-composer="true"]::-webkit-scrollbar {
        display: none;
        width: 0;
        height: 0;
      }
    `;
    document.head.appendChild(style);
  }, []);

  useEffect(() => {
    if (emojiEvent) {
      setBody((prev) => {
        const nextBody = prev + emojiEvent.emoji;
        resizeInputRef.current(nextBody);
        return nextBody;
      });
    }
  }, [emojiEvent]);

  useEffect(() => {
    if (focusTrigger) {
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [focusTrigger]);

  const expireSeconds = kind === "temporary" ? 60 : null;
  const placeholder = "הקלידו הודעה";

  function handleChangeText(nextBody: string) {
    setBody(nextBody);
    resizeInputRef.current(nextBody);
  }

  function handleSend() {
    if (!body.trim()) return;
    onSend(body, kind, expireSeconds);
    setBody("");
    setKind("standard");
    setInputHeight(42);
    if (Platform.OS === "web" && inputRef.current) {
      const el = inputRef.current as any;
      el.style.height = '42px';
      el.style.overflowY = "hidden";
      el.scrollTop = 0;
    }
  }

  const handleSendRef = useRef(handleSend);
  useEffect(() => {
    handleSendRef.current = handleSend;
  }, [handleSend]);

  useEffect(() => {
    if (Platform.OS === "web" && inputRef.current) {
      const el = inputRef.current as any;
      const collapsedHeight = 42;
      const lineHeight = 22;
      const maxComposerHeight = 170;
      const measureCanvas = typeof document !== "undefined" ? document.createElement("canvas") : null;
      const measureContext = measureCanvas?.getContext("2d") ?? null;
      const estimateLineCount = (nextBody?: string) => {
        const value = String(nextBody ?? el.value ?? "");
        const availableWidth = Math.max(1, (el.clientWidth || 0) - 8);
        if (!measureContext || !value || availableWidth <= 1) return 1;

        const computedStyle = window.getComputedStyle(el);
        measureContext.font = computedStyle.font || `${computedStyle.fontSize || "16px"} ${computedStyle.fontFamily || "sans-serif"}`;

        return value.split("\n").reduce((totalLines, paragraph) => {
          if (!paragraph) return totalLines + 1;
          let paragraphLines = 1;
          let currentLineWidth = 0;

          for (const char of Array.from(paragraph)) {
            const charWidth = measureContext.measureText(char).width;
            if (currentLineWidth > 0 && currentLineWidth + charWidth > availableWidth) {
              paragraphLines += 1;
              currentLineWidth = charWidth;
            } else {
              currentLineWidth += charWidth;
            }
          }

          return totalLines + paragraphLines;
        }, 0);
      };
      const keydownHandler = (e: any) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          e.stopPropagation();
          handleSendRef.current();
        }
      };
      const inputHandler = (nextBody?: string) => {
        const value = String(nextBody ?? el.value ?? "");
        const hasText = Boolean(value.trim());
        el.style.height = 'auto';
        const lineCount = estimateLineCount(value);
        const nextHeight = hasText && lineCount > 1
          ? Math.min(maxComposerHeight, collapsedHeight + (lineCount - 1) * lineHeight)
          : collapsedHeight;
        el.style.height = `${nextHeight}px`;
        el.style.overflowY = nextHeight >= maxComposerHeight ? "auto" : "hidden";
        if (nextHeight < maxComposerHeight) el.scrollTop = 0;
        setInputHeight(nextHeight);
      };
      resizeInputRef.current = inputHandler;
      el.setAttribute("data-secureapp-composer", "true");
      el.style.overflowY = "hidden";
      el.addEventListener("keydown", keydownHandler);
      // Init height
      setTimeout(() => {
        el.style.height = 'auto';
        inputHandler();
      }, 100);
      return () => {
        el.removeAttribute("data-secureapp-composer");
        el.style.removeProperty("overflow-y");
        resizeInputRef.current = () => {};
        el.removeEventListener("keydown", keydownHandler);
      };
    }
  }, []);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const frame = requestAnimationFrame(() => resizeInputRef.current());
    return () => cancelAnimationFrame(frame);
  }, [body]);

  function handleSubmit(event: NativeSyntheticEvent<TextInputSubmitEditingEventData>) {
    if (Platform.OS === "web") return;
    handleSend();
  }

  const accentColor = useMemo(() => {
    if (!replyToName) return "#00A884";
    return getUserColor(replyToName);
  }, [replyToName]);

  return (
    <View style={styles.safeAreaWrapper}>
      <View style={styles.wrapper}>
        <View style={styles.modeRow}>
          <ModeChip active={kind === "standard"} activeColor={theme.colors.mine} textColor={theme.colors.text} icon="message-text-outline" label="הודעה" onPress={() => setKind("standard")} />
          <ModeChip active={kind === "temporary"} activeColor="#8b5cf6" textColor="#ffffff" icon="timer-sand" label="דקה 1" onPress={() => setKind("temporary")} />
          <ModeChip active={kind === "view_once"} activeColor="#ff4444" textColor="#ffffff" icon="eye-outline" label="צפייה חד-פעמית" onPress={() => setKind("view_once")} />
        </View>

        <View style={styles.composerRow}>
          <View style={styles.mainStack}>
            {replyToText ? (
              <View style={styles.replyBanner}>
                <View style={styles.replyContent}>
                  <View style={[styles.replyAccent, { backgroundColor: accentColor }]} />
                  <View style={styles.replyText}>
                    <Text numberOfLines={1} style={[styles.replyLabel, { color: accentColor }]}>{replyToName || "תשובה להודעה"}</Text>
                    <Text numberOfLines={1} style={styles.replyPreview}>{getMessagePreview(replyToText)}</Text>
                  </View>
                  <Pressable onPress={onCancelReply} style={styles.closeButton}>
                    <Feather color={theme.colors.headerIcon} name="x" size={18} />
                  </Pressable>
                </View>
              </View>
            ) : null}

            <View style={styles.inputContainer}>
              <Pressable onPress={() => { }} style={[styles.sideButton, webNoOutline]}>
                <MaterialCommunityIcons color={theme.colors.headerIcon} name="emoticon-outline" size={24} style={{ opacity: 0.6 }} />
              </Pressable>
              <View style={styles.inputShell}>
                <TextInput
                  onChangeText={handleChangeText}
                  onSubmitEditing={handleSubmit}
                  placeholder={placeholder}
                  placeholderTextColor={theme.colors.textMuted + "80"}
                  ref={inputRef}
                  onFocus={onInputFocus}
                  returnKeyType="default"
                  blurOnSubmit={false}
                  multiline={true}
                  style={[styles.input, Platform.OS === "web" ? { height: inputHeight, overflow: inputHeight >= 170 ? "auto" : "hidden" } : null, webEmbeddedInputReset]}
                  value={body}
                />
              </View>
              <Pressable onPress={() => onAttachmentPress?.()} style={[styles.innerSideButton, webNoOutline]}>
                <Feather color={theme.colors.headerIcon} name="paperclip" size={20} />
              </Pressable>
              <Pressable onPress={() => { }} style={[styles.innerSideButton, webNoOutline]}>
                <Feather color={theme.colors.headerIcon} name="camera" size={20} />
              </Pressable>
            </View>
          </View>

          {body.trim().length > 0 && (
            <Pressable onPress={handleSend} style={[styles.sendButton, webNoOutline]}>
              <Feather color={theme.colors.textOnAccent} name="send" size={18} style={styles.sendIcon} />
            </Pressable>
          )}

          {body.trim().length === 0 && (
            <Pressable onPress={() => { }} style={[styles.micFab, webNoOutline]}>
              <MaterialCommunityIcons color={theme.colors.textOnAccent} name="microphone" size={22} />
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );

  function ModeChip({ active, activeColor, textColor, icon, label, onPress }: { active: boolean; activeColor: string; textColor: string; icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; onPress: () => void; }) {
    return (
      <Pressable onPress={onPress} style={[styles.modeChip, active && { backgroundColor: activeColor, borderColor: activeColor }, active && styles.modeChipActive, webNoOutline]}>
        <MaterialCommunityIcons color={active ? (theme.colors.background === "#0b141a" ? "#ffffff" : textColor) : theme.colors.headerIcon} name={icon} size={15} />
        <Text style={[styles.modeLabel, active && { color: theme.colors.background === "#0b141a" ? "#ffffff" : textColor }]}>{label}</Text>
      </Pressable>
    );
  }
}

const createStyles = (theme: ReturnType<typeof useAppTheme>, isReplying: boolean = false) =>
  StyleSheet.create({
    wrapper: {
      backgroundColor: 'transparent',
      paddingHorizontal: Platform.OS === "web" ? 12 : theme.spacing.sm,
      paddingTop: theme.spacing.xs,
      paddingBottom: Platform.OS === "web" ? 8 : theme.spacing.xs,
      gap: theme.spacing.xs,
    },
    safeAreaWrapper: {
      backgroundColor: 'transparent',
      borderTopWidth: 0,
    },
    mainStack: {
      flex: 1,
      backgroundColor: theme.colors.surface,
      borderRadius: 24,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: theme.colors.background === "#0b141a" ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)",
      minWidth: 0,
    },
    replyBanner: {
      backgroundColor: 'transparent',
      paddingVertical: 8,
      paddingHorizontal: 8,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.background === "#0b141a" ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)",
    },
    replyContent: {
      flexDirection: Platform.OS === "web" ? "row-reverse" : "row",
      alignItems: "stretch",
      width: "100%",
      backgroundColor: theme.colors.background === "#0b141a" ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)",
      borderRadius: 8,
      overflow: "hidden",
    },
    replyAccent: {
      width: 4,
    },
    replyText: {
      flex: 1,
      minWidth: 0,
      paddingVertical: 6,
      paddingHorizontal: 10,
      justifyContent: "center",
      alignItems: "flex-end", // Force Move to Right
    },
    replyLabel: {
      fontSize: 12,
      fontWeight: "800",
      marginBottom: 2,
      textAlign: "right",
      writingDirection: "rtl",
      width: "100%",
    },
    replyPreview: {
      color: theme.colors.textMuted,
      fontSize: 13,
      textAlign: "right",
      writingDirection: "rtl",
      width: "100%",
    },
    closeButton: {
      paddingHorizontal: 12,
      justifyContent: "center",
      alignItems: "center",
    },
    modeRow: {
      flexDirection: Platform.OS === "web" ? "row-reverse" : "row",
      gap: 8,
      alignSelf: Platform.OS === "web" ? "flex-end" : "flex-start",
      marginBottom: -1,
      marginTop: 0,
    },
    modeChip: {
      flexDirection: Platform.OS === "web" ? "row-reverse" : "row",
      alignItems: "center",
      gap: 5,
      borderRadius: 18,
      paddingHorizontal: 14,
      paddingVertical: 7,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    modeChipActive: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 3,
      elevation: 3,
    },
    modeLabel: {
      color: theme.colors.textMuted,
      fontSize: 12,
      fontWeight: "800",
    },
    modeLabelActive: {
      color: theme.colors.textOnAccent,
    },
    composerRow: {
      flexDirection: Platform.OS === "web" ? "row-reverse" : "row",
      alignItems: "flex-end",
      gap: Platform.OS === "web" ? 6 : 1,
    },
    micFab: {
      width: 46,
      height: 46,
      borderRadius: 23,
      backgroundColor: theme.colors.accent,
      alignItems: "center",
      justifyContent: "center",
    },
    inputContainer: {
      flexDirection: Platform.OS === "web" ? "row-reverse" : "row",
      alignItems: "center",
      backgroundColor: "transparent",
      minHeight: 46,
    },
    sideButton: {
      width: 42,
      height: 44,
      alignItems: "center",
      justifyContent: "center",
    },
    innerSideButton: {
      width: 38,
      height: 44,
      alignItems: "center",
      justifyContent: "center",
    },
    inputShell: {
      flex: 1,
      minWidth: 0,
      paddingLeft: 4,
      paddingRight: 14,
      minHeight: Platform.OS === "web" ? 42 : 44,
      justifyContent: "center",
      paddingVertical: Platform.OS === "ios" ? 4 : 0,
    },
    input: {
      color: theme.colors.text,
      fontSize: 16,
      lineHeight: 22,
      minHeight: Platform.OS === "web" ? 42 : 22,
      maxHeight: 170, // 7 lines * 22 = 154 + 16 (padding)
      paddingTop: Platform.OS === "web" ? 10 : 8,
      paddingBottom: Platform.OS === "web" ? 10 : 8,
      textAlign: "right",
      writingDirection: "rtl",
      width: "100%",
      textAlignVertical: "center",
      ...(Platform.OS === "web" ? ({ resize: "none" } as any) : null),
    },
    sendButton: {
      width: 46,
      height: 46,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.accentStrong,
      alignItems: "center",
      justifyContent: "center",
    },
    sendIcon: {
      transform: Platform.OS === "web" ? [{ scaleX: -1 }] : undefined,
    },
  });
