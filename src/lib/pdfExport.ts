import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatCHF, formatPct, Settings } from "./calc";
import { CompanySettings } from "./companySettings";

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
  company: CompanySettings;
}

const DARK = [30, 30, 30] as [number, number, number];
const GRAY = [120, 120, 120] as [number, number, number];
const LIGHT_GRAY = [240, 240, 240] as [number, number, number];
const WHITE = [255, 255, 255] as [number, number, number];

function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}

async function loadImageAsBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function exportOrderPDF(data: OrderExportData) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 18;
  let y = margin;

  const ACCENT = hexToRgb(data.company.primary_color || "#FF5A00");
  const firmenname = data.company.firmenname || "3dMuscio";
  const slogan = data.company.slogan || "Professioneller 3D-Druck | Schweiz";

  // ── Header bar ──────────────────────────────────────────────────
  doc.setFillColor(...ACCENT);
  doc.rect(0, 0, pageW, 22, "F");

  // Logo or text
  if (data.company.logo_url) {
    const b64 = await loadImageAsBase64(data.company.logo_url);
    if (b64) {
      doc.addImage(b64, "PNG", margin, 3, 0, 16);
    } else {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.setTextColor(...WHITE);
      doc.text(firmenname, margin, 14);
    }
  } else {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(...WHITE);
    doc.text(firmenname, margin, 14);
  }

  // Slogan below logo/name
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...WHITE);
  doc.text(slogan, margin, 20);

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
    headStyles: { fillColor: ACCENT, textColor: WHITE, fontStyle: "bold", halign: "center" },
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

  // ── Summary box – nur Finalpreis ─────────────────────────────────
  const boxW = 80;
  const boxX = pageW - margin - boxW;

  doc.setFillColor(...DARK);
  doc.roundedRect(boxX, y, boxW, 22, 2, 2, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...ACCENT);
  doc.text("RECHNUNGSBETRAG", boxX + 4, y + 8);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...WHITE);
  doc.text(formatCHF(data.umsatz_total), boxX + boxW - 4, y + 17, { align: "right" });


  // ── Bank info (if available) ─────────────────────────────────────
  const hasBank = data.company.bank_iban || data.company.bank_name;
  if (hasBank) {
    const bankY = y + 8;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...GRAY);
    doc.text("BANKVERBINDUNG", margin, bankY);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...DARK);
    let bLine = bankY + 6;
    if (data.company.bank_inhaber) { doc.text(`Inhaber: ${data.company.bank_inhaber}`, margin, bLine); bLine += 5; }
    if (data.company.bank_iban) { doc.text(`IBAN: ${data.company.bank_iban}`, margin, bLine); bLine += 5; }
    if (data.company.bank_name) { doc.text(`Bank: ${data.company.bank_name}`, margin, bLine); }
  }

  // ── Firma info ───────────────────────────────────────────────────
  if (data.company.uid_nummer) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...GRAY);
    doc.text(`MwSt./UID: ${data.company.uid_nummer}`, margin, y + 42);
  }

  // ── Footer ───────────────────────────────────────────────────────
  const pageH = doc.internal.pageSize.getHeight();
  doc.setFillColor(...ACCENT);
  doc.rect(0, pageH - 10, pageW, 10, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...WHITE);
  const footerLeft = [firmenname, data.company.adresse, data.company.email, data.company.website].filter(Boolean).join(" | ");
  doc.text(footerLeft || firmenname, margin, pageH - 4);
  doc.text(`Erstellt am ${new Date().toLocaleDateString("de-CH")}`, pageW - margin, pageH - 4, { align: "right" });

  const filename = `Auftrag_${data.datum}_${data.customerName.replace(/\s+/g, "_")}.pdf`;
  doc.save(filename);
}
