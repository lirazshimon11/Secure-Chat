import { Platform } from "react-native";

export const SYSTEM_FONT_FAMILY =
  'system-ui, "Segoe UI", -apple-system, BlinkMacSystemFont, Arial, sans-serif';

export const webSystemFont =
  Platform.OS === "web"
    ?
        ({
          fontFamily: SYSTEM_FONT_FAMILY,
        } as any)
    : undefined;

export const webNoOutline =
  Platform.OS === "web"
    ?
        ({
          outlineWidth: 0,
          outlineColor: "transparent",
          outlineStyle: "none",
          boxShadow: "none",
        } as any)
    : undefined;

export const webEmbeddedInputReset =
  Platform.OS === "web"
    ?
        ({
          outlineWidth: 0,
          outlineColor: "transparent",
          outlineStyle: "none",
          borderWidth: 0,
          borderColor: "transparent",
          boxShadow: "none",
          backgroundColor: "transparent",
        } as any)
    : undefined;

export const webDefaultCursor = Platform.OS === "web" ? ({ cursor: "default" } as any) : undefined;
