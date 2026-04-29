import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const SITE_URL = "https://3dmuscio.com";

export const CanonicalTag = () => {
  const location = useLocation();

  useEffect(() => {
    const path = location.pathname === "/" ? "/" : location.pathname.replace(/\/$/, "");
    const href = `${SITE_URL}${path}`;
    let link = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = document.createElement("link");
      link.setAttribute("rel", "canonical");
      document.head.appendChild(link);
    }
    link.setAttribute("href", href);
  }, [location.pathname]);

  return null;
};
