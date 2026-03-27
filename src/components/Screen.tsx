import { PropsWithChildren } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { theme } from "@/lib/theme";

type Props = PropsWithChildren<{
  scroll?: boolean;
}>;

export function Screen({ children, scroll }: Props) {
  const content = scroll ? (
    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      {children}
    </ScrollView>
  ) : (
    <View style={styles.content}>{children}</View>
  );

  return (
    <View style={styles.shell}>
      <SafeAreaView edges={["top", "left", "right", "bottom"]} style={styles.safeArea}>
        <KeyboardAvoidingView behavior={Platform.select({ ios: "padding", android: undefined })} style={styles.flex}>
          {content}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: Platform.OS === "web" ? theme.colors.appBackground : theme.colors.background,
    alignItems: Platform.OS === "web" ? "center" : undefined,
    justifyContent: Platform.OS === "web" ? "center" : undefined,
    paddingVertical: Platform.OS === "web" ? 20 : 0,
  },
  safeArea: {
    flex: 1,
    width: "100%",
    maxWidth: Platform.OS === "web" ? 430 : undefined,
    backgroundColor: theme.colors.background,
    overflow: Platform.OS === "web" ? "hidden" : undefined,
    borderRadius: Platform.OS === "web" ? 28 : 0,
    shadowColor: "#000000",
    shadowOpacity: Platform.OS === "web" ? 0.22 : 0,
    shadowRadius: Platform.OS === "web" ? 28 : 0,
    shadowOffset: Platform.OS === "web" ? { width: 0, height: 14 } : { width: 0, height: 0 },
  },
  flex: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    backgroundColor: theme.colors.background,
  },
});
