import { useEffect } from "react";

/**
 * Setzt <meta name="robots" content="noindex,nofollow"> für die aktuelle Seite,
 * damit interne Bereiche (Admin, Portal, Login) nicht in Suchmaschinen erscheinen.
 */
export function useNoIndex() {
  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow";
    document.head.appendChild(meta);
    return () => {
      document.head.removeChild(meta);
    };
  }, []);
}
