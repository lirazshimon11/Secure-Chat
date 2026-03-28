import { useState } from "react";
import { AuthScreen } from "@/screens/AuthScreen";
import { LoadingScreen } from "@/screens/LoadingScreen";
import { ChatsScreen } from "@/screens/ChatsScreen";
import { ChatScreen } from "@/screens/ChatScreen";
import { SettingsScreen } from "@/screens/SettingsScreen";
import { CreateChatScreen } from "@/screens/CreateChatScreen";
import { ChatSettingsScreen } from "@/screens/ChatSettingsScreen";
import { SavedMessagesScreen } from "@/screens/SavedMessagesScreen";
import { useAuth } from "@/context/AuthContext";
import { Chat } from "@/lib/types";

export function AppShell() {
  const { session, loading } = useAuth();
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showCreateChat, setShowCreateChat] = useState(false);
  const [showChatSettings, setShowChatSettings] = useState(false);
  const [showSavedMessages, setShowSavedMessages] = useState(false);

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
    return <SavedMessagesScreen onBack={() => setShowSavedMessages(false)} />;
  }

  if (showCreateChat) {
    return (
      <CreateChatScreen
        onBack={() => setShowCreateChat(false)}
        onOpenChat={(chat) => {
          setShowCreateChat(false);
          setSelectedChat(chat);
        }}
      />
    );
  }

  if (selectedChat && showChatSettings) {
    return <ChatSettingsScreen chat={selectedChat} onBack={() => setShowChatSettings(false)} />;
  }

  if (selectedChat) {
    return (
      <ChatScreen
        chat={selectedChat}
        onBack={() => setSelectedChat(null)}
        onOpenChatSettings={() => setShowChatSettings(true)}
      />
    );
  }

  return (
    <ChatsScreen
      onOpenChat={(chat) => {
        setShowChatSettings(false);
        setSelectedChat(chat);
      }}
      onOpenSavedMessages={() => setShowSavedMessages(true)}
      onOpenSettings={() => setShowSettings(true)}
      onCreateChat={() => setShowCreateChat(true)}
    />
  );
}
