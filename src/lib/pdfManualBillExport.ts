import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { CompanySettings } from "./companySettings";
import { appendQrBill } from "./pdfQrBill";

export interface ManualBillItem {
  beschreibung: string;
  menge: number;
  einheit: string;
  einzelpreis_chf: number;
  gesamtpreis_chf: number;
}

export interface ManualBillData {
  rechnungsnummer: string;
  rechnungs_datum: string; // yyyy-mm-dd
  faellig_am?: string | null;
  betreff?: string;
  empfaenger_name: string;
  empfaenger_firma?: string;
  empfaenger_adresse?: string;
  empfaenger_email?: string;
  items: ManualBillItem[];
  mwst_prozent: number;
  company: CompanySettings;
  returnBase64?: boolean;
}

const BLACK: [number, number, number] = [30, 30, 30];
const DARK: [number, number, number] = [55, 55, 55];
const GRAY: [number, number, number] = [120, 120, 120];
const WHITE: [number, number, number] = [255, 255, 255];
const XLGRAY: [number, number, number] = [245, 245, 245];

function hexToRgb(hex: string): [number, number, number] {
  const c = hex.replace("#", "");
  return [parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16)];
}

function fmtCHF(n: number) {
  return new Intl.NumberFormat("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

function fmtDate(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" });
}

async function loadImageAsBase64(url: string): Promise<string | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 3000);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(t);
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = () => resolve(null);
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function exportManualBillPDF(data: ManualBillData): Promise<string | void> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 18;
  const colR = pageW / 2 + 4;

  const ACCENT = hexToRgb(data.company.primary_color || "#FF5A00");
  const firma = data.company.firmenname || "3DMuscio";

  // ── Header dark ──
  doc.setFillColor(...BLACK);
  doc.rect(0, 0, pageW / 2 - 4, 68, "F");

  let logoLoaded = false;
  if (data.company.logo_url) {
    const b64 = await loadImageAsBase64(data.company.logo_url);
    if (b64) {
      try {
        doc.addImage(b64, "PNG", margin, 12, 0, 18);
        logoLoaded = true;
      } catch { /* ignore */ }
    }
  }
  if (!logoLoaded) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(...WHITE);
    doc.text(firma.toUpperCase(), margin, 24);
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(180, 180, 180);
  let sy = logoLoaded ? 38 : 34;
  if (data.company.email) { doc.text(data.company.email, margin, sy); sy += 4.5; }
  if (data.company.telefon) { doc.text(data.company.telefon, margin, sy); sy += 4.5; }
  if (data.company.website) { doc.text(data.company.website, margin, sy); }

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(30);
  doc.setTextColor(...BLACK);
  doc.text("RECHNUNG", pageW - margin, 26, { align: "right" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...DARK);
  doc.text("Rechnungsdetails", colR, 38);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...GRAY);
  doc.text(`Datum:          ${fmtDate(data.rechnungs_datum)}`, colR, 44);
  doc.text(`Rechnungs-Nr.:  ${data.rechnungsnummer}`, colR, 49);
  if (data.faellig_am) doc.text(`Fällig am:      ${fmtDate(data.faellig_am)}`, colR, 54);

  // Empfänger
  doc.setFillColor(...XLGRAY);
  doc.rect(0, 68, pageW / 2 - 4, 42, "F");
  const empX = margin;
  const empY = 76;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  doc.text("RECHNUNGSEMPFÄNGER", empX, empY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(...BLACK);
  doc.text(data.empfaenger_name || "", empX, empY + 7);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...DARK);
  let cy = empY + 13;
  if (data.empfaenger_firma) {
    data.empfaenger_firma.split("\n").forEach(l => { doc.text(l, empX, cy); cy += 4.5; });
  }
  if (data.empfaenger_adresse) {
    data.empfaenger_adresse.split("\n").forEach(l => { doc.text(l, empX, cy); cy += 4.5; });
  }
  if (data.empfaenger_email) { doc.text(data.empfaenger_email, empX, cy); cy += 4.5; }

  // Betreff
  let startY = 122;
  if (data.betreff) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...BLACK);
    doc.text(data.betreff, margin, startY);
    startY += 8;
  }

  // Positionen-Tabelle
  const zwischensumme = data.items.reduce((s, i) => s + (Number(i.gesamtpreis_chf) || 0), 0);
  const mwstBetrag = zwischensumme * (Number(data.mwst_prozent) || 0) / 100;
  const gesamt = zwischensumme + mwstBetrag;

  autoTable(doc, {
    startY,
    head: [["Beschreibung", "Menge", "Einheit", "Einzelpreis", "Total"]],
    body: data.items.map(i => [
      i.beschreibung || "",
      String(i.menge),
      i.einheit || "",
      `CHF ${fmtCHF(Number(i.einzelpreis_chf) || 0)}`,
      `CHF ${fmtCHF(Number(i.gesamtpreis_chf) || 0)}`,
    ]),
    theme: "plain",
    styles: { fontSize: 9, cellPadding: 3, textColor: DARK },
    headStyles: { fillColor: ACCENT, textColor: WHITE, fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: "auto" },
      1: { halign: "right", cellWidth: 18 },
      2: { cellWidth: 18 },
      3: { halign: "right", cellWidth: 28 },
      4: { halign: "right", cellWidth: 28 },
    },
    margin: { left: margin, right: margin },
  });

  const afterY = (doc as any).lastAutoTable.finalY + 6;
  const totalsX = pageW - margin - 70;
  const valX = pageW - margin;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...DARK);

  let ty = afterY;
  doc.text("Zwischensumme", totalsX, ty);
  doc.text(`CHF ${fmtCHF(zwischensumme)}`, valX, ty, { align: "right" });
  ty += 5;

  if (data.mwst_prozent > 0) {
    doc.text(`MwSt (${data.mwst_prozent}%)`, totalsX, ty);
    doc.text(`CHF ${fmtCHF(mwstBetrag)}`, valX, ty, { align: "right" });
    ty += 5;
  }

  doc.setDrawColor(...GRAY);
  doc.line(totalsX, ty, valX, ty);
  ty += 5;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...BLACK);
  doc.text("Gesamtbetrag", totalsX, ty);
  doc.text(`CHF ${fmtCHF(gesamt)}`, valX, ty, { align: "right" });

  // Zahlungsbedingungen
  if (data.company.zahlungsbedingungen) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...GRAY);
    doc.text(data.company.zahlungsbedingungen, margin, ty + 15, { maxWidth: pageW - 2 * margin });
  }

  // QR-Bill Seite
  await appendQrBill(doc, {
    company: data.company,
    customerName: data.empfaenger_name || "",
    customerAdresse: data.empfaenger_adresse || "",
    amount: gesamt,
    currency: "CHF",
    invoiceNr: data.rechnungsnummer,
  });

  if (data.returnBase64) {
    return doc.output("datauristring");
  }

  const filename = `Rechnung_${data.rechnungsnummer}.pdf`;
  doc.save(filename);
}
