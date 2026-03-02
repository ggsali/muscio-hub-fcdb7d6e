import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatCHF, Settings } from "./calc";
import { CompanySettings } from "./companySettings";
import { appendQrBill } from "./pdfQrBill";

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
  returnBase64?: boolean;
}

const BLACK = [30, 30, 30] as [number, number, number];
const DARK = [55, 55, 55] as [number, number, number];
const GRAY = [120, 120, 120] as [number, number, number];
const LGRAY = [200, 200, 200] as [number, number, number];
const XLGRAY = [245, 245, 245] as [number, number, number];
const WHITE = [255, 255, 255] as [number, number, number];

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  return [parseInt(clean.slice(0, 2), 16), parseInt(clean.slice(2, 4), 16), parseInt(clean.slice(4, 6), 16)];
}

async function loadImageAsBase64(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    const blob = await res.blob();
    return new Promise((resolve) => {
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
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 18;
  const colR = pageW / 2 + 4; // rechte Spalte X-Start

  const ACCENT = hexToRgb(data.company.primary_color || "#FF5A00");
  const firmenname = data.company.firmenname || "3DMuscio";

  // Rechnungsnummer generieren
  const rechnungsNr = `RE-${data.datum?.replace(/-/g, "")}-${data.orderId.slice(0, 6).toUpperCase()}`;

  // ── Linke dunkel Spalte (Kopf) ─────────────────────────────────
  doc.setFillColor(...BLACK);
  doc.rect(0, 0, pageW / 2 - 4, 68, "F");

  // Logo oder Firmenname
  let logoLoaded = false;
  if (data.company.logo_url) {
    const b64 = await loadImageAsBase64(data.company.logo_url);
    if (b64) {
      doc.addImage(b64, "PNG", margin, 12, 0, 18);
      logoLoaded = true;
    }
  }
  if (!logoLoaded) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(...WHITE);
    doc.text(firmenname.toUpperCase(), margin, 24);
  }

  // Absender-Infos unter Logo
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(180, 180, 180);
  let sy = logoLoaded ? 38 : 34;
  if (data.company.email) {
    doc.text(data.company.email, margin, sy);
    sy += 4.5;
  }
  if (data.company.telefon) {
    doc.text(data.company.telefon, margin, sy);
    sy += 4.5;
  }
  if (data.company.website) {
    doc.text(data.company.website, margin, sy);
  }

  // ── Rechts: RECHNUNG Titel ──────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(30);
  doc.setTextColor(...BLACK);
  doc.text("RECHNUNG", pageW - margin, 26, { align: "right" });

  // Rechnungsdetails
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...DARK);
  doc.text("Rechnungsdetails", colR, 38);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...GRAY);
  const datumFormatted = data.datum
    ? new Date(data.datum + "T12:00:00").toLocaleDateString("de-CH", { day: "2-digit", month: "long", year: "numeric" })
    : "";
  doc.text(`Datum:          ${datumFormatted}`, colR, 44);
  doc.text(`Rechnungs-Nr.:  ${rechnungsNr}`, colR, 49);
  doc.text(`Status:         ${data.status}`, colR, 54);

  // ── Rechnungsempfänger ──────────────────────────────────────────
  const empX = margin;
  const empY = 76;

  doc.setFillColor(...XLGRAY);
  doc.rect(0, 68, pageW / 2 - 4, 42, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  doc.text("RECHNUNGSEMPFÄNGER", empX, empY);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(...BLACK);
  doc.text(data.customerName, empX, empY + 7);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...DARK);
  let cy = empY + 13;
  if (data.customerFirma) {
    data.customerFirma.split("\n").forEach(line => {
      doc.text(line, empX, cy);
      cy += 4.5;
    });
  }
  if (data.customerAdresse) {
    data.customerAdresse.split("\n").forEach(line => {
      doc.text(line, empX, cy);
      cy += 4.5;
    });
  }
  if (data.customerEmail) {
    doc.text(data.customerEmail, empX, cy);
    cy += 4.5;
  }
  if (data.customerTelefon) {
    doc.text(data.customerTelefon, empX, cy);
  }

  // ── Rechts: Beschreibung ────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  doc.text("BESCHREIBUNG / PROJEKT", colR, 76);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...DARK);
  const descLines = doc.splitTextToSize(data.beschreibung || "—", pageW - colR - margin);
  doc.text(descLines.slice(0, 4), colR, 83);

  // ── Positions-Tabelle ───────────────────────────────────────────
  const tableY = 118;

  autoTable(doc, {
    startY: tableY,
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
    styles: {
      fontSize: 8.5,
      cellPadding: { top: 4, bottom: 4, left: 3, right: 3 },
      textColor: DARK,
    },
    headStyles: {
      fillColor: BLACK,
      textColor: WHITE,
      fontStyle: "bold",
      fontSize: 8,
    },
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

  // ── Zusammenfassung rechts ──────────────────────────────────────
  const sumW = 70;
  const sumX = pageW - margin - sumW;
  let sumY = afterTable;

  // Trennlinie
  doc.setDrawColor(...LGRAY);
  doc.setLineWidth(0.3);
  doc.line(sumX, sumY, pageW - margin, sumY);
  sumY += 6;

  // Zeilen
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

  // Grand Total Box
  sumY += 2;
  doc.setFillColor(...BLACK);
  doc.rect(sumX, sumY - 4, sumW, 12, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(...WHITE);
  doc.text("GESAMTBETRAG", sumX + 3, sumY + 3.5);
  doc.text(formatCHF(data.umsatz_total), pageW - margin - 3, sumY + 3.5, { align: "right" });

  // Grand Total box bottom edge
  const totalBoxBottom = sumY + 8; // sumY - 4 + 12

  // ── Zahlungsbedingungen unter Gesamtbetrag ──────────────────────
  const termsY = totalBoxBottom + 8;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...BLACK);
  doc.text("ZAHLUNGSBEDINGUNGEN", sumX, termsY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...GRAY);
  const termsText =
    data.company.zahlungsbedingungen ||
    "Zahlung fällig innerhalb von 30 Tagen nach Rechnungsdatum. Bei Fragen stehen wir Ihnen gerne zur Verfügung.";
  const termsLines = doc.splitTextToSize(termsText, pageW - sumX - margin);
  doc.text(termsLines, sumX, termsY + 6);

  // ── Dankeszeile links ───────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...BLACK);
  doc.text("Vielen Dank!", margin, afterTable + 10);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  doc.text("Wir schätzen Ihr Vertrauen.", margin, afterTable + 16);

  // UID
  if (data.company.uid_nummer) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...GRAY);
    doc.text(`UID: ${data.company.uid_nummer}`, margin, afterTable + 22);
  }

  // ── Fusszeile ───────────────────────────────────────────────────
  doc.setFillColor(...BLACK);
  doc.rect(0, pageH - 14, pageW, 14, "F");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(160, 160, 160);
  const footParts = [firmenname, data.company.adresse, data.company.email, data.company.website].filter(Boolean);
  doc.text(footParts.join("  |  "), margin, pageH - 5.5);
  doc.text(
    `Erstellt: ${new Date().toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" })}`,
    pageW - margin,
    pageH - 5.5,
    { align: "right" },
  );

  // Akzentlinie oben auf Footer
  doc.setFillColor(...ACCENT);
  doc.rect(0, pageH - 14, pageW, 2, "F");

  const filename = `Rechnung_${rechnungsNr}_${data.customerName.replace(/\s+/g, "_")}.pdf`;

  // ── Seite 2: Einzahlungsschein ──────────────────────────────────────────
  if (data.company.qr_bill_image_url) {
    const qrImg = await loadImageAsBase64(data.company.qr_bill_image_url);
    if (qrImg) {
      doc.addPage();
      const pw = doc.internal.pageSize.getWidth();
      const ph = doc.internal.pageSize.getHeight();
      doc.addImage(qrImg, "PNG", 0, 0, pw, ph);
    }
  } else {
    await appendQrBill(doc, {
      company: data.company,
      customerName: data.customerName,
      customerAdresse: data.customerAdresse,
      amount: data.umsatz_total,
      invoiceNr: rechnungsNr,
    });
  }

  if (data.returnBase64) return { base64: doc.output("datauristring").split(",")[1], filename };
  doc.save(filename);
}
