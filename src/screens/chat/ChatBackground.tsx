import React from "react";
import { ImageBackground, StyleSheet, View } from "react-native";

const lightBg = require("../../../public/images/default_white_background.png");
const darkBg = require("../../../public/images/default_dark_background.png");

type ChatBackgroundProps = {
  colorScheme: "light" | "dark" | null | undefined;
};

export const ChatBackground = React.memo(({ colorScheme }: ChatBackgroundProps) => {
  const source = colorScheme === "dark" ? darkBg : lightBg;
  return (
    <View style={[StyleSheet.absoluteFillObject, { zIndex: -1, overflow: 'hidden' }]} pointerEvents="none">
      <ImageBackground
        fadeDuration={0}
        source={source}
        style={{ width: "100%", height: "100%", transform: [{ scale: 1.8 }] }}
        resizeMode="repeat"
      />
    </View>
  );
});
