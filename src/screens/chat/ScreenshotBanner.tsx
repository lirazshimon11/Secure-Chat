import React from "react";
import { Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAppTheme } from "@/lib/theme";

type ScreenshotBannerProps = {
  type: "none" | "approved";
  secondsLeft: number;
};

export function ScreenshotBanner({ type, secondsLeft }: ScreenshotBannerProps) {
  const theme = useAppTheme();
  if (type !== "approved") return null;

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const countdown = `${mins}:${secs.toString().padStart(2, "0")}`;

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: theme.colors.accentStrong,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
        paddingHorizontal: 14,
        paddingVertical: 9,
        gap: 10,
      }}
    >
      <MaterialCommunityIcons name="camera-outline" size={17} color={theme.colors.textOnAccent} />
      <Text
        style={{
          flex: 1,
          color: theme.colors.textOnAccent,
          fontSize: 13,
          fontWeight: "600",
          textAlign: "right",
        }}
      >
        צילום מסך מורשה · עוד {countdown}
      </Text>
    </View>
  );
}
