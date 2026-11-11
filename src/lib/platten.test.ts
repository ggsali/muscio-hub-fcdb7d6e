import { describe, it, expect } from "vitest";
import { schaetzePlatten } from "./platten";

describe("schaetzePlatten", () => {
  it("kleines Teil: viele Stück auf einer Platte", () => {
    expect(schaetzePlatten([20, 20, 10], 10).plates).toBe(1);
  });
  it("braucht mehrere Platten, wenn nicht alles passt", () => {
    expect(schaetzePlatten([100, 100, 20], 20).plates).toBeGreaterThan(1);
  });
  it("grosser Drucker spart Platten", () => {
    const r = schaetzePlatten([100, 100, 20], 9);
    expect(r.plates).toBe(1); // 9 Stück passen auf 350x350 (mit Abstand), auf dem A1 wären es 3 Platten
    expect(r.printer).toBe("K2 Plus");
  });
  it("ohne Masse: eine Platte", () => {
    expect(schaetzePlatten(null, 5).plates).toBe(1);
  });
  it("zu gross für jeden Drucker: eine Platte pro Stück", () => {
    expect(schaetzePlatten([600, 600, 600], 3).plates).toBe(3);
  });
});
