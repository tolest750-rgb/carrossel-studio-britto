import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./use-auth";

export function useSubscription() {
  const { user } = useAuth();
  const [active, setActive] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setActive(false);
      setLoading(false);
      return;
    }
    let mounted = true;
    setLoading(true);
    const load = async () => {
      try {
        const { data, error } = await supabase
          .from("subscriptions")
          .select("status, current_period_end")
          .eq("user_id", user.id)
          .maybeSingle();
        if (!mounted) return;
        if (error) {
          console.error("[useSubscription] query error:", error);
          setActive(false);
        } else {
          const isActive =
            !!data &&
            (data.status === "active" || data.status === "trialing") &&
            (!data.current_period_end || new Date(data.current_period_end) > new Date());
          setActive(isActive);
        }
      } catch (e) {
        console.error("[useSubscription] unexpected error:", e);
        if (mounted) setActive(false);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();

    const channel = supabase
      .channel("sub-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "subscriptions", filter: `user_id=eq.${user.id}` },
        () => load(),
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [user]);

  return { active, loading };
}
