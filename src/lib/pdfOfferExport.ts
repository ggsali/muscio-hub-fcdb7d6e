import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatCHF, Settings } from "./calc";
import { CompanySettings } from "./companySettings";

interface PartRow {
  teilname: string;
  material: string;
  menge: number;
  preis_pro_stueck: number;
  preis_total: number;
}

interface OfferExportData {
  orderId: string;
  datum: string;
  beschreibung: string;
  customerName: string;
  customerFirma?: string;
  customerEmail?: string;
  customerTelefon?: string;
  customerAdresse?: string;
  parts: PartRow[];
  umsatz_total: number;
  settings: Settings;
  company: CompanySettings;
  gueltigBis?: string; // Gültigkeitsdatum
  returnBase64?: boolean;
}

const BLACK   = [30, 30, 30]   as [number, number, number];
const DARK    = [55, 55, 55]   as [number, number, number];
const GRAY    = [120, 120, 120] as [number, number, number];
const LGRAY   = [200, 200, 200] as [number, number, number];
const XLGRAY  = [245, 245, 245] as [number, number, number];
const WHITE   = [255, 255, 255] as [number, number, number];

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  return [parseInt(clean.slice(0,2),16), parseInt(clean.slice(2,4),16), parseInt(clean.slice(4,6),16)];
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
  } catch { return null; }
}

