import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "owner" | "admin" | "user";

export function useRole() {
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        if (mounted) { setRole(null); setLoading(false); }
        return;
      }
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id);
      if (!mounted) return;
      const roles = (data ?? []).map((r) => r.role as AppRole);
      const resolved: AppRole | null = roles.includes("owner")
        ? "owner"
        : roles.includes("admin")
        ? "admin"
        : roles.includes("user")
        ? "user"
        : null;
      setRole(resolved);
      setLoading(false);
    }
    load();
    const { data: sub } = supabase.auth.onAuthStateChange((e) => {
      if (e === "SIGNED_IN" || e === "SIGNED_OUT" || e === "USER_UPDATED") load();
    });
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, []);

  return {
    role,
    loading,
    isOwner: role === "owner",
    isAdmin: role === "admin",
    isStaff: role === "owner" || role === "admin",
  };
}
