import "react-native-gesture-handler";
import { Platform } from "react-native";

// Web only: constrain layout to phone width
if (Platform.OS === "web" && typeof document !== "undefined") {
  const style = document.createElement("style");
  style.textContent = `
    html, body {
      background: #0a0a0a !important;
      height: 100%;
      margin: 0;
      padding: 0;
    }
    #root {
      max-width: 430px;
      height: 100%;
      margin: 0 auto;
      overflow: hidden;
      position: relative;
      box-shadow: 0 0 60px rgba(0,0,0,0.8);
    }
  `;
  document.head.appendChild(style);
}

import { I18nManager, useColorScheme } from "react-native";

I18nManager.allowRTL(true);
I18nManager.forceRTL(true);
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { AuthProvider } from "@/context/AuthContext";
import { ChatProvider } from "@/context/ChatContext";
import { ScreenshotProvider } from "@/context/ScreenshotContext";
import { AppShell } from "@/AppShell";

export default function App() {
  const scheme = useColorScheme();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <ChatProvider>
            <ScreenshotProvider>
              <StatusBar style={scheme === "dark" ? "light" : "dark"} />
              <AppShell />
            </ScreenshotProvider>
          </ChatProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
