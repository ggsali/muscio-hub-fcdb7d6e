import { gzAbgelehnt, gzipIfWorthIt } from "@/lib/gzipUpload";

export interface AdminSliceResult {
  printTimeS: number;
  filamentG: number;
  hasSupport: boolean;
  layers: number | null;
  splitParts: number | null;
}

export const SCHICHTHOEHEN = ["0.08", "0.12", "0.16", "0.20"] as const;

/** Slict eine Modelldatei über den Slicer-Server (Edge Function slice-public) mit gewählter Schichthöhe und Infill. Wirft mit lesbarer Meldung. */
export async function sliceDatei(file: File, schichthoehe: string, infill: number): Promise<AdminSliceResult> {
  const senden = async (komprimiert: boolean) => {
    const up = komprimiert && /\.(stl|obj)$/i.test(file.name) ? await gzipIfWorthIt(file, file.name) : { blob: file as Blob, name: file.name, gz: false };
    const body = new FormData();
    body.append("file", up.gz ? new File([up.blob], up.name) : file);
    if (up.gz) body.append("gz", "1");
    body.append("quality", schichthoehe);
    body.append("infill", String(Math.min(100, Math.max(5, Math.round(infill)))));
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/slice-public`, {
      method: "POST",
      headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "" },
      body,
      signal: AbortSignal.timeout(130_000),
    });
    return { res, json: await res.json().catch(() => ({})), gz: up.gz };
  };
  let v = await senden(true);
  if (v.gz && gzAbgelehnt(v.json)) v = await senden(false);
  const st = v.json?.stats;
  if (!v.res.ok || !st || !(st.filament_g > 0) || !(st.print_time_s > 0)) {
    const grund = String(v.json?.detail ?? v.json?.error ?? "").slice(0, 200);
    throw new Error(grund ? `Slicer: ${grund}` : "Der Slicer-Server hat nicht geantwortet (ist die NAS-Schätzung aktiv?)");
  }
  return {
    printTimeS: Number(st.print_time_s),
    filamentG: Number(st.filament_g),
    hasSupport: !!st.has_support,
    layers: st.layers != null ? Number(st.layers) : null,
    splitParts: Number(v.json?.split?.parts) >= 2 ? Math.floor(Number(v.json.split.parts)) : null,
  };
}
