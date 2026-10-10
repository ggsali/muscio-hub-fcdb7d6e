import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import { Search, Loader2, X, Package, Users, MessageSquare, ShoppingBag, ShoppingCart, FileText, Receipt, Ticket, FlaskConical, FolderKanban, Star, Compass } from "lucide-react";
import { cn } from "@/lib/utils";

type Area = "admin" | "website";
type Hit = { key: string; group: string; title: string; subtitle?: string; to: string; score: number };

const ICONS: Record<string, typeof Search> = {
  Seiten: Compass, Aufträge: Package, Kunden: Users, Anfragen: MessageSquare, "Shop-Bestellungen": ShoppingBag,
  Produkte: ShoppingCart, Blog: FileText, Rechnungen: Receipt, Gutscheine: Ticket, Filamente: FlaskConical,
  Projekte: FolderKanban, Bewertungen: Star,
};

// Seiten inkl. Synonyme, damit auch umgangssprachliche Begriffe treffen
const PAGES: { label: string; to: string; area?: Area; keys: string }[] = [
  { label: "Dashboard", to: "/admin", keys: "start übersicht home" },
  { label: "Scanner", to: "/admin/scan", keys: "qr barcode scannen" },
  { label: "Aufträge", to: "/admin/auftraege", keys: "orders offerten angebote projekte druck" },
  { label: "Kunden", to: "/admin/kunden", keys: "clients kontakte adressen" },
  { label: "KI-Offerte", to: "/admin/ki-offerte", keys: "ai angebot automatisch" },
  { label: "Anfragen", to: "/admin/anfragen", keys: "inquiries kontaktformular mails" },
  { label: "Bestellungen", to: "/admin/website/bestellungen", keys: "shop orders käufe" },
  { label: "Live-Chat", to: "/admin/chat", keys: "nachrichten support" },
  { label: "Druckplatten", to: "/admin/druckplatten", keys: "plates bauplatte drucker" },
  { label: "Filamente", to: "/admin/filamente", keys: "material pla petg spulen" },
  { label: "Filament-Rollen", to: "/admin/filamente/rollen", keys: "spulen rolle" },
  { label: "Filament-Bestand", to: "/admin/filamente/bestand", keys: "lager inventar" },
  { label: "Etiketten", to: "/admin/filamente/etiketten", keys: "label drucken" },
  { label: "Lager", to: "/admin/lager", keys: "inventar bestand" },
  { label: "Teile-Bibliothek", to: "/admin/teile", keys: "parts stl" },
  { label: "Kalkulator", to: "/admin/kalkulator", keys: "preis rechner berechnen" },
  { label: "Finanzen", to: "/admin/finanzen", keys: "geld umsatz gewinn" },
  { label: "Abrechnungen", to: "/admin/finanzen/abrechnungen", keys: "quartal mwst" },
  { label: "Neue Rechnung", to: "/admin/finanzen/neue-rechnung", keys: "invoice faktura" },
  { label: "Buchhaltung (EAR)", to: "/admin/buchhaltung", keys: "ear belege ausgaben steuer" },
  { label: "Newsletter", to: "/admin/newsletter", keys: "mailing email kampagne" },
  { label: "Gutscheine", to: "/admin/gutscheine", keys: "rabatt code voucher" },
  { label: "Bewertungen", to: "/admin/bewertungen", keys: "reviews sterne rezension" },
  { label: "Kalender", to: "/admin/kalender", keys: "termine planung" },
  { label: "Einstellungen", to: "/admin/einstellungen", keys: "settings konfiguration preset branding resin" },
  { label: "Website-Übersicht", to: "/website-admin", keys: "website admin" },
  { label: "Analyse", to: "/website-admin/analyse", keys: "analytics besucher statistik" },
  { label: "Shop-Übersicht", to: "/website-admin/shop", keys: "shop umsatz" },
  { label: "Shop-Produkte", to: "/website-admin/shop-produkte", keys: "artikel produkte" },
  { label: "Blog / News", to: "/website-admin/blog", keys: "beiträge artikel news" },
  { label: "Projekte (Portfolio)", to: "/website-admin/projekte", keys: "portfolio referenzen" },
  { label: "Team", to: "/website-admin/team", keys: "mitarbeiter" },
  { label: "Zeitleiste", to: "/website-admin/timeline", keys: "geschichte timeline" },
  { label: "Partner", to: "/website-admin/partner", keys: "logos" },
  { label: "Maschinen & Equipment", to: "/website-admin/equipment", keys: "drucker maschinen" },
  { label: "Navigation", to: "/website-admin/navigation", keys: "menü links" },
  { label: "Website-Kunden", to: "/website-admin/kunden", keys: "konten accounts registrierung" },
  { label: "Website-Einstellungen", to: "/website-admin/einstellungen", keys: "wartung faq kontakt whatsapp" },
];

