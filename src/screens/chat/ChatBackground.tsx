import React from "react";
import { ImageBackground, StyleSheet, View } from "react-native";

const lightBg = require("../../../public/images/default_white_background.png");
const darkBg = require("../../../public/images/default_dark_background.png");

export function preloadChatBackgrounds() {
  // The hidden ImageBackgrounds below warm local bundled assets without relying on
  // platform-specific Image.prefetch behavior for Metro asset IDs.
}

export function ChatBackgroundPreloader() {
  return (
    <View pointerEvents="none" style={styles.preloader}>
      <ImageBackground fadeDuration={0} source={lightBg} style={styles.preloadImage} resizeMode="repeat" />
      <ImageBackground fadeDuration={0} source={darkBg} style={styles.preloadImage} resizeMode="repeat" />
    </View>
  );
}

type ChatBackgroundProps = {
  colorScheme: "light" | "dark" | null | undefined;
};

export const ChatBackground = React.memo(({ colorScheme }: ChatBackgroundProps) => {
  const source = colorScheme === "dark" ? darkBg : lightBg;
  return (
    <View style={[StyleSheet.absoluteFillObject, { zIndex: -1, overflow: "hidden" }]} pointerEvents="none">
      <ImageBackground
        fadeDuration={0}
        source={source}
        style={styles.backgroundImage}
        resizeMode="repeat"
      />
    </View>
  );
});

const styles = StyleSheet.create({
  backgroundImage: {
    width: "100%",
    height: "100%",
    transform: [{ scale: 1.8 }],
  },
  preloader: {
    position: "absolute",
    width: 2,
    height: 2,
    opacity: 0,
    overflow: "hidden",
    left: -10,
    top: -10,
  },
  preloadImage: {
    width: 2,
    height: 2,
  },
});
