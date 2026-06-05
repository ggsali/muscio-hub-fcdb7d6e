import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const SESSION_KEY = "_pv_session";

function getSessionId() {
  try {
    let s = sessionStorage.getItem(SESSION_KEY);
    if (!s) {
      s = crypto.randomUUID();
      sessionStorage.setItem(SESSION_KEY, s);
    }
    return s;
  } catch {
    return null;
  }
}

function detectDevice(): string {
  if (typeof window === "undefined") return "unknown";
  const ua = navigator.userAgent || "";
  if (/Tablet|iPad/i.test(ua)) return "tablet";
  if (/Mobi|Android|iPhone/i.test(ua)) return "mobile";
  return "desktop";
}

export function usePageViewTracker() {
  const location = useLocation();
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    const path = location.pathname;
    if (lastPath.current === path) return;
    lastPath.current = path;

    // Don't track admin/portal/login areas
    if (/^\/(admin|website-admin|portal|login|kunde)/.test(path)) return;

    const payload = {
      path,
      referrer: typeof document !== "undefined" ? document.referrer || null : null,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
      device: detectDevice(),
      session_id: getSessionId(),
    };

    // Fire and forget
    supabase.from("page_views").insert(payload).then(() => {}, () => {});
  }, [location.pathname]);
}
