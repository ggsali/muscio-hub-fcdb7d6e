import { useEffect, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SettingsProvider } from "@/contexts/SettingsContext";
import { CompanySettingsProvider } from "@/contexts/CompanySettingsContext";
import type { Session } from "@supabase/supabase-js";

// Admin pages
import AppLayout from "@/components/AppLayout";
import LoginPage from "@/pages/LoginPage";
import DashboardPage from "@/pages/DashboardPage";
import KundenPage from "@/pages/KundenPage";
import KundeDetailPage from "@/pages/KundeDetailPage";
import AuftraegePage from "@/pages/AuftraegePage";
import AuftragDetailPage from "@/pages/AuftragDetailPage";
import TeileBibliothekPage from "@/pages/TeileBibliothekPage";
import KalkulatorPage from "@/pages/KalkulatorPage";
import EinstellungenPage from "@/pages/EinstellungenPage";
import FilamentePage from "@/pages/FilamentePage";
import AnfragenPage from "@/pages/AnfragenPage";

// Public website pages
import { WebsiteHeader } from "@/components/website/WebsiteHeader";
import { WebsiteFooter } from "@/components/website/WebsiteFooter";
import WebsiteIndex from "@/pages/website/WebsiteIndex";
import WebsiteKalkulator from "@/pages/website/WebsiteKalkulator";
import WebsiteMaterialien from "@/pages/website/WebsiteMaterialien";
import WebsiteUeberUns from "@/pages/website/WebsiteUeberUns";
import WebsiteKontakt from "@/pages/website/WebsiteKontakt";
import WebsiteAGB from "@/pages/website/WebsiteAGB";
import WebsiteImpressum from "@/pages/website/WebsiteImpressum";
import WebsiteDatenschutz from "@/pages/website/WebsiteDatenschutz";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

// Public website layout (with header + footer)
const WebsiteLayout = () => (
  <div className="min-h-screen bg-[#0a0a0a]">
    <WebsiteHeader />
    <main>
      <Routes>
        <Route path="/" element={<WebsiteIndex />} />
        <Route path="/kalkulator" element={<WebsiteKalkulator />} />
        <Route path="/materialien" element={<WebsiteMaterialien />} />
        <Route path="/ueber-uns" element={<WebsiteUeberUns />} />
        <Route path="/kontakt" element={<WebsiteKontakt />} />
        <Route path="/agb" element={<WebsiteAGB />} />
        <Route path="/impressum" element={<WebsiteImpressum />} />
        <Route path="/datenschutz" element={<WebsiteDatenschutz />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </main>
    <WebsiteFooter />
  </div>
);

// Admin area (requires login)
function AdminGate() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
  }, []);

  if (session === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!session) return <LoginPage />;

  return (
    <SettingsProvider>
      <CompanySettingsProvider>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/admin" element={<DashboardPage />} />
            <Route path="/admin/kunden" element={<KundenPage />} />
            <Route path="/admin/kunden/:id" element={<KundeDetailPage />} />
            <Route path="/admin/auftraege" element={<AuftraegePage />} />
            <Route path="/admin/auftraege/:id" element={<AuftragDetailPage />} />
            <Route path="/admin/teile" element={<TeileBibliothekPage />} />
            <Route path="/admin/filamente" element={<FilamentePage />} />
            <Route path="/admin/kalkulator" element={<KalkulatorPage />} />
            <Route path="/admin/einstellungen" element={<EinstellungenPage />} />
            <Route path="/admin/anfragen" element={<AnfragenPage />} />
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Route>
        </Routes>
      </CompanySettingsProvider>
    </SettingsProvider>
  );
}

// Root router — splits public vs admin
function AppRouter() {
  const location = useLocation();
  const isAdmin = location.pathname.startsWith("/admin") || location.pathname === "/login";

  if (isAdmin) return <AdminGate />;
  return <WebsiteLayout />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AppRouter />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
