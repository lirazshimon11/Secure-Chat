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

export const USER_COLORS = ["#34B7F1", "#53D669", "#FFBC2E", "#FF5B5B", "#A529E7", "#E91E63", "#F28C28", "#8E44AD"];

export function getUserColor(nameOrId: string) {
  if (!nameOrId) return "#00A884";
  let hash = 0;
  for (let i = 0; i < nameOrId.length; i++) {
    hash = nameOrId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return USER_COLORS[Math.abs(hash) % USER_COLORS.length];
}

export function getMessagePreview(body: string | null) {
  if (!body) return "";
  
  if (body.startsWith("[POLL]:")) {
    try {
      const data = JSON.parse(body.substring(7));
      return data.question || "סקר";
    } catch {
      return "סקר";
    }
  }

  if (body.startsWith("[SCREENSHOT_REQUEST]:")) {
    return "בקשת אישור לצילום מסך \u{1F4F8}";
  }

  if (body.startsWith("[SYSTEM_")) {
    // Basic formatting for system messages in preview if needed
    return body.split("]:")[0].replace("[SYSTEM_", "").replace(/_/g, " ").toLowerCase();
  }

  return body;
}
