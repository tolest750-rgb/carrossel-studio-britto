import { createContext, createElement, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AuthCtx = {
  session: Session | null;
  user: User | null;
  /** True only after the initial getSession() resolved. Components should wait for this before redirecting. */
  ready: boolean;
  /** Backwards-compat alias of !ready */
  loading: boolean;
};

const AuthContext = createContext<AuthCtx>({
  session: null,
  user: null,
  ready: false,
  loading: true,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Listener FIRST (synchronous-only inside the callback to avoid deadlocks)
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      // Once we got any event, we're definitely ready
      setReady(true);
    });
    // Then load existing session
    supabase.auth
      .getSession()
      .then(({ data: { session: sess } }) => {
        setSession(sess);
        setUser(sess?.user ?? null);
      })
      .finally(() => setReady(true));
    return () => sub.subscription.unsubscribe();
  }, []);

  return createElement(AuthContext.Provider, { value: { session, user, ready, loading: !ready } }, children);
}

export function useAuth() {
  return useContext(AuthContext);
}
