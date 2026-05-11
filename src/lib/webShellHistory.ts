import { Platform } from "react-native";

const SA_SHELL_KEY = "secureAppShell";

export type SaShellState = {
  c: string;
  s?: boolean;
};

function historyBase(): Record<string, unknown> {
  return { ...((typeof window !== "undefined" ? (window.history.state as Record<string, unknown> | null) : null) ?? {}) };
}

/** Current shell snapshot from the top history entry (web only). */
export function readSaShell(): SaShellState | null {
  if (typeof window === "undefined") return null;
  const v = (window.history.state as Record<string, unknown> | null)?.[SA_SHELL_KEY];
  if (!v || typeof v !== "object") return null;
  const c = (v as { c?: unknown }).c;
  if (typeof c !== "string" || !c.length) return null;
  return { c, s: !!(v as { s?: unknown }).s };
}

function withShell(shell: SaShellState | null): Record<string, unknown> {
  const base = historyBase();
  if (shell === null) {
    delete base[SA_SHELL_KEY];
  } else {
    base[SA_SHELL_KEY] = shell;
  }
  return base;
}

export function pushShell(shell: SaShellState) {
  if (Platform.OS !== "web" || typeof window === "undefined") return;
  window.history.pushState(withShell(shell), "", "");
}

export function replaceShell(shell: SaShellState | null) {
  if (Platform.OS !== "web" || typeof window === "undefined") return;
  window.history.replaceState(withShell(shell), "", "");
}
