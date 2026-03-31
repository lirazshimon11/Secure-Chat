import { useColorScheme } from "react-native";

export const themeTokens = {
  radius: {
    sm: 8,
    md: 12,
    lg: 18,
    xl: 24,
    pill: 999,
  },
  spacing: {
    xs: 6,
    sm: 10,
    md: 16,
    lg: 24,
    xl: 32,
  },
};

const lightColors = {
  appBackground: "#dfe5e7",
  background: "#f7f8fa",
  surface: "#ffffff",
  surfaceAlt: "#f0f2f5",
  surfaceMuted: "#e9edef",
  text: "#111b21",
  textMuted: "#667781",
  textOnAccent: "#ffffff",
  border: "#d1d7db",
  separator: "#e9edef",
  accent: "#008069",
  accentStrong: "#00a884",
  accentSoft: "#d9fdd3",
  header: "#ffffff",
  headerText: "#000000",
  headerSubtitle: "#667781",
  headerIcon: "#111b21",
  danger: "#b42318",
  warning: "#a15c00",
  mine: "#d9fdd3",
  theirs: "#ffffff",
  composer: "#ffffff",
  chatBackdrop: "#efeae2",
  overlay: "rgba(17,27,33,0.12)",
  shadow: "rgba(0,0,0,0.14)",
  noticeBackground: "#fff8d6",
  noticeText: "#667781",
  noticeBorder: "#f4df9a",
  homeBackground: "#ffffff",
  homeHeader: "#ffffff",
  homeSearch: "#f0f2f5",
  homeRow: "#ffffff",
  homeSelection: "#d9fdd3",
  datePill: "#ffffff",
  datePillText: "#54656f",
};

const darkColors = {
  appBackground: "#0b141a",
  background: "#0b141a",
  surface: "#111b21",
  surfaceAlt: "#202c33",
  surfaceMuted: "#233138",
  text: "#e9edef",
  textMuted: "#8696a0",
  textOnAccent: "#ffffff",
  border: "#374248",
  separator: "#1f2c34",
  accent: "#00a884",
  accentStrong: "#00a884",
  accentSoft: "rgba(0,168,132,0.18)",
  header: "#111b21",
  headerText: "#ffffff",
  headerSubtitle: "rgba(255,255,255,0.82)",
  headerIcon: "#ffffff",
  danger: "#ffb4ab",
  warning: "#f9c74f",
  mine: "#144d37",
  theirs: "#202c33",
  composer: "#111b21",
  chatBackdrop: "#0b141a",
  overlay: "rgba(0,0,0,0.24)",
  shadow: "rgba(0,0,0,0.26)",
  noticeBackground: "#1d272e",
  noticeText: "#aebdc6",
  noticeBorder: "#2f3d45",
  homeBackground: "#111b21",
  homeHeader: "#111b21",
  homeSearch: "#202c33",
  homeRow: "#111b21",
  homeSelection: "#123526",
  datePill: "rgba(32,44,51,0.92)",
  datePillText: "#ffffff",
};

export type AppTheme = typeof lightTheme;

export const lightTheme = {
  colors: lightColors,
  ...themeTokens,
};

export const darkTheme = {
  colors: darkColors,
  ...themeTokens,
};

export const theme = lightTheme;

export function useAppTheme() {
  const scheme = useColorScheme();
  return scheme === "dark" ? darkTheme : lightTheme;
}
