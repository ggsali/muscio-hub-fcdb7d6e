import React, { useState } from "react";
import { cn } from "@/lib/utils";
import FilamentBestandPage from "@/pages/filament/FilamentBestandPage";
import FilamentArtenPage from "@/pages/filament/FilamentArtenPage";
import FilamentRollenPage from "@/pages/filament/FilamentRollenPage";
import FilamentEtikettenPage from "@/pages/filament/FilamentEtikettenPage";
import FilamentScanPage from "@/pages/filament/FilamentScanPage";

const TABS = [
  { key: "bestand", label: "📊 Bestandsübersicht" },
  { key: "arten", label: "🎨 Filamentarten" },
  { key: "rollen", label: "➕ Rollen anlegen" },
  { key: "etiketten", label: "🏷️ Etiketten" },
  { key: "scan", label: "📷 Leer melden" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default function LagerPage() {
  const [tab, setTab] = useState<TabKey>("bestand");

  return (
    <div className="min-h-full">
      <div className="px-4 md:px-6 pt-4 md:pt-6 print:hidden">
        <h1 className="text-xl md:text-2xl font-bold">Lager</h1>
        <p className="text-sm text-muted-foreground">Internes Filamentlager – Rollen, Etiketten und Bestände</p>
        <div className="mt-4 flex flex-wrap gap-2 border-b border-border pb-2">
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
        </div>
      </div>

      {tab === "bestand" && <FilamentBestandPage />}
      {tab === "arten" && <FilamentArtenPage />}
      {tab === "rollen" && <FilamentRollenPage />}
      {tab === "etiketten" && <FilamentEtikettenPage />}
      {tab === "scan" && <FilamentScanPage />}
    </div>
  );
}
