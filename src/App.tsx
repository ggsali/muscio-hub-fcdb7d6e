import { useEffect, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SettingsProvider } from "@/contexts/SettingsContext";
import { CompanySettingsProvider } from "@/contexts/CompanySettingsContext";
import { CustomerAuthProvider } from "@/contexts/CustomerAuthContext";

import AdminGate from "@/components/AdminGate";
import SiteLayout from "@/components/SiteLayout";
import PortalLayout from "@/components/PortalLayout";

import LoginPage from "@/pages/LoginPage";
import KundeLogin from "@/pages/kunde/Login";
import KundeRegister from "@/pages/kunde/Register";
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
import AnfragenPage from "@/pages/AnfragenPage";
import KalenderPage from "@/pages/KalenderPage";
import UploadLinksPage from "@/pages/UploadLinksPage";
import ProjectUploadPage from "@/pages/ProjectUploadPage";
import ChatPage from "@/pages/ChatPage";
import PaymentSuccessPage from "@/pages/PaymentSuccessPage";
import WebsiteBestellungenPage from "@/pages/WebsiteBestellungenPage";
import WebsiteKundenAdminPage from "@/pages/WebsiteKundenAdminPage";
import EmailTemplatesPage from "@/pages/EmailTemplatesPage";
import WebsiteEinstellungenPage from "@/pages/WebsiteEinstellungenPage";

// Public website
import HomePage from "@/pages/site/HomePage";
import FaqPage from "@/pages/site/FaqPage";
import ContactPage from "@/pages/site/ContactPage";
import CalculatorOnlinePage from "@/pages/site/CalculatorOnlinePage";
import MaterialienPage from "@/pages/site/MaterialienPage";
import UeberUnsPage from "@/pages/site/UeberUnsPage";
import AGBPage from "@/pages/site/AGBPage";
import DatenschutzPage from "@/pages/site/DatenschutzPage";
import ImpressumPage from "@/pages/site/ImpressumPage";
import ShopPage from "@/pages/site/ShopPage";
import ShopDetailPage from "@/pages/site/ShopDetailPage";
import ProjektDetailPage from "@/pages/site/ProjektDetailPage";
import BewertungPage from "@/pages/site/BewertungPage";

// Customer portal
import PortalDashboardPage from "@/pages/portal/PortalDashboardPage";
import PortalOrdersPage from "@/pages/portal/PortalOrdersPage";
import PortalProfilePage from "@/pages/portal/PortalProfilePage";

// Website Admin
import WebsiteAdminLayout from "@/components/WebsiteAdminLayout";
import WebsiteAdminDashboardPage from "@/pages/website-admin/WebsiteAdminDashboardPage";
import ReviewsAdminPage from "@/pages/website-admin/ReviewsAdminPage";
import ProjekteAdminPage from "@/pages/website-admin/ProjekteAdminPage";
import PartnersAdminPage from "@/pages/website-admin/PartnersAdminPage";
import TeamAdminPage from "@/pages/website-admin/TeamAdminPage";
import NavigationAdminPage from "@/pages/website-admin/NavigationAdminPage";
import TimelineAdminPage from "@/pages/website-admin/TimelineAdminPage";

const queryClient = new QueryClient();

