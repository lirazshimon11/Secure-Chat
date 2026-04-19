/**
 * DecoyContentScreen
 *
 * A thin wrapper around ChatScreen with decoyMode=true.
 * Visually IDENTICAL to the real chat. Only difference: the title.
 */
import React, { useMemo } from "react";
import { Chat } from "@/lib/types";
import { ChatScreen } from "@/screens/ChatScreen";

type Props = {
  chat: Chat;
  onBack: () => void;
};

export function DecoyContentScreen({ chat, onBack }: Props) {
  // Override the title — everything else is the real ChatScreen
  const decoyChat = useMemo<Chat>(
    () => ({ ...chat, title: `${chat.title} — תוכן פיתיון` }),
    [chat],
  );

  return (
    <ChatScreen
      chat={decoyChat}
      onBack={onBack}
      onOpenChatSettings={() => {}}
      decoyMode
    />
  );
}
