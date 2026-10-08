import type { ErrorComponentProps } from "@tanstack/react-router";
import { useEffect } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { QueryClientProvider } from "@tanstack/react-query";
import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRouteWithContext,
  useRouter,
} from "@tanstack/react-router";
import { HelmetProvider } from "react-helmet-async";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SettingsProvider } from "@/contexts/SettingsContext";
import { CompanySettingsProvider } from "@/contexts/CompanySettingsContext";
import { CustomerAuthProvider } from "@/contexts/CustomerAuthContext";
import { reportLovableError } from "@/lib/lovable-error-reporting";
import NotFound from "@/pages/NotFound";
import appCss from "../styles.css?url";

// Ported from index.html: Domain-Vereinheitlichung www -> non-www (Client-Fallback)
const domainRedirectScript = `(function () {
  var h = location.hostname;
  if (h === "www.3dmuscio.com" || (h === "3dmuscio.com" && location.protocol === "http:")) {
    location.replace("https://3dmuscio.com" + location.pathname + location.search + location.hash);
  }
})();`;

// Ported from index.html: Alte Service Worker / PWA-Caches entfernen
const legacyPwaCleanupScript = `(function () {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.getRegistrations().then(function (rs) {
      rs.forEach(function (r) { r.unregister(); });
    });
  }
  if (window.caches) {
    caches.keys().then(function (ks) { ks.forEach(function (k) { caches.delete(k); }); });
  }
})();`;


export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1.0, viewport-fit=cover" },
      { name: "google-site-verification", content: "viXJbv64kKqwwY_MpoGdHZU0kcvv0GVwwQKTXeIieHU" },
      { title: "3DMuscio – 3D Druckservice Schweiz" },
      {
        name: "description",
        content:
          "Professioneller 3D Druckservice in Eschlikon TG für B2B-Kunden, Einzelteile und Kleinserien. Online-Kalkulator. Schnell, präzise, made in Switzerland.",
      },
      { name: "author", content: "3DMuscio" },
      { name: "robots", content: "index, follow, max-image-preview:large" },
      { property: "og:site_name", content: "3DMuscio" },
      { property: "og:locale", content: "de_CH" },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://3dmuscio.com/" },
      {
        property: "og:title",
        content: "3DMuscio – 3D Druckservice Schweiz",
      },
      {
        property: "og:description",
        content:
          "Professioneller 3D Druckservice in Eschlikon TG für B2B-Kunden, Einzelteile und Kleinserien. Online-Kalkulator.",
      },
      { name: "twitter:card", content: "summary_large_image" },
      {
        name: "twitter:title",
        content: "3DMuscio – 3D Druckservice Schweiz",
      },
      {
        name: "twitter:description",
        content:
          "Professioneller 3D Druckservice in Eschlikon TG für B2B-Kunden, Einzelteile und Kleinserien. Online-Kalkulator.",
      },
      { name: "theme-color", content: "#22c55e" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://ukqtjdsjmtxgzhklvqky.supabase.co", crossOrigin: "anonymous" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "dns-prefetch", href: "https://storage.googleapis.com" },
      {
        rel: "icon",
        type: "image/x-icon",
        href: "https://ukqtjdsjmtxgzhklvqky.supabase.co/storage/v1/object/public/company-assets/logo.jpeg",
      },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
    ],
    scripts: [
      { children: domainRedirectScript },
      { children: legacyPwaCleanupScript },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFound,
  errorComponent: RootErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  // Dark Mode ist nur für das Admin-Panel erlaubt – öffentliche Website bleibt immer hell
  useEffect(() => {
    const isAdminArea = window.location.pathname.startsWith("/admin") || window.location.pathname.startsWith("/website-admin");
    if (!isAdminArea) {
      document.documentElement.classList.remove("dark");
    } else if (localStorage.getItem("admin-theme") === "dark") {
      document.documentElement.classList.add("dark");
    }
  });
  return (
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <SettingsProvider>
            <CompanySettingsProvider>
              <CustomerAuthProvider>
                <Outlet />
              </CustomerAuthProvider>
            </CompanySettingsProvider>
          </SettingsProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </HelmetProvider>
  );
}

function RootErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="max-w-md w-full text-center bg-card border border-border rounded-xl p-8">
        <h1 className="text-xl font-bold text-foreground mb-2">This page didn't load</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Etwas ist schiefgelaufen. Du kannst es erneut versuchen oder zur Startseite zurückkehren.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium"
          >
            Try again
          </button>
          <a
            href="/"
            className="px-4 py-2 rounded-md border border-border text-foreground text-sm font-medium"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}
