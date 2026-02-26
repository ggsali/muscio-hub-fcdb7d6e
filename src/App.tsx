import { useEffect, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SettingsProvider } from "@/contexts/SettingsContext";
import { CompanySettingsProvider } from "@/contexts/CompanySettingsContext";
import type { Session } from "@supabase/supabase-js";

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
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

function AuthGate() {
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
            <Route path="/" element={<DashboardPage />} />
            <Route path="/kunden" element={<KundenPage />} />
            <Route path="/kunden/:id" element={<KundeDetailPage />} />
            <Route path="/auftraege" element={<AuftraegePage />} />
            <Route path="/auftraege/:id" element={<AuftragDetailPage />} />
            <Route path="/teile" element={<TeileBibliothekPage />} />
            <Route path="/filamente" element={<FilamentePage />} />
            <Route path="/kalkulator" element={<KalkulatorPage />} />
            <Route path="/einstellungen" element={<EinstellungenPage />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </CompanySettingsProvider>
    </SettingsProvider>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthGate />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
