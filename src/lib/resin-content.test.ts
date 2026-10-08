import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { filterResinData, isResinText, parseResinEnabled, stripResin } from "./resin-content";

describe("public resin visibility", () => {
  it("keeps the default enabled and respects both stored boolean formats", () => {
    expect(parseResinEnabled(undefined)).toBe(true);
    expect(parseResinEnabled(true)).toBe(true);
    expect(parseResinEnabled(false)).toBe(false);
    expect(parseResinEnabled({ aktiv: false })).toBe(false);
  });
  it("keeps FDM copy without hidden process names", () => {
    const copy = stripResin("Einzelteile im FDM- und SLA/Resin-Verfahren. Material: PLA, PETG und Resin.");
    expect(copy).toContain("FDM-Verfahren");
    expect(isResinText(copy)).toBe(false);
  });
  it("drops dedicated offers, FAQ questions and links from structured data", () => {
    const data = filterResinData({ offers: [{ itemOffered: { name: "SLA Resin Druck" } }, { itemOffered: { name: "FDM Druck" } }], faq: [{ name: "Was ist SLA?" }], links: [{ url: "/materialien/resin" }] });
    expect(isResinText(JSON.stringify(data))).toBe(false);
    expect(JSON.stringify(data)).toContain("FDM Druck");
  });
  it("cleans both bundled AI manifests without changing their enabled sources", () => {
    for (const file of ["llms.txt", "llms-full.txt"]) {
      const source = readFileSync(`src/data/${file}`, "utf8");
      expect(isResinText(source)).toBe(true);
      expect(isResinText(stripResin(source))).toBe(false);
    }
  });
  it("removes dedicated sitemap URLs while preserving FDM", () => {
    const source = readFileSync("src/data/sitemap.xml", "utf8");
    const cleaned = source.replace(/<url>[\s\S]*?<\/url>/g, (entry) => isResinText(entry) ? "" : entry);
    expect(isResinText(cleaned)).toBe(false);
    expect(cleaned).toContain("/leistungen/fdm-3d-druck");
  });
});