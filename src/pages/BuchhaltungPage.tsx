import React, { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Pencil, Trash2, Check, X, Plus, FileSpreadsheet, FileDown, ArrowUp, ArrowDown, Camera, ReceiptText, RefreshCw } from "lucide-react";
import BelegScanDialog from "@/components/BelegScanDialog";
import { cn } from "@/lib/utils";

type Kategorie =
  | "einnahmen" | "div_aufwaende" | "personalaufwand" | "raumaufwand"
  | "unterhalt" | "versicherungen" | "buero" | "abschreibungen";

interface Buchung {
  id: string;
  jahr: number;
  datum: string | null;
  text: string | null;
  beleg: string | null;
  beleg_url: string | null;
  beleg_storage_path: string | null;
  einnahmen: number | null;
  ausgaben: number | null;
  kategorie: Kategorie;
}

interface Anlage {
  id: string;
  jahr: number;
  konto: string;
  anfangsbestand: number | null;
  zugaenge: number | null;
  abgaenge: number | null;
  abschreibungen_chf: number | null;
  abschreibungen_pct: number | null;
}

const KATEGORIEN: { key: Kategorie; label: string }[] = [
  { key: "einnahmen", label: "Einnahmen" },
  { key: "div_aufwaende", label: "Div. Aufwände" },
  { key: "personalaufwand", label: "Personalaufwand" },
  { key: "raumaufwand", label: "Raumaufwand / Miete" },
  { key: "unterhalt", label: "Unterhalt & Fahrzeug" },
  { key: "versicherungen", label: "Versicherungen & Gebühren" },
  { key: "buero", label: "Büro & Verwaltung" },
  { key: "abschreibungen", label: "Abschreibungen" },
];

const JAHRE = [2023, 2024, 2025, 2026];
const STANDARD_KONTEN = ["Mobiliar & Betriebseinrichtungen", "EDV-Anlage / 3D-Drucker"];

const n = (v: unknown) => Number(v ?? 0) || 0;

export function fmtCHF(value: number): string {
  const neg = value < 0;
  const abs = Math.abs(value).toFixed(2);
  const [int, dec] = abs.split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, "'");
  return `${neg ? "-" : ""}${grouped}.${dec}`;
}

const Num: React.FC<{ value: number; className?: string; colored?: boolean; bold?: boolean }> = ({ value, className, colored, bold }) => (
  <span className={cn(
    "tabular-nums",
    bold && "font-semibold",
    colored && (value < 0 ? "text-destructive" : "text-emerald-600 dark:text-emerald-400"),
    !colored && value < 0 && "text-destructive",
    className,
  )}>
    {fmtCHF(value)}
  </span>
);

type TabKey = "rekap" | Kategorie | "anlagen" | "export";

const TABS: { key: TabKey; label: string }[] = [
  { key: "rekap", label: "Rekapitulation" },
  ...KATEGORIEN.map(k => ({ key: k.key as TabKey, label: k.label })),
  { key: "anlagen", label: "Anlagevermögen" },
  { key: "export", label: "Export" },
];

interface DraftBuchung { datum: string; text: string; beleg: string; einnahmen: string; ausgaben: string }

const heute = () => new Date().toISOString().slice(0, 10);

