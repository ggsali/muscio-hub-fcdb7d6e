import jsPDF from "jspdf";
import type { SpardoseParams } from "@/lib/spardose";

// Übersichtsblatt (PDF) für einen Spardose-Auftrag: welche Teile, welche Farbe, welcher Drucker, welche Datei.
export type SheetJob = {
  label: string; hex: string; count: number; min: number; g: number; sup: boolean; printerName: string;
  bed: { x: number; y: number }; rects: { x: number; y: number; w: number; h: number; name: string }[];
  stlName: string; gcodeName?: string;
};
export type SheetInput = {
  params: SpardoseParams; customer: string; email: string; preis: number; jobs: SheetJob[];
  colors: { text: string; base: string; cap: string }; labelOf: (hex: string) => string;
};

const rgb = (hex: string): [number, number, number] => {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const dur = (min: number) => `${Math.floor(min / 60)} h ${Math.round(min % 60)} min`;

export function buildSheet(i: SheetInput): Blob {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210, M = 15;
  let y = M;
  doc.setFont("helvetica", "bold").setFontSize(18).text(`Spardose «${i.params.name}» – Auftragsblatt`, M, y + 6);
  y += 13;
  doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(90);
  doc.text(`Erstellt: ${new Date().toLocaleString("de-CH")}   ·   Kunde: ${i.customer} (${i.email})`, M, y);
  y += 6;
  doc.text(`Material: PLA   ·   Schrift: ${i.params.font}   ·   Richtpreis: CHF ${i.preis.toFixed(2)}`, M, y);
  doc.setTextColor(0);
  y += 8;

  // Farbzuordnung der drei Bauteile
  doc.setFont("helvetica", "bold").setFontSize(12).text("Teile und Farben", M, y); y += 5;
  const rows: [string, string][] = [
    ["Körper (Dose)", i.colors.base], ["Buchstaben (Einlagen)", i.colors.text], ["Kappe (Verschluss)", i.colors.cap],
  ];
  doc.setFont("helvetica", "normal").setFontSize(10);
  for (const [name, hex] of rows) {
    doc.setFillColor(...rgb(hex)).setDrawColor(120).rect(M, y - 3.6, 6, 4.6, "FD");
    doc.text(`${name}: ${i.labelOf(hex)}`, M + 9, y);
    y += 6;
  }
  y += 3;

  // Platten
  i.jobs.forEach((j, idx) => {
    const boxH = 66;
    if (y + boxH > 285) { doc.addPage(); y = M; }
    doc.setDrawColor(180).rect(M, y, W - 2 * M, boxH);
    doc.setFont("helvetica", "bold").setFontSize(12).text(`Platte ${idx + 1} – ${j.label}`, M + 4, y + 7);
    doc.setFillColor(...rgb(j.hex)).setDrawColor(120).rect(W - M - 12, y + 3, 8, 5, "FD");
    doc.setFont("helvetica", "normal").setFontSize(10);
    const lines = [
      `Drucker: ${j.printerName}`,
      `Druckzeit: ${dur(j.min)}   ·   Filament: ${j.g.toFixed(0)} g   ·   Stützen: ${j.sup ? "ja" : "nein"}`,
      `Teile (${j.count}): ${j.rects.map((r) => `${r.name} ${r.w.toFixed(0)}×${r.h.toFixed(0)} mm`).join(", ")}`,
      `Datei (STL): ${j.stlName}`,
      `Datei (G-Code): ${j.gcodeName ?? "nicht gespeichert"}`,
    ];
    let ly = y + 14;
    lines.forEach((l) => { const parts = doc.splitTextToSize(l, 105) as string[]; doc.text(parts, M + 4, ly); ly += 5 * parts.length + 1; });
    // Plattenskizze
    const sx = 52, sy = 52, k = Math.min(sx / j.bed.x, sy / j.bed.y);
    const ox = W - M - 4 - j.bed.x * k, oy = y + 10;
    doc.setDrawColor(100).setFillColor(245, 245, 245).rect(ox, oy, j.bed.x * k, j.bed.y * k, "FD");
    for (const r of j.rects) {
      doc.setFillColor(...rgb(j.hex)).setDrawColor(60).rect(ox + r.x * k, oy + (j.bed.y - r.y - r.h) * k, Math.max(r.w * k, 0.6), Math.max(r.h * k, 0.6), "FD");
    }
    doc.setFontSize(7).setTextColor(110).text(`Bett ${j.bed.x}×${j.bed.y} mm`, ox, oy + j.bed.y * k + 3.5).setTextColor(0);
    y += boxH + 5;
  });

  // Konfiguration
  if (y + 30 > 285) { doc.addPage(); y = M; }
  doc.setFont("helvetica", "bold").setFontSize(12).text("Konfiguration", M, y); y += 5;
  doc.setFont("courier", "normal").setFontSize(7.5);
  (doc.splitTextToSize(JSON.stringify(i.params), W - 2 * M) as string[]).forEach((l) => { doc.text(l, M, y); y += 3.6; });
  return doc.output("blob");
}
