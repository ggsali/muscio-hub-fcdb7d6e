import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Mail, Sparkles, Eye, Send, ImagePlus, BookOpen, Loader2, Users, Filter as FilterIcon,
  MousePointerClick, Trophy, Zap, Save, Play, Trash2, Clock,
} from "lucide-react";

type Customer = {
  id: string; name: string | null; vorname: string | null; email: string | null; ort: string | null;
};
type Newsletter = {
  id: string; betreff: string; inhalt_text: string; bild_url: string | null;
  blog_link_url: string | null; blog_link_titel: string | null; status: string;
  empfaenger_anzahl: number; erstellt_am: string; gesendet_am: string | null;
  geoeffnet_anzahl: number | null; ist_ab_test: boolean | null;
  ab_variante: string | null; ab_gruppe_id: string | null; automation_id: string | null;
};
type BlogPost = { id: string; titel: string; slug: string; veroeffentlicht_am: string | null };
type Recipient = { email: string; name: string; customer_id: string };
type Automation = {
  id: string; typ: string; aktiv: boolean; tage_verzoegerung: number;
  betreff_vorlage: string | null; inhalt_vorlage: string | null;
};
type AutoCandidate = {
  id: string; name: string; email: string; lastCompleted: string; completedCount: number; daysAgo: number;
};
type SegmentFilter = {
  letzterAuftragOp: "" | "vor" | "innerhalb";
  letzterAuftragTage: number;
  umsatzOp: "" | "ueber" | "unter";
  umsatzChf: number;
  material: string;
  anzahlOp: "" | "mehr" | "weniger";
  anzahlAuftraege: number;
  ort: string;
};
type Segment = { id: string; name: string; filter_json: SegmentFilter };

const SITE_URL = "https://3dmuscio.com";
const MATERIALS = ["PLA", "PETG", "ABS", "ASA", "TPU", "Resin"];

const EMPTY_FILTER: SegmentFilter = {
  letzterAuftragOp: "", letzterAuftragTage: 90,
  umsatzOp: "", umsatzChf: 500,
  material: "",
  anzahlOp: "", anzahlAuftraege: 3,
  ort: "",
};

const QUICK_SEGMENTS: { label: string; filter: SegmentFilter }[] = [
  { label: "Inaktive Kunden (90+ Tage)", filter: { ...EMPTY_FILTER, letzterAuftragOp: "vor", letzterAuftragTage: 90 } },
  { label: "Top-Kunden (3+ Aufträge)", filter: { ...EMPTY_FILTER, anzahlOp: "mehr", anzahlAuftraege: 2 } },
  { label: "ABS/ASA Nutzer (Outdoor)", filter: { ...EMPTY_FILTER, material: "ABS" } },
  { label: "Neukunden (1 Auftrag, < 60 Tage)", filter: { ...EMPTY_FILTER, anzahlOp: "weniger", anzahlAuftraege: 2, letzterAuftragOp: "innerhalb", letzterAuftragTage: 60 } },
];

const AUTOMATION_LABELS: Record<string, { titel: string; hinweis: string }> = {
  reaktivierung: { titel: "Reaktivierung", hinweis: "Kunden ohne Auftrag in den letzten X Tagen" },
  nach_erstem_auftrag: { titel: "Kunden mit Auftrag in den letzten {days} Tagen", hinweis: "Diese Kunden haben kürzlich bei dir bestellt – jetzt ist der ideale Zeitpunkt sie für einen weiteren Auftrag zu motivieren." },
};

function customerName(c: Customer) {
  return [c.vorname, c.name].filter(Boolean).join(" ").trim() || c.email || "Kunde";
}

function fmt(d?: string | null) {
  return d ? new Date(d).toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" }) : "–";
}

const LOGO_URL = "https://ukqtjdsjmtxgzhklvqky.supabase.co/storage/v1/object/public/company-assets/logo.jpeg";

