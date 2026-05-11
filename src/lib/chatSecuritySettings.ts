import AsyncStorage from "@react-native-async-storage/async-storage";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { ChatSecuritySettings } from "@/lib/types";

export const CHAT_SECURITY_SETTINGS_EVENT = "secureapp:chat-security-settings";
export const CHAT_PREVIEW_SYSTEM_PREFIX = "[SYSTEM_CHAT_PREVIEW_ENABLED]:";

export const DEFAULT_CHAT_SECURITY_SETTINGS: ChatSecuritySettings = {
  require_hold_to_reveal: true,
  identity_magnet: true,
  shutter_flicker: true,
  shutter_flicker_fps: 30,
  app_switcher_blackout: true,
  fake_screenshot_warning: true,
  anti_copy_canvas: true,
  chat_preview_enabled: true,
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
  chat_preview_enabled: true,
};

const selectColumnNames = [
  "require_hold_to_reveal",
  "identity_magnet",
  "shutter_flicker",
  "shutter_flicker_fps",
  "app_switcher_blackout",
  "fake_screenshot_warning",
  "anti_copy_canvas",
  "chat_preview_enabled",
] as const;

const selectColumns = selectColumnNames.join(", ");
const selectColumnsWithChatId = ["chat_id", ...selectColumnNames].join(", ");
const legacySelectColumnNames = selectColumnNames.filter((name) => name !== "chat_preview_enabled");
const legacySelectColumns = legacySelectColumnNames.join(", ");
const legacySelectColumnsWithChatId = ["chat_id", ...legacySelectColumnNames].join(", ");

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

function isMissingChatPreviewColumnError(error: { code?: string; message?: string } | null | undefined) {
  return Boolean(
    error &&
      (error.code === "42703" ||
        error.code === "PGRST204" ||
        /chat_preview_enabled/i.test(error.message ?? "")),
  );
}

export function createChatPreviewSystemMessage(enabled: boolean) {
  return `${CHAT_PREVIEW_SYSTEM_PREFIX}${enabled ? "true" : "false"}`;
}

