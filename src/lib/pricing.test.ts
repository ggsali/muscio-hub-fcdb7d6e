import { describe, expect, it } from "vitest";
import { loesePreisConfigAuf, preisAuftrag, preisProStueck } from "./pricing";

const C = { maschinenzeitProH: 3, nachbearbeitungProH: 50, setupPauschale: 20, mindestpreis: 5 };

describe("pricing", () => {
  it("Stueckpreis = Material + Maschine + Nachbearbeitung (+ Teilen)", () => {
    const s = preisProStueck({ gewichtG: 100, druckzeitMin: 120, materialProG: 0.055, menge: 1, nachbearbeitungMin: 6 }, C);
    expect(s.material).toBeCloseTo(5.5);
    expect(s.maschine).toBeCloseTo(6);
    expect(s.nachbearbeitung).toBeCloseTo(5);
    expect(s.teilen).toBe(0);
    expect(s.stueck).toBeCloseTo(16.5);
  });
  it("Teilen kostet pro Schnitt 15 CHF", () => {
    expect(preisProStueck({ gewichtG: 0, druckzeitMin: 0, materialProG: 0, menge: 1, nachbearbeitungMin: 0, splitParts: 3 }, C).teilen).toBe(30);
  });
  it("Setup einmal pro Platte, Versand dazu, Mindestpreis greift", () => {
    const t = { gewichtG: 100, druckzeitMin: 120, materialProG: 0.055, menge: 2, nachbearbeitungMin: 6 };
    const a = preisAuftrag([t], C, { platten: 3, versand: 7 });
    expect(a.setup).toBe(60);
    expect(a.zwischensumme).toBeCloseTo(33 + 60);
    expect(a.total).toBeCloseTo(33 + 60 + 7);
    const klein = preisAuftrag([{ ...t, gewichtG: 0.1, druckzeitMin: 1, menge: 1, nachbearbeitungMin: 0 }], { ...C, setupPauschale: 0 }, { versand: 0 });
    expect(klein.total).toBe(5);
  });
  it("leerer Warenkorb kostet nichts ausser Mindestpreis, kein Versand", () => {
    const a = preisAuftrag([], C, { versand: 7 });
    expect(a.setup).toBe(0);
    expect(a.versand).toBe(0);
  });
  it("Quelle: Website > intern > Standard", () => {
    const r = loesePreisConfigAuf({
      website: { maschinenzeit_pro_h: 4, setup_pauschale: null, nachbearbeitung_pro_h: null },
      settings: { maschinenzeit_pro_h: 3, nachbearbeitung_pro_h: 60 },
      calcParams: { fix_cost: 3.5, min_price: 5 },
    });
    expect(r.maschinenzeitProH).toBe(4); expect(r.quelle.maschinenzeitProH).toBe("website");
    expect(r.nachbearbeitungProH).toBe(60); expect(r.quelle.nachbearbeitungProH).toBe("intern");
    expect(r.setupPauschale).toBe(3.5); expect(r.quelle.setupPauschale).toBe("intern");
  });
});
