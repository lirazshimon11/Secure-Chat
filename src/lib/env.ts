import Constants from "expo-constants";

const extra = Constants.expoConfig?.extra ?? {};

export const env = {
  supabaseUrl:
    process.env.EXPO_PUBLIC_SUPABASE_URL ??
    (extra.EXPO_PUBLIC_SUPABASE_URL as string | undefined) ??
    "",
  supabaseAnonKey:
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
    (extra.EXPO_PUBLIC_SUPABASE_ANON_KEY as string | undefined) ??
    "",
};

export function assertEnv() {
  if (!env.supabaseUrl || !env.supabaseAnonKey) {
    throw new Error(
      "Missing Supabase environment variables. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }
}
