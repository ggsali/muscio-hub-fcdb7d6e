import { describe, it, expect, vi } from "vitest";

// Die Slicer-Funktion und die Datenbank werden hier nicht gebraucht: nur die reine Logik wird geprüft.
vi.mock("@/pages/KalkulatorTestPage", () => ({ sliceOnNas: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { vergleiche, laborPreis, wurdeEingereiht, type SliceKurz, type LaborPreisKonfig } from "./laborAblauf";

const k = (o: Partial<SliceKurz>): SliceKurz => ({ druckzeitMin: 120, gramm: 50, schichten: 100, hatStuetzen: false, stuetzGramm: null, splitParts: null, ...o });

describe("Ausrichtungsvergleich", () => {
  it("kürzere Zeit bei gleichen Stützen gewinnt", () => {
    expect(vergleiche(k({ druckzeitMin: 100 }), k({ druckzeitMin: 130 })).gewinner).toBe("mit");
    expect(vergleiche(k({ druckzeitMin: 140 }), k({ druckzeitMin: 110 })).gewinner).toBe("ohne");
  });
  it("schneller, aber mit Stützen und mehr Material: unklar", () => {
    expect(vergleiche(k({ druckzeitMin: 90, hatStuetzen: true, gramm: 60 }), k({ druckzeitMin: 120 })).gewinner).toBe("unklar");
  });
  it("praktisch gleiche Zeit: gleich", () => {
    expect(vergleiche(k({ druckzeitMin: 120 }), k({ druckzeitMin: 120.2 })).gewinner).toBe("gleich");
  });
  it("mit gelieferter Stützmenge entscheidet diese", () => {
    expect(vergleiche(k({ druckzeitMin: 90, stuetzGramm: 3 }), k({ druckzeitMin: 120, stuetzGramm: 8 })).gewinner).toBe("mit");
    expect(vergleiche(k({ druckzeitMin: 90, stuetzGramm: 9 }), k({ druckzeitMin: 120, stuetzGramm: 8 })).gewinner).toBe("unklar");
  });
});

describe("Preis", () => {
  const konfig = { maschinenRate: 3, nachbearbeitungRate: 50, setupPauschale: 20, minPrice: 5, presets: [] } as LaborPreisKonfig;
  it("setzt sich aus Material, Maschine, Nachbearbeitung und Teilung zusammen", () => {
    const p = laborPreis({ gramm: 100, druckzeitMin: 120, pricePerGram: 0.06, hasSupport: false, dims: [50, 50, 50], triangles: 1000, volumeCm3: 60, splitParts: 2, menge: 3 }, konfig);
    expect(p.material).toBeCloseTo(6, 5);
    expect(p.maschine).toBeCloseTo(6, 5);
    expect(p.teilung).toBe(15);
    expect(p.proStueck).toBeCloseTo(p.material + p.maschine + p.nachbearbeitung + p.teilung, 5);
    expect(p.teilsumme).toBeCloseTo(p.proStueck * 3, 5);
  });
});

describe("Sicherheitsnetz Queue", () => {
  it("erkennt Einreihung", () => {
    expect(wurdeEingereiht({ nas: { queued: true } } as any)).toBe(true);
    expect(wurdeEingereiht({ nas: { queued: false, queueItemId: 5 } } as any)).toBe(true);
    expect(wurdeEingereiht({ nas: { queued: false, queueItemId: null } } as any)).toBe(false);
  });
});
