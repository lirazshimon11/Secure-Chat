import { Chat, ChatLocalPreferences, ChatMuteSetting } from "@/lib/types";

export type DisplayChat = {
  chat: Chat;
  preferences: ChatLocalPreferences;
  unreadCount: number;
  muted: boolean;
  hiddenByClear: boolean;
  preview: string;
  timeLabel: string;
  type: "chat" | "message";
  matchedMessageId?: string;
};

export function isChatMuted(setting?: ChatMuteSetting) {
  if (!setting) return false;
  if (setting.mute_always) return true;
  return Boolean(setting.mute_until && new Date(setting.mute_until).getTime() > Date.now());
}

export function getDefaultPreferences(): ChatLocalPreferences {
  return {
    archived: false,
    pinned_at: null,
    locked: false,
    cleared_at: null,
    deleted_from_home_at: null,
  };
}

export function isHiddenByClear(chat: Chat, preferences: ChatLocalPreferences) {
  if (!preferences.cleared_at) return false;
  if (!chat.last_message_at) return true;
  return new Date(chat.last_message_at).getTime() <= new Date(preferences.cleared_at).getTime();
}

export function formatChatTime(chat: Chat, hiddenByClear: boolean) {
  if (hiddenByClear || !chat.last_message_at) return "";
  const d = new Date(chat.last_message_at);
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")} `;
}

export function sortDisplayChats(a: DisplayChat, b: DisplayChat) {
  const aPinned = a.preferences.pinned_at ? new Date(a.preferences.pinned_at).getTime() : 0;
  const bPinned = b.preferences.pinned_at ? new Date(b.preferences.pinned_at).getTime() : 0;
  if (aPinned !== bPinned) return bPinned - aPinned;
  const aLastMessageAt = a.chat.last_message_at ? new Date(a.chat.last_message_at).getTime() : 0;
  const bLastMessageAt = b.chat.last_message_at ? new Date(b.chat.last_message_at).getTime() : 0;
  return bLastMessageAt - aLastMessageAt;
}
