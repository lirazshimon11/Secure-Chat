import { useState } from "react";
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
import React, { useEffect } from "react";
import { Animated, Easing, StyleSheet, View, Dimensions } from "react-native";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export function AppShell() {
  const { session, loading } = useAuth();
  const { chats, sendMessage, loadMessages } = useChats();
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showCreateChat, setShowCreateChat] = useState<boolean | Profile[]>(false);
  const [showChatSettings, setShowChatSettings] = useState(false);
  const [settingsChatStack, setSettingsChatStack] = useState<Chat[]>([]);
  const [showSavedMessages, setShowSavedMessages] = useState(false);
  const [forwardPayload, setForwardPayload] = useState<Message[] | null>(null);
  const [scrollToMessageId, setScrollToMessageId] = useState<string | null>(null);

  const [animValue] = useState(new Animated.Value(0)); // 0: Chats, 1: Chat
  const [prevChat, setPrevChat] = useState<Chat | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);

  // Simple "push/pop" slide logic
  useEffect(() => {
    if (selectedChat && !prevChat) {
      // Open Animation
      setIsAnimating(true);
      animValue.setValue(0);
      Animated.timing(animValue, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
        easing: Easing.out(Easing.poly(4)),
      }).start(() => {
        setIsAnimating(false);
        setPrevChat(selectedChat);
      });
    } else if (!selectedChat && prevChat) {
      // Back Animation
      setIsAnimating(true);
      animValue.setValue(1);
      Animated.timing(animValue, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
        easing: Easing.inOut(Easing.poly(4)),
      }).start(() => {
        setIsAnimating(false);
        setPrevChat(null);
      });
    } else if (selectedChat !== prevChat) {
      setPrevChat(selectedChat);
    }
  }, [selectedChat]);

  if (loading) {
    return <LoadingScreen />;
  }

  if (!session) {
    return <AuthScreen />;
  }

  if (showSettings) {
    return <SettingsScreen onBack={() => setShowSettings(false)} />;
  }

  if (showSavedMessages) {
    return (
      <SavedMessagesScreen
        onBack={() => setShowSavedMessages(false)}
        onNavigateToChat={(chatId, messageId) => {
          const chat = chats.find((c) => c.id === chatId) ?? null;
          setShowSavedMessages(false);
          setScrollToMessageId(messageId);
          setSelectedChat(chat);
        }}
      />
    );
  }

  if (showCreateChat) {
    return (
      <CreateChatScreen
        initialSelectedUsers={Array.isArray(showCreateChat) ? showCreateChat : undefined}
        onBack={() => setShowCreateChat(false)}
        onOpenChat={(chat) => {
          setShowCreateChat(false);
          setSelectedChat(chat);
        }}
      />
    );
  }

  if (forwardPayload) {
    return (
      <ForwardScreen
        messages={forwardPayload}
        onCancel={() => setForwardPayload(null)}
        onSend={async (chatIds) => {
          setForwardPayload(null);
          if (chatIds.length === 1) {
            const nextChat = chats.find(c => c.id === chatIds[0]);
            if (nextChat) setSelectedChat(nextChat);
          } else {
            setSelectedChat(null);
          }

          const sorted = [...forwardPayload].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
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
    );
  }

  if (selectedChat && showChatSettings) {
    const currentChatForSettings = settingsChatStack.length > 0 ? settingsChatStack[settingsChatStack.length - 1] : selectedChat;
    
    return <ChatSettingsScreen chat={currentChatForSettings} 
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
               setSelectedChat(chat);
             }}
             onOpenChatSettings={(chat) => {
               setSettingsChatStack(cur => [...cur, chat]);
             }}
           />;
  }

  const chatsTranslateX = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -SCREEN_WIDTH * 0.3],
  });

  const chatTranslateX = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [SCREEN_WIDTH, 0],
  });

  const chatOpacity = animValue.interpolate({
    inputRange: [0, 0.1, 1],
    outputRange: [0, 1, 1],
  });

  const chatsOpacity = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.6],
  });

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      {(!selectedChat || isAnimating) && (
        <Animated.View style={{ 
          ...StyleSheet.absoluteFillObject, 
          transform: [{ translateX: chatsTranslateX }],
          opacity: chatsOpacity
        }}>
          <ChatsScreen
            onOpenChat={(chat, messageId) => {
              setShowChatSettings(false);
              setScrollToMessageId(messageId ?? null);
              // Pre-load messages so they're ready when the animation ends
              void loadMessages(chat.id);
              setSelectedChat(chat);
            }}
            onOpenSavedMessages={() => setShowSavedMessages(true)}
            onOpenSettings={() => setShowSettings(true)}
            onCreateChat={() => setShowCreateChat(true)}
          />
        </Animated.View>
      )}

      {(selectedChat || (isAnimating && prevChat)) && (
        <Animated.View style={{ 
          ...StyleSheet.absoluteFillObject, 
          transform: [{ translateX: chatTranslateX }],
          opacity: chatOpacity,
          zIndex: 10,
          backgroundColor: "#000",
          shadowColor: "#000",
          shadowOffset: { width: -10, height: 0 },
          shadowOpacity: 0.3,
          shadowRadius: 20,
          elevation: 20,
        }}>
          { (selectedChat || prevChat) && (
            <ChatScreen
              chat={(selectedChat || prevChat)!}
              onBack={() => {
                setSelectedChat(null);
                setScrollToMessageId(null);
              }}
              onOpenChatSettings={() => setShowChatSettings(true)}
              scrollToMessageId={scrollToMessageId}
              onForward={(messages) => setForwardPayload(messages)}
              onCreateGroupWith={(profile) => setShowCreateChat([profile])}
            />
          )}
        </Animated.View>
      )}
    </View>
  );
}