function escHtml(s: string) {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Erzeugt exakt dasselbe HTML wie beim Versand (mit Platzhalter-Namen). */
function renderHtmlPreview(betreff: string, inhalt: string, blogUrl: string, blogTitel: string, bildUrl: string) {
  const text = String(inhalt ?? "")
    .replace(/\[Kundenname\]/g, "Kunde")
    .replace(/\[LINK_KALKULATOR\]/g, "");
  const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)
    .map((p) => {
      const html = escHtml(p).replace(/\n/g, "<br/>")
        .replace(/(https?:\/\/[^\s<]+)/g, (m) => `<a href="${escHtml(m)}" style="color:#16a34a;">${escHtml(m)}</a>`);
      return `<p style="font-size:15px;line-height:1.7;color:#3f3f46;margin:0 0 16px;">${html}</p>`;
    }).join("");

  const imageBlock = /^https?:\/\//i.test(bildUrl)
    ? `<tr><td style="padding:0 0 8px;"><img src="${escHtml(bildUrl)}" alt="" width="600" style="display:block;width:100%;max-width:600px;height:auto;border:0;" /></td></tr>`
    : "";

  const blogBlock = /^https?:\/\//i.test(blogUrl)
    ? `<tr><td style="padding:8px 32px 32px;">
          <div style="background-color:#f4f4f5;border-radius:10px;padding:18px 20px;">
            <p style="margin:0 0 8px;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#71717a;font-weight:700;">Lesenswerter Beitrag</p>
            <a href="${escHtml(blogUrl)}" style="font-size:15px;font-weight:600;color:#16a34a;text-decoration:none;">📖 ${escHtml(blogTitel || "Zum Beitrag")} →</a>
          </div>
        </td></tr>`
    : "";

  return `<!DOCTYPE html>
<html lang="de" dir="ltr">
  <head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /><title>${escHtml(betreff)}</title></head>
  <body style="margin:0;padding:0;background-color:#f4f4f5;font-family:Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:24px 12px;">
      <tr><td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;background-color:#ffffff;border-radius:14px;overflow:hidden;">
          <tr>
            <td style="padding:24px 32px;background-color:#0f172a;">
              <table role="presentation" cellpadding="0" cellspacing="0"><tr>
                <td style="padding-right:12px;"><img src="${LOGO_URL}" alt="3DMuscio" width="40" height="40" style="display:block;border-radius:8px;" /></td>
                <td>
                  <div style="font-size:17px;font-weight:700;color:#ffffff;line-height:1.2;">3DMuscio</div>
                  <div style="font-size:12px;color:#9ca3af;line-height:1.4;">3D-Druck Schweiz</div>
                </td>
              </tr></table>
            </td>
          </tr>
          ${imageBlock}
          <tr><td style="padding:28px 32px 8px;">${paragraphs}</td></tr>
          <tr><td style="padding:8px 32px 24px;" align="center">
            <a href="${SITE_URL}/kalkulator-online" style="background-color:#16a34a;color:#ffffff;padding:14px 30px;border-radius:8px;text-decoration:none;font-size:15px;font-weight:600;display:inline-block;">Jetzt Preis berechnen →</a>
          </td></tr>
          ${blogBlock}
          <tr><td style="padding:20px 32px 28px;border-top:1px solid #e4e4e7;">
            <p style="margin:0 0 10px;font-size:12px;line-height:1.6;color:#71717a;">
              3DMuscio | Gartensiedlung 13, 8360 Eschlikon TG | info@3dmuscio.com | www.3dmuscio.com
            </p>
            <p style="margin:0;font-size:12px;color:#a1a1aa;"><span style="text-decoration:underline;">Vom Newsletter abmelden</span></p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}


function NewsletterPreview({
  betreff, inhalt, bildUrl, blogUrl, blogTitel,
}: { betreff: string; inhalt: string; bildUrl: string; blogUrl: string; blogTitel: string }) {
  const text = inhalt.replace(/\[Kundenname\]/g, "Herr Muster").replace(/\[LINK_KALKULATOR\]/g, "");
  const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);

  return (
    <div className="rounded-xl overflow-hidden bg-white text-zinc-800">
      <div className="px-6 py-5 bg-[#0f172a] flex items-center gap-3">
        <img
          src="https://ukqtjdsjmtxgzhklvqky.supabase.co/storage/v1/object/public/company-assets/logo.jpeg"
          alt="3DMuscio" className="w-10 h-10 rounded-lg object-cover"
        />
        <div className="leading-tight">
          <div className="text-white font-bold text-[17px]">3DMuscio</div>
          <div className="text-[12px] text-zinc-400">3D-Druck Schweiz</div>
        </div>
      </div>
      {bildUrl && <img src={bildUrl} alt="" className="w-full object-cover max-h-64" loading="lazy" />}
      <div className="px-6 pt-6 pb-2">
        <p className="text-[11px] uppercase tracking-wider text-zinc-400 mb-3">Betreff: {betreff || "–"}</p>
        {paragraphs.map((p, i) => (
          <p key={i} className="text-[15px] leading-relaxed mb-4 whitespace-pre-wrap">{p}</p>
        ))}
      </div>
      <div className="px-6 pb-6 text-center">
        <span className="inline-block bg-[#16a34a] text-white px-7 py-3.5 rounded-lg text-[15px] font-semibold">
          Jetzt Preis berechnen →
        </span>
      </div>
      {blogUrl && (
        <div className="px-6 pb-6">
          <div className="bg-zinc-100 rounded-lg p-4">
            <p className="text-[11px] uppercase tracking-wider font-bold text-zinc-500 mb-2">Lesenswerter Beitrag</p>
            <span className="text-[15px] font-semibold text-[#16a34a]">📖 {blogTitel || "Zum Beitrag"} →</span>
          </div>
        </div>
      )}
      <div className="px-6 py-5 border-t border-zinc-200 text-[12px] text-zinc-500">
        <p className="mb-2">3DMuscio | Gartensiedlung 13, 8360 Eschlikon TG | info@3dmuscio.com | www.3dmuscio.com</p>
        <p className="underline text-zinc-400">Vom Newsletter abmelden</p>
      </div>
    </div>
  );
}

export default function NewsletterPage() {
  const [tab, setTab] = useState("neu");

  // Editor
  const [thema, setThema] = useState("");
  const [kiLoading, setKiLoading] = useState(false);
  const [betreff, setBetreff] = useState("");
  const [betreffB, setBetreffB] = useState("");
  const [abTest, setAbTest] = useState(false);
  const [inhalt, setInhalt] = useState("");
  const [bildUrl, setBildUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [blogUrl, setBlogUrl] = useState("");
  const [blogTitel, setBlogTitel] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const [blogModalOpen, setBlogModalOpen] = useState(false);

  // Empfänger
  const [mode, setMode] = useState<"alle" | "mit_auftrag" | "segment" | "manuell">("alle");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [withOrders, setWithOrders] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");

  // Segmentierung
  const [filter, setFilter] = useState<SegmentFilter>(EMPTY_FILTER);
  const [orderStats, setOrderStats] = useState<Map<string, { count: number; umsatz: number; last: number | null }>>(new Map());
  const [materialsByCustomer, setMaterialsByCustomer] = useState<Map<string, Set<string>>>(new Map());
  const [segments, setSegments] = useState<Segment[]>([]);
  const [segmentName, setSegmentName] = useState("");

  // Versand
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState(0);

  // Verlauf
  const [history, setHistory] = useState<Newsletter[]>([]);
  const [detail, setDetail] = useState<Newsletter | null>(null);
  const [detailRecipients, setDetailRecipients] = useState<{ email: string; name: string | null; gesendet: boolean; geoeffnet: boolean }[]>([]);
  const [detailKlicks, setDetailKlicks] = useState<{ url: string; klicks: number }[]>([]);
  const [blogPosts, setBlogPosts] = useState<BlogPost[]>([]);
  const [klicks, setKlicks] = useState<Map<string, number>>(new Map());

  // Automationen
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [autoLog7d, setAutoLog7d] = useState(0);
  const [runningAuto, setRunningAuto] = useState<string | null>(null);
  const [autoKiLoading, setAutoKiLoading] = useState<string | null>(null);
  const [autoCounts, setAutoCounts] = useState<Map<string, number>>(new Map());
  const [autoPreview, setAutoPreview] = useState<{ automation: Automation; loading: boolean; rows: AutoCandidate[] } | null>(null);

  useEffect(() => {
    (async () => {
      const [{ data: cs }, { data: os }, { data: ps }, { data: segs }] = await Promise.all([
        supabase.from("customers").select("id,name,vorname,email,ort").eq("newsletter_aktiv", true).not("email", "is", null),
        supabase.from("orders").select("customer_id,created_at,umsatz_total"),
        supabase.from("parts").select("customer_id,material"),
        supabase.from("newsletter_segmente").select("*").order("erstellt_am", { ascending: false }),
      ]);
      setCustomers((cs ?? []).filter((c) => !!c.email) as Customer[]);
      setWithOrders(new Set((os ?? []).map((o) => o.customer_id).filter(Boolean) as string[]));

      const stats = new Map<string, { count: number; umsatz: number; last: number | null }>();
      for (const o of os ?? []) {
        if (!o.customer_id) continue;
        const cur = stats.get(o.customer_id) ?? { count: 0, umsatz: 0, last: null };
        cur.count += 1;
        cur.umsatz += Number(o.umsatz_total ?? 0);
        const t = o.created_at ? new Date(o.created_at as string).getTime() : null;
        if (t && (!cur.last || t > cur.last)) cur.last = t;
        stats.set(o.customer_id, cur);
      }
      setOrderStats(stats);

      const mats = new Map<string, Set<string>>();
      for (const p of ps ?? []) {
        if (!p.customer_id || !p.material) continue;
        const set = mats.get(p.customer_id) ?? new Set<string>();
        set.add(String(p.material).toUpperCase());
        mats.set(p.customer_id, set);
      }
      setMaterialsByCustomer(mats);
      setSegments((segs ?? []) as unknown as Segment[]);
    })();
    loadHistory();
    loadAutomations();
  }, []);

  const loadHistory = useCallback(async () => {
    const [{ data }, { data: ks }] = await Promise.all([
      supabase.from("newsletters").select("*").order("erstellt_am", { ascending: false }),
      supabase.from("newsletter_klicks").select("newsletter_id"),
    ]);
    setHistory((data ?? []) as unknown as Newsletter[]);
    const m = new Map<string, number>();
    for (const k of ks ?? []) {
      if (!k.newsletter_id) continue;
      m.set(k.newsletter_id, (m.get(k.newsletter_id) ?? 0) + 1);
    }
    setKlicks(m);
  }, []);

  const loadAutomations = useCallback(async () => {
    const since = new Date(Date.now() - 7 * 86400_000).toISOString();
    const [{ data: as }, { count }] = await Promise.all([
      supabase.from("newsletter_automationen").select("*").order("typ"),
      supabase.from("newsletter_automation_log").select("id", { count: "exact", head: true }).gte("gesendet_am", since),
    ]);
    setAutomations((as ?? []) as unknown as Automation[]);
    setAutoLog7d(count ?? 0);
  }, []);

  /** Vorschau: welche Kunden würde diese Automation beim nächsten Lauf treffen? */
  const computeAutomationCandidates = useCallback(async (a: Automation): Promise<AutoCandidate[]> => {
    const [{ data: cs }, { data: logs }] = await Promise.all([
      supabase
        .from("customers")
        .select(`
          id, name, vorname, email,
          orders!inner(id, status, updated_at, created_at)
        `)
        .or("newsletter_aktiv.eq.true,newsletter_aktiv.is.null")
        .not("email", "is", null)
        .eq("orders.status", "Abgeschlossen"),
      supabase.from("newsletter_automation_log").select("customer_id").eq("automation_id", a.id),
    ]);
    const sentTo = new Set((logs ?? []).map((l: any) => l.customer_id));
    const days = Math.max(1, a.tage_verzoegerung || 1);
    const now = Date.now();
    const out: AutoCandidate[] = [];

    for (const c of (cs ?? []) as any[]) {
      if (!c.email || sentTo.has(c.id)) continue;
      const abgeschlosseneOrders = (c.orders as any[])
        .filter((o: any) => o.status === "Abgeschlossen")
        .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      if (abgeschlosseneOrders.length === 0) continue;

      const letzterAuftrag = abgeschlosseneOrders[0];
      const letzterAbgeschlossen = new Date(letzterAuftrag.created_at).getTime();
      const alterTage = (now - letzterAbgeschlossen) / 86400_000;

      if (a.typ === "reaktivierung") {
        if (alterTage <= days) continue;
      } else if (a.typ === "nach_erstem_auftrag") {
        // Kunden die in den letzten X Tagen (default 30) einen Auftrag hatten
        if (alterTage > days) continue;
      } else {
        continue;
      }

      out.push({
        id: c.id,
        name: [c.vorname, c.name].filter(Boolean).join(" ") || "—",
        email: c.email,
        lastCompleted: new Date(letzterAbgeschlossen).toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" }),
        completedCount: abgeschlosseneOrders.length,
        daysAgo: Math.max(1, Math.floor(alterTage)),
      });
    }
    return out.sort((x, y) => x.name.localeCompare(y.name));
  }, []);

  // Live-Zähler pro Automation
  useEffect(() => {
    if (automations.length === 0) return;
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        automations.map(async (a) => [a.id, (await computeAutomationCandidates(a)).length] as const),
      );
      if (!cancelled) setAutoCounts(new Map(entries));
    })();
    return () => { cancelled = true; };
  }, [automations.map((a) => `${a.id}:${a.tage_verzoegerung}:${a.typ}`).join(","), computeAutomationCandidates]);

  async function openAutoPreview(a: Automation) {
    setAutoPreview({ automation: a, loading: true, rows: [] });
    const rows = await computeAutomationCandidates(a);
    setAutoPreview({ automation: a, loading: false, rows });
  }


  async function openBlogModal() {
    setBlogModalOpen(true);
    const { data } = await supabase
      .from("blog_posts").select("id,titel,slug,veroeffentlicht_am")
      .eq("veroeffentlicht", true).order("veroeffentlicht_am", { ascending: false });
    setBlogPosts((data ?? []) as BlogPost[]);
  }

  const segmentCustomers = useMemo(() => {
    const now = Date.now();
    return customers.filter((c) => {
      const s = orderStats.get(c.id) ?? { count: 0, umsatz: 0, last: null };

      if (filter.letzterAuftragOp === "vor") {
        if (!s.last) return true; // nie bestellt = länger her
        if (s.last > now - filter.letzterAuftragTage * 86400_000) return false;
      }
      if (filter.letzterAuftragOp === "innerhalb") {
        if (!s.last) return false;
        if (s.last < now - filter.letzterAuftragTage * 86400_000) return false;
      }
      if (filter.umsatzOp === "ueber" && s.umsatz <= filter.umsatzChf) return false;
      if (filter.umsatzOp === "unter" && s.umsatz >= filter.umsatzChf) return false;
      if (filter.anzahlOp === "mehr" && s.count <= filter.anzahlAuftraege) return false;
      if (filter.anzahlOp === "weniger" && s.count >= filter.anzahlAuftraege) return false;
      if (filter.material) {
        const set = materialsByCustomer.get(c.id);
        if (!set || ![...set].some((m) => m.includes(filter.material.toUpperCase()))) return false;
      }
      if (filter.ort.trim()) {
        if (!(c.ort ?? "").toLowerCase().includes(filter.ort.trim().toLowerCase())) return false;
      }
      return true;
    });
  }, [customers, orderStats, materialsByCustomer, filter]);

  const recipients: Recipient[] = useMemo(() => {
    const base = mode === "mit_auftrag"
      ? customers.filter((c) => withOrders.has(c.id))
      : mode === "manuell"
        ? customers.filter((c) => selected.has(c.id))
        : mode === "segment"
          ? segmentCustomers
          : customers;
    return base.map((c) => ({ email: c.email!, name: customerName(c), customer_id: c.id }));
  }, [mode, customers, withOrders, selected, segmentCustomers]);

  const filteredCustomers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((c) => customerName(c).toLowerCase().includes(q) || (c.email ?? "").toLowerCase().includes(q));
  }, [customers, search]);

  async function generateDraft() {
    if (!thema.trim()) { toast.error("Bitte ein Thema angeben"); return; }
    setKiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-newsletter", { body: { thema } });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setBetreff((data as any).betreff ?? "");
      setInhalt((data as any).inhalt ?? "");
      toast.success("KI-Entwurf erstellt");
    } catch (e: any) {
      toast.error(e?.message ?? "KI-Entwurf fehlgeschlagen");
    } finally {
      setKiLoading(false);
    }
  }

  async function uploadImage(file: File) {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `newsletter/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("projekte").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("projekte").getPublicUrl(path);
      setBildUrl(data.publicUrl);
      toast.success("Bild hochgeladen");
    } catch (e: any) {
      toast.error(e?.message ?? "Upload fehlgeschlagen");
    } finally {
      setUploading(false);
    }
  }

  async function saveSegment() {
    if (!segmentName.trim()) { toast.error("Bitte einen Namen für das Segment angeben"); return; }
    const { data, error } = await supabase.from("newsletter_segmente")
      .insert({ name: segmentName.trim(), filter_json: filter as any }).select("*").single();
    if (error) { toast.error(error.message); return; }
    setSegments((prev) => [data as unknown as Segment, ...prev]);
    setSegmentName("");
    toast.success("Segment gespeichert");
  }

  async function deleteSegment(id: string) {
    const { error } = await supabase.from("newsletter_segmente").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    setSegments((prev) => prev.filter((s) => s.id !== id));
  }

  async function send() {
    setSending(true);
    setProgress(10);
    try {
      const base = {
        inhalt_text: inhalt,
        bild_url: bildUrl || null,
        blog_link_url: blogUrl || null,
        blog_link_titel: blogTitel || null,
        status: "entwurf",
      };

      if (abTest) {
        const gruppe = crypto.randomUUID();
        const shuffled = [...recipients].sort(() => Math.random() - 0.5);
        const half = Math.ceil(shuffled.length / 2);
        const groups: [string, Recipient[]][] = [
          [betreff.trim(), shuffled.slice(0, half)],
          [betreffB.trim(), shuffled.slice(half)],
        ];

        let totalSent = 0;
        for (let i = 0; i < groups.length; i++) {
          const [subject, list] = groups[i];
          if (list.length === 0) continue;
          const { data: nl, error: insErr } = await supabase.from("newsletters").insert({
            ...base, betreff: subject, ist_ab_test: true,
            ab_variante: i === 0 ? "A" : "B", ab_gruppe_id: gruppe,
          }).select("id").single();
          if (insErr) throw insErr;
          setProgress(30 + i * 30);
          const { data, error } = await supabase.functions.invoke("send-newsletter", {
            body: { newsletter_id: nl.id, empfaenger: list },
          });
          if (error) throw error;
          if ((data as any)?.error) throw new Error((data as any).error);
          totalSent += (data as any).sent ?? 0;
        }
        setProgress(100);
        toast.success(`A/B-Test gesendet an ${totalSent} Empfänger ✓`);
      } else {
        const { data: nl, error: insErr } = await supabase.from("newsletters")
          .insert({ ...base, betreff: betreff.trim() }).select("id").single();
        if (insErr) throw insErr;

        setProgress(40);
        const { data, error } = await supabase.functions.invoke("send-newsletter", {
          body: { newsletter_id: nl.id, empfaenger: recipients },
        });
        if (error) throw error;
        if ((data as any)?.error) throw new Error((data as any).error);
        setProgress(100);
        toast.success(`Newsletter erfolgreich an ${(data as any).sent} Empfänger gesendet ✓`);
      }

      setThema(""); setBetreff(""); setBetreffB(""); setAbTest(false);
      setInhalt(""); setBildUrl(""); setBlogUrl(""); setBlogTitel("");
      await loadHistory();
      setTab("verlauf");
    } catch (e: any) {
      toast.error(e?.message ?? "Versand fehlgeschlagen");
    } finally {
      setSending(false);
      setTimeout(() => setProgress(0), 800);
    }
  }

  async function openDetail(nl: Newsletter) {
    setDetail(nl);
    setDetailKlicks([]);
    const { data } = await supabase
      .from("newsletter_empfaenger").select("email,name,gesendet,geoeffnet")
      .eq("newsletter_id", nl.id).order("email");
    setDetailRecipients((data ?? []) as any);

    const { data: kl } = await supabase
      .from("newsletter_klicks").select("url").eq("newsletter_id", nl.id);
    const counts = new Map<string, number>();
    (kl ?? []).forEach((k: any) => counts.set(k.url, (counts.get(k.url) ?? 0) + 1));
    setDetailKlicks([...counts.entries()]
      .map(([url, klicks]) => ({ url, klicks }))
      .sort((a, b) => b.klicks - a.klicks));
  }

  async function saveAutomation(a: Automation) {
    const { error } = await supabase.from("newsletter_automationen").update({
      aktiv: a.aktiv, tage_verzoegerung: a.tage_verzoegerung,
      betreff_vorlage: a.betreff_vorlage, inhalt_vorlage: a.inhalt_vorlage,
    }).eq("id", a.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Automation gespeichert");
  }

  async function runAutomation(a: Automation) {
    setRunningAuto(a.id);
    try {
      const { data, error } = await supabase.functions.invoke("check-newsletter-automationen", {
        body: { automation_id: a.id },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const res = (data as any).results?.[a.typ];
      toast.success(`Automation ausgeführt: ${res?.sent ?? 0} Mails gesendet`);
      await loadAutomations();
    } catch (e: any) {
      toast.error(e?.message ?? "Ausführung fehlgeschlagen");
    } finally {
      setRunningAuto(null);
    }
  }

  async function generateAutomationText(a: Automation) {
    setAutoKiLoading(a.id);
    try {
      const thema = a.typ === "reaktivierung"
        ? `Reaktivierungs-Mail an Kunden, die seit ${a.tage_verzoegerung} Tagen keinen Auftrag mehr erteilt haben.`
        : `Follow-up-Mail ${a.tage_verzoegerung} Tage nach dem ersten Auftrag: Erfahrung erfragen und zum nächsten Auftrag einladen.`;
      const { data, error } = await supabase.functions.invoke("generate-newsletter", { body: { thema } });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setAutomations((prev) => prev.map((x) => x.id === a.id
        ? { ...x, betreff_vorlage: (data as any).betreff ?? x.betreff_vorlage, inhalt_vorlage: (data as any).inhalt ?? x.inhalt_vorlage }
        : x));
      toast.success("KI-Vorlage erstellt – noch speichern");
    } catch (e: any) {
      toast.error(e?.message ?? "KI-Entwurf fehlgeschlagen");
    } finally {
      setAutoKiLoading(null);
    }
  }

  /** A/B-Gruppen für die Verlaufsanzeige. */
  const abResults = useMemo(() => {
    const groups = new Map<string, Newsletter[]>();
    for (const nl of history) {
      if (nl.ist_ab_test && nl.ab_gruppe_id) {
        groups.set(nl.ab_gruppe_id, [...(groups.get(nl.ab_gruppe_id) ?? []), nl]);
      }
    }
    const winners = new Map<string, string>();
    for (const [gid, list] of groups) {
      const rate = (n: Newsletter) => (n.empfaenger_anzahl > 0 ? (n.geoeffnet_anzahl ?? 0) / n.empfaenger_anzahl : 0);
      const best = [...list].sort((a, b) => rate(b) - rate(a))[0];
      if (best && list.length > 1) winners.set(gid, best.id);
    }
    return { groups, winners };
  }, [history]);

  const canSend = betreff.trim().length > 0 && inhalt.trim().length > 0 && recipients.length > 0
    && (!abTest || betreffB.trim().length > 0);

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
          <Mail className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Newsletter</h1>
          <p className="text-sm text-muted-foreground">Kunden-Newsletter erstellen und versenden</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="neu">Neuer Newsletter</TabsTrigger>
          <TabsTrigger value="verlauf">Verlauf</TabsTrigger>
          <TabsTrigger value="automationen">Automationen</TabsTrigger>
        </TabsList>

        <TabsContent value="neu" className="space-y-6">
          {/* KI-Assistent */}
          <section className="bg-card border border-border rounded-xl p-5">
            <h2 className="font-semibold text-foreground mb-3 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" /> KI-Assistent
            </h2>
            <Label htmlFor="thema" className="text-sm">Worum geht es in diesem Newsletter?</Label>
            <Textarea
              id="thema" value={thema} onChange={(e) => setThema(e.target.value)} rows={3} className="mt-2"
              placeholder="z.B. Neue Materialien, Saisonangebot, Tipp zur Dateivorbereitung..."
            />
            <Button onClick={generateDraft} disabled={kiLoading} className="mt-3">
              {kiLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
              KI-Entwurf erstellen
            </Button>
          </section>

          {/* Editor */}
          <section className="bg-card border border-border rounded-xl p-5 space-y-4">
            <h2 className="font-semibold text-foreground">Inhalt</h2>

            <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
              <div>
                <p className="text-sm font-medium text-foreground">A/B-Test aktivieren</p>
                <p className="text-xs text-muted-foreground">Zwei Betreffzeilen, Empfänger werden 50/50 zufällig aufgeteilt.</p>
              </div>
              <Switch checked={abTest} onCheckedChange={setAbTest} />
            </div>

            <div>
              <Label htmlFor="betreff" className="text-sm">{abTest ? "Betreff Version A *" : "Betreff *"}</Label>
              <Input id="betreff" value={betreff} onChange={(e) => setBetreff(e.target.value)} className="mt-2" placeholder="Betreff des Newsletters" />
            </div>
            {abTest && (
              <div>
                <Label htmlFor="betreffB" className="text-sm">Betreff Version B *</Label>
                <Input id="betreffB" value={betreffB} onChange={(e) => setBetreffB(e.target.value)} className="mt-2" placeholder="Alternative Betreffzeile" />
              </div>
            )}

            <div>
              <Label htmlFor="inhalt" className="text-sm">Inhalt *</Label>
              <Textarea id="inhalt" value={inhalt} onChange={(e) => setInhalt(e.target.value)} rows={14} className="mt-2 font-mono text-[13px]" placeholder="Guten Tag [Kundenname], ..." />
              <p className="text-xs text-muted-foreground mt-1">
                Platzhalter: <code>[Kundenname]</code> wird pro Empfänger ersetzt. <code>[LINK_KALKULATOR]</code> wird durch den CTA-Button ersetzt.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
              <div>
                <Label htmlFor="bild" className="text-sm">Bild (optional) – URL</Label>
                <Input id="bild" value={bildUrl} onChange={(e) => setBildUrl(e.target.value)} className="mt-2" placeholder="https://..." />
              </div>
              <label className="inline-flex">
                <input type="file" accept="image/*" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(f); e.currentTarget.value = ""; }} />
                <span className="inline-flex items-center gap-2 h-10 px-4 rounded-md border border-border text-sm cursor-pointer hover:bg-muted">
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />} Hochladen
                </span>
              </label>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label htmlFor="blogurl" className="text-sm">Blog-Link – URL (optional)</Label>
                <Input id="blogurl" value={blogUrl} onChange={(e) => setBlogUrl(e.target.value)} className="mt-2" placeholder="https://3dmuscio.com/blog/..." />
              </div>
              <div>
                <Label htmlFor="blogtitel" className="text-sm">Blog-Link – Text</Label>
                <Input id="blogtitel" value={blogTitel} onChange={(e) => setBlogTitel(e.target.value)} className="mt-2" placeholder="FDM vs SLA – Welches Material passt?" />
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={openBlogModal}>
              <BookOpen className="w-4 h-4 mr-2" /> Aus Blog wählen
            </Button>

            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => setPreviewOpen(true)}>
                <Eye className="w-4 h-4 mr-2" /> Vorschau
              </Button>
              <Button variant="outline" onClick={() => setShowPreview(true)}>
                <Mail className="w-4 h-4 mr-2" /> E-Mail Vorschau (HTML)
              </Button>
            </div>

          </section>

          {/* Empfänger */}
          <section className="bg-card border border-border rounded-xl p-5 space-y-4">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" /> Empfänger
            </h2>
            <RadioGroup value={mode} onValueChange={(v) => setMode(v as typeof mode)} className="space-y-2">
              <div className="flex items-center gap-2">
                <RadioGroupItem value="alle" id="m-alle" />
                <Label htmlFor="m-alle" className="text-sm font-normal">Alle aktiven Kunden</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="mit_auftrag" id="m-auftrag" />
                <Label htmlFor="m-auftrag" className="text-sm font-normal">Kunden mit Aufträgen</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="segment" id="m-segment" />
                <Label htmlFor="m-segment" className="text-sm font-normal">Segment erstellen</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="manuell" id="m-manuell" />
                <Label htmlFor="m-manuell" className="text-sm font-normal">Manuelle Auswahl</Label>
              </div>
            </RadioGroup>

            {mode === "segment" && (
              <div className="border border-border rounded-lg p-4 space-y-4">
                <div className="flex flex-wrap gap-2">
                  {QUICK_SEGMENTS.map((q) => (
                    <Button key={q.label} variant="outline" size="sm" onClick={() => setFilter(q.filter)}>
                      {q.label}
                    </Button>
                  ))}
                  <Button variant="ghost" size="sm" onClick={() => setFilter(EMPTY_FILTER)}>Zurücksetzen</Button>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <Label className="text-sm">Letzter Auftrag</Label>
                    <div className="flex gap-2 mt-2">
                      <Select value={filter.letzterAuftragOp || "egal"} onValueChange={(v) => setFilter((f) => ({ ...f, letzterAuftragOp: v === "egal" ? "" : v as any }))}>
                        <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="egal">Egal</SelectItem>
                          <SelectItem value="vor">Vor mehr als … Tagen</SelectItem>
                          <SelectItem value="innerhalb">Innerhalb der letzten … Tage</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input type="number" className="w-24" value={filter.letzterAuftragTage}
                        onChange={(e) => setFilter((f) => ({ ...f, letzterAuftragTage: Number(e.target.value) || 0 }))} />
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm">Auftragsvolumen (CHF)</Label>
                    <div className="flex gap-2 mt-2">
                      <Select value={filter.umsatzOp || "egal"} onValueChange={(v) => setFilter((f) => ({ ...f, umsatzOp: v === "egal" ? "" : v as any }))}>
                        <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="egal">Egal</SelectItem>
                          <SelectItem value="ueber">Über</SelectItem>
                          <SelectItem value="unter">Unter</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input type="number" className="w-28" value={filter.umsatzChf}
                        onChange={(e) => setFilter((f) => ({ ...f, umsatzChf: Number(e.target.value) || 0 }))} />
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm">Anzahl Aufträge</Label>
                    <div className="flex gap-2 mt-2">
                      <Select value={filter.anzahlOp || "egal"} onValueChange={(v) => setFilter((f) => ({ ...f, anzahlOp: v === "egal" ? "" : v as any }))}>
                        <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="egal">Egal</SelectItem>
                          <SelectItem value="mehr">Mehr als</SelectItem>
                          <SelectItem value="weniger">Weniger als</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input type="number" className="w-24" value={filter.anzahlAuftraege}
                        onChange={(e) => setFilter((f) => ({ ...f, anzahlAuftraege: Number(e.target.value) || 0 }))} />
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm">Material verwendet</Label>
                    <Select value={filter.material || "egal"} onValueChange={(v) => setFilter((f) => ({ ...f, material: v === "egal" ? "" : v }))}>
                      <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="egal">Egal</SelectItem>
                        {MATERIALS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="md:col-span-2">
                    <Label className="text-sm">Region / Ort</Label>
                    <Input className="mt-2" value={filter.ort} placeholder="z.B. Zürich"
                      onChange={(e) => setFilter((f) => ({ ...f, ort: e.target.value }))} />
                  </div>
                </div>

                <div className="flex items-center gap-2 text-sm">
                  <FilterIcon className="w-4 h-4 text-primary" />
                  <span className="font-medium text-foreground">Dieses Segment: {segmentCustomers.length} Kunden</span>
                </div>

                <div className="flex gap-2">
                  <Input value={segmentName} onChange={(e) => setSegmentName(e.target.value)} placeholder="Segment-Name zum Speichern" />
                  <Button variant="outline" onClick={saveSegment}><Save className="w-4 h-4 mr-2" />Speichern</Button>
                </div>

                {segments.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Gespeicherte Segmente</p>
                    {segments.map((s) => (
                      <div key={s.id} className="flex items-center gap-2 text-sm">
                        <button className="flex-1 text-left hover:underline" onClick={() => setFilter({ ...EMPTY_FILTER, ...s.filter_json })}>
                          {s.name}
                        </button>
                        <Button variant="ghost" size="icon" onClick={() => deleteSegment(s.id)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {mode === "manuell" && (
              <div className="border border-border rounded-lg overflow-hidden">
                <div className="p-3 border-b border-border">
                  <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nach Name oder E-Mail suchen..." />
                </div>
                <div className="max-h-72 overflow-y-auto divide-y divide-border">
                  {filteredCustomers.map((c) => (
                    <label key={c.id} className="flex items-center gap-3 px-3 py-2 text-sm cursor-pointer hover:bg-muted/50">
                      <Checkbox
                        checked={selected.has(c.id)}
                        onCheckedChange={(v) => {
                          setSelected((prev) => {
                            const next = new Set(prev);
                            v ? next.add(c.id) : next.delete(c.id);
                            return next;
                          });
                        }}
                      />
                      <span className="flex-1 truncate">{customerName(c)}</span>
                      <span className="text-muted-foreground truncate">{c.email}</span>
                    </label>
                  ))}
                  {filteredCustomers.length === 0 && (
                    <p className="px-3 py-6 text-sm text-muted-foreground text-center">Keine Kunden gefunden</p>
                  )}
                </div>
              </div>
            )}

            <p className="text-sm font-medium text-foreground">{recipients.length} Empfänger ausgewählt</p>
            {recipients.length > 0 && (
              <details className="mt-2">
                <summary className="text-xs text-primary cursor-pointer">
                  {recipients.length} Empfänger anzeigen
                </summary>
                <div className="mt-2 max-h-32 overflow-y-auto text-xs text-muted-foreground space-y-0.5">
                  {recipients.map((e) => (
                    <div key={e.customer_id || e.email}>{e.name} – {e.email}</div>
                  ))}
                </div>
              </details>
            )}
            {recipients.length < 1 && (
              <p className="text-sm text-destructive">Keine Empfänger ausgewählt</p>
            )}

          </section>

          {sending && <Progress value={progress} className="h-2" />}

          <Button size="lg" disabled={!canSend || sending} onClick={() => setConfirmOpen(true)} className="w-full md:w-auto">
            {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
            Newsletter an {recipients.length} Empfänger senden
          </Button>
        </TabsContent>

        <TabsContent value="verlauf">
          <div className="bg-card border border-border rounded-xl divide-y divide-border">
            {history.map((nl) => {
              const opened = nl.geoeffnet_anzahl ?? 0;
              const rate = nl.empfaenger_anzahl > 0 ? Math.round((opened / nl.empfaenger_anzahl) * 100) : 0;
              const clicks = klicks.get(nl.id) ?? 0;
              const isWinner = nl.ab_gruppe_id ? abResults.winners.get(nl.ab_gruppe_id) === nl.id : false;
              return (
                <button key={nl.id} onClick={() => openDetail(nl)} className="w-full text-left px-4 py-3 hover:bg-muted/50 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {nl.betreff}
                      {nl.ist_ab_test && (
                        <Badge variant="outline" className="ml-2 align-middle text-[10px]">A/B {nl.ab_variante}</Badge>
                      )}

                    </p>
                    <p className="text-xs text-muted-foreground">
                      {nl.status === "gesendet" ? `Gesendet am ${fmt(nl.gesendet_am)}` : `Erstellt am ${fmt(nl.erstellt_am)}`} · Gesendet an {nl.empfaenger_anzahl} Empfänger
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span>Geöffnet: {opened} / {nl.empfaenger_anzahl} ({rate}%)</span>
                      <span className="inline-flex items-center gap-1">
                        <MousePointerClick className="w-3 h-3" /> Klicks auf CTA: {clicks}
                      </span>
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge variant={nl.status === "gesendet" ? "default" : "secondary"}>
                      {nl.status === "gesendet" ? "Gesendet" : "Entwurf"}
                    </Badge>
                    {nl.automation_id && <Badge variant="outline">Automatisch</Badge>}
                    {isWinner && (
                      <Badge className="bg-amber-500/20 text-amber-500 border border-amber-500/30">
                        <Trophy className="w-3 h-3 mr-1" /> Gewinner
                      </Badge>
                    )}
                  </div>
                </button>
              );
            })}
            {history.length === 0 && (
              <p className="px-4 py-10 text-sm text-muted-foreground text-center">Noch keine Newsletter vorhanden</p>
            )}
          </div>

          {/* A/B-Test Ergebnisse */}
          {[...abResults.groups.entries()].filter(([, l]) => l.length > 1).map(([gid, list]) => {
            const sorted = [...list].sort((a, b) => (a.ab_variante ?? "").localeCompare(b.ab_variante ?? ""));
            const rate = (n: Newsletter) => (n.empfaenger_anzahl > 0 ? Math.round(((n.geoeffnet_anzahl ?? 0) / n.empfaenger_anzahl) * 100) : 0);
            const winnerId = abResults.winners.get(gid);
            const winner = sorted.find((n) => n.id === winnerId);
            return (
              <div key={gid} className="mt-4 bg-card border border-border rounded-xl p-5">
                <h3 className="font-semibold text-foreground mb-3">A/B Test Ergebnis</h3>
                {sorted.map((n) => (
                  <div key={n.id} className="flex items-center justify-between text-sm py-1">
                    <span className="truncate mr-3">Version {n.ab_variante}: «{n.betreff}»</span>
                    <span className="font-medium whitespace-nowrap">
                      {rate(n)}% Öffnungsrate {n.id === winnerId && "🏆"}
                    </span>
                  </div>
                ))}
                <p className="text-sm text-muted-foreground mt-3">
                  Gewinner: Version {winner?.ab_variante ?? "–"}
                </p>
              </div>
            );
          })}
        </TabsContent>

        <TabsContent value="automationen" className="space-y-4">
          <div className="bg-primary/10 border border-primary/30 rounded-xl p-4 flex items-center gap-3">
            <Clock className="w-4 h-4 text-primary" />
            <p className="text-sm text-foreground">⏰ Automationen laufen täglich um 09:00 Uhr automatisch</p>
          </div>

          <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
            <Zap className="w-4 h-4 text-primary" />
            <p className="text-sm text-foreground">Letzte 7 Tage: <strong>{autoLog7d}</strong> Mails automatisch gesendet</p>
          </div>


          {automations.map((a) => {
            const meta = AUTOMATION_LABELS[a.typ] ?? { titel: a.typ, hinweis: "" };
            const titel = meta.titel.replace("{days}", String(a.tage_verzoegerung));
            return (
              <section key={a.id} className="bg-card border border-border rounded-xl p-5 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-semibold text-foreground">{titel}</h3>
                    <p className="text-xs text-muted-foreground">{meta.hinweis}</p>
                  </div>
                  <Switch checked={a.aktiv}
                    onCheckedChange={(v) => setAutomations((prev) => prev.map((x) => x.id === a.id ? { ...x, aktiv: v } : x))} />
                </div>

                <div className="grid gap-3 md:grid-cols-[160px_1fr]">
                  <div>
                    <Label className="text-sm">Verzögerung (Tage)</Label>
                    <Input type="number" className="mt-2" value={a.tage_verzoegerung}
                      onChange={(e) => setAutomations((prev) => prev.map((x) => x.id === a.id ? { ...x, tage_verzoegerung: Number(e.target.value) || 0 } : x))} />
                  </div>
                  <div>
                    <Label className="text-sm">Betreff-Vorlage</Label>
                    <Input className="mt-2" value={a.betreff_vorlage ?? ""}
                      onChange={(e) => setAutomations((prev) => prev.map((x) => x.id === a.id ? { ...x, betreff_vorlage: e.target.value } : x))} />
                  </div>
                </div>

                <div>
                  <Label className="text-sm">Inhalt-Vorlage</Label>
                  <Textarea rows={10} className="mt-2 font-mono text-[13px]" value={a.inhalt_vorlage ?? ""}
                    onChange={(e) => setAutomations((prev) => prev.map((x) => x.id === a.id ? { ...x, inhalt_vorlage: e.target.value } : x))} />
                  <p className="text-xs text-muted-foreground mt-1">Platzhalter <code>[Kundenname]</code> wird ersetzt.</p>
                </div>

                <div className="flex flex-wrap gap-2 items-center">
                  <Button onClick={() => saveAutomation(a)}><Save className="w-4 h-4 mr-2" />Speichern</Button>
                  <Button variant="outline" disabled={autoKiLoading === a.id} onClick={() => generateAutomationText(a)}>
                    {autoKiLoading === a.id ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                    KI-Vorlage
                  </Button>
                  <Button variant="secondary" disabled={runningAuto === a.id} onClick={() => runAutomation(a)}>
                    {runningAuto === a.id ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
                    Jetzt manuell ausführen
                  </Button>
                  <Button variant="outline" onClick={() => openAutoPreview(a)}>
                    <Users className="w-4 h-4 mr-2" />Betroffene Kunden anzeigen
                  </Button>
                </div>

                {(() => {
                  const n = autoCounts.get(a.id);
                  if (n === undefined) return <p className="text-xs text-muted-foreground">Kunden werden geprüft…</p>;
                  return n > 0
                    ? <Badge className="bg-success/15 text-success border-success/30">{n} Kunden warten</Badge>
                    : <Badge variant="secondary">Keine Kunden</Badge>;
                })()}
              </section>
            );
          })}
          {automations.length === 0 && (
            <p className="px-4 py-10 text-sm text-muted-foreground text-center">Keine Automationen vorhanden</p>
          )}

        </TabsContent>
      </Tabs>

      {/* Betroffene Kunden pro Automation */}
      <Dialog open={!!autoPreview} onOpenChange={(o) => !o && setAutoPreview(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Kunden für Automation: {autoPreview ? (AUTOMATION_LABELS[autoPreview.automation.typ]?.titel ?? autoPreview.automation.typ) : ""}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Diese Kunden würden beim nächsten Ausführen eine Mail erhalten</p>
          {autoPreview?.loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Laden…
            </p>
          ) : (autoPreview?.rows.length ?? 0) === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Keine Kunden erfüllen aktuell die Kriterien</p>
          ) : (
            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="px-3 py-2 text-left font-medium">Name</th>
                    <th className="px-3 py-2 text-left font-medium">E-Mail</th>
                    <th className="px-3 py-2 text-left font-medium">Letzter Auftrag</th>
                    <th className="px-3 py-2 text-right font-medium">Aufträge total</th>
                  </tr>
                </thead>
                <tbody>
                  {autoPreview?.rows.map((r) => (
                    <tr key={r.id} className="border-b border-border/50 last:border-0">
                      <td className="px-3 py-2">{r.name}</td>
                      <td className="px-3 py-2 text-muted-foreground">{r.email}</td>
                      <td className="px-3 py-2 text-muted-foreground">vor {r.daysAgo} Tag{r.daysAgo === 1 ? "" : "en"}</td>
                      <td className="px-3 py-2 text-right">{r.completedCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* E-Mail HTML Vorschau */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>E-Mail Vorschau</DialogTitle></DialogHeader>
          <iframe
            srcDoc={renderHtmlPreview(betreff, inhalt, blogUrl, blogTitel, bildUrl)}
            className="w-full min-h-[500px] border-0"
            title="Newsletter Vorschau"
          />
        </DialogContent>
      </Dialog>

      {/* Vorschau */}

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>

        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Vorschau</DialogTitle></DialogHeader>
          <NewsletterPreview betreff={betreff} inhalt={inhalt} bildUrl={bildUrl} blogUrl={blogUrl} blogTitel={blogTitel} />
        </DialogContent>
      </Dialog>

      {/* Blog-Auswahl */}
      <Dialog open={blogModalOpen} onOpenChange={setBlogModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Blog-Beitrag wählen</DialogTitle></DialogHeader>
          <div className="max-h-80 overflow-y-auto divide-y divide-border">
            {blogPosts.map((p) => (
              <button key={p.id}
                onClick={() => {
                  setBlogUrl(`${SITE_URL}/blog/${p.slug}`);
                  setBlogTitel(p.titel);
                  setBlogModalOpen(false);
                }}
                className="w-full text-left px-2 py-3 hover:bg-muted/50">
                <p className="text-sm font-medium text-foreground">{p.titel}</p>
                <p className="text-xs text-muted-foreground">{fmt(p.veroeffentlicht_am)}</p>
              </button>
            ))}
            {blogPosts.length === 0 && (
              <p className="px-2 py-8 text-sm text-muted-foreground text-center">Keine veröffentlichten Beiträge</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Detailansicht */}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{detail?.betreff}</DialogTitle></DialogHeader>
          {detail && (
            <div className="space-y-4">
              <NewsletterPreview
                betreff={detail.betreff} inhalt={detail.inhalt_text}
                bildUrl={detail.bild_url ?? ""} blogUrl={detail.blog_link_url ?? ""} blogTitel={detail.blog_link_titel ?? ""}
              />
              {detailKlicks.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                    <MousePointerClick className="w-4 h-4 text-primary" />
                    Klicks nach Link ({detailKlicks.reduce((s, k) => s + k.klicks, 0)})
                  </h3>
                  <div className="border border-border rounded-lg p-3 space-y-2">
                    {detailKlicks.map((k) => {
                      const max = detailKlicks[0].klicks || 1;
                      return (
                        <div key={k.url} className="space-y-1">
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <span className="truncate text-muted-foreground" title={k.url}>
                              {k.url.replace(/^https?:\/\//, "").slice(0, 50)}
                            </span>
                            <span className="font-semibold text-foreground shrink-0">{k.klicks}</span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-primary rounded-full transition-all"
                              style={{ width: `${Math.round((k.klicks / max) * 100)}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div>
                <h3 className="text-sm font-semibold text-foreground mb-2">Empfänger ({detailRecipients.length})</h3>
                <div className="border border-border rounded-lg max-h-56 overflow-y-auto divide-y divide-border">
                  {detailRecipients.map((r, i) => (
                    <div key={i} className="flex items-center gap-2 px-3 py-2 text-sm">
                      <span className="flex-1 truncate">{r.name || "–"}</span>
                      <span className="text-muted-foreground truncate">{r.email}</span>
                      {r.geoeffnet && <Badge variant="outline">Geöffnet</Badge>}
                      <Badge variant={r.gesendet ? "default" : "destructive"}>{r.gesendet ? "OK" : "Fehler"}</Badge>
                    </div>
                  ))}
                  {detailRecipients.length === 0 && (
                    <p className="px-3 py-6 text-sm text-muted-foreground text-center">Keine Empfänger erfasst</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Bestätigung */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Newsletter jetzt senden?</AlertDialogTitle>
            <AlertDialogDescription>
              {abTest
                ? `Der A/B-Test wird an ${recipients.length} Empfänger gesendet (50% Version A, 50% Version B). Dies kann nicht widerrufen werden.`
                : `Der Newsletter «${betreff}» wird an ${recipients.length} Empfänger gesendet. Dies kann nicht widerrufen werden.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={send}>Senden</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
