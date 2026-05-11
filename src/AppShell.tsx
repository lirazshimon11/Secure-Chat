import { PropsWithChildren, useCallback, useEffect, useRef, useState } from "react";
import { Animated, BackHandler, Easing, Platform, StyleSheet, View, useWindowDimensions } from "react-native";
import { pushShell, readSaShell, replaceShell } from "@/lib/webShellHistory";
import { AuthScreen } from "@/screens/AuthScreen";
import { LoadingScreen } from "@/screens/LoadingScreen";
import { ChatsScreen } from "@/screens/ChatsScreen";
import { ChatScreen } from "@/screens/ChatScreen";
import { SettingsScreen } from "@/screens/SettingsScreen";
import { CreateChatScreen } from "@/screens/CreateChatScreen";
import { ChatSettingsScreen } from "@/screens/ChatSettingsScreen";
import { SavedMessagesScreen } from "@/screens/SavedMessagesScreen";
import { ForwardScreen } from "@/screens/ForwardScreen";
import { useAuth } from "@/context/AuthContext";
import { useChats } from "@/context/ChatContext";
import { Chat, Message, Profile } from "@/lib/types";
import React from "react";
import { chatMessagesQueryKey, fetchMessagesPage, MessagesPage } from "@/hooks/useChatMessages";
import { queryClient } from "@/lib/queryClient";
import { ChatBackgroundPreloader, preloadChatBackgrounds } from "@/screens/chat/ChatBackground";

