import "react-native-gesture-handler";
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
