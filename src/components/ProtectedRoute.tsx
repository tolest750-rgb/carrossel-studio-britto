import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { useSubscription } from "@/hooks/use-subscription";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

function FullscreenLoader({ label = "CARREGANDO..." }: { label?: string }) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="font-mono text-xs text-muted-foreground tracking-[2px] animate-pulse">{label}</div>
    </div>
  );
}

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, ready } = useAuth();
  if (!ready) return <FullscreenLoader />;
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

/** Blocks access to the studio when subscription is inactive — sends to /account. */
export function RequireSubscription({ children }: { children: React.ReactNode }) {
  const { ready } = useAuth();
  const { active, loading } = useSubscription();
  if (!ready || loading || active === null) return <FullscreenLoader label="VERIFICANDO ASSINATURA..." />;
  if (!active) return <Navigate to="/account" replace />;
  return <>{children}</>;
}

export function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, ready } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      setIsAdmin(false);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      setIsAdmin(!!data);
    })();
  }, [user, ready]);

  if (!ready || isAdmin === null) return <FullscreenLoader label="VERIFICANDO PERMISSÕES..." />;
  if (!user) return <Navigate to="/auth" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
}
