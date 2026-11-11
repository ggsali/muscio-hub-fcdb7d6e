import { describe, it, expect } from "vitest";
import { schaetzePlatten } from "./platten";

describe("schaetzePlatten (H2C 330 x 320)", () => {
  it("kleines Teil: viele Stück auf einer Platte", () => {
    const r = schaetzePlatten([20, 20, 10], 10);
    expect(r.plates).toBe(1);
    expect(r.printer).toBe("H2C");
  });
  it("braucht mehrere Platten, wenn nicht alles passt", () => {
    // 100x100: 2 x 2 = 4 pro Platte (nutzbar 310 x 300)
    expect(schaetzePlatten([100, 100, 20], 5).plates).toBe(2);
    expect(schaetzePlatten([100, 100, 20], 4).plates).toBe(1);
  });
  it("ohne Masse: eine Platte", () => {
    expect(schaetzePlatten(null, 5).plates).toBe(1);
  });
  it("zu gross für H2C: XL", () => {
    const r = schaetzePlatten([380, 380, 50], 2);
    expect(r.printer).toBe("XL");
    expect(r.plates).toBe(2);
  });
  it("zu gross für jeden Drucker: eine Platte pro Stück", () => {
    expect(schaetzePlatten([600, 600, 600], 3).plates).toBe(3);
  });
});
