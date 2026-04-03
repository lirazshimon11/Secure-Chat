import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from "react";
import { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { Profile } from "@/lib/types";

type AuthContextValue = {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (identifier: string, password: string) => Promise<{ error: string | null }>;
  signUp: (
    email: string,
    password: string,
    username: string,
  ) => Promise<{ error: string | null; notice: string | null }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) {
        return;
      }

      setSession(data.session);
      if (data.session?.user) {
        await loadProfile(data.session.user.id);
      }
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession?.user) {
        void loadProfile(nextSession.user.id);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function loadProfile(userId: string) {
    const { data } = await supabase.from("profiles").select("*").eq("id", userId).single();
    setProfile((data as Profile | null) ?? null);
  }

  async function signIn(identifier: string, password: string) {
    let loginEmail = identifier;

    // If identifier doesn't look like an email, assume it's a username.
    // We use an RPC function so the lookup works even before the user is authenticated
    // (the profiles table RLS only allows reads by authenticated users).
    if (!identifier.includes("@")) {
      const { data, error: rpcError } = await supabase.rpc("get_email_by_username", {
        p_username: identifier.toLowerCase(),
      });

      if (rpcError || !data) {
        return { error: "שם משתמש אינו קיים במערכת." };
      }
      loginEmail = data as string;
    }

    const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password });
    return { error: normalizeAuthError(error?.message ?? null) };
  }

  async function signUp(email: string, password: string, username: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username,
        },
      },
    });

    if (error) {
      return { error: normalizeAuthError(error.message), notice: null };
    }

    if (!data.session) {
      return {
        error: null,
        notice:
          "Account created. Supabase may require email confirmation before first sign-in. For quick testing, enable Email provider + password sign-in and disable Confirm email in Supabase Auth settings.",
      };
    }

    return { error: null, notice: "Account created and signed in." };
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  const value = useMemo(
    () => ({
      session,
      profile,
      loading,
      signIn,
      signUp,
      signOut,
    }),
    [loading, profile, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}

function normalizeAuthError(message: string | null) {
  if (!message) {
    return null;
  }

  if (message.toLowerCase().includes("email logins are disabled")) {
    return "Email/password auth is disabled in Supabase. Open Supabase Dashboard -> Authentication -> Providers -> Email and enable the Email provider plus password sign-in. For easier testing, also disable Confirm email.";
  }

  return message;
}
