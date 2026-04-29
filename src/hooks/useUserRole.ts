import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "customer" | null;

export function useUserRole(userId: string | undefined) {
  const [role, setRole] = useState<AppRole | undefined>(undefined); // undefined = loading
  useEffect(() => {
    if (!userId) {
      setRole(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);
      if (cancelled) return;
      if (data?.some((r: any) => r.role === "admin")) setRole("admin");
      else if (data?.some((r: any) => r.role === "customer")) setRole("customer");
      else setRole(null);
    })();
    return () => { cancelled = true; };
  }, [userId]);
  return role;
}
