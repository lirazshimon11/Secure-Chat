import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { Animated, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

type Point = {
  x: number;
  y: number;
};

type Props = {
  revealHeld: boolean;
  blackout: boolean;
  warningVisible: boolean;
  magnetPoint: Point;
  username: string;
  onRevealChange: (revealed: boolean) => void;
  bottomOffset: number;
};

export function ChatLeakShield({
  revealHeld,
  blackout,
  warningVisible,
  magnetPoint,
  username,
  onRevealChange,
  bottomOffset,
}: Props) {
  const flicker = useRef(new Animated.Value(0)).current;
  const webFlickerRef = useRef<HTMLDivElement | null>(null);
  const revealPointerIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (Platform.OS === "web") return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(flicker, { toValue: 0, duration: 10, useNativeDriver: true }),
        Animated.timing(flicker, { toValue: 1, duration: 5, useNativeDriver: true }),
        Animated.timing(flicker, { toValue: 0, duration: 1, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [flicker]);

  useEffect(() => {
    if (Platform.OS !== "web" || !revealHeld) return;

    const handlePointerDone = (event: PointerEvent) => {
      if (revealPointerIdRef.current === null || event.pointerId === revealPointerIdRef.current) {
        revealPointerIdRef.current = null;
        onRevealChange(false);
      }
    };
    const handleWindowBlur = () => {
      revealPointerIdRef.current = null;
      onRevealChange(false);
    };

    window.addEventListener("pointerup", handlePointerDone, true);
    window.addEventListener("pointercancel", handlePointerDone, true);
    window.addEventListener("blur", handleWindowBlur, true);

    return () => {
      window.removeEventListener("pointerup", handlePointerDone, true);
      window.removeEventListener("pointercancel", handlePointerDone, true);
      window.removeEventListener("blur", handleWindowBlur, true);
    };
  }, [onRevealChange, revealHeld]);

  const startReveal = useCallback((event: any) => {
    revealPointerIdRef.current = event?.nativeEvent?.pointerId ?? null;
    onRevealChange(true);
  }, [onRevealChange]);

  const endReveal = useCallback(() => {
    revealPointerIdRef.current = null;
    onRevealChange(false);
  }, [onRevealChange]);

  const watermarkText = useMemo(() => `הודלף ע"י ${username || "משתמש"}`, [username]);

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFillObject}>
      {revealHeld && Platform.OS === "web" ? (
        React.createElement("div", {
          "aria-hidden": true,
          ref: webFlickerRef,
          style: webFlickerStyle,
        })
      ) : revealHeld ? (
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFillObject,
            styles.nativeFlicker,
            { opacity: flicker.interpolate({ inputRange: [0, 1], outputRange: [0, 0.9] }) },
          ]}
        />
      ) : null}

      {blackout && <View pointerEvents="none" style={styles.blackout} />}

      {revealHeld && (
        <View
          pointerEvents="none"
          style={[
            styles.identityMagnet,
            {
              right: 6,
              bottom: bottomOffset + 66,
            },
          ]}
        >
          <Text style={styles.identityMagnetText}>{watermarkText}</Text>
        </View>
      )}

      <Pressable
        accessibilityLabel="החזק כדי לחשוף את הצ'אט"
        delayLongPress={0}
        onPressIn={startReveal}
        onPressOut={endReveal}
        onResponderTerminate={endReveal}
        onTouchCancel={endReveal}
        style={({ pressed }) => [
          styles.revealButton,
          { bottom: bottomOffset + 14 },
          pressed && styles.revealButtonPressed,
        ]}
      >
        <MaterialCommunityIcons name={revealHeld ? "eye" : "eye-lock-outline"} size={22} color="#fff" />
      </Pressable>

      <Pressable
        accessibilityLabel="החזק כדי לחשוף את הצ'אט"
        delayLongPress={0}
        onPressIn={startReveal}
        onPressOut={endReveal}
        onResponderTerminate={endReveal}
        onTouchCancel={endReveal}
        style={({ pressed }) => [
          styles.revealButton,
          styles.revealButtonLeft,
          { bottom: bottomOffset + 14 },
          pressed && styles.revealButtonPressed,
        ]}
      >
        <MaterialCommunityIcons name={revealHeld ? "eye" : "eye-lock-outline"} size={22} color="#fff" />
      </Pressable>

      {warningVisible && (
        <View pointerEvents="none" style={styles.warningOverlay}>
          <MaterialCommunityIcons name="alert-octagon" size={54} color="#fff" />
          <Text style={styles.warningText}>
            זוהה ניסיון צילום מסך. התראה נשלחה לשאר חברי הקבוצה וחשבונך נכנס למעקב.
          </Text>
        </View>
      )}
    </View>
  );
}

export const chatLeakShieldStyles = StyleSheet.create({
  protectedThreadBlurred: Platform.OS === "web" ? ({ filter: "blur(20px)" } as any) : { opacity: 0.18 },
  protectedThreadRevealed: Platform.OS === "web" ? ({ filter: "blur(0px)" } as any) : { opacity: 1 },
});

const styles = StyleSheet.create({
  nativeFlicker: {
    backgroundColor: "#000",
    zIndex: 8,
  },
  blackout: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.08)",
    zIndex: 20,
    ...(Platform.OS === "web"
      ? ({
          backdropFilter: "blur(28px)",
          WebkitBackdropFilter: "blur(28px)",
        } as any)
      : null),
  },
  identityMagnet: {
    position: "absolute",
    backgroundColor: "#ffffff",
    borderColor: "rgba(255,0,0,0.8)",
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    zIndex: 30,
    minWidth: 180,
  },
  identityMagnetText: {
    color: "#ff0000",
    fontWeight: "900",
    fontSize: 13,
    textAlign: "center",
  },
  revealButton: {
    position: "absolute",
    right: 14,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(220,0,0,0.86)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 40,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 12,
  },
  revealButtonLeft: {
    left: 14,
    right: undefined,
  },
  revealButtonPressed: {
    backgroundColor: "rgba(0,168,132,0.95)",
    transform: [{ scale: 0.96 }],
  },
  warningOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(185,0,0,0.94)",
    zIndex: 60,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 34,
    gap: 18,
  },
  warningText: {
    color: "#fff",
    fontSize: 21,
    lineHeight: 31,
    fontWeight: "900",
    textAlign: "center",
    writingDirection: "rtl",
  },
});

const webFlickerStyle = {
  position: "absolute",
  inset: 0,
  backgroundColor: "transparent",
  backgroundImage:
    "radial-gradient(circle at 20% 30%, rgba(0,0,0,0.62) 0 1px, transparent 1px 4px), radial-gradient(circle at 70% 60%, rgba(0,0,0,0.48) 0 1px, transparent 1px 5px), repeating-linear-gradient(0deg, rgba(0,0,0,0.36) 0 1px, transparent 1px 3px)",
  backgroundSize: "11px 11px, 17px 17px, 100% 4px",
  opacity: 0.58,
  pointerEvents: "none",
  animation:
    "secureapp-shutter-flicker 33ms steps(1, end) infinite, secureapp-shutter-noise 50ms steps(1, end) infinite",
  willChange: "opacity, transform, background-position",
  zIndex: 8,
} as const;
