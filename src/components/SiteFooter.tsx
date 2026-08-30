import React from "react";
import { Link } from "@/lib/router-compat";
import { Box, Mail, Phone, MapPin } from "lucide-react";

export default function SiteFooter() {
  return (
    <footer className="bg-sidebar border-t border-border mt-20">
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-12 grid grid-cols-1 md:grid-cols-4 gap-8">
        <div>
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
              <Box className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-bold">3DMuscio</span>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Professioneller 3D-Druck-Service aus der Schweiz. Schnell, präzise, fair kalkuliert.
          </p>
        </div>

        <div>
          <h4 className="font-semibold mb-3 text-sm">Service</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><Link to="/kalkulator-online" className="hover:text-primary">Preisrechner</Link></li>
            <li><Link to="/faq" className="hover:text-primary">FAQ</Link></li>
            <li><Link to="/kontakt" className="hover:text-primary">Kontakt</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="font-semibold mb-3 text-sm">Konto</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><Link to="/login" className="hover:text-primary">Anmelden</Link></li>
            <li><Link to="/login?mode=register" className="hover:text-primary">Registrieren</Link></li>
            <li><Link to="/portal" className="hover:text-primary">Mein Konto</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="font-semibold mb-3 text-sm">Kontakt</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-center gap-2"><Mail className="w-3.5 h-3.5" /> info@3dmuscio.com</li>
            <li className="flex items-center gap-2"><MapPin className="w-3.5 h-3.5" /> Schweiz</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-4 text-xs text-muted-foreground flex flex-wrap justify-between gap-2">
          <span>© {new Date().getFullYear()} 3DMuscio. Alle Rechte vorbehalten.</span>
          <span>Made in Switzerland 🇨🇭</span>
        </div>
      </div>
    </footer>
  );
}
