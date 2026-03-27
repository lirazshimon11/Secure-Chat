import { useState } from "react";
import { AuthScreen } from "@/screens/AuthScreen";
import { LoadingScreen } from "@/screens/LoadingScreen";
import { ChatsScreen } from "@/screens/ChatsScreen";
import { ChatScreen } from "@/screens/ChatScreen";
import { SettingsScreen } from "@/screens/SettingsScreen";
import { useAuth } from "@/context/AuthContext";
import { Chat } from "@/lib/types";

export function AppShell() {
  const { session, loading } = useAuth();
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  if (loading) {
    return <LoadingScreen />;
  }

  if (!session) {
    return <AuthScreen />;
  }

  if (showSettings) {
    return <SettingsScreen onBack={() => setShowSettings(false)} />;
  }

  if (selectedChat) {
    return <ChatScreen chat={selectedChat} onBack={() => setSelectedChat(null)} />;
  }

  return <ChatsScreen onOpenChat={setSelectedChat} onOpenSettings={() => setShowSettings(true)} />;
}
