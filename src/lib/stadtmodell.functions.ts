import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { COLOR_MAP } from "./colorMap";
import {
  MASSSTAEBE, MODELL_MAX_MM, MODELL_MIN_MM, VERSAND, berechnePreis, modellMm,
  type StadtmodellFilament, type VersandKey,
} from "./stadtmodell";

function toFilament(r: any): StadtmodellFilament {
  const farben = Array.isArray(r.farben) ? r.farben : [];
  const c = farben[0];
  const farbname = typeof c === "object" && c?.name ? String(c.name) : typeof c === "string" ? c : String(r.farbe || "").replace(/^#(?![0-9a-f]{3,6}$)/i, "");
  let hex = typeof c === "object" && c?.hex ? String(c.hex) : typeof c === "string" && /^#[0-9a-f]{3,6}$/i.test(c) ? c : "";
  if (!hex && /^#[0-9a-f]{3,6}$/i.test(r.farbe || "")) hex = r.farbe;
  if (!hex) hex = COLOR_MAP[farbname] || "#e8e8e8";
  return { id: r.id, name: r.name, material: r.material, hersteller: r.hersteller, hex, farbname };
}

async function ladeFreigegebene() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("filaments")
    .select("id,name,material,hersteller,farbe,farben")
    .eq("stadtmodell_aktiv", true)
    .eq("aktiv", true)
    .order("material")
    .order("name");
  if (error) throw new Error("Filamente konnten nicht geladen werden");
  return (data || []).map(toFilament);
}

/** Public: filaments the admin enabled for city models (non-sensitive fields only). */
export const listStadtmodellFilamente = createServerFn({ method: "GET" }).handler(async () => ladeFreigegebene());

const Input = z.object({
  lat: z.number().gt(45.7).lt(47.9),
  lon: z.number().gt(5.9).lt(10.6),
  kantenlaenge_m: z.number().int().min(100).max(500),
  massstab: z.number().refine((m) => (MASSSTAEBE as readonly number[]).includes(m)),
  sockel_mm: z.number().min(2).max(15),
  filament_id: z.string().uuid(),
  versand: z.enum(Object.keys(VERSAND) as [VersandKey, ...VersandKey[]]),
  origin: z.string().url(),
});

export const createStadtmodellCheckout = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }) => {
    const mm = modellMm(data.kantenlaenge_m, data.massstab);
    if (mm < MODELL_MIN_MM || mm > MODELL_MAX_MM) throw new Error(`Modellgrösse muss zwischen ${MODELL_MIN_MM} und ${MODELL_MAX_MM} mm liegen`);
    const filament = (await ladeFreigegebene()).find((f) => f.id === data.filament_id);
    if (!filament) throw new Error("Dieses Filament ist nicht verfügbar");
    const preis = berechnePreis(data.kantenlaenge_m, data.massstab, data.sockel_mm);
    const versand = VERSAND[data.versand];
    const materialLabel = `${filament.material} · ${filament.name}`;
    const origin = /^https:\/\/([a-z0-9-]+\.)*(3dmuscio\.com|lovable\.app)$|^http:\/\/localhost(:\d+)?$/.test(data.origin) ? data.origin : "https://3dmuscio.com";

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin.from("stadtmodell_bestellungen").insert({
      lat: data.lat, lon: data.lon, kantenlaenge_m: data.kantenlaenge_m, massstab: data.massstab,
      sockel_mm: data.sockel_mm, material: materialLabel, modell_mm: mm, preis: preis + versand.preis,
      versandart: versand.label, versandkosten: versand.preis,
    }).select("id").single();
    if (error) throw new Error("Bestellung konnte nicht angelegt werden");
    const path = `${row.id}.stl`;
    const { data: up, error: upErr } = await supabaseAdmin.storage.from("stadtmodelle").createSignedUploadUrl(path);
    if (upErr || !up) throw new Error("Upload konnte nicht vorbereitet werden");

    const name = `Stadtmodell ${data.kantenlaenge_m}×${data.kantenlaenge_m} m, 1:${data.massstab} (${mm}×${mm} mm), ${materialLabel} – ${versand.label}`;
    const { createGateway } = await import("./payrexx.server");
    let gw: { id: number; link: string };
    try {
      gw = await createGateway({
        amountChf: preis + versand.preis, purpose: name, referenceId: `stadt:${row.id}`,
        successUrl: `${origin}/payment-success?ref=${row.id.slice(0, 8)}`, cancelUrl: `${origin}/stadtmodell`, adresse: true,
      });
    } catch {
      await supabaseAdmin.from("stadtmodell_bestellungen").update({ status: "fehler", fehler: "Checkout fehlgeschlagen" }).eq("id", row.id);
      throw new Error("Zahlung konnte nicht gestartet werden");
    }
    await supabaseAdmin.from("stadtmodell_bestellungen").update({ stripe_session_id: `payrexx:${gw.id}`, stl_path: path }).eq("id", row.id);
    return { url: gw.link, path, uploadToken: up.token };
  });
