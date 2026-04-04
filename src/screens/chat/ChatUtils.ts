import { ChatMuteSetting } from "@/lib/types";

export function isChatMuted(setting?: ChatMuteSetting) {
  if (!setting) {
    return false;
  }

  if (setting.mute_always) {
    return true;
  }

  return Boolean(setting.mute_until && new Date(setting.mute_until).getTime() > Date.now());
}

export function describeMute(setting?: ChatMuteSetting) {
  if (!isChatMuted(setting)) {
    return "Off";
  }

  if (setting?.mute_always) {
    return "תמיד";
  }

  return setting?.mute_until ? `עד ${new Date(setting.mute_until).toLocaleString("he-IL")}` : "מושתק";
}

export function formatChatTime(date: Date) {
  return date.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
}

export function formatRelativeDate(date: Date) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterday = today - 86400000;
  const dTime = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

  if (dTime === today) return "היום";
  if (dTime === yesterday) return "אתמול";
  
  if (now.getTime() - date.getTime() < 7 * 86400000) {
    return date.toLocaleDateString("he-IL", { weekday: "long" });
  }

  return date.toLocaleDateString("he-IL", { day: "numeric", month: "long", year: "numeric" });
}
