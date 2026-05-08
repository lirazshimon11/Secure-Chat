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
  username,
  onRevealChange,
  bottomOffset,
}: Props) {
  const flicker = useRef(new Animated.Value(0)).current;
  const webFlickerRef = useRef<HTMLDivElement | null>(null);
  const leftButtonRef = useRef<HTMLButtonElement | null>(null);
  const rightButtonRef = useRef<HTMLButtonElement | null>(null);
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

    const handlePointerUp = (event: PointerEvent) => {
      if (revealPointerIdRef.current === null || event.pointerId === revealPointerIdRef.current) {
        revealPointerIdRef.current = null;
        onRevealChange(false);
      }
    };
    const handleTouchEnd = (event: TouchEvent) => {
      if (event.touches.length === 0) {
        revealPointerIdRef.current = null;
        onRevealChange(false);
      }
    };

    window.addEventListener("pointerup", handlePointerUp, true);
    window.addEventListener("touchend", handleTouchEnd, true);
    return () => {
      window.removeEventListener("pointerup", handlePointerUp, true);
      window.removeEventListener("touchend", handleTouchEnd, true);
    };
  }, [onRevealChange, revealHeld]);

  useEffect(() => {
    if (Platform.OS !== "web") return;

    const buttons = [leftButtonRef.current, rightButtonRef.current].filter(Boolean) as HTMLButtonElement[];
    const cleanups: Array<() => void> = [];

    buttons.forEach((button) => {
      const stopNative = (event: Event) => {
        event.stopPropagation();
        (event as any).stopImmediatePropagation?.();
      };

      const start = (event: PointerEvent) => {
        stopNative(event);
        revealPointerIdRef.current = event.pointerId;
        onRevealChange(true);
      };

      const end = (event: PointerEvent) => {
        stopNative(event);
        revealPointerIdRef.current = null;
        onRevealChange(false);
      };

      const cancel = (event: Event) => {
        event.preventDefault();
        stopNative(event);
      };

      button.addEventListener("pointerdown", start, { capture: true });
      button.addEventListener("pointerup", end, { capture: true });
      button.addEventListener("pointercancel", cancel, { capture: true });
      button.addEventListener("touchstart", stopNative, { capture: true, passive: true });
      button.addEventListener("touchmove", stopNative, { capture: true, passive: true });
      button.addEventListener("touchend", stopNative, { capture: true, passive: true });
      button.addEventListener("contextmenu", cancel, { capture: true });
      button.addEventListener("dragstart", cancel, { capture: true });

      cleanups.push(() => {
        button.removeEventListener("pointerdown", start, { capture: true } as any);
        button.removeEventListener("pointerup", end, { capture: true } as any);
        button.removeEventListener("pointercancel", cancel, { capture: true } as any);
        button.removeEventListener("touchstart", stopNative, { capture: true } as any);
        button.removeEventListener("touchmove", stopNative, { capture: true } as any);
        button.removeEventListener("touchend", stopNative, { capture: true } as any);
        button.removeEventListener("contextmenu", cancel, { capture: true } as any);
        button.removeEventListener("dragstart", cancel, { capture: true } as any);
      });
    });

    return () => cleanups.forEach((cleanup) => cleanup());
  }, [onRevealChange]);

  const startReveal = useCallback((event: any) => {
    revealPointerIdRef.current = event?.nativeEvent?.pointerId ?? null;
    onRevealChange(true);
  }, [onRevealChange]);

  const endReveal = useCallback(() => {
    revealPointerIdRef.current = null;
    onRevealChange(false);
  }, [onRevealChange]);

  const watermarkText = useMemo(() => `הודלף ע"י ${username || "משתמש"}`, [username]);

  const renderRevealButton = (side: "left" | "right") => {
    if (Platform.OS === "web") {
      return React.createElement(
        "button",
        {
          "aria-label": "החזק כדי לחשוף את הצ'אט",
          type: "button",
          tabIndex: -1,
          ref: (node: HTMLButtonElement | null) => {
            if (side === "left") leftButtonRef.current = node;
            else rightButtonRef.current = node;
          },
          style: {
            ...webRevealButtonStyle,
            ...(side === "left" ? { left: 14 } : { right: 14 }),
            bottom: bottomOffset + 14,
            backgroundColor: revealHeld ? "rgba(0,168,132,0.95)" : "rgba(220,0,0,0.86)",
          },
        },
        <MaterialCommunityIcons name={revealHeld ? "eye" : "eye-lock-outline"} size={22} color="#fff" />,
      );
    }

    return (
      <Pressable
        accessibilityLabel="החזק כדי לחשוף את הצ'אט"
        delayLongPress={0}
        onPressIn={startReveal}
        onPressOut={endReveal}
        onResponderTerminate={endReveal}
        style={({ pressed }) => [
          styles.revealButton,
          side === "left" && styles.revealButtonLeft,
          { bottom: bottomOffset + 14 },
          pressed && styles.revealButtonPressed,
        ]}
      >
        <MaterialCommunityIcons name={revealHeld ? "eye" : "eye-lock-outline"} size={22} color="#fff" />
      </Pressable>
    );
  };

  return (
    <View
      pointerEvents="box-none"
      style={[StyleSheet.absoluteFillObject, Platform.OS === "web" ? webShieldRootStyle : null]}
    >
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

      {renderRevealButton("right")}
      {renderRevealButton("left")}

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

const webRevealButtonStyle = {
  position: "absolute",
  width: 44,
  height: 44,
  borderRadius: 22,
  borderWidth: 0,
  borderStyle: "solid",
  alignItems: "center",
  justifyContent: "center",
  display: "flex",
  zIndex: 40,
  pointerEvents: "auto",
  boxShadow: "0 4px 8px rgba(0,0,0,0.35)",
  cursor: "default",
  touchAction: "none",
  userSelect: "none",
  WebkitUserSelect: "none",
  WebkitTouchCallout: "none",
  outline: "none",
  padding: 0,
} as const;

const webShieldRootStyle = {
  pointerEvents: "none",
} as const;

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
