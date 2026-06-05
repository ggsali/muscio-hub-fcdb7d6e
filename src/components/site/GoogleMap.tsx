import { useEffect, useRef } from "react";

declare global {
  interface Window {
    google: any;
    __initGMap?: () => void;
    __gmapLoading?: Promise<void>;
  }
}

const BROWSER_KEY = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY;
const TRACKING_ID = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID;

function loadMapsScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject();
  if (window.google?.maps) return Promise.resolve();
  if (window.__gmapLoading) return window.__gmapLoading;

  window.__gmapLoading = new Promise<void>((resolve, reject) => {
    window.__initGMap = () => resolve();
    const s = document.createElement("script");
    const params = new URLSearchParams({
      key: BROWSER_KEY,
      loading: "async",
      callback: "__initGMap",
    });
    if (TRACKING_ID) params.set("channel", TRACKING_ID);
    s.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
    s.async = true;
    s.defer = true;
    s.onerror = () => reject(new Error("maps_load_error"));
    document.head.appendChild(s);
  });
  return window.__gmapLoading;
}

interface Props {
  lat: number;
  lng: number;
  zoom?: number;
  title?: string;
  className?: string;
}

export function GoogleMap({ lat, lng, zoom = 15, title, className }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const errRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    if (!BROWSER_KEY) {
      if (errRef.current) errRef.current.style.display = "flex";
      return;
    }
    loadMapsScript()
      .then(() => {
        if (cancelled || !ref.current || !window.google?.maps) return;
        const map = new window.google.maps.Map(ref.current, {
          center: { lat, lng },
          zoom,
          disableDefaultUI: false,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
        });
        new window.google.maps.Marker({
          position: { lat, lng },
          map,
          title,
        });
      })
      .catch(() => {
        if (errRef.current) errRef.current.style.display = "flex";
      });
    return () => { cancelled = true; };
  }, [lat, lng, zoom, title]);

  return (
    <div className={className} style={{ position: "relative" }}>
      <div ref={ref} style={{ width: "100%", height: "100%" }} />
      <div
        ref={errRef}
        style={{ display: "none" }}
        className="absolute inset-0 items-center justify-center bg-muted text-sm text-muted-foreground p-4 text-center"
      >
        Karte konnte nicht geladen werden.
      </div>
    </div>
  );
}
