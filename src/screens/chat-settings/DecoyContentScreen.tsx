import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, KeyboardAvoidingView, PanResponder, Platform, Pressable, ScrollView, StyleSheet, Text, useColorScheme, View } from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";

import { MessageBubble } from "@/components/MessageBubble";
import { MessageComposer } from "@/components/MessageComposer";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { useAppTheme } from "@/lib/theme";
import { Chat, Message } from "@/lib/types";
import { ChatBackground } from "@/screens/chat/ChatBackground";

type Props = {
  chat: Chat;
  onBack: () => void;
};

type DecoyMessage = {
  id: string;
  body: string;
  is_me: boolean;
  sender_id: string | null;
  created_at: string;
  edited_at?: string | null;
  optimistic?: boolean;
};

const toMessage = (chatId: string, message: DecoyMessage): Message & { _decoy_row_id: string } => ({
  id: message.id,
  _decoy_row_id: message.id,
  chat_id: chatId,
  sender_id: message.sender_id ?? "",
  body_ciphertext: message.body,
  body_preview: message.body,
  message_kind: "standard",
  reply_to_id: null,
  expires_at: null,
  created_at: message.created_at,
  edited_at: message.edited_at ?? null,
  deleted_at: null,
  optimistic: message.optimistic,
});

export function DecoyContentScreen({ chat, onBack }: Props) {
  const theme = useAppTheme();
  const colorScheme = useColorScheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { profile } = useAuth();
  const scrollRef = useRef<ScrollView | null>(null);
  const threadHeightRef = useRef(0);
  const scrollPageYRef = useRef(58);
  const scrollMetricsRef = useRef({ y: 0, height: 0, contentHeight: 0 });
  const messageLayoutsRef = useRef<Record<string, { y: number; h: number }>>({});
  const selectedIdsRef = useRef<string[]>([]);
  const dragPivotIdRef = useRef<string | null>(null);
  const dragInitialIdsRef = useRef<Set<string>>(new Set());
  const isDragSelectingRef = useRef(false);
  const dragLastPageYRef = useRef<number | null>(null);
  const dragAutoScrollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [messages, setMessages] = useState<DecoyMessage[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editingMessage, setEditingMessage] = useState<DecoyMessage | null>(null);
  const [editNonce, setEditNonce] = useState(0);
  const [editSaving, setEditSaving] = useState(false);
  const [webKeyboardInset, setWebKeyboardInset] = useState(0);
  const webViewportBaselineRef = useRef(0);
  const webKeyboardVisibleRef = useRef(false);
  const webKeyboardBlurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedMessages = useMemo(
    () => selectedIds.map((id) => messages.find((message) => message.id === id)).filter(Boolean) as DecoyMessage[],
    [messages, selectedIds],
  );
  const chatMessages = useMemo(() => messages.map((message) => toMessage(chat.id, message)), [chat.id, messages]);
  const messageMap = useMemo(() => Object.fromEntries(chatMessages.map((message) => [message.id, message])), [chatMessages]);

  useEffect(() => {
    selectedIdsRef.current = selectedIds;
  }, [selectedIds]);

  const scrollToBottom = useCallback((animated = false) => {
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated }));
  }, []);

  const measureScrollView = useCallback(() => {
    requestAnimationFrame(() => {
      (scrollRef.current as any)?.measure?.((_x: number, _y: number, _w: number, h: number, _pageX: number, pageY: number) => {
        if (typeof pageY === "number") scrollPageYRef.current = pageY;
        if (typeof h === "number" && h > 0) {
          threadHeightRef.current = h;
          scrollMetricsRef.current.height = h;
        }
      });
    });
  }, []);

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((selectedId) => selectedId !== id) : [...current, id],
    );
  }, []);

  const beginSelection = useCallback((id?: string) => {
    if (!id) return;
    setSelectedIds((current) => (current.includes(id) ? current : [...current, id]));
  }, []);

  const updateDragSelection = useCallback((pageY: number) => {
    dragLastPageYRef.current = pageY;
    const viewportY = pageY - scrollPageYRef.current;
    const contentY = Math.max(0, viewportY + scrollMetricsRef.current.y);

    let targetId: string | null = null;
    for (const [id, layout] of Object.entries(messageLayoutsRef.current)) {
      if (contentY >= layout.y && contentY <= layout.y + layout.h) {
        targetId = id;
        break;
      }
    }

    if (!targetId || !dragPivotIdRef.current) return;
    const pivotLayout = messageLayoutsRef.current[dragPivotIdRef.current];
    const targetLayout = messageLayoutsRef.current[targetId];
    if (!pivotLayout || !targetLayout) return;

    const minY = Math.min(pivotLayout.y, targetLayout.y);
    const maxY = Math.max(pivotLayout.y, targetLayout.y);
    const next = new Set(dragInitialIdsRef.current);
    for (const [id, layout] of Object.entries(messageLayoutsRef.current)) {
      const centerY = layout.y + layout.h / 2;
      if (centerY >= minY && centerY <= maxY) next.add(id);
    }
    setSelectedIds(Array.from(next));
  }, []);

  const stopDragAutoScroll = useCallback(() => {
    if (dragAutoScrollTimerRef.current) {
      clearInterval(dragAutoScrollTimerRef.current);
      dragAutoScrollTimerRef.current = null;
    }
  }, []);

  const updateDragAutoScroll = useCallback((pageY: number) => {
    const viewportY = pageY - scrollPageYRef.current;
    const height = scrollMetricsRef.current.height || threadHeightRef.current;
    const edgeSize = 64;
    const direction = viewportY < edgeSize ? -1 : viewportY > height - edgeSize ? 1 : 0;

    if (!direction) {
      stopDragAutoScroll();
      return;
    }

    if (dragAutoScrollTimerRef.current) return;
    dragAutoScrollTimerRef.current = setInterval(() => {
      const lastPageY = dragLastPageYRef.current;
      if (lastPageY === null) return;

      const currentViewportY = lastPageY - scrollPageYRef.current;
      const liveHeight = scrollMetricsRef.current.height || threadHeightRef.current;
      const liveDirection = currentViewportY < edgeSize ? -1 : currentViewportY > liveHeight - edgeSize ? 1 : 0;
      if (!liveDirection) {
        stopDragAutoScroll();
        return;
      }

      const speed = liveDirection < 0
        ? Math.min(30, Math.max(10, edgeSize - currentViewportY))
        : Math.min(30, Math.max(10, currentViewportY - (liveHeight - edgeSize)));
      const maxY = Math.max(0, scrollMetricsRef.current.contentHeight - scrollMetricsRef.current.height);
      const nextY = Math.max(0, Math.min(maxY, scrollMetricsRef.current.y + liveDirection * speed));
      scrollMetricsRef.current.y = nextY;
      scrollRef.current?.scrollTo({ y: nextY, animated: false });
      updateDragSelection(lastPageY);
    }, 16);
  }, [stopDragAutoScroll, updateDragSelection]);

  const updateDragFromPageY = useCallback((pageY: number) => {
    if (!isDragSelectingRef.current) return;
    updateDragSelection(pageY);
    updateDragAutoScroll(pageY);
  }, [updateDragAutoScroll, updateDragSelection]);

  const beginDragSelectAtMessage = useCallback((id?: string | null, updateSelection = true) => {
    if (!id || !messageMap[id]) return;
    measureScrollView();
    isDragSelectingRef.current = true;
    dragPivotIdRef.current = id;
    const initial = new Set(selectedIdsRef.current);
    initial.add(id);
    dragInitialIdsRef.current = initial;
    if (updateSelection) setSelectedIds(Array.from(initial));
  }, [messageMap]);

  const stopDragSelect = useCallback(() => {
    isDragSelectingRef.current = false;
    dragPivotIdRef.current = null;
    dragInitialIdsRef.current = new Set();
    dragLastPageYRef.current = null;
    stopDragAutoScroll();
  }, [stopDragAutoScroll]);

  const selectionPanResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponderCapture: () => isDragSelectingRef.current,
    onPanResponderMove: (_evt, gesture) => {
      updateDragFromPageY(gesture.moveY);
    },
    onPanResponderRelease: stopDragSelect,
    onPanResponderTerminate: stopDragSelect,
  }), [stopDragSelect, updateDragFromPageY]);

  const webDragHandlers = useMemo(() => {
    if (Platform.OS !== "web") return {};
    return {
      onPointerMove: (event: any) => {
        if (!isDragSelectingRef.current) return;
        const buttons = event?.nativeEvent?.buttons;
        if (event?.nativeEvent?.pointerType !== "touch" && buttons !== undefined && buttons !== 1) {
          stopDragSelect();
          return;
        }
        const y = event.nativeEvent.clientY ?? event.nativeEvent.pageY;
        if (typeof y === "number") updateDragFromPageY(y);
      },
      onPointerUp: stopDragSelect,
      onPointerCancel: stopDragSelect,
    } as any;
  }, [stopDragSelect, updateDragFromPageY]);

  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;

    const isComposerTarget = (target: EventTarget | null) =>
      target instanceof HTMLElement && !!target.closest("[data-message-composer='true']");
    const isComposerPoint = (x: number, y: number) =>
      isComposerTarget(document.elementFromPoint(x, y));
    const touchEventHitsComposer = (event: TouchEvent) =>
      Array.from(event.touches).some((touch) => isComposerPoint(touch.clientX, touch.clientY)) ||
      Array.from(event.changedTouches).some((touch) => isComposerPoint(touch.clientX, touch.clientY));

    const handleComposerTouchStart = (event: TouchEvent) => {
      if (!touchEventHitsComposer(event)) return;
      stopDragSelect();
    };
    const handleComposerPointerDown = (event: PointerEvent) => {
      if (!isComposerTarget(event.target) && !isComposerPoint(event.clientX, event.clientY)) return;
      stopDragSelect();
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (isComposerTarget(event.target) || isComposerPoint(event.clientX, event.clientY)) {
        stopDragSelect();
        return;
      }
      if (!isDragSelectingRef.current) return;
      if (event.pointerType !== "touch" && event.buttons !== undefined && event.buttons !== 1) {
        stopDragSelect();
        return;
      }
      event.preventDefault();
      updateDragFromPageY(event.clientY);
    };
    const handleTouchMove = (event: TouchEvent) => {
      if (touchEventHitsComposer(event)) {
        stopDragSelect();
        return;
      }
      if (!isDragSelectingRef.current) return;
      const touch = event.touches[0];
      if (!touch) return;
      event.preventDefault();
      updateDragFromPageY(touch.clientY);
    };
    const handleEnd = () => stopDragSelect();

    document.addEventListener("touchstart", handleComposerTouchStart, { capture: true, passive: true });
    document.addEventListener("pointerdown", handleComposerPointerDown, { capture: true });
    document.addEventListener("pointermove", handlePointerMove, { capture: true });
    document.addEventListener("pointerup", handleEnd, { capture: true });
    document.addEventListener("pointercancel", handleEnd, { capture: true });
    document.addEventListener("touchmove", handleTouchMove, { capture: true, passive: false } as any);
    document.addEventListener("touchend", handleEnd, { capture: true });
    document.addEventListener("touchcancel", handleEnd, { capture: true });

    return () => {
      document.removeEventListener("touchstart", handleComposerTouchStart, { capture: true } as any);
      document.removeEventListener("pointerdown", handleComposerPointerDown, { capture: true } as any);
      document.removeEventListener("pointermove", handlePointerMove, { capture: true } as any);
      document.removeEventListener("pointerup", handleEnd, { capture: true } as any);
      document.removeEventListener("pointercancel", handleEnd, { capture: true } as any);
      document.removeEventListener("touchmove", handleTouchMove, { capture: true } as any);
      document.removeEventListener("touchend", handleEnd, { capture: true } as any);
      document.removeEventListener("touchcancel", handleEnd, { capture: true } as any);
    };
  }, [stopDragSelect, updateDragFromPageY]);

  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;

    const scrollPageToTop = () => {
      if (window.scrollX !== 0 || window.scrollY !== 0) {
        window.scrollTo(0, 0);
      }
    };

    const getViewportHeight = () => window.visualViewport?.height ?? window.innerHeight;
    webViewportBaselineRef.current = Math.max(webViewportBaselineRef.current, getViewportHeight(), window.innerHeight || 0);

    const getFocusedComposerElement = () => {
      if (typeof document === "undefined") return false;
      const active = document.activeElement;
      return active instanceof HTMLElement && active.closest("[data-message-composer='true']") ? active : null;
    };

    const updateInset = () => {
      const viewport = window.visualViewport;
      const baseline = Math.max(webViewportBaselineRef.current, window.innerHeight || 0);
      const viewportHeight = viewport?.height ?? window.innerHeight;
      const viewportOffsetTop = viewport?.offsetTop ?? 0;
      const focusedComposerElement = getFocusedComposerElement();
      const nextInset = focusedComposerElement
        ? Math.max(0, Math.round(baseline - viewportHeight - viewportOffsetTop))
        : 0;
      const keyboardVisible = nextInset > 80;
      setWebKeyboardInset(keyboardVisible ? nextInset : 0);
      if (webKeyboardBlurTimerRef.current) {
        clearTimeout(webKeyboardBlurTimerRef.current);
        webKeyboardBlurTimerRef.current = null;
      }
      if (!keyboardVisible && webKeyboardVisibleRef.current && focusedComposerElement) {
        webKeyboardBlurTimerRef.current = setTimeout(() => {
          const stillFocusedComposerElement = getFocusedComposerElement();
          if (!stillFocusedComposerElement) return;

          const liveViewport = window.visualViewport;
          const liveViewportHeight = liveViewport?.height ?? window.innerHeight;
          const liveViewportOffsetTop = liveViewport?.offsetTop ?? 0;
          const liveInset = Math.max(0, Math.round(baseline - liveViewportHeight - liveViewportOffsetTop));
          if (liveInset <= 80) {
            stillFocusedComposerElement.blur();
          }
        }, 120);
      }
      webKeyboardVisibleRef.current = keyboardVisible;
      scrollPageToTop();
    };

    const handleFocus = () => {
      stopDragSelect();
      requestAnimationFrame(updateInset);
      setTimeout(updateInset, 80);
      setTimeout(updateInset, 160);
    };

    const handleBlur = () => {
      setTimeout(updateInset, 80);
    };

    const handleWindowScroll = () => scrollPageToTop();
    window.visualViewport?.addEventListener("resize", updateInset);
    window.visualViewport?.addEventListener("scroll", updateInset);
    window.addEventListener("resize", updateInset);
    window.addEventListener("scroll", handleWindowScroll, { passive: true });
    document.addEventListener("focusin", handleFocus);
    document.addEventListener("focusout", handleBlur);
    updateInset();

    return () => {
      window.visualViewport?.removeEventListener("resize", updateInset);
      window.visualViewport?.removeEventListener("scroll", updateInset);
      window.removeEventListener("resize", updateInset);
      window.removeEventListener("scroll", handleWindowScroll);
      document.removeEventListener("focusin", handleFocus);
      document.removeEventListener("focusout", handleBlur);
      if (webKeyboardBlurTimerRef.current) clearTimeout(webKeyboardBlurTimerRef.current);
    };
  }, [stopDragSelect]);

  useEffect(() => {
    let active = true;
    setLoadError(null);

    void (async () => {
      const { data, error } = await supabase
        .from("chat_decoy_messages")
        .select("*")
        .eq("chat_id", chat.id)
        .order("created_at", { ascending: true });

      if (!active) return;

      if (error) {
        setLoadError("לא ניתן לטעון כרגע את תוכן הפיתיון.");
        setMessages([]);
        return;
      }

      setMessages(
        (data ?? []).map((row: any) => ({
          id: String(row.id),
          body: String(row.body ?? ""),
          is_me: Boolean(row.is_me),
          sender_id: typeof row.sender_id === "string" ? row.sender_id : null,
          created_at: String(row.created_at ?? new Date().toISOString()),
          edited_at: typeof row.edited_at === "string" ? row.edited_at : null,
        })),
      );
      scrollToBottom(false);
    })();

    return () => {
      active = false;
    };
  }, [chat.id, scrollToBottom]);

  const handleSend = useCallback(
    (body: string) => {
      const text = body.trim();
      if (!text || !profile?.id) return;

      const optimisticId = `optimistic-${Date.now()}`;
      const optimisticMessage: DecoyMessage = {
        id: optimisticId,
        body: text,
        is_me: true,
        sender_id: profile.id,
        created_at: new Date().toISOString(),
        optimistic: true,
      };

      setLoadError(null);
      setMessages((current) => [...current, optimisticMessage]);
      scrollToBottom(true);

      void supabase
        .from("chat_decoy_messages")
        .insert([{ chat_id: chat.id, sender_id: profile.id, body: text, is_me: true }])
        .select("*")
        .single()
        .then(({ data, error }) => {
          if (error || !data) {
            setMessages((current) => current.filter((message) => message.id !== optimisticId));
            setLoadError("ההודעה לא נשמרה בתוכן הפיתיון.");
            return;
          }

          setMessages((current) =>
            current.map((message) =>
              message.id === optimisticId
                ? {
                    id: String(data.id),
                    body: String(data.body ?? text),
                    is_me: Boolean(data.is_me),
                    sender_id: typeof data.sender_id === "string" ? data.sender_id : profile.id,
                    created_at: String(data.created_at ?? optimisticMessage.created_at),
                    edited_at: typeof data.edited_at === "string" ? data.edited_at : null,
                  }
                : message,
            ),
          );
          scrollToBottom(true);
        });
    },
    [chat.id, profile?.id, scrollToBottom],
  );

  const copySelected = useCallback(async () => {
    const text = selectedMessages.map((message) => message.body).join("\n");
    if (!text) return;
    await Clipboard.setStringAsync(text);
    setSelectedIds([]);
  }, [selectedMessages]);

  const beginEditSelected = useCallback(() => {
    const message = selectedMessages[0];
    if (!message || selectedMessages.length !== 1) return;
    setEditingMessage(message);
    setEditNonce((current) => current + 1);
    setSelectedIds([]);
    const layout = messageLayoutsRef.current[message.id];
    if (layout) {
      const targetY = Math.max(0, layout.y - (scrollMetricsRef.current.height - layout.h - 24));
      requestAnimationFrame(() => scrollRef.current?.scrollTo({ y: targetY, animated: true }));
    }
  }, [selectedMessages]);

  const saveEdit = useCallback(async (body: string) => {
    if (!editingMessage || editSaving) return;
    const nextBody = body.trim();
    if (!nextBody) {
      Alert.alert("עריכה", "הטקסט ריק.");
      return;
    }

    setEditSaving(true);
    const editedAt = new Date().toISOString();
    let { error } = await supabase
      .from("chat_decoy_messages")
      .update({ body: nextBody, edited_at: editedAt })
      .eq("id", editingMessage.id);
    if (error && /edited_at|schema|column/i.test(String(error.message ?? ""))) {
      const retry = await supabase
        .from("chat_decoy_messages")
        .update({ body: nextBody })
        .eq("id", editingMessage.id);
      error = retry.error;
    }
    setEditSaving(false);

    if (error) {
      Alert.alert("עריכה", "לא ניתן לשמור את ההודעה.");
      return;
    }

    setMessages((current) =>
      current.map((message) => (message.id === editingMessage.id ? { ...message, body: nextBody, edited_at: editedAt } : message)),
    );
    setEditingMessage(null);
    setSelectedIds([]);
  }, [editSaving, editingMessage]);

  const deleteSelected = useCallback(async () => {
    if (!selectedIds.length) return;

    const ids = [...selectedIds];
    const previousMessages = messages;
    setSelectedIds([]);
    setMessages((current) => current.filter((message) => !ids.includes(message.id)));

    const persistedIds = ids.filter((id) => !id.startsWith("optimistic-"));
    if (!persistedIds.length) return;

    const { error } = await supabase
      .from("chat_decoy_messages")
      .delete()
      .eq("chat_id", chat.id)
      .in("id", persistedIds);

    if (error) {
      setMessages(previousMessages);
      Alert.alert("מחיקה", "לא ניתן למחוק את ההודעות.");
    }
  }, [chat.id, messages, selectedIds]);
  const closeSelection = useCallback(() => setSelectedIds([]), []);

  return (
    <View style={styles.root}>
      <ChatBackground colorScheme={colorScheme} />
      <SafeAreaView edges={["top", "left", "right"]} style={styles.safeArea}>
        {selectedIds.length > 0 ? (
          <View style={styles.header}>
            <Pressable onPress={closeSelection} style={styles.headerButton}>
              <Feather name="x" size={24} color={theme.colors.headerIcon} />
            </Pressable>
            <Text style={styles.selectionCount}>{selectedIds.length}</Text>
            <View style={styles.selectionActions}>
              <Pressable onPress={() => void copySelected()} style={styles.headerButton}>
                <MaterialCommunityIcons name="content-copy" size={22} color={theme.colors.headerIcon} />
              </Pressable>
              {selectedIds.length === 1 ? (
                <Pressable onPress={beginEditSelected} style={styles.headerButton}>
                  <MaterialCommunityIcons name="pencil-outline" size={23} color={theme.colors.headerIcon} />
                </Pressable>
              ) : null}
              <Pressable onPress={deleteSelected} style={styles.headerButton}>
                <MaterialCommunityIcons name="trash-can-outline" size={24} color={theme.colors.headerIcon} />
              </Pressable>
              <Pressable onPress={() => Alert.alert("פרטים", selectedMessages[0] ? new Date(selectedMessages[0].created_at).toLocaleString("he-IL") : "")} style={styles.headerButton}>
                <MaterialCommunityIcons name="information-outline" size={24} color={theme.colors.headerIcon} />
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.header}>
            <Pressable onPress={onBack} style={styles.headerButton}>
              <Feather name="arrow-left" size={24} color={theme.colors.headerIcon} />
            </Pressable>
            <View style={styles.headerCopy}>
              <Text numberOfLines={1} style={styles.title}>
                {chat.title} - תוכן פיתיון
              </Text>
              <Text numberOfLines={1} style={styles.subtitle}>
                צ'אט שיוצג במצב פיתיון
              </Text>
            </View>
            <View style={styles.avatar}>
              <MaterialCommunityIcons name="fish" size={22} color={theme.colors.accent} />
            </View>
          </View>
        )}

        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.content}>
          <ScrollView
            ref={scrollRef}
            {...selectionPanResponder.panHandlers}
            {...webDragHandlers}
            onTouchMove={(event) => {
              const touch = event.nativeEvent.touches?.[0];
              const pageY = touch?.pageY ?? (event.nativeEvent as any).pageY;
              if (typeof pageY === "number") updateDragFromPageY(pageY);
            }}
            onTouchEnd={stopDragSelect}
            onTouchCancel={stopDragSelect}
            contentContainerStyle={styles.messagesContent}
            keyboardDismissMode="none"
            keyboardShouldPersistTaps="always"
            scrollEventThrottle={16}
            onLayout={(e) => {
              threadHeightRef.current = e.nativeEvent.layout.height;
              scrollMetricsRef.current.height = e.nativeEvent.layout.height;
              measureScrollView();
            }}
            onContentSizeChange={(_w, h) => {
              scrollMetricsRef.current.contentHeight = h;
              scrollToBottom(false);
            }}
            onScroll={(e) => {
              scrollMetricsRef.current.y = e.nativeEvent.contentOffset.y;
              scrollMetricsRef.current.height = e.nativeEvent.layoutMeasurement.height || scrollMetricsRef.current.height;
              scrollMetricsRef.current.contentHeight = e.nativeEvent.contentSize.height || scrollMetricsRef.current.contentHeight;
            }}
            showsVerticalScrollIndicator={false}
          >
            {loadError ? (
              <View style={styles.notice}>
                <Text style={styles.noticeText}>{loadError}</Text>
              </View>
            ) : null}

            {chatMessages.map((message) => {
              const isEditingList = !!editingMessage;
              return (
              <View
                key={message.id}
                style={isEditingList ? styles.blurredMessage : null}
                onLayout={(e) => {
                  messageLayoutsRef.current[message.id] = {
                    y: e.nativeEvent.layout.y,
                    h: e.nativeEvent.layout.height,
                  };
                }}
              >
                <MessageBubble
                  currentUserId={profile?.id ?? ""}
                  message={message}
                  onReply={() => {}}
                  onToggleReaction={() => {}}
                  onRevealViewOnce={() => {}}
                  onToggleSelection={toggleSelection}
                  onShowReactions={() => {}}
                  onShowReactionsSheet={() => {}}
                  onPlusExtra={() => {}}
                  showReactions={false}
                  isSelected={selectedIds.includes(message.id)}
                  isSelectionMode={selectedIds.length > 0}
                  onInitiateDragSelect={(messageId) => {
                    if (Platform.OS === "web") {
                      beginSelection(messageId);
                      beginDragSelectAtMessage(messageId, true);
                    } else {
                      beginDragSelectAtMessage(messageId, false);
                    }
                  }}
                  renderSecureText={false}
                  allowWebLongPressSelection
                />
              </View>
              );
            })}
          </ScrollView>

          {editingMessage ? (
            <View pointerEvents="none" style={styles.editFloatingPreview}>
              <MessageBubble
                currentUserId={profile?.id ?? ""}
                message={toMessage(chat.id, editingMessage)}
                onReply={() => {}}
                onToggleReaction={() => {}}
                onRevealViewOnce={() => {}}
                onToggleSelection={() => {}}
                onShowReactions={() => {}}
                onShowReactionsSheet={() => {}}
                onPlusExtra={() => {}}
                showReactions={false}
                isSelected={false}
                isSelectionMode={false}
                renderSecureText={false}
                allowWebLongPressSelection
              />
            </View>
          ) : null}

          <View style={Platform.OS === "web" ? { paddingBottom: webKeyboardInset } : null}>
            <MessageComposer
              onInputFocus={() => {
                stopDragSelect();
                setSelectedIds([]);
              }}
              onSend={(body) => {
                if (editingMessage) {
                  void saveEdit(body);
                  return;
                }
                handleSend(body);
              }}
              onCancelReply={() => {}}
              replyToText={null}
              replyToName={null}
              onAttachmentPress={() => {}}
              keepKeyboardOpenAfterSend
              editSession={editingMessage ? { id: editingMessage.id, text: editingMessage.body, nonce: editNonce } : null}
              onCancelEdit={() => setEditingMessage(null)}
            />
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const createStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: theme.colors.chatBackdrop,
      overflow: "hidden",
    },
    safeArea: {
      flex: 1,
      backgroundColor: "transparent",
    },
    header: {
      height: 58,
      paddingHorizontal: 12,
      flexDirection: Platform.OS === "web" ? "row-reverse" : "row",
      alignItems: "center",
      gap: 16,
      backgroundColor: theme.colors.header,
      borderBottomColor: theme.colors.separator,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    headerButton: {
      width: 40,
      height: 40,
      borderRadius: 999,
      alignItems: "center",
      justifyContent: "center",
    },
    headerCopy: {
      flex: 1,
      alignItems: "flex-end",
    },
    selectionCount: {
      color: theme.colors.headerText,
      fontSize: 20,
      fontWeight: "700",
      marginLeft: 4,
    },
    selectionActions: {
      flex: 1,
      flexDirection: Platform.OS === "web" ? "row-reverse" : "row",
      alignItems: "center",
      justifyContent: "flex-end",
      gap: 2,
    },
    title: {
      color: theme.colors.headerText,
      fontSize: 18,
      fontWeight: "800",
      textAlign: "right",
      writingDirection: "rtl",
    },
    subtitle: {
      color: theme.colors.headerSubtitle,
      fontSize: 12,
      marginTop: 2,
      textAlign: "right",
      writingDirection: "rtl",
    },
    avatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.surfaceAlt,
    },
    content: {
      flex: 1,
    },
    messagesContent: {
      flexGrow: 1,
      paddingHorizontal: 0,
      paddingTop: 12,
      paddingBottom: 12,
    },
    blurredMessage: {
      opacity: 0.62,
      ...(Platform.OS === "web" ? ({ filter: "blur(1px)" } as any) : null),
    },
    editFloatingPreview: {
      paddingHorizontal: 0,
      paddingTop: 6,
      paddingBottom: 2,
      backgroundColor: "transparent",
    },
    notice: {
      alignSelf: "center",
      maxWidth: "86%",
      borderRadius: 999,
      paddingHorizontal: 14,
      paddingVertical: 8,
      backgroundColor: theme.colors.datePill,
      marginBottom: 12,
    },
    noticeText: {
      color: theme.colors.datePillText,
      fontSize: 13,
      textAlign: "center",
      writingDirection: "rtl",
    },
    messageRow: {
      width: "100%",
      paddingHorizontal: 12,
      paddingVertical: 2,
      marginVertical: 3,
    },
    messageRowSelected: {
      backgroundColor: theme.colors.selectionModeBackground,
    },
    mineRow: {
      alignItems: "flex-end",
    },
    theirsRow: {
      alignItems: "flex-start",
    },
    bubble: {
      maxWidth: "78%",
      minWidth: 72,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingTop: 7,
      paddingBottom: 5,
    },
    mineBubble: {
      backgroundColor: theme.colors.mine,
      borderTopRightRadius: 2,
    },
    theirsBubble: {
      backgroundColor: theme.colors.theirs,
      borderTopLeftRadius: 2,
    },
    optimisticBubble: {
      opacity: 0.7,
    },
    bubbleText: {
      color: theme.colors.text,
      fontSize: 16,
      lineHeight: 21,
      textAlign: "right",
      writingDirection: "rtl",
    },
    timeText: {
      color: theme.colors.textMuted,
      fontSize: 11,
      marginTop: 3,
      alignSelf: "flex-end",
    },
    modalRoot: {
      flex: 1,
      justifyContent: "center",
      paddingHorizontal: 20,
      backgroundColor: "rgba(0,0,0,0.45)",
    },
    editCard: {
      borderRadius: 14,
      padding: 18,
      backgroundColor: theme.colors.surface,
    },
    editTitle: {
      color: theme.colors.text,
      fontSize: 18,
      fontWeight: "800",
      textAlign: "right",
      writingDirection: "rtl",
      marginBottom: 12,
    },
    editInput: {
      minHeight: 120,
      maxHeight: 220,
      borderRadius: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.separator,
      padding: 12,
      color: theme.colors.text,
      fontSize: 16,
      textAlign: "right",
      writingDirection: "rtl",
      textAlignVertical: "top",
    },
    editActions: {
      flexDirection: "row",
      justifyContent: "flex-end",
      alignItems: "center",
      gap: 12,
      marginTop: 16,
    },
    editButton: {
      paddingVertical: 10,
      paddingHorizontal: 14,
    },
    cancelText: {
      color: theme.colors.textMuted,
      fontWeight: "600",
    },
    saveButton: {
      backgroundColor: theme.colors.accent,
      paddingVertical: 10,
      paddingHorizontal: 18,
      borderRadius: 999,
    },
    saveText: {
      color: "#fff",
      fontWeight: "700",
    },
  });