export function AppShell() {
  const { session, loading } = useAuth();
  const { width } = useWindowDimensions();
  const { chats, sendMessage } = useChats();
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showCreateChat, setShowCreateChat] = useState<boolean | Profile[]>(false);
  const [showChatSettings, setShowChatSettings] = useState(false);
  const [settingsChatStack, setSettingsChatStack] = useState<Chat[]>([]);
  const [showSavedMessages, setShowSavedMessages] = useState(false);
  const [forwardPayload, setForwardPayload] = useState<Message[] | null>(null);
  const [scrollToMessageId, setScrollToMessageId] = useState<string | null>(null);
  const warmedChatIdsRef = useRef<Set<string>>(new Set());
  const selectedChatRef = useRef<Chat | null>(null);
  selectedChatRef.current = selectedChat;
  const syncingFromHistoryRef = useRef(false);

  useEffect(() => {
    preloadChatBackgrounds();
  }, []);

  const warmChatMessages = useCallback((chatId: string) => {
    if (warmedChatIdsRef.current.has(chatId)) return;
    warmedChatIdsRef.current.add(chatId);

    void queryClient.prefetchInfiniteQuery({
      queryKey: chatMessagesQueryKey(chatId),
      queryFn: ({ pageParam }) => fetchMessagesPage(chatId, pageParam),
      initialPageParam: null as string | null,
      getNextPageParam: (lastPage: MessagesPage) => lastPage.nextCursor,
    });
  }, []);

  useEffect(() => {
    if (!session || !chats.length) return;
    chats.slice(0, 10).forEach((chat) => warmChatMessages(chat.id));
  }, [chats, session, warmChatMessages]);

  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;

    const onPopState = () => {
      syncingFromHistoryRef.current = true;
      try {
        const shell = readSaShell();
        if (!shell) {
          setSelectedChat(null);
          setShowChatSettings(false);
          setSettingsChatStack([]);
          setScrollToMessageId(null);
          return;
        }
        const ch = chats.find((x) => x.id === shell.c) ?? null;
        setSelectedChat(ch);
        setShowChatSettings(!!shell.s && !!ch);
        if (!shell.s) setSettingsChatStack([]);
        if (!ch) {
          setShowChatSettings(false);
          setSettingsChatStack([]);
        }
      } finally {
        syncingFromHistoryRef.current = false;
      }
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [chats]);

  const openChat = useCallback(
    (chat: Chat | null) => {
      if (!chat) {
        if (Platform.OS === "web") replaceShell(null);
        setSelectedChat(null);
        return;
      }

      warmChatMessages(chat.id);
      const prevId = selectedChatRef.current?.id ?? null;
      setSelectedChat(chat);

      if (Platform.OS !== "web" || syncingFromHistoryRef.current) return;
      if (prevId) {
        replaceShell({ c: chat.id, s: false });
      } else {
        pushShell({ c: chat.id });
      }
    },
    [warmChatMessages],
  );

  const closeChat = useCallback(() => {
    setScrollToMessageId(null);
    replaceShell(null);
    setSelectedChat(null);
    setShowChatSettings(false);
    setSettingsChatStack([]);
  }, []);

  const openChatSettingsLayer = useCallback((stackPreset?: Chat[]) => {
    setSettingsChatStack(stackPreset ?? []);
    setShowChatSettings(true);
    const id = selectedChatRef.current?.id;
    if (Platform.OS === "web" && id && !syncingFromHistoryRef.current) {
      pushShell({ c: id, s: true });
    }
  }, []);

  const handleChatSettingsBack = useCallback(() => {
    if (settingsChatStack.length > 0) {
      setSettingsChatStack((c) => c.slice(0, -1));
      return;
    }
    if (Platform.OS === "web" && typeof window !== "undefined" && readSaShell()?.s) {
      window.history.back();
      return;
    }
    setShowChatSettings(false);
  }, [settingsChatStack.length]);

  useEffect(() => {
    if (Platform.OS !== "android") return undefined;

    const onHardwareBack = () => {
      if (forwardPayload) {
        setForwardPayload(null);
        return true;
      }
      if (selectedChat && showChatSettings) {
        handleChatSettingsBack();
        return true;
      }
      if (showSettings) {
        setShowSettings(false);
        return true;
      }
      if (showSavedMessages) {
        setShowSavedMessages(false);
        return true;
      }
      if (showCreateChat) {
        setShowCreateChat(false);
        return true;
      }
      if (selectedChat) {
        closeChat();
        return true;
      }
      return false;
    };

    const sub = BackHandler.addEventListener("hardwareBackPress", onHardwareBack);
    return () => sub.remove();
  }, [
    forwardPayload,
    selectedChat,
    showChatSettings,
    showSettings,
    showSavedMessages,
    showCreateChat,
    closeChat,
    handleChatSettingsBack,
  ]);

  if (loading) {
    return <LoadingScreen />;
  }

  if (!session) {
    return <AuthScreen />;
  }

  const slideDistance = Math.min(width, 430);

  const chatsScreen = (
    <ChatsScreen
      onOpenChat={(chat, messageId) => {
        setShowChatSettings(false);
        setScrollToMessageId(messageId ?? null);
        openChat(chat);
      }}
      onOpenSavedMessages={() => setShowSavedMessages(true)}
      onOpenSettings={() => setShowSettings(true)}
      onCreateChat={() => setShowCreateChat(true)}
    />
  );

  const renderChatScreen = (chat: Chat) => (
    <ChatScreen
      chat={chat}
      onBack={closeChat}
      onOpenChatSettings={(nextChat) => {
        const preset =
          nextChat && nextChat.id !== chat.id ? [nextChat] : [];
        openChatSettingsLayer(preset);
      }}
      scrollToMessageId={scrollToMessageId}
      onForward={(messages) => setForwardPayload(messages)}
      onCreateGroupWith={(profile) => setShowCreateChat([profile])}
      onOpenChat={(nextChat) => {
        setShowChatSettings(false);
        setSettingsChatStack([]);
        openChat(nextChat);
      }}
    />
  );

  return (
    <View style={styles.root}>
      <ChatBackgroundPreloader />
      <View style={styles.layer}>
        {chatsScreen}
      </View>

      <SlidingPage visible={!!selectedChat} distance={slideDistance} zIndex={10}>
        {selectedChat ? renderChatScreen(selectedChat) : null}
      </SlidingPage>

      <SlidingPage visible={showSettings} distance={slideDistance} zIndex={20}>
        <SettingsScreen onBack={() => setShowSettings(false)} />
      </SlidingPage>

      <SlidingPage visible={showSavedMessages} distance={slideDistance} zIndex={20}>
        <SavedMessagesScreen
          onBack={() => setShowSavedMessages(false)}
          onNavigateToChat={(chatId, messageId) => {
            const chat = chats.find((c) => c.id === chatId) ?? null;
            setShowSavedMessages(false);
            setScrollToMessageId(messageId);
            openChat(chat);
          }}
        />
      </SlidingPage>

      <SlidingPage visible={!!showCreateChat} distance={slideDistance} zIndex={20}>
        <CreateChatScreen
          initialSelectedUsers={Array.isArray(showCreateChat) ? showCreateChat : undefined}
          onBack={() => setShowCreateChat(false)}
          onOpenChat={(chat) => {
            setShowCreateChat(false);
            openChat(chat);
          }}
        />
      </SlidingPage>

      <SlidingPage visible={!!forwardPayload} distance={slideDistance} zIndex={30}>
        {forwardPayload ? (
          <ForwardScreen
            messages={forwardPayload}
            onCancel={() => setForwardPayload(null)}
            onSend={async (chatIds) => {
              const payload = forwardPayload;
              setForwardPayload(null);
              if (chatIds.length === 1) {
                const nextChat = chats.find(c => c.id === chatIds[0]);
                if (nextChat) {
                  openChat(nextChat);
                }
              } else {
                replaceShell(null);
                setSelectedChat(null);
              }

              const sorted = [...payload].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
              for (const chatId of chatIds) {
                for (const msg of sorted) {
                  await sendMessage({
                    chatId,
                    body: msg.body_ciphertext,
                    messageKind: "standard",
                  });
                }
              }
            }}
          />
        ) : null}
      </SlidingPage>

      <SlidingPage visible={!!selectedChat && showChatSettings} distance={slideDistance} zIndex={30}>
        {selectedChat ? (
          <ChatSettingsScreen
            chat={settingsChatStack.length > 0 ? settingsChatStack[settingsChatStack.length - 1] : selectedChat}
            onBack={handleChatSettingsBack}
            onOpenChat={(chat) => {
              setShowChatSettings(false);
              setSettingsChatStack([]);
              openChat(chat);
            }}
            onOpenChatSettings={(chat) => {
              setSettingsChatStack(cur => [...cur, chat]);
            }}
          />
        ) : null}
      </SlidingPage>
    </View>
  );
}

function SlidingPage({ visible, distance, zIndex, children }: PropsWithChildren<{ visible: boolean; distance: number; zIndex: number }>) {
  const [present, setPresent] = useState(visible);
  const anim = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const childrenRef = useRef<React.ReactNode>(children);

  if (visible && children) {
    childrenRef.current = children;
  }

  useEffect(() => {
    if (visible) {
      setPresent(true);
      anim.setValue(0);
      requestAnimationFrame(() => {
        Animated.timing(anim, {
          toValue: 1,
          duration: 260,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start();
      });
      return;
    }

    if (!present) return;

    anim.setValue(1);
    requestAnimationFrame(() => {
      Animated.timing(anim, {
        toValue: 0,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(() => setPresent(false));
    });
  }, [anim, present, visible]);

  if (!present) return null;

  return (
    <Animated.View
      pointerEvents={visible ? "auto" : "none"}
      style={[
        styles.layer,
        {
          zIndex,
          transform: [
            {
              translateX: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [-distance, 0],
              }),
            },
          ],
        },
      ]}
    >
      {visible ? children : childrenRef.current}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#000",
    overflow: "hidden",
  },
  layer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000",
  },
});
