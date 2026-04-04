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

export function AppShell() {
  const { session, loading } = useAuth();
  const { chats, sendMessage } = useChats();
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showCreateChat, setShowCreateChat] = useState<boolean | Profile[]>(false);
  const [showChatSettings, setShowChatSettings] = useState(false);
  const [settingsChatStack, setSettingsChatStack] = useState<Chat[]>([]);
  const [showSavedMessages, setShowSavedMessages] = useState(false);
  const [forwardPayload, setForwardPayload] = useState<Message[] | null>(null);
  // When navigating from SavedMessages to a chat, optionally scroll to a message
  const [scrollToMessageId, setScrollToMessageId] = useState<string | null>(null);

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
          // Only single-chat returns you to the chat. Multi-chat drops you at ChatsScreen.
          if (chatIds.length === 1) {
            const nextChat = chats.find(c => c.id === chatIds[0]);
            if (nextChat) setSelectedChat(nextChat);
          } else {
            setSelectedChat(null); // return to home screen
          }

          // In a real app we might want a progress indicator if there are many messages,
          // but for now we dispatch them asynchronously.
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

  if (selectedChat) {
    return (
      <ChatScreen
        chat={selectedChat}
        onBack={() => {
          setSelectedChat(null);
          setScrollToMessageId(null);
        }}
        onOpenChatSettings={() => setShowChatSettings(true)}
        scrollToMessageId={scrollToMessageId}
        onForward={(messages) => setForwardPayload(messages)}
        onCreateGroupWith={(profile) => setShowCreateChat([profile])}
      />
    );
  }

  return (
    <ChatsScreen
      onOpenChat={(chat, messageId) => {
        setShowChatSettings(false);
        setScrollToMessageId(messageId ?? null);
        setSelectedChat(chat);
      }}
      onOpenSavedMessages={() => setShowSavedMessages(true)}
      onOpenSettings={() => setShowSettings(true)}
      onCreateChat={() => setShowCreateChat(true)}
    />
  );
}
