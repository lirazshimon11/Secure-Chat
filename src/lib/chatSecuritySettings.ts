import AsyncStorage from "@react-native-async-storage/async-storage";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { ChatSecuritySettings } from "@/lib/types";

export const CHAT_SECURITY_SETTINGS_EVENT = "secureapp:chat-security-settings";

export const DEFAULT_CHAT_SECURITY_SETTINGS: ChatSecuritySettings = {
  require_hold_to_reveal: true,
  identity_magnet: true,
  shutter_flicker: true,
  shutter_flicker_fps: 30,
  app_switcher_blackout: true,
  fake_screenshot_warning: true,
  anti_copy_canvas: true,
};

/** Shown to users under active decoy / \"מגן הגנה\" so the conversation looks ordinary (no security chrome). */
export const PLAIN_DECOY_VIEWER_CHAT_SECURITY: ChatSecuritySettings = {
  require_hold_to_reveal: false,
  identity_magnet: false,
  shutter_flicker: false,
  shutter_flicker_fps: 30,
  app_switcher_blackout: false,
  fake_screenshot_warning: false,
  anti_copy_canvas: false,
};

const selectColumns = [
  "require_hold_to_reveal",
  "identity_magnet",
  "shutter_flicker",
  "shutter_flicker_fps",
  "app_switcher_blackout",
  "fake_screenshot_warning",
  "anti_copy_canvas",
].join(", ");

const storageKey = (chatId: string) => `chat-security-settings:${chatId}`;
const listeners = new Set<(chatId: string, settings: ChatSecuritySettings) => void>();
const liveSubscriptions = new Map<
  string,
  {
    channel: RealtimeChannel;
    listeners: Set<(settings: ChatSecuritySettings) => void>;
  }
>();

function normalizeSettings(settings: Partial<ChatSecuritySettings> | null | undefined): ChatSecuritySettings {
  return { ...DEFAULT_CHAT_SECURITY_SETTINGS, ...(settings ?? {}) };
}

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

function emitSettingsChanged(chatId: string, settings: ChatSecuritySettings) {
  listeners.forEach((listener) => listener(chatId, settings));
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(CHAT_SECURITY_SETTINGS_EVENT, {
      detail: { chatId, settings },
    }),
  );
}

function emitSubscribedSettings(chatId: string, settings: ChatSecuritySettings) {
  liveSubscriptions.get(chatId)?.listeners.forEach((listener) => listener(settings));
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

  const settings = normalizeSettings(data as Partial<ChatSecuritySettings>);
  await writeLocalSettings(chatId, settings);
  return settings;
}

export function addChatSecuritySettingsListener(
  listener: (chatId: string, settings: ChatSecuritySettings) => void,
) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function subscribeToChatSecuritySettings(
  chatId: string,
  onSettings: (settings: ChatSecuritySettings) => void,
): { channel: RealtimeChannel; unsubscribe: () => void } {
  const unsubscribeLocal = addChatSecuritySettingsListener((changedChatId, settings) => {
    if (changedChatId === chatId) onSettings(settings);
  });
  const existing = liveSubscriptions.get(chatId);
  if (existing) {
    existing.listeners.add(onSettings);
    return {
      channel: existing.channel,
      unsubscribe: () => {
        unsubscribeLocal();
        existing.listeners.delete(onSettings);
        if (existing.listeners.size === 0) {
          liveSubscriptions.delete(chatId);
          void supabase.removeChannel(existing.channel);
        }
      },
    };
  }

  const subscription = {
    channel: supabase.channel(`chat-security-settings:${chatId}`),
    listeners: new Set<(settings: ChatSecuritySettings) => void>([onSettings]),
  };

  subscription.channel
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "chat_security_settings", filter: `chat_id=eq.${chatId}` },
      (payload) => {
        const next = payload.new as Partial<ChatSecuritySettings> | null;
        if (!next) {
          void fetchChatSecuritySettings(chatId).then(onSettings);
          return;
        }

        const settings = normalizeSettings(next);
        emitSubscribedSettings(chatId, settings);
        void writeLocalSettings(chatId, settings);
      },
    )
    .on("broadcast", { event: "settings" }, ({ payload }) => {
      const next = (payload as { chatId?: string; settings?: Partial<ChatSecuritySettings> } | null)?.settings;
      const changedChatId = (payload as { chatId?: string } | null)?.chatId;
      if (changedChatId !== chatId || !next) return;

      const settings = normalizeSettings(next);
      emitSubscribedSettings(chatId, settings);
      void writeLocalSettings(chatId, settings);
    })
    .subscribe();
  liveSubscriptions.set(chatId, subscription);

  return {
    channel: subscription.channel,
    unsubscribe: () => {
      unsubscribeLocal();
      subscription.listeners.delete(onSettings);
      if (subscription.listeners.size === 0) {
        liveSubscriptions.delete(chatId);
        void supabase.removeChannel(subscription.channel);
      }
    },
  };
}

export async function saveChatSecuritySettings(
  chatId: string,
  settings: ChatSecuritySettings,
  userId: string,
) {
  const result = await supabase
    .from("chat_security_settings")
    .upsert({
      chat_id: chatId,
      ...settings,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    });
  if (result.error) {
    const serverSettings = await fetchChatSecuritySettings(chatId);
    emitSettingsChanged(chatId, serverSettings);
  } else {
    await writeLocalSettings(chatId, settings);
    emitSettingsChanged(chatId, settings);
    void liveSubscriptions.get(chatId)?.channel.send({
      type: "broadcast",
      event: "settings",
      payload: { chatId, settings },
    });
  }
  return result;
}
