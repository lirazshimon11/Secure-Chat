import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase";
import { ChatSecuritySettings } from "@/lib/types";

export const DEFAULT_CHAT_SECURITY_SETTINGS: ChatSecuritySettings = {
  require_hold_to_reveal: true,
  identity_magnet: true,
  shutter_flicker: true,
  app_switcher_blackout: true,
  fake_screenshot_warning: true,
  anti_copy_canvas: true,
};

const selectColumns = [
  "require_hold_to_reveal",
  "identity_magnet",
  "shutter_flicker",
  "app_switcher_blackout",
  "fake_screenshot_warning",
  "anti_copy_canvas",
].join(", ");

const storageKey = (chatId: string) => `chat-security-settings:${chatId}`;

async function readLocalSettings(chatId: string): Promise<ChatSecuritySettings | null> {
  const raw = await AsyncStorage.getItem(storageKey(chatId));
  if (!raw) return null;
  try {
    return { ...DEFAULT_CHAT_SECURITY_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return null;
  }
}

async function writeLocalSettings(chatId: string, settings: ChatSecuritySettings) {
  await AsyncStorage.setItem(storageKey(chatId), JSON.stringify(settings));
}

export async function fetchChatSecuritySettings(chatId: string): Promise<ChatSecuritySettings> {
  const { data, error } = await supabase
    .from("chat_security_settings")
    .select(selectColumns)
    .eq("chat_id", chatId)
    .maybeSingle();

  if (error || !data) {
    return (await readLocalSettings(chatId)) ?? DEFAULT_CHAT_SECURITY_SETTINGS;
  }

  return { ...DEFAULT_CHAT_SECURITY_SETTINGS, ...(data as Partial<ChatSecuritySettings>) };
}

export async function saveChatSecuritySettings(
  chatId: string,
  settings: ChatSecuritySettings,
  userId: string,
) {
  await writeLocalSettings(chatId, settings);
  const result = await supabase
    .from("chat_security_settings")
    .upsert({
      chat_id: chatId,
      ...settings,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    });
  return result.error ? { ...result, error: null } : result;
}
