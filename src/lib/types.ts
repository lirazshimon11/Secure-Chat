export type MessageKind = "standard" | "temporary" | "view_once" | "system";
export type MuteDurationOption = "8_hours" | "7_days" | "always";

export type Profile = {
  id: string;
  email: string;
  username: string;
  full_name: string | null;
  created_at: string;
  is_in_relationship: boolean;
};

export type DecoyTarget = {
  id: string;
  chat_id: string;
  target_id: string;
  enabled_by: string;
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
  edited_at?: string | null;
  deleted_at: string | null;
  optimistic?: boolean;
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

export type ChatSecuritySettings = {
  require_hold_to_reveal: boolean;
  identity_magnet: boolean;
  shutter_flicker: boolean;
  shutter_flicker_fps: number;
  app_switcher_blackout: boolean;
  fake_screenshot_warning: boolean;
  anti_copy_canvas: boolean;
  chat_preview_enabled: boolean;
};

export type ReactionSummary = Record<string, { userId: string; createdAt: string }[]>;
