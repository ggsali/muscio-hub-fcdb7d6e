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

const ACCENT: [number, number, number] = [22, 163, 74];

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
  const pageH = doc.internal.pageSize.getHeight();
  const M = 18;

  // Header: Firma links, ABRECHNUNG rechts
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(25, 25, 25);
  doc.text("3DMuscio", M, 22);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(120, 120, 120);
  doc.text(
    [`${company.address.street}`, `${company.address.postalCode} ${company.address.city}`, company.email],
    M, 27,
  );

  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(25, 25, 25);
  doc.text("ABRECHNUNG", pageW - M, 24, { align: "right" });

  // Grüne Akzentlinie
  doc.setDrawColor(ACCENT[0], ACCENT[1], ACCENT[2]);
  doc.setLineWidth(1);
  doc.line(M, 41, pageW - M, 41);

  // Metadaten
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(55, 55, 55);
  doc.text(`Nummer: ${d.nummer}`, M, 50);
  doc.text(`Typ: ${d.typ}`, M, 55.5);
  doc.text(`Zeitraum: ${fmtDate(d.zeitraum_von)} – ${fmtDate(d.zeitraum_bis)}`, pageW - M, 50, { align: "right" });
  doc.text(`Erstellt: ${new Date().toLocaleDateString("de-CH")}`, pageW - M, 55.5, { align: "right" });

  const gewinnNachMwst = d.gewinn_total - d.mwst_betrag;

  // Zusammenfassungs-Box
  autoTable(doc, {
    startY: 64,
    theme: "plain",
    styles: { fontSize: 10, cellPadding: 3, textColor: [45, 45, 45] },
    headStyles: { fillColor: ACCENT, textColor: 255, fontStyle: "bold" },
    head: [["Zusammenfassung", "CHF"]],
    body: [
      ["Einnahmen", fmtCHF(d.einnahmen_total)],
      ["Ausgaben", `-${fmtCHF(d.ausgaben_total)}`],
      ["Gewinn", fmtCHF(d.gewinn_total)],
      [`MwSt (${d.mwst_satz}%)`, fmtCHF(d.mwst_betrag)],
    ],
    foot: [["Gewinn nach MwSt", fmtCHF(gewinnNachMwst)]],
    footStyles: { fillColor: [240, 245, 241], textColor: 25, fontStyle: "bold", fontSize: 11 },
    columnStyles: { 1: { halign: "right" } },
    margin: { left: M, right: M },
    tableLineColor: [225, 225, 225],
    tableLineWidth: 0.2,
  });

  const y = (doc as any).lastAutoTable.finalY + 10;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(25, 25, 25);
  doc.text("Positionen", M, y);

  // Positionstabelle mit abwechselnden Zeilenfarben
  autoTable(doc, {
    startY: y + 3,
    theme: "striped",
    styles: { fontSize: 9, cellPadding: 2.2, textColor: [50, 50, 50] },
    headStyles: { fillColor: [38, 38, 38], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [246, 248, 246] },
    head: [["Datum", "Typ", "Beschreibung", "Betrag CHF"]],
    body: d.positionen.map(p => [
      fmtDate(p.datum),
      p.typ === "einnahme" ? "Einnahme" : "Ausgabe",
      p.beschreibung || "",
      (p.typ === "ausgabe" ? "-" : "") + fmtCHF(Number(p.betrag || 0)),
    ]),
    foot: [["", "", "Total", fmtCHF(d.gewinn_total)]],
    footStyles: { fillColor: [240, 245, 241], textColor: 25, fontStyle: "bold" },
    columnStyles: { 0: { cellWidth: 24 }, 1: { cellWidth: 24 }, 3: { halign: "right", cellWidth: 30 } },
    margin: { left: M, right: M, bottom: 24 },
  });

  let ny = (doc as any).lastAutoTable.finalY + 10;
  if (d.notizen) {
    if (ny > pageH - 40) { doc.addPage(); ny = 30; }
    doc.setFontSize(10);
    doc.setTextColor(25, 25, 25);
    doc.setFont("helvetica", "bold");
    doc.text("Notizen", M, ny);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(70, 70, 70);
    const lines = doc.splitTextToSize(d.notizen, pageW - 2 * M);
    doc.text(lines, M, ny + 5);
  }

  // Footer + Seitenzahlen
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setDrawColor(ACCENT[0], ACCENT[1], ACCENT[2]);
    doc.setLineWidth(0.5);
    doc.line(M, pageH - 18, pageW - M, pageH - 18);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(140, 140, 140);
    doc.text(
      `3DMuscio | ${company.address.street}, ${company.address.postalCode} ${company.address.city} ${company.address.regionCode} | ${company.email} | www.3dmuscio.com`,
      pageW / 2, pageH - 13, { align: "center" },
    );
    doc.text("Hinweis: MwSt-Angaben bitte beim Treuhänder/Steuerberater prüfen.", pageW / 2, pageH - 9, { align: "center" });
    doc.text(`Seite ${i} / ${total}`, pageW - M, pageH - 9, { align: "right" });
  }

  return { doc, base64: doc.output("datauristring") };
}
