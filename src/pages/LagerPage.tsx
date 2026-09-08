import React, { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ScanLine } from "lucide-react";
import { cn } from "@/lib/utils";
import FilamentBestandPage from "@/pages/filament/FilamentBestandPage";
import FilamentArtenPage from "@/pages/filament/FilamentArtenPage";
import FilamentRollenPage from "@/pages/filament/FilamentRollenPage";
import FilamentEtikettenPage from "@/pages/filament/FilamentEtikettenPage";
import FilamentLieferungPage from "@/pages/filament/FilamentLieferungPage";
import VersandScanPage from "@/pages/filament/VersandScanPage";

const TABS = [
  { key: "bestand", label: "📊 Bestandsübersicht" },
  { key: "arten", label: "🎨 Filamentarten" },
  { key: "rollen", label: "➕ Rollen anlegen" },
  { key: "lieferung", label: "🚚 Lieferung einbuchen" },
  { key: "etiketten", label: "🏷️ Etiketten" },
  { key: "versand", label: "📦 Versand scannen" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default function LagerPage() {
  const [tab, setTab] = useState<TabKey>("bestand");

  return (
    <div className="min-h-full">
      <div className="px-4 md:px-6 pt-4 md:pt-6 print:hidden">
        <h1 className="text-xl md:text-2xl font-bold">Lager</h1>
        <p className="text-sm text-muted-foreground">Internes Filamentlager – Rollen, Etiketten und Bestände</p>
        <div className="mt-4 flex flex-wrap items-center gap-2 border-b border-border pb-2">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "rounded-xl px-3 py-2 text-sm transition-colors",
                tab === t.key
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {t.label}
            </button>
          ))}
          <Link
            to="/admin/scan"
            className="ml-auto inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm text-primary hover:bg-primary/10 transition-colors"
          >
            <ScanLine className="w-4 h-4" /> Scanner öffnen →
          </Link>
        </div>
      </div>

      {tab === "bestand" && <FilamentBestandPage />}
      {tab === "arten" && <FilamentArtenPage />}
      {tab === "rollen" && <FilamentRollenPage />}
      {tab === "lieferung" && <FilamentLieferungPage />}
      {tab === "etiketten" && <FilamentEtikettenPage />}
      {tab === "versand" && <VersandScanPage />}
    </div>
  );
}
