import "react-native-gesture-handler";
import { Platform } from "react-native";

// Web only: constrain layout to phone width
if (Platform.OS === "web" && typeof document !== "undefined") {
  const style = document.createElement("style");
  style.textContent = `
    * {
      -webkit-touch-callout: none !important;
      -webkit-tap-highlight-color: transparent !important;
      -webkit-user-drag: none !important;
      -webkit-user-select: none !important;
      user-select: none !important;
    }
    html, body {
      background: #0a0a0a !important;
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
      -webkit-user-select: text !important;
      user-select: text !important;
      -webkit-touch-callout: default !important;
    }
    #root {
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
