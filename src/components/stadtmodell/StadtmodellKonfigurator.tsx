import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import ModellViewer from "./ModellViewer";
import * as THREE from "three";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { toast } from "sonner";
import { Box, Check, Clock, Loader2, MapPin, Package, Ruler, Search, ShieldCheck, Sparkles, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { createStadtmodellCheckout, listStadtmodellFilamente } from "@/lib/stadtmodell.functions";
import {
  KANTE_MAX, KANTE_MIN, MASSSTAEBE, MODELL_MAX_MM, MODELL_MIN_MM, QUELLE, SOCKEL_MAX, SOCKEL_MIN, VERSAND,
  berechnePreis, druckzeitH, modellMm, type StadtmodellFilament, type VersandKey,
} from "@/lib/stadtmodell";
import { baueModell, exportStl, ladeGebaeude, ladeHoehen } from "@/lib/stadtmodell-mesh";
import { cn } from "@/lib/utils";

const START: [number, number] = [47.3769, 8.5417];

function squareBounds(lat: number, lon: number, kante: number): L.LatLngBoundsExpression {
  const dLat = kante / 2 / 110540;
  const dLon = kante / 2 / (111320 * Math.cos((lat * Math.PI) / 180));
  return [[lat - dLat, lon - dLon], [lat + dLat, lon + dLon]];
}

function primaryColor() {
  const v = getComputedStyle(document.documentElement).getPropertyValue("--primary").trim();
  return v ? `hsl(${v})` : "currentColor";
}

function Schritt({ nr, titel, untertitel, children }: { nr: number; titel: string; untertitel?: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm md:p-6">
      <div className="mb-4 flex items-start gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">{nr}</span>
        <div>
          <h2 className="font-heading text-lg font-semibold leading-tight">{titel}</h2>
          {untertitel && <p className="text-sm text-muted-foreground">{untertitel}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

export default function StadtmodellKonfigurator() {
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const rectRef = useRef<L.Rectangle | null>(null);
  const [center, setCenter] = useState<[number, number]>(START);
  const [kante, setKante] = useState(250);
  const [massstab, setMassstab] = useState<number>(2000);
  const [sockel, setSockel] = useState(5);
  const [filamente, setFilamente] = useState<StadtmodellFilament[] | null>(null);
  const [filamentId, setFilamentId] = useState<string | null>(null);
  const [versand, setVersand] = useState<VersandKey>("b_post");
  const [suche, setSuche] = useState("");
  const [geo, setGeo] = useState<THREE.BufferGeometry | null>(null);
  const [laden, setLaden] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  const mm = modellMm(kante, massstab);
  const grenzeOk = mm >= MODELL_MIN_MM && mm <= MODELL_MAX_MM;
  const preis = berechnePreis(kante, massstab, sockel);
  const versandPreis = VERSAND[versand].preis;
  const filament = filamente?.find((f) => f.id === filamentId) ?? null;

  useEffect(() => {
    listStadtmodellFilamente()
      .then((f) => { setFilamente(f); setFilamentId(f[0]?.id ?? null); })
      .catch(() => { setFilamente([]); toast.error("Materialien konnten nicht geladen werden"); });
  }, []);

  useEffect(() => {
    if (!mapEl.current || mapRef.current) return;
    const map = L.map(mapEl.current, { center: START, zoom: 15 });
    L.tileLayer("https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-farbe/default/current/3857/{z}/{x}/{y}.jpeg", {
      maxZoom: 19, attribution: "© swisstopo",
    }).addTo(map);
    const c = primaryColor();
    rectRef.current = L.rectangle(squareBounds(START[0], START[1], 250), { color: c, fillColor: c, weight: 3, fillOpacity: 0.18 }).addTo(map);
    map.on("click", (e) => setCenter([e.latlng.lat, e.latlng.lng]));
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    rectRef.current?.setBounds(squareBounds(center[0], center[1], kante) as L.LatLngBounds);
    setGeo(null);
  }, [center, kante]);
  useEffect(() => { setGeo(null); }, [massstab, sockel]);

  async function ortSuchen() {
    if (!suche.trim()) return;
    const r = await fetch(`https://api3.geo.admin.ch/rest/services/api/SearchServer?type=locations&sr=4326&limit=1&searchText=${encodeURIComponent(suche)}`);
    const d = await r.json();
    const a = d.results?.[0]?.attrs;
    if (!a) return toast.error("Ort nicht gefunden");
    setCenter([a.lat, a.lon]);
    mapRef.current?.setView([a.lat, a.lon], 16);
  }

  async function vorschau() {
    try {
      setLaden("Lade Höhendaten …");
      const [h, g] = await Promise.all([
        ladeHoehen(center[0], center[1], kante, (p) => setLaden(`Lade Höhendaten … ${Math.round(p * 100)}%`)),
        ladeGebaeude(center[0], center[1], kante).catch(() => { toast.warning("Gebäude konnten nicht geladen werden – nur Gelände"); return []; }),
      ]);
      setLaden("Erzeuge 3D-Modell …");
      setGeo(baueModell(h, g, kante, massstab, sockel));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler beim Erzeugen");
    } finally { setLaden(null); }
  }

  async function bestellen() {
    if (!geo || !filamentId) return;
    try {
      setLaden("Bereite Bestellung vor …");
      const res = await createStadtmodellCheckout({ data: {
        environment: getStripeEnvironment(), lat: center[0], lon: center[1], kantenlaenge_m: kante,
        massstab, sockel_mm: sockel, filament_id: filamentId, versand, origin: window.location.origin,
      } });
      setLaden("Lade 3D-Datei hoch …");
      const blob = await exportStl(geo);
      const { error } = await supabase.storage.from("stadtmodelle").uploadToSignedUrl(res.path, res.uploadToken, blob, { contentType: "model/stl" });
      if (error) throw new Error("Upload der 3D-Datei fehlgeschlagen");
      setClientSecret(res.clientSecret);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Bestellung fehlgeschlagen");
    } finally { setLaden(null); }
  }

  const checkoutOptions = useMemo(() => clientSecret ? { fetchClientSecret: () => Promise.resolve(clientSecret) } : null, [clientSecret]);
  const kannBestellen = !!geo && grenzeOk && !!filament && !laden;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <div className="space-y-6">
        <Schritt nr={1} titel="Ort & Ausschnitt wählen" untertitel="Suche einen Ort oder klicke in die Karte.">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={suche} onChange={(e) => setSuche(e.target.value)} onKeyDown={(e) => e.key === "Enter" && ortSuchen()} placeholder="z. B. Bern Bundesplatz" className="h-11 pl-9" />
            </div>
            <Button className="h-11" onClick={ortSuchen}>Suchen</Button>
          </div>
          <div className="relative mt-4 overflow-hidden rounded-xl border border-border">
            <div ref={mapEl} className="h-[420px] w-full" />
            <div className="pointer-events-none absolute left-3 top-3 z-[400] flex items-center gap-1.5 rounded-full bg-background/90 px-3 py-1.5 text-xs font-medium shadow backdrop-blur">
              <MapPin className="h-3.5 w-3.5 text-primary" /> {center[0].toFixed(4)}, {center[1].toFixed(4)}
            </div>
          </div>
          <div className="mt-5">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Kantenlänge</span>
              <span className="rounded-md bg-accent px-2 py-0.5 font-semibold text-primary">{kante} m</span>
            </div>
            <Slider className="mt-3" min={KANTE_MIN} max={KANTE_MAX} step={10} value={[kante]} onValueChange={([v]) => setKante(v)} />
            <div className="mt-1 flex justify-between text-xs text-muted-foreground"><span>{KANTE_MIN} m</span><span>{KANTE_MAX} m</span></div>
          </div>
        </Schritt>

        <Schritt nr={2} titel="Massstab, Sockel & Material">
          <p className="text-sm font-medium">Massstab</p>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {MASSSTAEBE.map((m) => {
              const g = modellMm(kante, m);
              const ok = g >= MODELL_MIN_MM && g <= MODELL_MAX_MM;
              return (
                <button key={m} type="button" onClick={() => setMassstab(m)}
                  className={cn("rounded-xl border-2 p-3 text-left transition-all",
                    massstab === m ? "border-primary bg-accent" : "border-border hover:border-primary/50",
                    !ok && "opacity-50")}>
                  <div className="font-heading text-base font-bold">1:{m}</div>
                  <div className="text-xs text-muted-foreground">{g} × {g} mm</div>
                </button>
              );
            })}
          </div>

          <div className="mt-6">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Sockelhöhe</span>
              <span className="rounded-md bg-accent px-2 py-0.5 font-semibold text-primary">{sockel} mm</span>
            </div>
            <Slider className="mt-3" min={SOCKEL_MIN} max={SOCKEL_MAX} step={1} value={[sockel]} onValueChange={([v]) => setSockel(v)} />
          </div>

          <p className="mt-6 text-sm font-medium">Filament</p>
          {filamente === null ? (
            <div className="mt-2 grid gap-2 sm:grid-cols-2">{[0, 1].map((i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />)}</div>
          ) : filamente.length === 0 ? (
            <p className="mt-2 rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">Aktuell sind keine Materialien verfügbar. Bitte kontaktiere uns.</p>
          ) : (
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {filamente.map((f) => (
                <button key={f.id} type="button" onClick={() => setFilamentId(f.id)}
                  className={cn("flex items-center gap-3 rounded-xl border-2 p-3 text-left transition-all",
                    filamentId === f.id ? "border-primary bg-accent" : "border-border hover:border-primary/50")}>
                  <span className="h-10 w-10 shrink-0 rounded-lg border border-border shadow-inner" style={{ background: f.hex }} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{f.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{f.material}{f.farbname ? ` · ${f.farbname}` : ""}</span>
                  </span>
                  {filamentId === f.id && <Check className="h-4 w-4 text-primary" />}
                </button>
              ))}
            </div>
          )}
        </Schritt>

        <Schritt nr={3} titel="3D-Vorschau" untertitel="Gelände und Gebäude aus Schweizer Geodaten – drehen und zoomen.">
          <div className="relative h-[380px] overflow-hidden rounded-xl border border-border bg-muted/40">
            {geo ? (
              <ModellViewer geo={geo} size={mm} color={filament?.hex ?? "#eeeeee"} />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent"><Box className="h-7 w-7 text-primary" /></div>
                <p className="max-w-xs text-sm text-muted-foreground">{laden ?? "Erzeuge die Vorschau, um dein Modell zu prüfen."}</p>
                <Button disabled={!grenzeOk || !!laden} onClick={vorschau}>
                  {laden ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}3D-Vorschau erzeugen
                </Button>
              </div>
            )}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">{QUELLE}</p>
        </Schritt>

        <Schritt nr={4} titel="Versand wählen">
          <div className="grid gap-2 sm:grid-cols-2">
            {(Object.keys(VERSAND) as VersandKey[]).map((k) => (
              <button key={k} type="button" onClick={() => setVersand(k)}
                className={cn("flex items-center gap-3 rounded-xl border-2 p-4 text-left transition-all",
                  versand === k ? "border-primary bg-accent" : "border-border hover:border-primary/50")}>
                <Truck className={cn("h-5 w-5 shrink-0", versand === k ? "text-primary" : "text-muted-foreground")} />
                <span className="flex-1">
                  <span className="block text-sm font-semibold">{VERSAND[k].label}</span>
                  <span className="block text-xs text-muted-foreground">{VERSAND[k].info}</span>
                </span>
                <span className="text-sm font-semibold">CHF {VERSAND[k].preis.toFixed(2)}</span>
              </button>
            ))}
          </div>
        </Schritt>
      </div>

      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-lg">
          <div className="bg-primary px-5 py-4 text-primary-foreground">
            <p className="text-xs font-medium uppercase tracking-wider opacity-80">Dein Stadtmodell</p>
            <p className="font-heading text-2xl font-bold">{mm} × {mm} mm</p>
          </div>
          <div className="space-y-3 p-5 text-sm">
            <Zeile icon={<Ruler className="h-4 w-4" />} label="Ausschnitt" wert={`${kante} × ${kante} m · 1:${massstab}`} />
            <Zeile icon={<Package className="h-4 w-4" />} label="Sockel" wert={`${sockel} mm`} />
            <Zeile icon={<span className="block h-4 w-4 rounded-full border border-border" style={{ background: filament?.hex }} />} label="Filament" wert={filament ? filament.name : "–"} />
            <Zeile icon={<Clock className="h-4 w-4" />} label="Druckzeit ca." wert={`${druckzeitH(kante, massstab, sockel)} h`} />
            <div className="border-t border-border pt-3">
              <div className="flex justify-between"><span className="text-muted-foreground">Modell</span><span>CHF {preis.toFixed(2)}</span></div>
              <div className="mt-1 flex justify-between"><span className="text-muted-foreground">Versand</span><span>CHF {versandPreis.toFixed(2)}</span></div>
              <div className="mt-3 flex items-end justify-between">
                <span className="font-medium">Total</span>
                <span className="font-heading text-3xl font-bold text-primary">CHF {(preis + versandPreis).toFixed(2)}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">inkl. MwSt.</p>
            </div>
            {!grenzeOk && <p className="rounded-lg bg-destructive/10 p-3 text-destructive">Das Modell muss zwischen {MODELL_MIN_MM} und {MODELL_MAX_MM} mm gross sein – bitte Massstab oder Kantenlänge anpassen.</p>}
            {grenzeOk && !geo && <p className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">Erzeuge zuerst die 3D-Vorschau, dann kannst du bestellen.</p>}
            <Button size="lg" className="h-12 w-full text-base" disabled={!kannBestellen} onClick={bestellen}>
              {laden && geo ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{laden}</> : "Jetzt bestellen"}
            </Button>
            <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground"><ShieldCheck className="h-3.5 w-3.5" /> Sichere Zahlung über Stripe · TWINT, Karte</p>
          </div>
        </div>
      </aside>

      <Dialog open={!!checkoutOptions} onOpenChange={(o) => !o && setClientSecret(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader><DialogTitle>Bezahlung</DialogTitle></DialogHeader>
          {checkoutOptions && (
            <EmbeddedCheckoutProvider stripe={getStripe()} options={checkoutOptions}>
              <EmbeddedCheckout />
            </EmbeddedCheckoutProvider>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Zeile({ icon, label, wert }: { icon: ReactNode; label: string; wert: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-muted-foreground">{icon}</span>
      <span className="text-muted-foreground">{label}</span>
      <span className="ml-auto text-right font-medium">{wert}</span>
    </div>
  );
}
