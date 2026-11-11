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
    const r = schaetzePlatten([100, 100, 20], 16);
    expect(r.plates).toBe(1); // 16 Stück passen auf 420x420 (mit Abstand)
    expect(r.printer).toBe("XL");
  });
  it("ohne Masse: eine Platte", () => {
    expect(schaetzePlatten(null, 5).plates).toBe(1);
  });
  it("zu gross für jeden Drucker: eine Platte pro Stück", () => {
    expect(schaetzePlatten([600, 600, 600], 3).plates).toBe(3);
  });
});