export default function BuchhaltungPage() {
  const [jahr, setJahr] = useState<number>(new Date().getFullYear());
  const [tab, setTab] = useState<TabKey>("rekap");
  const [buchungen, setBuchungen] = useState<Buchung[]>([]);
  const [anlagen, setAnlagen] = useState<Anlage[]>([]);
  const [loading, setLoading] = useState(true);

  const [editId, setEditId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftBuchung | null>(null);
  const [scanKategorie, setScanKategorie] = useState<Kategorie | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [syncBusy, setSyncBusy] = useState(false);
  const [pendingSync, setPendingSync] = useState<number | null>(null);

  const syncableOrders = useCallback(async () => {
    const { data: orders } = await supabase
      .from("orders")
      .select("id, name, beschreibung, datum, created_at, umsatz_total, status")
      .in("status", ["Bezahlt", "Abgeschlossen"]);
    const list = (orders ?? []).filter(o => {
      const d = (o.datum || o.created_at || "").slice(0, 10);
      return d.startsWith(String(jahr));
    });
    const vorhanden = new Set(
      buchungen.filter(b => b.kategorie === "einnahmen" && b.beleg).map(b => b.beleg as string)
    );
    return list.filter(o => !vorhanden.has(o.id.slice(0, 8)));
  }, [buchungen, jahr]);

  useEffect(() => {
    if (tab !== "einnahmen" || loading) { setPendingSync(null); return; }
    let alive = true;
    void syncableOrders().then(list => { if (alive) setPendingSync(list.length); });
    return () => { alive = false; };
  }, [tab, loading, syncableOrders]);

  const syncEinnahmen = async () => {
    setSyncBusy(true);
    try {
      const offene = await syncableOrders();
      if (offene.length === 0) {
        toast("Alles aktuell — 0 neue Einnahmen");
        return;
      }
      const rows = offene.map(o => ({
        jahr,
        datum: (o.datum || o.created_at || "").slice(0, 10) || null,
        text: o.name || o.beschreibung || `Auftrag ${o.id.slice(0, 8)}`,
        beleg: o.id.slice(0, 8),
        einnahmen: n(o.umsatz_total),
        ausgaben: 0,
        kategorie: "einnahmen" as const,
      }));
      const { error } = await supabase.from("ear_buchungen").insert(rows);
      if (error) throw error;
      toast.success(`${rows.length} Einnahmen synchronisiert`);
      await load();
    } catch (e: any) {
      toast.error("Synchronisation fehlgeschlagen", { description: e?.message });
    } finally {
      setSyncBusy(false);
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: b }, { data: a }] = await Promise.all([
      supabase.from("ear_buchungen").select("*").in("jahr", [jahr, jahr - 1]),
      supabase.from("ear_anlagevermoegen").select("*").eq("jahr", jahr).order("created_at"),
    ]);
    setBuchungen((b as Buchung[]) ?? []);
    setAnlagen((a as Anlage[]) ?? []);
    setLoading(false);
  }, [jahr]);

  useEffect(() => { void load(); }, [load]);

  // Standard-Konten beim ersten Laden eines Jahres anlegen
  useEffect(() => {
    if (loading || anlagen.length > 0) return;
    (async () => {
      const { data } = await supabase.from("ear_anlagevermoegen")
        .insert(STANDARD_KONTEN.map(konto => ({ jahr, konto })))
        .select("*");
      if (data) setAnlagen(data as Anlage[]);
    })();
  }, [loading, anlagen.length, jahr]);

  const sumFor = useCallback((j: number, kategorie: Kategorie, feld: "einnahmen" | "ausgaben") =>
    buchungen.filter(b => b.jahr === j && b.kategorie === kategorie)
      .reduce((s, b) => s + n(b[feld]), 0), [buchungen]);

  const rekap = useCallback((j: number) => {
    const einnahmen = sumFor(j, "einnahmen", "einnahmen");
    const waren = sumFor(j, "div_aufwaende", "ausgaben");
    const personal = sumFor(j, "personalaufwand", "ausgaben");
    const raum = sumFor(j, "raumaufwand", "ausgaben");
    const unterhalt = sumFor(j, "unterhalt", "ausgaben");
    const versicherungen = sumFor(j, "versicherungen", "ausgaben");
    const buero = sumFor(j, "buero", "ausgaben");
    const abschreibungen = sumFor(j, "abschreibungen", "ausgaben");
    const uebrig = raum + unterhalt + versicherungen + buero;
    const bg1 = einnahmen - waren;
    const bg2 = bg1 - personal;
    const ergebnis = bg2 - uebrig - abschreibungen;
    const aufwandTotal = waren + personal + uebrig + abschreibungen;
    return { einnahmen, waren, personal, raum, unterhalt, versicherungen, buero, abschreibungen, uebrig, bg1, bg2, ergebnis, aufwandTotal };
  }, [sumFor]);

  const cur = useMemo(() => rekap(jahr), [rekap, jahr]);
  const prev = useMemo(() => rekap(jahr - 1), [rekap, jahr]);
  const veraenderung = cur.ergebnis - prev.ergebnis;

  const rowsFor = useCallback((kategorie: Kategorie) => {
    const rows = buchungen.filter(b => b.jahr === jahr && b.kategorie === kategorie)
      .sort((x, y) => (x.datum ?? "").localeCompare(y.datum ?? ""));
    let saldo = 0;
    return rows.map(r => {
      saldo += n(r.einnahmen) - n(r.ausgaben);
      return { ...r, saldo };
    });
  }, [buchungen, jahr]);

  const startNew = (kategorie: Kategorie) => {
    setEditId("new");
    setDraft({ datum: heute(), text: "", beleg: "", einnahmen: "", ausgaben: "" });
    void kategorie;
  };

  const startEdit = (b: Buchung) => {
    setEditId(b.id);
    setDraft({
      datum: b.datum ?? heute(),
      text: b.text ?? "",
      beleg: b.beleg ?? "",
      einnahmen: b.einnahmen ? String(b.einnahmen) : "",
      ausgaben: b.ausgaben ? String(b.ausgaben) : "",
    });
  };

  const cancelEdit = () => { setEditId(null); setDraft(null); };

  const saveDraft = async (kategorie: Kategorie) => {
    if (!draft) return;
    if (!draft.text.trim()) { toast.error("Text ist ein Pflichtfeld"); return; }
    const payload = {
      jahr,
      kategorie,
      datum: draft.datum || null,
      text: draft.text.trim(),
      beleg: draft.beleg.trim() || null,
      einnahmen: kategorie === "einnahmen" ? Number(draft.einnahmen || 0) : 0,
      ausgaben: Number(draft.ausgaben || 0),
    };
    if (editId === "new") {
      const { error } = await supabase.from("ear_buchungen").insert(payload);
      if (error) { toast.error("Speichern fehlgeschlagen"); return; }
      toast.success("Eintrag hinzugefügt");
    } else if (editId) {
      const { error } = await supabase.from("ear_buchungen").update(payload).eq("id", editId);
      if (error) { toast.error("Speichern fehlgeschlagen"); return; }
      toast.success("Eintrag gespeichert");
    }
    cancelEdit();
    await load();
  };

  const deleteBuchung = async (id: string) => {
    const { error } = await supabase.from("ear_buchungen").delete().eq("id", id);
    if (error) { toast.error("Löschen fehlgeschlagen"); return; }
    toast.success("Eintrag gelöscht");
    await load();
  };

  const updateAnlage = async (id: string, field: keyof Anlage, value: string) => {
    const val = field === "konto" ? value : Number(value || 0);
    setAnlagen(prevA => prevA.map(a => a.id === id ? { ...a, [field]: val } as Anlage : a));
    const patch = { [field]: val } as unknown as Partial<Anlage>;
    await supabase.from("ear_anlagevermoegen").update(patch).eq("id", id);
  };

  const addAnlage = async () => {
    const { data, error } = await supabase.from("ear_anlagevermoegen").insert({ jahr, konto: "Neues Konto" }).select("*").single();
    if (error || !data) { toast.error("Konto konnte nicht angelegt werden"); return; }
    setAnlagen(prevA => [...prevA, data as Anlage]);
  };

  const deleteAnlage = async (id: string) => {
    await supabase.from("ear_anlagevermoegen").delete().eq("id", id);
    setAnlagen(prevA => prevA.filter(a => a.id !== id));
  };

  const anlagenRows = anlagen.map(a => {
    const vor = n(a.anfangsbestand) + n(a.zugaenge) - n(a.abgaenge);
    return { ...a, vor, nach: vor - n(a.abschreibungen_chf) };
  });
  const anlagenTotal = anlagenRows.reduce((t, r) => ({
    anfangsbestand: t.anfangsbestand + n(r.anfangsbestand),
    zugaenge: t.zugaenge + n(r.zugaenge),
    abgaenge: t.abgaenge + n(r.abgaenge),
    vor: t.vor + r.vor,
    abschreibungen_chf: t.abschreibungen_chf + n(r.abschreibungen_chf),
    nach: t.nach + r.nach,
  }), { anfangsbestand: 0, zugaenge: 0, abgaenge: 0, vor: 0, abschreibungen_chf: 0, nach: 0 });

  // ---------- Exporte ----------
  const rekapRows = (): (string | number)[][] => [
    ["Erfolgsrechnung", String(jahr), String(jahr - 1)],
    ["EINNAHMEN", "", ""],
    ["Total Einnahmen", cur.einnahmen, prev.einnahmen],
    ["WARENAUFWAND", "", ""],
    ["Div. Aufwände", cur.waren, prev.waren],
    ["Total Warenaufwand", cur.waren, prev.waren],
    ["Bruttogewinn I", cur.bg1, prev.bg1],
    ["PERSONALAUFWAND", "", ""],
    ["Personalaufwand", cur.personal, prev.personal],
    ["Total Personalaufwand", cur.personal, prev.personal],
    ["Bruttogewinn II", cur.bg2, prev.bg2],
    ["ÜBRIGER BETRIEBSAUFWAND", "", ""],
    ["Miete / Raumaufwand", cur.raum, prev.raum],
    ["Unterhalt & Fahrzeug", cur.unterhalt, prev.unterhalt],
    ["Versicherungen & Gebühren", cur.versicherungen, prev.versicherungen],
    ["Büro & Verwaltungsaufwand", cur.buero, prev.buero],
    ["Total Übriger Betriebsaufwand", cur.uebrig, prev.uebrig],
    ["ABSCHREIBUNGEN", "", ""],
    ["Abschreibungen", cur.abschreibungen, prev.abschreibungen],
    ["Total Abschreibungen", cur.abschreibungen, prev.abschreibungen],
    ["UNTERNEHMENSERGEBNIS", cur.ergebnis, prev.ergebnis],
  ];

  const exportExcel = async () => {
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ["Einnahmen-/Ausgabenrechnung"],
      ["3DMuscio – Jorim Moos"],
      ["8734 Eschlikon TG"],
      [],
      ["Geschäftsjahr", jahr],
      ["Erstellt am", heute()],
    ]), "Deckblatt");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rekapRows()), "Rekapitulation");
    for (const k of KATEGORIEN) {
      const rows = rowsFor(k.key);
      const aoa: (string | number)[][] = [["Datum", "Text", "Beleg", "Einnahmen CHF", "Ausgaben CHF", "Saldo CHF"]];
      rows.forEach(r => aoa.push([r.datum ?? "", r.text ?? "", r.beleg ?? "", n(r.einnahmen), n(r.ausgaben), r.saldo]));
      aoa.push(["TOTAL", "", "",
        rows.reduce((s, r) => s + n(r.einnahmen), 0),
        rows.reduce((s, r) => s + n(r.ausgaben), 0),
        rows.length ? rows[rows.length - 1].saldo : 0]);
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), k.label.slice(0, 31));
    }
    const anlAoa: (string | number)[][] = [["Konto", "Anfangsbestand 1.1.", "Zugänge", "Abgänge", "Bestand vor Abschr.", "Abschr. CHF", "%", "Bestand nach Abschr."]];
    anlagenRows.forEach(r => anlAoa.push([r.konto, n(r.anfangsbestand), n(r.zugaenge), n(r.abgaenge), r.vor, n(r.abschreibungen_chf), n(r.abschreibungen_pct), r.nach]));
    anlAoa.push(["Total", anlagenTotal.anfangsbestand, anlagenTotal.zugaenge, anlagenTotal.abgaenge, anlagenTotal.vor, anlagenTotal.abschreibungen_chf, "", anlagenTotal.nach]);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(anlAoa), "Anlagevermögen");
    XLSX.writeFile(wb, `EAR_3DMuscio_${jahr}.xlsx`);
    toast.success("Excel-Datei erstellt");
  };

  const exportPdf = async () => {
    const [{ default: jsPDF }, autoTableMod] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
    const autoTable = (autoTableMod as unknown as { default: (doc: unknown, opts: unknown) => void }).default;
    const doc = new jsPDF();
    const header = () => {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text("3DMuscio, Jorim Moos, Eschlikon", 14, 18);
    };

    // Deckblatt
    doc.setFontSize(18);
    doc.text(`Einnahmen- / Ausgabenrechnung ${jahr}`, 14, 30);
    doc.setFontSize(11);
    doc.text("3DMuscio, Jorim Moos", 14, 44);
    doc.text("Eschlikon TG", 14, 51);

    // Rekapitulation: Beträge aus derselben Datenbasis wie im Excel-Export.
    doc.addPage();
    header();
    doc.setFontSize(15);
    doc.text("Rekapitulation", 14, 29);
    const rekapData = rekapRows().slice(1);
    const rekapPositionen = [
      ["Einnahmen", "Total Einnahmen"],
      ["Total Einnahmen", "Total Einnahmen"],
      ["Div. Aufwände", "Div. Aufwände"],
      ["Personalaufwand", "Personalaufwand"],
      ["Raumaufwand", "Miete / Raumaufwand"],
      ["Unterhalt", "Unterhalt & Fahrzeug"],
      ["Versicherungen", "Versicherungen & Gebühren"],
      ["Büro- und Verwaltungsaufwand", "Büro & Verwaltungsaufwand"],
      ["Abschreibungen", "Abschreibungen"],
      ["Bruttogewinn I", "Bruttogewinn I"],
      ["Unternehmensergebnis", "UNTERNEHMENSERGEBNIS"],
    ];
    const rekapBody = rekapPositionen.map(([label, source]) => {
      const row = rekapData.find(r => r[0] === source);
      return [label, typeof row?.[1] === "number" ? fmtCHF(row[1]) : "", typeof row?.[2] === "number" ? fmtCHF(row[2]) : ""];
    });
    autoTable(doc, {
      startY: 36,
      head: [["Erfolgsrechnung vom 01. Januar bis 31. Dezember", String(jahr), String(jahr - 1)]],
      body: rekapBody,
      styles: { fontSize: 9, halign: "right", cellPadding: 3 },
      columnStyles: { 0: { halign: "left" } },
      headStyles: { fillColor: [30, 30, 30] },
      didParseCell: (data: { section: string; row: { index: number }; cell: { styles: { fontStyle: string } } }) => {
        if (data.section === "body" && [1, 9, 10].includes(data.row.index)) data.cell.styles.fontStyle = "bold";
      },
    });

    const kategorieLabels: Record<Kategorie, string> = {
      einnahmen: "Einnahmen",
      div_aufwaende: "Div. Aufwände",
      personalaufwand: "Personalaufwand",
      raumaufwand: "Raumaufwand",
      unterhalt: "Unterhalt und Reparaturen",
      versicherungen: "Versicherungen",
      buero: "Büro- und Verwaltungsaufwand",
      abschreibungen: "Abschreibungen",
    };
    for (const { key } of KATEGORIEN) {
      doc.addPage();
      header();
      doc.setFontSize(15);
      doc.text(kategorieLabels[key], 14, 29);
      const rows = buchungen
        .filter(b => b.kategorie === key && b.datum?.startsWith(String(jahr)))
        .sort((a, b) => (a.datum ?? "").localeCompare(b.datum ?? ""));
      let saldo = 0;
      let totalEinnahmen = 0;
      let totalAusgaben = 0;
      const body = rows.map(b => {
        const einnahme = key === "einnahmen" ? n(b.einnahmen) : 0;
        const ausgabe = key === "einnahmen" ? 0 : n(b.ausgaben);
        totalEinnahmen += einnahme;
        totalAusgaben += ausgabe;
        saldo += einnahme - ausgabe;
        const date = b.datum?.match(/^(\d{4})-(\d{2})-(\d{2})/);
        return [date ? `${date[3]}.${date[2]}.${date[1].slice(2)}` : "", b.text ?? "", b.beleg ?? "",
          key === "einnahmen" ? fmtCHF(einnahme) : "",
          key === "einnahmen" ? "" : fmtCHF(ausgabe), fmtCHF(saldo)];
      });
      body.push(["TOTAL:", "", "", fmtCHF(totalEinnahmen), fmtCHF(totalAusgaben), fmtCHF(saldo)]);
      autoTable(doc, {
        startY: 36,
        head: [["Datum", "Text", "Beleg", "Einnahmen", "Ausgaben", "Saldo"]],
        body,
        margin: { left: 14, right: 14 },
        styles: { fontSize: 8, cellPadding: 2, overflow: "linebreak" },
        columnStyles: {
          0: { cellWidth: 21 }, 1: { cellWidth: 62 }, 2: { cellWidth: 20 },
          3: { cellWidth: 26, halign: "right" }, 4: { cellWidth: 26, halign: "right" },
          5: { cellWidth: 27, halign: "right" },
        },
        headStyles: { fillColor: [30, 30, 30] },
        didParseCell: (data: { section: string; row: { index: number }; cell: { styles: { fontStyle: string } } }) => {
          if (data.section === "body" && data.row.index === body.length - 1) data.cell.styles.fontStyle = "bold";
        },
      });
    }
    doc.save(`EAR_${jahr}_3DMuscio.pdf`);
    toast.success("PDF erstellt");
  };

  // ---------- Render-Helfer ----------
  const renderDraftRow = (kategorie: Kategorie) => draft && (
    <tr className="bg-muted/40">
      <td className="p-2"><Input type="date" value={draft.datum} onChange={e => setDraft({ ...draft, datum: e.target.value })} className="h-8" /></td>
      <td className="p-2"><Input value={draft.text} onChange={e => setDraft({ ...draft, text: e.target.value })} placeholder="Text *" className="h-8" /></td>
      <td className="p-2"><Input value={draft.beleg} onChange={e => setDraft({ ...draft, beleg: e.target.value })} placeholder="Beleg" className="h-8" /></td>
      <td className="p-2">
        <Input type="number" step="0.05" value={kategorie === "einnahmen" ? draft.einnahmen : "0"} readOnly={kategorie !== "einnahmen"}
          onChange={e => setDraft({ ...draft, einnahmen: e.target.value })} className="h-8 text-right tabular-nums" />
      </td>
      <td className="p-2">
        <Input type="number" step="0.05" value={draft.ausgaben} onChange={e => setDraft({ ...draft, ausgaben: e.target.value })} className="h-8 text-right tabular-nums" />
      </td>
      <td className="p-2" />
      <td className="p-2 whitespace-nowrap text-right">
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => void saveDraft(kategorie)}><Check className="w-4 h-4 text-emerald-600" /></Button>
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={cancelEdit}><X className="w-4 h-4" /></Button>
      </td>
    </tr>
  );

  const renderBlatt = (kategorie: Kategorie) => {
    const rows = rowsFor(kategorie);
    const totalEin = rows.reduce((s, r) => s + n(r.einnahmen), 0);
    const totalAus = rows.reduce((s, r) => s + n(r.ausgaben), 0);
    const totalSaldo = totalEin - totalAus;
    const label = KATEGORIEN.find(k => k.key === kategorie)?.label ?? "";
    return (
      <Card className="p-0 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-border">
          <div>
            <h2 className="font-semibold">{label} {jahr}</h2>
            {kategorie === "einnahmen" && pendingSync !== null && (
              <p className={cn("text-xs mt-0.5", pendingSync > 0 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground")}>
                {pendingSync} nicht synchronisierte Aufträge
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {kategorie === "einnahmen" && (
              <Button size="sm" variant="outline" onClick={() => void syncEinnahmen()} disabled={syncBusy}>
                <RefreshCw className={cn("w-4 h-4 mr-1", syncBusy && "animate-spin")} /> Einnahmen aus Aufträgen synchronisieren
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => setScanKategorie(kategorie)}>
              <Camera className="w-4 h-4 mr-1" /> Beleg scannen
            </Button>
            <Button size="sm" onClick={() => startNew(kategorie)} disabled={editId === "new"}>
              <Plus className="w-4 h-4 mr-1" /> Eintrag hinzufügen
            </Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="text-left p-2 font-medium w-[130px]">Datum</th>
                <th className="text-left p-2 font-medium">Text</th>
                <th className="text-left p-2 font-medium w-[120px]">Beleg</th>
                <th className="text-right p-2 font-medium w-[130px]">Einnahmen CHF</th>
                <th className="text-right p-2 font-medium w-[130px]">Ausgaben CHF</th>
                <th className="text-right p-2 font-medium w-[130px]">Saldo CHF</th>
                <th className="w-[90px]" />
              </tr>
            </thead>
            <tbody>
              {editId === "new" && renderDraftRow(kategorie)}
              {rows.map(r => editId === r.id ? (
                <React.Fragment key={r.id}>{renderDraftRow(kategorie)}</React.Fragment>
              ) : (
                <tr key={r.id} className={cn("border-t border-border", r.saldo < 0 && "bg-destructive/10")}>
                  <td className="p-2 tabular-nums">{r.datum ?? "–"}</td>
                  <td className="p-2">{r.text}</td>
                  <td className="p-2 text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      {r.beleg ?? "–"}
                      {r.beleg_url && (
                        <button onClick={() => setLightbox(r.beleg_url!)} title="Beleg ansehen" className="text-primary hover:opacity-70">
                          <ReceiptText className="w-4 h-4" />
                        </button>
                      )}
                    </span>
                  </td>
                  <td className="p-2 text-right"><Num value={n(r.einnahmen)} /></td>
                  <td className="p-2 text-right"><Num value={n(r.ausgaben)} /></td>
                  <td className="p-2 text-right"><Num value={r.saldo} bold /></td>
                  <td className="p-2 text-right whitespace-nowrap">
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => startEdit(r)}><Pencil className="w-3.5 h-3.5" /></Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => void deleteBuchung(r.id)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && editId !== "new" && (
                <tr className="border-t border-border"><td colSpan={7} className="p-6 text-center text-muted-foreground">Keine Einträge für {jahr}</td></tr>
              )}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border bg-muted/50 font-semibold">
                <td className="p-2" colSpan={3}>TOTAL</td>
                <td className="p-2 text-right"><Num value={totalEin} bold /></td>
                <td className="p-2 text-right"><Num value={totalAus} bold /></td>
                <td className="p-2 text-right"><Num value={totalSaldo} bold /></td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>
    );
  };

  const RekapRow: React.FC<{ label: string; a: number; b: number; variant?: "head" | "sub" | "total" | "result" }> = ({ label, a, b, variant = "sub" }) => {
    if (variant === "head") {
      return (
        <tr className="bg-muted/40">
          <td className="px-3 py-1.5 text-[11px] uppercase tracking-wider font-semibold text-muted-foreground" colSpan={3}>{label}</td>
        </tr>
      );
    }
    const bold = variant === "total" || variant === "result";
    return (
      <tr className={cn("border-t border-border", variant === "result" && "bg-muted/60")}>
        <td className={cn("px-3 py-2", bold && "font-semibold")}>{label}</td>
        <td className="px-3 py-2 text-right"><Num value={a} bold={bold} colored={variant === "result"} /></td>
        <td className="px-3 py-2 text-right text-muted-foreground"><Num value={b} bold={bold} /></td>
      </tr>
    );
  };

  const renderRekap = () => (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Total Einnahmen</p>
          <p className="text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">CHF {fmtCHF(cur.einnahmen)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Total Aufwände</p>
          <p className="text-2xl font-bold tabular-nums text-destructive">CHF {fmtCHF(cur.aufwandTotal)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Unternehmensergebnis</p>
          <p className={cn("text-2xl font-bold tabular-nums", cur.ergebnis < 0 ? "text-destructive" : "text-emerald-600 dark:text-emerald-400")}>
            CHF {fmtCHF(cur.ergebnis)}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Veränderung ggü. {jahr - 1}</p>
          <p className={cn("text-2xl font-bold tabular-nums flex items-center gap-1", veraenderung < 0 ? "text-destructive" : "text-emerald-600 dark:text-emerald-400")}>
            {veraenderung < 0 ? <ArrowDown className="w-5 h-5" /> : <ArrowUp className="w-5 h-5" />}
            CHF {fmtCHF(veraenderung)}
          </p>
        </Card>
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="font-semibold">Erfolgsrechnung {jahr}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Position</th>
                <th className="text-right px-3 py-2 font-medium w-[150px]">{jahr}</th>
                <th className="text-right px-3 py-2 font-medium w-[150px]">{jahr - 1}</th>
              </tr>
            </thead>
            <tbody>
              <RekapRow label="Einnahmen" a={0} b={0} variant="head" />
              <RekapRow label="Total Einnahmen" a={cur.einnahmen} b={prev.einnahmen} variant="total" />
              <RekapRow label="Warenaufwand" a={0} b={0} variant="head" />
              <RekapRow label="Div. Aufwände" a={cur.waren} b={prev.waren} />
              <RekapRow label="Total Warenaufwand" a={cur.waren} b={prev.waren} variant="total" />
              <RekapRow label="Bruttogewinn I" a={cur.bg1} b={prev.bg1} variant="result" />
              <RekapRow label="Personalaufwand" a={0} b={0} variant="head" />
              <RekapRow label="Personalaufwand" a={cur.personal} b={prev.personal} />
              <RekapRow label="Total Personalaufwand" a={cur.personal} b={prev.personal} variant="total" />
              <RekapRow label="Bruttogewinn II" a={cur.bg2} b={prev.bg2} variant="result" />
              <RekapRow label="Übriger Betriebsaufwand" a={0} b={0} variant="head" />
              <RekapRow label="Miete / Raumaufwand" a={cur.raum} b={prev.raum} />
              <RekapRow label="Unterhalt & Fahrzeug" a={cur.unterhalt} b={prev.unterhalt} />
              <RekapRow label="Versicherungen & Gebühren" a={cur.versicherungen} b={prev.versicherungen} />
              <RekapRow label="Büro & Verwaltungsaufwand" a={cur.buero} b={prev.buero} />
              <RekapRow label="Total Übriger Betriebsaufwand" a={cur.uebrig} b={prev.uebrig} variant="total" />
              <RekapRow label="Abschreibungen" a={0} b={0} variant="head" />
              <RekapRow label="Abschreibungen" a={cur.abschreibungen} b={prev.abschreibungen} />
              <RekapRow label="Total Abschreibungen" a={cur.abschreibungen} b={prev.abschreibungen} variant="total" />
              <RekapRow label="Unternehmensergebnis" a={cur.ergebnis} b={prev.ergebnis} variant="result" />
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );

  const renderAnlagen = () => (
    <Card className="p-0 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h2 className="font-semibold">Anlagevermögen {jahr}</h2>
        <Button size="sm" onClick={() => void addAnlage()}><Plus className="w-4 h-4 mr-1" /> Konto hinzufügen</Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="text-left p-2 font-medium min-w-[200px]">Konto</th>
              <th className="text-right p-2 font-medium w-[140px]">Anfangsbestand 1.1.</th>
              <th className="text-right p-2 font-medium w-[110px]">Zugänge</th>
              <th className="text-right p-2 font-medium w-[110px]">Abgänge</th>
              <th className="text-right p-2 font-medium w-[140px]">Bestand vor Abschr.</th>
              <th className="text-right p-2 font-medium w-[120px]">Abschr. CHF</th>
              <th className="text-right p-2 font-medium w-[80px]">%</th>
              <th className="text-right p-2 font-medium w-[150px]">Bestand nach Abschr.</th>
              <th className="w-[50px]" />
            </tr>
          </thead>
          <tbody>
            {anlagenRows.map(r => (
              <tr key={r.id} className="border-t border-border">
                <td className="p-2"><Input value={r.konto} onChange={e => void updateAnlage(r.id, "konto", e.target.value)} className="h-8" /></td>
                <td className="p-2"><Input type="number" step="0.05" value={n(r.anfangsbestand)} onChange={e => void updateAnlage(r.id, "anfangsbestand", e.target.value)} className="h-8 text-right tabular-nums" /></td>
                <td className="p-2"><Input type="number" step="0.05" value={n(r.zugaenge)} onChange={e => void updateAnlage(r.id, "zugaenge", e.target.value)} className="h-8 text-right tabular-nums" /></td>
                <td className="p-2"><Input type="number" step="0.05" value={n(r.abgaenge)} onChange={e => void updateAnlage(r.id, "abgaenge", e.target.value)} className="h-8 text-right tabular-nums" /></td>
                <td className="p-2 text-right"><Num value={r.vor} /></td>
                <td className="p-2"><Input type="number" step="0.05" value={n(r.abschreibungen_chf)} onChange={e => void updateAnlage(r.id, "abschreibungen_chf", e.target.value)} className="h-8 text-right tabular-nums" /></td>
                <td className="p-2"><Input type="number" step="0.5" value={n(r.abschreibungen_pct)} onChange={e => void updateAnlage(r.id, "abschreibungen_pct", e.target.value)} className="h-8 text-right tabular-nums" /></td>
                <td className="p-2 text-right"><Num value={r.nach} bold /></td>
                <td className="p-2 text-right">
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => void deleteAnlage(r.id)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border bg-muted/50 font-semibold">
              <td className="p-2">Total</td>
              <td className="p-2 text-right"><Num value={anlagenTotal.anfangsbestand} bold /></td>
              <td className="p-2 text-right"><Num value={anlagenTotal.zugaenge} bold /></td>
              <td className="p-2 text-right"><Num value={anlagenTotal.abgaenge} bold /></td>
              <td className="p-2 text-right"><Num value={anlagenTotal.vor} bold /></td>
              <td className="p-2 text-right"><Num value={anlagenTotal.abschreibungen_chf} bold /></td>
              <td />
              <td className="p-2 text-right"><Num value={anlagenTotal.nach} bold /></td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </Card>
  );

  const renderExport = () => (
    <Card className="p-6 space-y-4 max-w-xl">
      <div>
        <h2 className="font-semibold">Export {jahr}</h2>
        <p className="text-sm text-muted-foreground mt-1">3DMuscio – Jorim Moos, 8734 Eschlikon TG</p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Button onClick={() => void exportExcel()}><FileSpreadsheet className="w-4 h-4 mr-2" /> Excel exportieren (.xlsx)</Button>
        <Button variant="outline" onClick={() => void exportPdf()}><FileDown className="w-4 h-4 mr-2" /> PDF exportieren</Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Die Excel-Datei enthält Deckblatt, Rekapitulation, alle acht Buchungsblätter und das Anlagevermögen. Das PDF enthält die Rekapitulation.
      </p>
    </Card>
  );

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Buchhaltung (EAR)</h1>
          <p className="text-sm text-muted-foreground">Einnahmen-/Ausgabenrechnung nach Schweizer Standard</p>
        </div>
        <select
          value={jahr}
          onChange={e => { cancelEdit(); setJahr(Number(e.target.value)); }}
          className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
        >
          {JAHRE.map(j => <option key={j} value={j}>Jahr {j}</option>)}
        </select>
      </div>

      <div className="flex gap-1 overflow-x-auto pb-1 border-b border-border">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => { cancelEdit(); setTab(t.key); }}
            className={cn(
              "px-3 py-2 text-sm rounded-t-lg whitespace-nowrap transition-colors",
              tab === t.key ? "bg-muted font-medium text-foreground border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-16 flex justify-center"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
      ) : tab === "rekap" ? renderRekap()
        : tab === "anlagen" ? renderAnlagen()
        : tab === "export" ? renderExport()
        : renderBlatt(tab as Kategorie)}

      {scanKategorie && (
        <BelegScanDialog
          jahr={jahr}
          kategorie={scanKategorie}
          onClose={() => setScanKategorie(null)}
          onSaved={load}
        />
      )}

      {lightbox && (
        <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
          <button className="absolute top-4 right-4 p-2 rounded-lg bg-background/90" onClick={() => setLightbox(null)}>
            <X className="w-5 h-5" />
          </button>
          <img src={lightbox} alt="Beleg" className="max-h-[90vh] max-w-full rounded-xl object-contain" onClick={e => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}
