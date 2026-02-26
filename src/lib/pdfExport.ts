import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatCHF, formatPct, Settings } from "./calc";

interface PartRow {
  teilname: string;
  material: string;
  menge: number;
  gewicht_g: number;
  druckzeit_h: number;
  nachbearbeitung_h: number;
  konstruktion_h: number;
  preis_pro_stueck: number;
  preis_total: number;
  status: string;
  notizen: string;
}

interface OrderExportData {
  orderId: string;
  datum: string;
  beschreibung: string;
  status: string;
  customerName: string;
  customerFirma?: string;
  customerEmail?: string;
  customerTelefon?: string;
  customerAdresse?: string;
  parts: PartRow[];
  umsatz_total: number;
  kosten_total: number;
  gewinn_total: number;
  marge: number;
  settings: Settings;
}

const ORANGE = [255, 90, 0] as [number, number, number];
const DARK = [30, 30, 30] as [number, number, number];
const GRAY = [120, 120, 120] as [number, number, number];
const LIGHT_GRAY = [240, 240, 240] as [number, number, number];
const WHITE = [255, 255, 255] as [number, number, number];

export function exportOrderPDF(data: OrderExportData) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 18;
  let y = margin;

  // ── Header bar ──────────────────────────────────────────────────
  doc.setFillColor(...ORANGE);
  doc.rect(0, 0, pageW, 22, "F");

  // Logo text
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...WHITE);
  doc.text("3dMuscio", margin, 14);

  // Subtitle
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Professioneller 3D-Druck | Schweiz", margin, 20);

  // Document title right side
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("AUFTRAGSÜBERSICHT", pageW - margin, 10, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Datum: ${data.datum}`, pageW - margin, 16, { align: "right" });
  doc.text(`Status: ${data.status}`, pageW - margin, 21, { align: "right" });

  y = 32;

  // ── Customer block ───────────────────────────────────────────────
  doc.setFillColor(...LIGHT_GRAY);
  doc.roundedRect(margin, y, pageW / 2 - margin - 4, 34, 2, 2, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...GRAY);
  doc.text("KUNDE", margin + 4, y + 7);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...DARK);
  doc.text(data.customerName, margin + 4, y + 14);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...GRAY);
  let cy = y + 20;
  if (data.customerFirma) { doc.text(data.customerFirma, margin + 4, cy); cy += 5; }
  if (data.customerEmail) { doc.text(data.customerEmail, margin + 4, cy); cy += 5; }
  if (data.customerTelefon) { doc.text(data.customerTelefon, margin + 4, cy); }

  // ── Order info block ─────────────────────────────────────────────
  const infoX = pageW / 2 + 2;
  doc.setFillColor(...LIGHT_GRAY);
  doc.roundedRect(infoX, y, pageW - infoX - margin, 34, 2, 2, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...GRAY);
  doc.text("BESCHREIBUNG", infoX + 4, y + 7);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...DARK);
  const descLines = doc.splitTextToSize(data.beschreibung || "—", pageW - infoX - margin - 8);
  doc.text(descLines.slice(0, 4), infoX + 4, y + 14);

  y += 42;

  // ── Parts table ──────────────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...DARK);
  doc.text("Teile-Liste", margin, y);
  y += 4;

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [["Teilname", "Mat.", "Menge", "Gewicht\n(g)", "Druck\n(h)", "NB\n(h)", "Konstr.\n(h)", "Preis/St.", "Total", "Status"]],
    body: data.parts.map(p => [
      p.teilname || "—",
      p.material,
      p.menge.toString(),
      p.gewicht_g.toFixed(1),
      p.druckzeit_h.toFixed(2),
      p.nachbearbeitung_h.toFixed(2),
      p.konstruktion_h.toFixed(2),
      formatCHF(p.preis_pro_stueck),
      formatCHF(p.preis_total),
      p.status,
    ]),
    styles: { fontSize: 8, cellPadding: 2.5, textColor: DARK },
    headStyles: { fillColor: ORANGE, textColor: WHITE, fontStyle: "bold", halign: "center" },
    columnStyles: {
      0: { cellWidth: 32 },
      7: { halign: "right" },
      8: { halign: "right" },
    },
    alternateRowStyles: { fillColor: [248, 248, 248] as [number, number, number] },
    tableLineColor: [220, 220, 220] as [number, number, number],
    tableLineWidth: 0.2,
  });

  y = (doc as any).lastAutoTable.finalY + 8;

  // ── Summary box ──────────────────────────────────────────────────
  const boxW = 80;
  const boxX = pageW - margin - boxW;

  doc.setFillColor(...DARK);
  doc.roundedRect(boxX, y, boxW, 52, 2, 2, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...ORANGE);
  doc.text("ZUSAMMENFASSUNG", boxX + 4, y + 7);

  const rows = [
    ["Setup-Pauschale:", formatCHF(data.settings.setup_pauschale)],
    ["Meine Kosten:", formatCHF(data.kosten_total)],
  ];
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(180, 180, 180);
  rows.forEach(([label, val], i) => {
    const ry = y + 14 + i * 6;
    doc.text(label, boxX + 4, ry);
    doc.text(val, boxX + boxW - 4, ry, { align: "right" });
  });

  // Divider
  doc.setDrawColor(80, 80, 80);
  doc.line(boxX + 4, y + 26, boxX + boxW - 4, y + 26);

  // Total umsatz
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...ORANGE);
  doc.text("TOTAL UMSATZ:", boxX + 4, y + 33);
  doc.text(formatCHF(data.umsatz_total), boxX + boxW - 4, y + 33, { align: "right" });

  // Gewinn
  doc.setFontSize(9);
  doc.setTextColor(39, 174, 96);
  doc.text("REINGEWINN:", boxX + 4, y + 40);
  doc.text(formatCHF(data.gewinn_total), boxX + boxW - 4, y + 40, { align: "right" });

  // Marge
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(180, 180, 180);
  doc.text("Marge:", boxX + 4, y + 47);
  doc.text(formatPct(data.marge), boxX + boxW - 4, y + 47, { align: "right" });

  // ── Footer ───────────────────────────────────────────────────────
  const pageH = doc.internal.pageSize.getHeight();
  doc.setFillColor(...ORANGE);
  doc.rect(0, pageH - 10, pageW, 10, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...WHITE);
  doc.text("3dMuscio – Professioneller 3D-Druck", margin, pageH - 4);
  doc.text(`Erstellt am ${new Date().toLocaleDateString("de-CH")}`, pageW - margin, pageH - 4, { align: "right" });

  // Save
  const filename = `Auftrag_${data.datum}_${data.customerName.replace(/\s+/g, "_")}.pdf`;
  doc.save(filename);
}