export async function exportOfferPDF(data: OfferExportData) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 18;
  const colR = pageW / 2 + 4;

  const ACCENT = hexToRgb(data.company.primary_color || "#FF5A00");
  const firmenname = data.company.firmenname || "3DMuscio";

  const offerNr = `OF-${data.datum?.replace(/-/g, "")}-${data.orderId.slice(0, 6).toUpperCase()}`;
  const gueltigBis = data.gueltigBis || (() => {
    const d = new Date(data.datum);
    d.setDate(d.getDate() + 30);
    return d.toISOString().split("T")[0];
  })();

  // ── Header links (dunkel) ────────────────────────────────────────
  doc.setFillColor(...BLACK);
  doc.rect(0, 0, pageW / 2 - 4, 68, "F");

  let logoLoaded = false;
  if (data.company.logo_url) {
    const b64 = await loadImageAsBase64(data.company.logo_url);
    if (b64) { doc.addImage(b64, "PNG", margin, 12, 0, 18); logoLoaded = true; }
  }
  if (!logoLoaded) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(...WHITE);
    doc.text(firmenname.toUpperCase(), margin, 24);
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(180, 180, 180);
  let sy = logoLoaded ? 38 : 34;
  if (data.company.adresse) { doc.text(data.company.adresse, margin, sy); sy += 4.5; }
  if (data.company.email)   { doc.text(data.company.email, margin, sy); sy += 4.5; }
  if (data.company.telefon) { doc.text(data.company.telefon, margin, sy); sy += 4.5; }
  if (data.company.website) { doc.text(data.company.website, margin, sy); }

  // ── OFFERTE Titel ────────────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(30);
  doc.setTextColor(...BLACK);
  doc.text("OFFERTE", pageW - margin, 26, { align: "right" });

  // Offertendetails
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...DARK);
  doc.text("Offertendetails", colR, 38);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...GRAY);
  doc.text(`Datum:           ${data.datum}`, colR, 44);
  doc.text(`Offerten-Nr.:    ${offerNr}`, colR, 49);
  doc.text(`Gültig bis:      ${gueltigBis}`, colR, 54);

  // ── Empfänger ───────────────────────────────────────────────────
  doc.setFillColor(...XLGRAY);
  doc.rect(0, 68, pageW / 2 - 4, 42, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  doc.text("ANGEBOT FÜR", margin, 76);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(...BLACK);
  doc.text(data.customerName, margin, 83);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...DARK);
  let cy = 89;
  if (data.customerFirma)   { doc.text(data.customerFirma, margin, cy); cy += 4.5; }
  if (data.customerAdresse) { doc.text(data.customerAdresse, margin, cy); cy += 4.5; }
  if (data.customerEmail)   { doc.text(data.customerEmail, margin, cy); cy += 4.5; }
  if (data.customerTelefon) { doc.text(data.customerTelefon, margin, cy); }

  // ── Beschreibung ─────────────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  doc.text("BESCHREIBUNG / PROJEKT", colR, 76);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...DARK);
  const descLines = doc.splitTextToSize(data.beschreibung || "—", pageW - colR - margin);
  doc.text(descLines.slice(0, 4), colR, 83);

  // ── Positionstabelle ─────────────────────────────────────────────
  autoTable(doc, {
    startY: 118,
    margin: { left: margin, right: margin },
    head: [["Nr.", "Beschreibung", "Material", "Menge", "Preis/St.", "Total"]],
    body: data.parts.map((p, i) => [
      String(i + 1).padStart(2, "0"),
      p.teilname || "—",
      p.material,
      `${p.menge}×`,
      formatCHF(p.preis_pro_stueck),
      formatCHF(p.preis_total),
    ]),
    styles: { fontSize: 8.5, cellPadding: { top: 4, bottom: 4, left: 3, right: 3 }, textColor: DARK },
    headStyles: { fillColor: BLACK, textColor: WHITE, fontStyle: "bold", fontSize: 8 },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      1: { cellWidth: 55 },
      2: { cellWidth: 30 },
      3: { cellWidth: 12, halign: "center" },
      4: { halign: "right" },
      5: { halign: "right", fontStyle: "bold" },
    },
    alternateRowStyles: { fillColor: XLGRAY },
    tableLineColor: LGRAY,
    tableLineWidth: 0.1,
  });

  const afterTable = (doc as any).lastAutoTable.finalY + 6;

  // ── Zusammenfassung ───────────────────────────────────────────────
  const sumW = 70;
  const sumX = pageW - margin - sumW;
  let sumY = afterTable;

  doc.setDrawColor(...LGRAY);
  doc.setLineWidth(0.3);
  doc.line(sumX, sumY, pageW - margin, sumY);
  sumY += 6;

  const sumRows: [string, string][] = [
    ["Zwischensumme", formatCHF(data.umsatz_total)],
    ["MwSt. (0%)", "CHF 0.00"],
  ];
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  sumRows.forEach(([label, val]) => {
    doc.setTextColor(...GRAY);
    doc.text(label, sumX, sumY);
    doc.setTextColor(...DARK);
    doc.text(val, pageW - margin, sumY, { align: "right" });
    sumY += 6;
  });

  sumY += 2;
  doc.setFillColor(...ACCENT);
  doc.rect(sumX, sumY - 4, sumW, 12, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(...WHITE);
  doc.text("ANGEBOTSSUMME", sumX + 3, sumY + 3.5);
  doc.text(formatCHF(data.umsatz_total), pageW - margin - 3, sumY + 3.5, { align: "right" });

  const totalBoxBottom = sumY + 8;

  // ── Zahlungsbedingungen ───────────────────────────────────────────
  const termsY = totalBoxBottom + 8;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...BLACK);
  doc.text("HINWEIS", sumX, termsY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...GRAY);
  const termsText = `Dieses Angebot ist gültig bis ${gueltigBis}. Bei Annahme erstellen wir eine verbindliche Auftragsbestätigung.`;
  const termsLines = doc.splitTextToSize(termsText, pageW - sumX - margin);
  doc.text(termsLines, sumX, termsY + 6);

  // ── Links ──────────────────────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...BLACK);
  doc.text("Vielen Dank!", margin, afterTable + 10);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  doc.text("Wir freuen uns auf Ihre Rückmeldung.", margin, afterTable + 16);

  const hasBank = data.company.bank_iban || data.company.bank_name;
  const bankY = afterTable + 30;
  if (hasBank) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...BLACK);
    doc.text("Kontaktinformationen", margin, bankY);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...GRAY);
    let bl = bankY + 6;
    if (data.company.email)   { doc.text(`E-Mail:    ${data.company.email}`, margin, bl); bl += 4.5; }
    if (data.company.telefon) { doc.text(`Telefon:   ${data.company.telefon}`, margin, bl); bl += 4.5; }
    if (data.company.website) { doc.text(`Web:       ${data.company.website}`, margin, bl); }
  }

  // ── Footer ─────────────────────────────────────────────────────────
  doc.setFillColor(...BLACK);
  doc.rect(0, pageH - 14, pageW, 14, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(160, 160, 160);
  const footParts = [firmenname, data.company.adresse, data.company.email, data.company.website].filter(Boolean);
  doc.text(footParts.join("  |  "), margin, pageH - 5.5);
  doc.text(`Erstellt: ${new Date().toLocaleDateString("de-CH")}`, pageW - margin, pageH - 5.5, { align: "right" });
  doc.setFillColor(...ACCENT);
  doc.rect(0, pageH - 14, pageW, 2, "F");

  const filename = `Offerte_${offerNr}_${data.customerName.replace(/\s+/g, "_")}.pdf`;

  if (data.returnBase64) {
    return { base64: doc.output("datauristring").split(",")[1], filename };
  }
  doc.save(filename);
  return null;
}