export function parseChatPreviewSystemMessage(body: string | null | undefined): boolean | null {
  if (!body?.startsWith(CHAT_PREVIEW_SYSTEM_PREFIX)) return null;
  const value = body.substring(CHAT_PREVIEW_SYSTEM_PREFIX.length).trim().toLowerCase();
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

export function formatChatPreviewSystemMessage(body: string | null | undefined) {
  const enabled = parseChatPreviewSystemMessage(body);
  if (enabled === null) return null;
  return `תצוגה מקדימה ברשימת הצ'אטים - ${enabled ? "הופעלה מחדש" : "הופסקה"}`;
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

async function fetchLatestChatPreviewSettings(chatIds: string[]) {
  const uniqueChatIds = [...new Set(chatIds)].filter(Boolean);
  if (!uniqueChatIds.length) return {};

  const { data, error } = await supabase
    .from("messages")
    .select("chat_id, body_ciphertext, created_at")
    .in("chat_id", uniqueChatIds)
    .eq("message_kind", "system")
    .like("body_ciphertext", `${CHAT_PREVIEW_SYSTEM_PREFIX}%`)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error || !data) return {};

  const next: Record<string, boolean> = {};
  for (const row of data as Array<{ chat_id: string; body_ciphertext: string }>) {
    if (next[row.chat_id] !== undefined) continue;
    const parsed = parseChatPreviewSystemMessage(row.body_ciphertext);
    if (parsed !== null) next[row.chat_id] = parsed;
  }
  return next;
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

  if (isMissingChatPreviewColumnError(error)) {
    const { data: legacyData, error: legacyError } = await supabase
      .from("chat_security_settings")
      .select(legacySelectColumns)
      .eq("chat_id", chatId)
      .maybeSingle();
    const fallback = legacyError || !legacyData
      ? (await readLocalSettings(chatId)) ?? DEFAULT_CHAT_SECURITY_SETTINGS
      : normalizeSettings(legacyData as Partial<ChatSecuritySettings>);
    const previewSettings = await fetchLatestChatPreviewSettings([chatId]);
    const settings = { ...fallback, chat_preview_enabled: previewSettings[chatId] ?? fallback.chat_preview_enabled };
    await writeLocalSettings(chatId, settings);
    return settings;
  }

  if (error || !data) {
    return (await readLocalSettings(chatId)) ?? DEFAULT_CHAT_SECURITY_SETTINGS;
  }

  const settings = normalizeSettings(data as Partial<ChatSecuritySettings>);
  await writeLocalSettings(chatId, settings);
  return settings;
}

export async function fetchChatSecuritySettingsMap(chatIds: string[]): Promise<Record<string, ChatSecuritySettings>> {
  const uniqueChatIds = [...new Set(chatIds)].filter(Boolean);
  if (!uniqueChatIds.length) return {};

  const localEntries = await Promise.all(
    uniqueChatIds.map(async (chatId) => [chatId, await readLocalSettings(chatId)] as const),
  );
  const localSettings = Object.fromEntries(
    localEntries
      .filter((entry): entry is readonly [string, ChatSecuritySettings] => Boolean(entry[1]))
      .map(([chatId, settings]) => [chatId, settings]),
  ) as Record<string, ChatSecuritySettings>;

  const { data, error } = await supabase
    .from("chat_security_settings")
    .select(selectColumnsWithChatId)
    .in("chat_id", uniqueChatIds);

  if (isMissingChatPreviewColumnError(error)) {
    const { data: legacyData, error: legacyError } = await supabase
      .from("chat_security_settings")
      .select(legacySelectColumnsWithChatId)
      .in("chat_id", uniqueChatIds);
    if (legacyError || !legacyData) {
      return localSettings;
    }

    const latestPreviewSettings = await fetchLatestChatPreviewSettings(uniqueChatIds);
    const next = Object.fromEntries(
      uniqueChatIds.map((chatId) => [chatId, localSettings[chatId] ?? DEFAULT_CHAT_SECURITY_SETTINGS]),
    ) as Record<string, ChatSecuritySettings>;
    await Promise.all(
      (legacyData as unknown as Array<Partial<ChatSecuritySettings> & { chat_id: string }>).map(async (row) => {
        const settings = normalizeSettings({
          ...row,
          chat_preview_enabled: latestPreviewSettings[row.chat_id] ?? row.chat_preview_enabled,
        });
        next[row.chat_id] = settings;
        await writeLocalSettings(row.chat_id, settings);
      }),
    );
    return next;
  }

  if (error || !data) {
    return localSettings;
  }

  const next = Object.fromEntries(
    uniqueChatIds.map((chatId) => [chatId, localSettings[chatId] ?? DEFAULT_CHAT_SECURITY_SETTINGS]),
  ) as Record<string, ChatSecuritySettings>;
  await Promise.all(
    (data as unknown as Array<Partial<ChatSecuritySettings> & { chat_id: string }>).map(async (row) => {
      const settings = normalizeSettings(row);
      next[row.chat_id] = settings;
      await writeLocalSettings(row.chat_id, settings);
    }),
  );
  return next;
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

        void (async () => {
          const previous = Object.prototype.hasOwnProperty.call(next, "chat_preview_enabled")
            ? null
            : await readLocalSettings(chatId);
          const settings = normalizeSettings({
            chat_preview_enabled: previous?.chat_preview_enabled,
            ...next,
          });
          emitSubscribedSettings(chatId, settings);
          void writeLocalSettings(chatId, settings);
        })();
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
  let result = await supabase
    .from("chat_security_settings")
    .upsert({
      chat_id: chatId,
      ...settings,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    });
  if (isMissingChatPreviewColumnError(result.error)) {
    const { chat_preview_enabled: _chatPreviewEnabled, ...legacySettings } = settings;
    result = await supabase
      .from("chat_security_settings")
      .upsert({
        chat_id: chatId,
        ...legacySettings,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      });
  }
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
