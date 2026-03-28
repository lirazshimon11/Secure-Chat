import { Platform } from "react-native";

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
