import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { company } from "@/data/company";

export interface AbrechnungPosition {
  typ: string;
  datum: string | null;
  beschreibung: string | null;
  betrag: number;
}

export interface AbrechnungPdfData {
  nummer: string;
  typ: string;
  zeitraum_von: string;
  zeitraum_bis: string;
  einnahmen_total: number;
  ausgaben_total: number;
  gewinn_total: number;
  mwst_satz: number;
  mwst_betrag: number;
  notizen?: string | null;
  positionen: AbrechnungPosition[];
}

function fmtCHF(n: number) {
  return new Intl.NumberFormat("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);
}
function fmtDate(iso?: string | null) {
  if (!iso) return "";
  return new Date(iso + "T12:00:00").toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** Erzeugt das Abrechnungs-PDF und gibt es als Base64-DataURL zurück */
export function buildAbrechnungPdf(d: AbrechnungPdfData): { doc: jsPDF; base64: string } {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const M = 18;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(30, 30, 30);
  doc.text("ABRECHNUNG", M, 24);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("3DMuscio", pageW - M, 20, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text(
    [`${company.address.street}`, `${company.address.postalCode} ${company.address.city}`, company.email],
    pageW - M, 25, { align: "right" },
  );

  doc.setTextColor(55, 55, 55);
  doc.setFontSize(10);
  doc.text(`Nummer: ${d.nummer}`, M, 34);
  doc.text(`Zeitraum: ${fmtDate(d.zeitraum_von)} – ${fmtDate(d.zeitraum_bis)}`, M, 39);
  doc.text(`Typ: ${d.typ}`, M, 44);

  const gewinnNachMwst = d.gewinn_total - d.mwst_betrag;

  autoTable(doc, {
    startY: 52,
    theme: "grid",
    styles: { fontSize: 10, cellPadding: 2.5 },
    headStyles: { fillColor: [40, 40, 40], textColor: 255 },
    head: [["Zusammenfassung", "CHF"]],
    body: [
      ["Einnahmen", fmtCHF(d.einnahmen_total)],
      ["Ausgaben", `-${fmtCHF(d.ausgaben_total)}`],
      ["Gewinn", fmtCHF(d.gewinn_total)],
      [`MwSt (${d.mwst_satz}%)`, fmtCHF(d.mwst_betrag)],
      ["Gewinn nach MwSt", fmtCHF(gewinnNachMwst)],
    ],
    columnStyles: { 1: { halign: "right" } },
  });

  const y = (doc as any).lastAutoTable.finalY + 8;

  autoTable(doc, {
    startY: y,
    theme: "striped",
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [40, 40, 40], textColor: 255 },
    head: [["Datum", "Typ", "Beschreibung", "Betrag CHF"]],
    body: d.positionen.map(p => [
      fmtDate(p.datum),
      p.typ === "einnahme" ? "Einnahme" : "Ausgabe",
      p.beschreibung || "",
      (p.typ === "ausgabe" ? "-" : "") + fmtCHF(Number(p.betrag || 0)),
    ]),
    foot: [["", "", "Total", fmtCHF(d.gewinn_total)]],
    footStyles: { fillColor: [235, 235, 235], textColor: 30, fontStyle: "bold" },
    columnStyles: { 3: { halign: "right" } },
  });

  let ny = (doc as any).lastAutoTable.finalY + 8;
  if (d.notizen) {
    doc.setFontSize(9);
    doc.setTextColor(55, 55, 55);
    doc.setFont("helvetica", "bold");
    doc.text("Notizen", M, ny);
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(d.notizen, pageW - 2 * M);
    doc.text(lines, M, ny + 5);
    ny += 5 + lines.length * 4;
  }

  doc.setFontSize(8);
  doc.setTextColor(140, 140, 140);
  doc.text(
    `3DMuscio | ${company.address.street}, ${company.address.postalCode} ${company.address.city} ${company.address.regionCode} | ${company.email}`,
    pageW / 2, doc.internal.pageSize.getHeight() - 12, { align: "center" },
  );
  doc.text("Hinweis: MwSt-Angaben bitte beim Treuhänder/Steuerberater prüfen.",
    pageW / 2, doc.internal.pageSize.getHeight() - 8, { align: "center" });

  return { doc, base64: doc.output("datauristring") };
}
