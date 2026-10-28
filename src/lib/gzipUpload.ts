// Hilfen für den Slicer-Upload: verlustfreie gzip-Kompression im Browser und Warten auf den G-Code im Storage.

/** Grosse Dateien (STL/OBJ) verlustfrei mit gzip komprimieren. Der Inhalt bleibt Byte für Byte gleich, die Edge Function entpackt wieder.
 *  Fällt auf die Originaldatei zurück, wenn der Browser keine Kompression kann oder sie kaum etwas bringt. */
export async function gzipIfWorthIt(
  file: Blob,
  name: string,
  minBytes = 1024 * 1024,
): Promise<{ blob: Blob; name: string; gz: boolean }> {
  try {
    if (file.size < minBytes || typeof CompressionStream === "undefined") return { blob: file, name, gz: false };
    const out = await new Response(file.stream().pipeThrough(new CompressionStream("gzip"))).blob();
    if (out.size >= file.size * 0.9) return { blob: file, name, gz: false };
    return { blob: out, name: `${name}.gz`, gz: true };
  } catch {
    return { blob: file, name, gz: false };
  }
}

/** Hat die Edge Function die Datei wegen der Kompression abgelehnt (alte Version noch aktiv)? Dann unkomprimiert wiederholen. */
export const gzAbgelehnt = (json: { error?: unknown } | null | undefined): boolean =>
  /Dateityp|entpackt/i.test(String(json?.error ?? ""));

/** Wartet, bis der im Hintergrund gespeicherte G-Code im Storage liegt (Prüfung über slice-public ?gcode_check=). */
export async function warteAufGcode(path: string, maxMs = 90_000): Promise<boolean> {
  const t0 = Date.now();
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/slice-public?gcode_check=${encodeURIComponent(path)}`;
  while (Date.now() - t0 < maxMs) {
    try {
      const res = await fetch(url, { method: "POST", headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "" } });
      const j = await res.json().catch(() => ({}));
      if (j?.ready) return true;
    } catch {
      /* nächster Versuch */
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  return false;
}
