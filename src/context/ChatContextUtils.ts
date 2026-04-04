import { ChatLocalPreferences, ChatMuteSetting, MuteDurationOption } from "@/lib/types";

export function getUtcTime(timestamp: string): number {
  if (timestamp.endsWith("Z")) return new Date(timestamp).getTime();
  const timePart = timestamp.includes("T") ? timestamp.split("T")[1] : "";
  if (timePart.includes("+") || timePart.includes("-")) {
    return new Date(timestamp).getTime();
  }
  return new Date(timestamp + "Z").getTime();
}

export function buildMuteSetting(duration: MuteDurationOption): ChatMuteSetting {
  if (duration === "always") {
    return { mute_until: null, mute_always: true };
  }
  const now = Date.now();
  const offset = duration === "8_hours" ? 8 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
  return {
    mute_until: new Date(now + offset).toISOString(),
    mute_always: false,
  };
}

export function getDefaultChatPreferences(): ChatLocalPreferences {
  return {
    archived: false,
    pinned_at: null,
    locked: false,
    cleared_at: null,
    deleted_from_home_at: null,
  };
}

export function normalizeChatPreferences(value: Partial<ChatLocalPreferences> | null | undefined): ChatLocalPreferences {
  return {
    archived: Boolean(value?.archived),
    pinned_at: typeof value?.pinned_at === "string" ? value.pinned_at : null,
    locked: Boolean(value?.locked),
    cleared_at: typeof value?.cleared_at === "string" ? value.cleared_at : null,
    deleted_from_home_at: typeof value?.deleted_from_home_at === "string" ? value.deleted_from_home_at : null,
  };
}
