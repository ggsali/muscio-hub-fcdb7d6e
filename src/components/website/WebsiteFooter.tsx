import { Link } from "react-router-dom";
import { Mail, Phone, MapPin } from "lucide-react";

export const WebsiteFooter = () => (
  <footer className="border-t border-border">
    <div className="container mx-auto px-4 py-12">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        <div>
          <h3 className="font-heading text-lg font-bold mb-3 text-foreground">
            3D<span className="text-primary">Muscio</span>
          </h3>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Professioneller 3D-Druckservice in der Schweiz.
          </p>
        </div>

        <div>
          <h4 className="font-heading font-semibold text-sm mb-3 text-foreground">Navigation</h4>
          <div className="flex flex-col gap-1.5">
            {[
              { label: "Kalkulator", path: "/kalkulator" },
              { label: "Materialien", path: "/materialien" },
              { label: "Über uns", path: "/ueber-uns" },
              { label: "Kontakt", path: "/kontakt" },
            ].map(l => (
              <Link key={l.path} to={l.path} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                {l.label}
              </Link>
            ))}
          </div>
        </div>

        <div>
          <h4 className="font-heading font-semibold text-sm mb-3 text-foreground">Materialien</h4>
          <div className="flex flex-col gap-1.5">
            {["PLA", "PETG", "ABS", "TPU", "Resin"].map(m => (
              <Link key={m} to="/materialien" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                {m}
              </Link>
            ))}
          </div>
        </div>

        <div>
          <h4 className="font-heading font-semibold text-sm mb-3 text-foreground">Kontakt</h4>
          <div className="flex flex-col gap-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-2"><MapPin className="w-4 h-4" /> Gartensiedlung 13, 8360 Eschlikon TG</span>
            <span className="flex items-center gap-2"><Phone className="w-4 h-4" /> +41 44 123 45 67</span>
            <span className="flex items-center gap-2"><Mail className="w-4 h-4" /> info@3dmuscio.ch</span>
          </div>
        </div>
      </div>

      <div className="border-t border-border mt-10 pt-6 flex flex-col md:flex-row items-center justify-between text-xs text-muted-foreground">
        <span>© {new Date().getFullYear()} 3DMuscio. Alle Rechte vorbehalten.</span>
        <div className="flex gap-4 mt-3 md:mt-0">
          <Link to="/impressum" className="hover:text-foreground transition-colors">Impressum</Link>
          <Link to="/datenschutz" className="hover:text-foreground transition-colors">Datenschutz</Link>
          <Link to="/agb" className="hover:text-foreground transition-colors">AGB</Link>
        </div>
      </div>
    </div>
  </footer>
);
