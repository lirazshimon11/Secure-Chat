import { PropsWithChildren, useCallback, useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, View, useWindowDimensions } from "react-native";
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

  const openChat = useCallback((chat: Chat | null) => {
    if (!chat) {
      setSelectedChat(null);
      return;
    }

    warmChatMessages(chat.id);
    setSelectedChat(chat);
  }, [warmChatMessages]);

  const closeChat = useCallback(() => {
    setSelectedChat(null);
    setScrollToMessageId(null);
  }, []);

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
        if (nextChat && nextChat?.id !== chat?.id) {
          setSettingsChatStack([nextChat]);
        } else {
          setSettingsChatStack([]);
        }
        setShowChatSettings(true);
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
            onBack={() => {
              if (settingsChatStack.length > 0) {
                setSettingsChatStack(cur => cur.slice(0, -1));
              } else {
                setShowChatSettings(false);
              }
            }}
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
