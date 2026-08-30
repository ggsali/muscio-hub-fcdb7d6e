import { useEffect, useRef } from "react";
import { useLocation } from "@/lib/router-compat";
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

type Geo = { country: string | null; country_code: string | null; region: string | null; city: string | null };

const GEO_KEY = "_pv_geo";
let geoPromise: Promise<Geo> | null = null;

const EMPTY_GEO: Geo = { country: null, country_code: null, region: null, city: null };

async function fetchGeo(): Promise<Geo> {
  try {
    const cached = sessionStorage.getItem(GEO_KEY);
    if (cached) return JSON.parse(cached) as Geo;
  } catch { /* ignore */ }

  let geo: Geo = { ...EMPTY_GEO };

  // Option A: Cloudflare trace (same-origin, kein extra API-Key)
  try {
    const res = await fetch("/cdn-cgi/trace", { cache: "no-store" });
    if (res.ok) {
      const text = await res.text();
      const loc = /(?:^|\n)loc=([A-Z]{2})/.exec(text)?.[1] || null;
      if (loc) geo = { ...geo, country_code: loc, country: loc };
    }
  } catch { /* ignore */ }

  // Option B: ipapi.co als Fallback (liefert auch Region/Stadt)
  if (!geo.country_code || !geo.city) {
    try {
      const res = await fetch("https://ipapi.co/json/");
      if (res.ok) {
        const d = await res.json();
        geo = {
          country: d.country_name || geo.country,
          country_code: d.country_code || geo.country_code,
          region: d.region || null,
          city: d.city || null,
        };
      }
    } catch { /* ignore */ }
  }

  try {
    if (geo.country_code || geo.city) sessionStorage.setItem(GEO_KEY, JSON.stringify(geo));
  } catch { /* ignore */ }

  return geo;
}

function getGeo(): Promise<Geo> {
  if (!geoPromise) geoPromise = fetchGeo().catch(() => ({ ...EMPTY_GEO }));
  return geoPromise;
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

    getGeo().then((geo) => {
      const payload = {
        path,
        referrer: typeof document !== "undefined" ? document.referrer || null : null,
        user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
        device: detectDevice(),
        session_id: getSessionId(),
        country: geo.country,
        country_code: geo.country_code,
        region: geo.region,
        city: geo.city,
      };

      // Fire and forget
      supabase.from("page_views").insert(payload).then(() => {}, () => {});
    });
  }, [location.pathname]);
}