const norm = (s: unknown) =>
  String(s ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

/** Bewertet einen Treffer: alle Suchwörter müssen vorkommen; Wortanfang & Titel zählen mehr. */
function score(terms: string[], title: string, rest: string): number {
  const t = norm(title), r = norm(rest);
  let s = 0;
  for (const term of terms) {
    if (t === term) s += 100;
    else if (t.startsWith(term)) s += 60;
    else if (new RegExp(`(^|\\s|-)${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(t)) s += 40;
    else if (t.includes(term)) s += 25;
    else if (r.includes(term)) s += 10;
    else if (fuzzy(term, t) || fuzzy(term, r)) s += 4;
    else return 0;
  }
  return s;
}

// Tippfehler-tolerant: erlaubt 1 Fehler bei Wörtern ab 4 Zeichen
function fuzzy(term: string, text: string): boolean {
  if (term.length < 4) return false;
  return text.split(/[\s,.;:/()-]+/).some(w => w.length >= term.length - 1 && lev(term, w.slice(0, term.length + 1)) <= 1);
}
function lev(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString("de-CH") : "");
const chf = (n?: number | null) => (n != null ? `CHF ${Number(n).toFixed(2)}` : "");

async function searchDb(q: string, terms: string[], area: Area): Promise<Hit[]> {
  // Längstes Wort für die Datenbank-Abfrage, Feinfilter danach lokal
  const main = [...terms].sort((a, b) => b.length - a.length)[0].replace(/[,()*%\\:"]/g, "");
  if (!main) return [];
  const p = `%${main}%`;
  const or = (cols: string[]) => cols.map(c => `${c}.ilike.${p}`).join(",");
  const L = 8;

  const [orders, customers, inquiries, shop, products, blog, bills, vouchers, filaments, projekte, reviews] = await Promise.all([
    supabase.from("orders").select("id,name,beschreibung,status,datum,tracking_nr,umsatz_total,customers(name,vorname,firma)").or(or(["name", "beschreibung", "tracking_nr", "notes_internal"])).order("created_at", { ascending: false }).limit(L),
    supabase.from("customers").select("id,name,vorname,firma,email,telefon,ort").or(or(["name", "vorname", "firma", "email", "telefon", "ort", "plz"])).limit(L),
    supabase.from("inquiries").select("id,name,email,betreff,nachricht,status,created_at").or(or(["name", "email", "betreff", "nachricht"])).order("created_at", { ascending: false }).limit(L),
    supabase.from("shop_orders").select("id,customer_name,customer_email,status,total,created_at,tracking_nr").or(or(["customer_name", "customer_email", "tracking_nr", "shipping_city"])).order("created_at", { ascending: false }).limit(L),
    supabase.from("shop_products").select("id,name,kurzbeschreibung,preis,material").or(or(["name", "kurzbeschreibung", "material"])).limit(L),
    supabase.from("blog_posts").select("id,titel,zusammenfassung,veroeffentlicht").or(or(["titel", "zusammenfassung"])).limit(L),
    supabase.from("bills").select("id,order_id,titel,rechnungsnummer,empfaenger_name,empfaenger_firma,betrag,bezahlt").or(or(["titel", "rechnungsnummer", "empfaenger_name", "empfaenger_firma", "empfaenger_email"])).limit(L),
    supabase.from("gutscheine").select("id,code,typ,wert,aktiv,grund").or(or(["code", "grund", "notiz"])).limit(L),
    supabase.from("filaments").select("id,name,material,farbe,hersteller").or(or(["name", "material", "farbe", "hersteller"])).limit(L),
    supabase.from("projekte").select("id,name,kurzbeschreibung,kategorie").or(or(["name", "kurzbeschreibung", "kategorie", "material"])).limit(L),
    supabase.from("reviews").select("id,customer_name,kommentar,rating").or(or(["customer_name", "kommentar", "customer_email"])).limit(L),
  ]);

  const hits: Hit[] = [];
  const add = (group: string, rows: any[] | null, map: (r: any) => { title: string; subtitle?: string; rest: string; to: string }) => {
    for (const r of rows ?? []) {
      const m = map(r);
      const s = score(terms, m.title, `${m.subtitle ?? ""} ${m.rest}`);
      if (s > 0) hits.push({ key: `${group}-${r.id}`, group, title: m.title, subtitle: m.subtitle, to: m.to, score: s });
    }
  };
  const shopBase = area === "website" ? "/website-admin/bestellungen" : "/admin/shop/bestellungen";

  add("Aufträge", orders.data, r => {
    const k = r.customers ? [r.customers.vorname, r.customers.name].filter(Boolean).join(" ") || r.customers.firma : "";
    return { title: r.name || r.beschreibung || "Auftrag", subtitle: [k, r.status, fmtDate(r.datum), chf(r.umsatz_total)].filter(Boolean).join(" · "), rest: `${r.beschreibung ?? ""} ${r.tracking_nr ?? ""} ${r.customers?.firma ?? ""}`, to: `/admin/auftraege/${r.id}` };
  });
  add("Kunden", customers.data, r => ({ title: [r.vorname, r.name].filter(Boolean).join(" "), subtitle: [r.firma, r.email, r.ort].filter(Boolean).join(" · "), rest: r.telefon ?? "", to: `/admin/kunden/${r.id}` }));
  add("Anfragen", inquiries.data, r => ({ title: r.betreff || r.name, subtitle: [r.name, r.status, fmtDate(r.created_at)].filter(Boolean).join(" · "), rest: `${r.email} ${r.nachricht}`, to: `/admin/anfragen` }));
  add("Shop-Bestellungen", shop.data, r => ({ title: r.customer_name, subtitle: [r.status, chf(r.total), fmtDate(r.created_at)].filter(Boolean).join(" · "), rest: `${r.customer_email} ${r.tracking_nr ?? ""} ${r.id}`, to: `${shopBase}/${r.id}` }));
  add("Produkte", products.data, r => ({ title: r.name, subtitle: [r.material, chf(r.preis)].filter(Boolean).join(" · "), rest: r.kurzbeschreibung ?? "", to: "/website-admin/shop-produkte" }));
  add("Blog", blog.data, r => ({ title: r.titel, subtitle: r.veroeffentlicht ? "Veröffentlicht" : "Entwurf", rest: r.zusammenfassung ?? "", to: "/website-admin/blog" }));
  add("Rechnungen", bills.data, r => ({ title: r.rechnungsnummer ? `${r.rechnungsnummer} – ${r.titel}` : r.titel, subtitle: [r.empfaenger_firma || r.empfaenger_name, chf(r.betrag), r.bezahlt ? "bezahlt" : "offen"].filter(Boolean).join(" · "), rest: "", to: r.order_id ? `/admin/auftraege/${r.order_id}` : "/admin/finanzen" }));
  add("Gutscheine", vouchers.data, r => ({ title: r.code, subtitle: [r.typ === "prozent" ? `${r.wert}%` : chf(r.wert), r.aktiv ? "aktiv" : "inaktiv"].join(" · "), rest: r.grund ?? "", to: "/admin/gutscheine" }));
  add("Filamente", filaments.data, r => ({ title: r.name, subtitle: [r.material, r.farbe, r.hersteller].filter(Boolean).join(" · "), rest: "", to: "/admin/filamente" }));
  add("Projekte", projekte.data, r => ({ title: r.name, subtitle: r.kategorie ?? "", rest: r.kurzbeschreibung ?? "", to: "/website-admin/projekte" }));
  add("Bewertungen", reviews.data, r => ({ title: r.customer_name, subtitle: `${"★".repeat(r.rating)}`, rest: r.kommentar ?? "", to: area === "website" ? "/website-admin/reviews" : "/admin/bewertungen" }));
  return hits;
}

export default function GlobalSearch({ area, onNavigate, className }: { area: Area; onNavigate?: () => void; className?: string }) {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dbHits, setDbHits] = useState<Hit[]>([]);
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const terms = useMemo(() => norm(q).split(/\s+/).filter(Boolean), [q]);

  const pageHits = useMemo<Hit[]>(() => {
    if (!terms.length) return [];
    return PAGES.map(p => ({ key: `p-${p.to}`, group: "Seiten", title: p.label, subtitle: p.to, to: p.to, score: score(terms, p.label, p.keys) + 5 }))
      .filter(h => h.score > 5).sort((a, b) => b.score - a.score).slice(0, 5);
  }, [terms]);

  useEffect(() => {
    if (q.trim().length < 2) { setDbHits([]); return; }
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await searchDb(q, terms, area);
        if (!cancelled) setDbHits(res);
      } finally { if (!cancelled) setLoading(false); }
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [q, terms, area]);

  // Gruppen nach bestem Treffer sortieren
  const grouped = useMemo(() => {
    const all = [...pageHits, ...dbHits];
    const map = new Map<string, Hit[]>();
    for (const h of all) map.set(h.group, [...(map.get(h.group) ?? []), h]);
    return [...map.entries()]
      .map(([g, list]) => [g, list.sort((a, b) => b.score - a.score).slice(0, 5)] as const)
      .sort((a, b) => b[1][0].score - a[1][0].score);
  }, [pageHits, dbHits]);
  const flat = useMemo(() => grouped.flatMap(([, l]) => l), [grouped]);

  useEffect(() => setActive(0), [q]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (!boxRef.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); inputRef.current?.focus(); setOpen(true); }
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, []);

  const go = (h: Hit) => { navigate(h.to); setOpen(false); setQ(""); onNavigate?.(); };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive(a => Math.min(a + 1, flat.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive(a => Math.max(a - 1, 0)); }
    else if (e.key === "Enter" && flat[active]) { e.preventDefault(); go(flat[active]); }
    else if (e.key === "Escape") { setOpen(false); inputRef.current?.blur(); }
  };

  let idx = -1;
  return (
    <div ref={boxRef} className={cn("relative", className)}>
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          ref={inputRef}
          value={q}
          onChange={e => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Suchen… (Ctrl+K)"
          className="w-full h-9 pl-8 pr-8 rounded-lg bg-muted/60 border border-border text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        />
        {loading ? (
          <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
        ) : q ? (
          <button onClick={() => setQ("")} className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-muted" aria-label="Suche leeren">
            <X className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        ) : null}
      </div>

      {open && terms.length > 0 && (
        <div className="absolute left-0 z-50 mt-1 w-[min(420px,calc(100vw-2rem))] max-h-[70vh] overflow-y-auto rounded-lg border border-border bg-popover shadow-xl py-1">
          {flat.length === 0 ? (
            <p className="px-3 py-4 text-[13px] text-muted-foreground text-center">
              {loading ? "Suche läuft…" : "Keine Treffer"}
            </p>
          ) : grouped.map(([group, list]) => {
            const Icon = ICONS[group] ?? Search;
            return (
              <div key={group} className="py-1">
                <p className="px-3 pt-1 pb-0.5 text-[10px] uppercase tracking-widest text-muted-foreground">{group}</p>
                {list.map(h => {
                  idx++;
                  const i = idx;
                  return (
                    <button
                      key={h.key}
                      onMouseEnter={() => setActive(i)}
                      onClick={() => go(h)}
                      className={cn("w-full flex items-start gap-2.5 px-3 py-2 text-left", i === active ? "bg-primary/10" : "hover:bg-muted")}
                    >
                      <Icon className={cn("w-4 h-4 mt-0.5 flex-shrink-0", i === active ? "text-primary" : "text-muted-foreground")} />
                      <span className="min-w-0">
                        <span className="block text-[13px] text-foreground truncate">{h.title}</span>
                        {h.subtitle && <span className="block text-[11px] text-muted-foreground truncate">{h.subtitle}</span>}
                      </span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
