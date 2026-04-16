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
    const load = async () => {
      const { data } = await supabase
        .from("subscriptions")
        .select("status, current_period_end")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!mounted) return;
      const isActive =
        !!data &&
        (data.status === "active" || data.status === "trialing") &&
        (!data.current_period_end || new Date(data.current_period_end) > new Date());
      setActive(isActive);
      setLoading(false);
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
