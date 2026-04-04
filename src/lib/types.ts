export type MessageKind = "standard" | "temporary" | "view_once" | "system";
export type MuteDurationOption = "8_hours" | "7_days" | "always";

export type Profile = {
  id: string;
  email: string;
  username: string;
  full_name: string | null;
  created_at: string;
};

export type Chat = {
  id: string;
  title: string;
  is_group: boolean;
  description: string | null;
  created_by: string;
  created_at: string;
  last_message_preview: string | null;
  last_message_at: string | null;
};

export type Message = {
  id: string;
  chat_id: string;
  sender_id: string;
  body_ciphertext: string;
  body_preview: string | null;
  message_kind: MessageKind;
  reply_to_id: string | null;
  expires_at: string | null;
  created_at: string;
  deleted_at: string | null;
};

export type ChatMuteSetting = {
  mute_until: string | null;
  mute_always: boolean;
};

export type ChatLocalPreferences = {
  archived: boolean;
  pinned_at: string | null;
  locked: boolean;
  cleared_at: string | null;
  deleted_from_home_at: string | null;
};

export type ReactionSummary = Record<string, string[]>;