function MaintenanceGate({ children }: { children: React.ReactNode }) {
  const [check, setCheck] = useState<{ active: boolean; msg: string } | null>(null);
  useEffect(() => {
    supabase.from("website_settings").select("value").eq("key", "wartungsmodus").maybeSingle()
      .then(({ data }) => {
        const v = (data?.value as any) || {};
        setCheck({ active: !!v.aktiv, msg: v.nachricht || "Die Website ist gerade in Wartung. Wir sind bald zurück." });
      });
  }, []);
  if (!check) return <>{children}</>;
  if (!check.active) return <>{children}</>;
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="max-w-md text-center bg-card border border-border rounded-xl p-8">
        <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center mx-auto mb-4">
          <span className="text-primary text-xl">🛠</span>
        </div>
        <h1 className="text-xl font-bold mb-2">Wartungsarbeiten</h1>
        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{check.msg}</p>
      </div>
    </div>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <SettingsProvider>
          <CompanySettingsProvider>
            <CustomerAuthProvider>
            <Routes>
              {/* Public website */}
              <Route element={<MaintenanceGate><SiteLayout /></MaintenanceGate>}>
                <Route path="/" element={<HomePage />} />
                <Route path="/shop" element={<ShopPage />} />
                <Route path="/shop/:slug" element={<ShopDetailPage />} />
                <Route path="/kalkulator-online" element={<CalculatorOnlinePage />} />
                <Route path="/materialien" element={<MaterialienPage />} />
                <Route path="/ueber-uns" element={<UeberUnsPage />} />
                <Route path="/faq" element={<FaqPage />} />
                <Route path="/kontakt" element={<ContactPage />} />
                <Route path="/agb" element={<AGBPage />} />
                <Route path="/datenschutz" element={<DatenschutzPage />} />
                <Route path="/impressum" element={<ImpressumPage />} />
                <Route path="/projekte/:slug" element={<ProjektDetailPage />} />
              </Route>

              {/* Auth */}
              <Route path="/login" element={<Navigate to="/anmelden" replace />} />
              <Route path="/anmelden" element={<KundeLogin />} />
              <Route path="/registrieren" element={<KundeRegister />} />
              <Route path="/admin/login" element={<LoginPage />} />

              {/* Public-flow pages (kein Layout) */}
              <Route path="/upload/:token" element={<ProjectUploadPage />} />
              <Route path="/payment-success" element={<PaymentSuccessPage />} />
              <Route path="/bewertung/:token?" element={<BewertungPage />} />

              {/* Customer portal */}
              <Route path="/portal" element={<PortalLayout />}>
                <Route index element={<PortalDashboardPage />} />
                <Route path="bestellungen" element={<PortalOrdersPage />} />
                <Route path="profil" element={<PortalProfilePage />} />
              </Route>

              {/* Admin dashboard – everything mounted under /admin */}
              <Route path="/admin" element={<AdminGate />}>
                <Route index element={<DashboardPage />} />
                <Route path="kunden" element={<KundenPage />} />
                <Route path="kunden/:id" element={<KundeDetailPage />} />
                <Route path="auftraege" element={<AuftraegePage />} />
                <Route path="auftraege/:id" element={<AuftragDetailPage />} />
                <Route path="teile" element={<TeileBibliothekPage />} />
                <Route path="filamente" element={<FilamentePage />} />
                <Route path="kalkulator" element={<KalkulatorPage />} />
                <Route path="einstellungen" element={<EinstellungenPage />} />
                <Route path="anfragen" element={<AnfragenPage />} />
                <Route path="kalender" element={<KalenderPage />} />
                <Route path="uploads" element={<UploadLinksPage />} />
                <Route path="chat" element={<ChatPage />} />
                <Route path="website/bestellungen" element={<WebsiteBestellungenPage />} />
                <Route path="website/kunden" element={<WebsiteKundenAdminPage />} />
                <Route path="website/email-templates" element={<EmailTemplatesPage />} />
                <Route path="website/einstellungen" element={<WebsiteEinstellungenPage />} />
              </Route>

              {/* Website Admin – separate area */}
              <Route path="/website-admin" element={<WebsiteAdminLayout />}>
                <Route index element={<WebsiteAdminDashboardPage />} />
                <Route path="bestellungen" element={<WebsiteBestellungenPage />} />
                <Route path="reviews" element={<ReviewsAdminPage />} />
                <Route path="projekte" element={<ProjekteAdminPage />} />
                <Route path="partner" element={<PartnersAdminPage />} />
                <Route path="team" element={<TeamAdminPage />} />
                <Route path="timeline" element={<TimelineAdminPage />} />
                <Route path="navigation" element={<NavigationAdminPage />} />
                <Route path="kunden" element={<WebsiteKundenAdminPage />} />
                <Route path="chat" element={<ChatPage />} />
                <Route path="email-templates" element={<EmailTemplatesPage />} />
                <Route path="einstellungen" element={<WebsiteEinstellungenPage />} />
              </Route>

              {/* Legacy redirects → admin */}
              <Route path="/auftraege" element={<Navigate to="/admin/auftraege" replace />} />
              <Route path="/auftraege/:id" element={<Navigate to="/admin/auftraege" replace />} />
              <Route path="/kunden" element={<Navigate to="/admin/kunden" replace />} />
              <Route path="/kunden/:id" element={<Navigate to="/admin/kunden" replace />} />
              <Route path="/teile" element={<Navigate to="/admin/teile" replace />} />
              <Route path="/filamente" element={<Navigate to="/admin/filamente" replace />} />
              <Route path="/kalkulator" element={<Navigate to="/admin/kalkulator" replace />} />
              <Route path="/einstellungen" element={<Navigate to="/admin/einstellungen" replace />} />
              <Route path="/anfragen" element={<Navigate to="/admin/anfragen" replace />} />
              <Route path="/kalender" element={<Navigate to="/admin/kalender" replace />} />
              <Route path="/uploads" element={<Navigate to="/admin/uploads" replace />} />
              <Route path="/chat" element={<Navigate to="/admin/chat" replace />} />
              <Route path="/website/*" element={<Navigate to="/admin" replace />} />

              <Route path="/mein-konto" element={<Navigate to="/portal" replace />} />

              <Route path="*" element={<NotFound />} />
            </Routes>
            </CustomerAuthProvider>
          </CompanySettingsProvider>
        </SettingsProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
