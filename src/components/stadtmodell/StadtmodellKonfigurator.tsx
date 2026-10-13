import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { toast } from "sonner";
import { Loader2, MapPin, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { supabase } from "@/integrations/supabase/client";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { createStadtmodellCheckout } from "@/lib/stadtmodell.functions";
import {
  KANTE_MAX, KANTE_MIN, MASSSTAEBE, MATERIALIEN, MODELL_MAX_MM, MODELL_MIN_MM, QUELLE, SOCKEL_MAX, SOCKEL_MIN,
  berechnePreis, modellMm, type MaterialKey,
} from "@/lib/stadtmodell";
import { baueModell, exportStl, ladeGebaeude, ladeHoehen } from "@/lib/stadtmodell-mesh";

const START: [number, number] = [47.3769, 8.5417];

function squareBounds(lat: number, lon: number, kante: number): L.LatLngBoundsExpression {
  const dLat = kante / 2 / 110540;
  const dLon = kante / 2 / (111320 * Math.cos((lat * Math.PI) / 180));
  return [[lat - dLat, lon - dLon], [lat + dLat, lon + dLon]];
}

export default function StadtmodellKonfigurator() {
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const rectRef = useRef<L.Rectangle | null>(null);
  const [center, setCenter] = useState<[number, number]>(START);
  const [kante, setKante] = useState(250);
  const [massstab, setMassstab] = useState<number>(2000);
  const [sockel, setSockel] = useState(5);
  const [material, setMaterial] = useState<MaterialKey>("pla_weiss");
  const [suche, setSuche] = useState("");
  const [geo, setGeo] = useState<THREE.BufferGeometry | null>(null);
  const [laden, setLaden] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  const mm = modellMm(kante, massstab);
  const grenzeOk = mm >= MODELL_MIN_MM && mm <= MODELL_MAX_MM;
  const preis = berechnePreis(kante, massstab, sockel, material);

  useEffect(() => {
    if (!mapEl.current || mapRef.current) return;
    const map = L.map(mapEl.current, { center: START, zoom: 15 });
    L.tileLayer("https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-farbe/default/current/3857/{z}/{x}/{y}.jpeg", {
      maxZoom: 19, attribution: "© swisstopo",
    }).addTo(map);
    rectRef.current = L.rectangle(squareBounds(START[0], START[1], 250), { color: "#FF5A00", weight: 2, fillOpacity: 0.15 }).addTo(map);
    map.on("click", (e) => setCenter([e.latlng.lat, e.latlng.lng]));
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    rectRef.current?.setBounds(squareBounds(center[0], center[1], kante) as L.LatLngBounds);
    setGeo(null); setClientSecret(null);
  }, [center, kante]);
  useEffect(() => { setGeo(null); setClientSecret(null); }, [massstab, sockel]);
  useEffect(() => { setClientSecret(null); }, [material]);

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
    if (!geo) return;
    try {
      setLaden("Bereite Bestellung vor …");
      const res = await createStadtmodellCheckout({ data: {
        environment: getStripeEnvironment(), lat: center[0], lon: center[1], kantenlaenge_m: kante,
        massstab, sockel_mm: sockel, material, origin: window.location.origin,
      } });
      setLaden("Lade STL-Datei hoch …");
      const blob = await exportStl(geo);
      const { error } = await supabase.storage.from("stadtmodelle").uploadToSignedUrl(res.path, res.uploadToken, blob, { contentType: "model/stl" });
      if (error) throw new Error("STL-Upload fehlgeschlagen");
      setClientSecret(res.clientSecret);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Bestellung fehlgeschlagen");
    } finally { setLaden(null); }
  }

  const checkoutOptions = useMemo(() => clientSecret ? { fetchClientSecret: () => Promise.resolve(clientSecret) } : null, [clientSecret]);

  return (
    <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
      <div className="space-y-3">
        <div className="flex gap-2">
          <Input value={suche} onChange={(e) => setSuche(e.target.value)} onKeyDown={(e) => e.key === "Enter" && ortSuchen()} placeholder="Ort oder Adresse suchen, z. B. Bern Bundesplatz" />
          <Button variant="secondary" onClick={ortSuchen}><Search className="h-4 w-4" /></Button>
        </div>
        <div ref={mapEl} className="h-[420px] w-full overflow-hidden rounded-xl border border-border" />
        <p className="flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3 w-3" /> In die Karte klicken, um das Quadrat zu platzieren.</p>
        <div className="h-[340px] overflow-hidden rounded-xl border border-border bg-muted/30">
          {geo ? (
            <Canvas camera={{ position: [0, -mm * 1.1, mm * 0.9], fov: 45, up: [0, 0, 1] }}>
              <ambientLight intensity={0.6} />
              <directionalLight position={[mm, -mm, mm * 2]} intensity={1.2} />
              <mesh geometry={geo}><meshStandardMaterial color={material === "pla_grau" ? "#9a9a9a" : material === "pla_stein" ? "#c9c2b5" : "#f2f2f2"} /></mesh>
              <OrbitControls />
            </Canvas>
          ) : (
            <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
              {laden ?? "Klicke auf «3D-Vorschau erzeugen», um dein Modell zu sehen."}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-5 rounded-xl border border-border bg-card p-5">
        <div>
          <label className="text-sm font-medium">Kantenlänge: {kante} m</label>
          <Slider className="mt-3" min={KANTE_MIN} max={KANTE_MAX} step={10} value={[kante]} onValueChange={([v]) => setKante(v)} />
        </div>
        <div>
          <label className="text-sm font-medium">Massstab</label>
          <div className="mt-2 grid grid-cols-4 gap-2">
            {MASSSTAEBE.map((m) => (
              <Button key={m} size="sm" variant={massstab === m ? "default" : "outline"} onClick={() => setMassstab(m)}>1:{m}</Button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-sm font-medium">Sockelhöhe: {sockel} mm</label>
          <Slider className="mt-3" min={SOCKEL_MIN} max={SOCKEL_MAX} step={1} value={[sockel]} onValueChange={([v]) => setSockel(v)} />
        </div>
        <div>
          <label className="text-sm font-medium">Material</label>
          <div className="mt-2 grid gap-2">
            {(Object.keys(MATERIALIEN) as MaterialKey[]).map((k) => (
              <Button key={k} size="sm" variant={material === k ? "default" : "outline"} onClick={() => setMaterial(k)} className="justify-start">{MATERIALIEN[k].label}</Button>
            ))}
          </div>
        </div>
        <div className="rounded-lg bg-muted/40 p-4 text-sm">
          <div className="flex justify-between"><span>Modellgrösse</span><span className="font-medium">{mm} × {mm} mm</span></div>
          <div className="mt-1 flex justify-between text-lg"><span>Preis</span><span className="font-bold text-primary">CHF {preis.toFixed(2)}</span></div>
          {!grenzeOk && <p className="mt-2 text-destructive">Das Modell muss zwischen {MODELL_MIN_MM} und {MODELL_MAX_MM} mm gross sein – bitte Massstab oder Kantenlänge anpassen.</p>}
        </div>
        <div className="grid gap-2">
          <Button variant="secondary" disabled={!grenzeOk || !!laden} onClick={vorschau}>
            {laden && !geo ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}3D-Vorschau erzeugen
          </Button>
          <Button disabled={!geo || !grenzeOk || !!laden || !!clientSecret} onClick={bestellen}>
            {laden && geo ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{laden && geo ? laden : "Jetzt bestellen"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">{QUELLE}</p>
      </div>

      {checkoutOptions && (
        <div className="lg:col-span-2 rounded-xl border border-border bg-card p-2">
          <EmbeddedCheckoutProvider stripe={getStripe()} options={checkoutOptions}>
            <EmbeddedCheckout />
          </EmbeddedCheckoutProvider>
        </div>
      )}
    </div>
  );
}
