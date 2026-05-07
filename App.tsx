import "react-native-gesture-handler";
import { Platform, Text as RNText, TextInput as RNTextInput } from "react-native";
import { SYSTEM_FONT_FAMILY } from "@/lib/webStyles";

if (Platform.OS === "web") {
  const defaultFontStyle = { fontFamily: SYSTEM_FONT_FAMILY };
  (RNText as any).defaultProps = (RNText as any).defaultProps || {};
  (RNText as any).defaultProps.style = [(RNText as any).defaultProps.style, defaultFontStyle];
  (RNTextInput as any).defaultProps = (RNTextInput as any).defaultProps || {};
  (RNTextInput as any).defaultProps.style = [(RNTextInput as any).defaultProps.style, defaultFontStyle];
}

// Web only: constrain layout to phone width
if (Platform.OS === "web" && typeof document !== "undefined") {
  const style = document.createElement("style");
  style.textContent = `
    * {
      font-family: ${SYSTEM_FONT_FAMILY};
      -webkit-touch-callout: none !important;
      -webkit-tap-highlight-color: transparent !important;
      -webkit-user-drag: none !important;
      -webkit-user-select: none !important;
      user-select: none !important;
    }
    canvas {
      pointer-events: none !important;
      -webkit-user-select: none !important;
      user-select: none !important;
    }
    @keyframes secureapp-shutter-flicker {
      0% { opacity: 0.10; transform: translate3d(0, 0, 0); }
      20% { opacity: 0.34; transform: translate3d(0, -1px, 0); }
      40% { opacity: 0.16; transform: translate3d(1px, 0, 0); }
      60% { opacity: 0.42; transform: translate3d(-1px, 1px, 0); }
      80% { opacity: 0.22; transform: translate3d(0, 1px, 0); }
      100% { opacity: 0.38; transform: translate3d(1px, -1px, 0); }
    }
    @keyframes secureapp-shutter-noise {
      0% { background-position: 0 0, 0 0, 0 0; }
      25% { background-position: 9px -7px, -5px 4px, 0 3px; }
      50% { background-position: -8px 6px, 4px -6px, 0 7px; }
      75% { background-position: 5px 9px, 8px 2px, 0 11px; }
      100% { background-position: -6px -4px, -9px 8px, 0 13px; }
    }
    html, body {
      background: #0a0a0a !important;
      font-family: ${SYSTEM_FONT_FAMILY};
      height: 100%;
      margin: 0;
      padding: 0;
      overscroll-behavior: none;
      scrollbar-width: none !important;
      -ms-overflow-style: none !important;
    }
    html::-webkit-scrollbar,
    body::-webkit-scrollbar,
    #root::-webkit-scrollbar,
    *::-webkit-scrollbar {
      width: 0 !important;
      height: 0 !important;
      display: none !important;
      background: transparent !important;
    }
    input, textarea, [contenteditable="true"], [contenteditable="true"] * {
      font-family: ${SYSTEM_FONT_FAMILY};
      -webkit-user-select: text !important;
      user-select: text !important;
      -webkit-touch-callout: default !important;
    }
    #root {
      font-family: ${SYSTEM_FONT_FAMILY};
      max-width: 430px;
      height: 100%;
      margin: 0 auto;
      overflow: hidden;
      position: relative;
      box-shadow: 0 0 60px rgba(0,0,0,0.8);
      scrollbar-width: none !important;
      -ms-overflow-style: none !important;
    }
  `;
  document.head.appendChild(style);

  const isEditableTarget = (target: EventTarget | null) => {
    if (!(target instanceof HTMLElement)) return false;
    return !!target.closest('input, textarea, [contenteditable="true"]');
  };

  document.addEventListener("selectstart", (event) => {
    if (!isEditableTarget(event.target)) event.preventDefault();
  });

  document.addEventListener("contextmenu", (event) => {
    if (!isEditableTarget(event.target)) event.preventDefault();
  });

  document.addEventListener("dragstart", (event) => {
    if (!isEditableTarget(event.target)) event.preventDefault();
  });

  document.addEventListener("copy", (event) => {
    if (!isEditableTarget(event.target)) event.preventDefault();
  });

  document.addEventListener("cut", (event) => {
    if (!isEditableTarget(event.target)) event.preventDefault();
  });
}

import { I18nManager, useColorScheme } from "react-native";

I18nManager.allowRTL(true);
I18nManager.forceRTL(true);
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/context/AuthContext";
import { ChatProvider } from "@/context/ChatContext";
import { ScreenshotProvider } from "@/context/ScreenshotContext";
import { AppShell } from "@/AppShell";
import { queryClient } from "@/lib/queryClient";

export default function App() {
  const scheme = useColorScheme();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <ChatProvider>
              <ScreenshotProvider>
                <StatusBar style={scheme === "dark" ? "light" : "dark"} />
                <AppShell />
              </ScreenshotProvider>
            </ChatProvider>
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
