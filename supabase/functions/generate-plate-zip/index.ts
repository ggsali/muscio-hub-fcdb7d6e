import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import JSZip from "npm:jszip@3.10.1";

const UMLAUT: Record<string, string> = {
  ä: "ae", ö: "oe", ü: "ue", Ä: "Ae", Ö: "Oe", Ü: "Ue", ß: "ss",
  é: "e", è: "e", ê: "e", à: "a", á: "a", â: "a", î: "i", ï: "i",
  ô: "o", ó: "o", ò: "o", ç: "c", ñ: "n",
};
const sanitize = (s: string): string => {
  if (!s) return "unbenannt";
  let out = "";
  for (const ch of s) out += UMLAUT[ch] ?? ch;
  out = out.replace(/\s+/g, "-").replace(/[^A-Za-z0-9._-]/g, "-").replace(/-+/g, "-");
  out = out.replace(/^[-_.]+|[-_.]+$/g, "");
  return out || "unbenannt";
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { orderId } = await req.json();
    if (!orderId) {
      return new Response(JSON.stringify({ error: "orderId fehlt" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Order + Kunde
    const { data: order } = await supabase
      .from("orders").select("id, customer_id").eq("id", orderId).single();
    if (!order) {
      return new Response(JSON.stringify({ error: "Auftrag nicht gefunden" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    let customerLastName = "Kunde";
    if (order.customer_id) {
      const { data: c } = await supabase
        .from("customers").select("name").eq("id", order.customer_id).single();
      if (c?.name) customerLastName = c.name;
    }

    // Alle Platten dieses Auftrags
    const { data: plates } = await supabase
      .from("print_plates")
      .select("id, name, equipment_id, created_at, equipment:equipment_id(name)")
      .eq("order_id", orderId)
      .order("created_at", { ascending: true });

    if (!plates || plates.length === 0) {
      return new Response(JSON.stringify({ error: "Keine Druckplatten vorhanden" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const plateIds = plates.map((p: any) => p.id);
    const { data: ppRows } = await supabase
      .from("print_plate_parts")
      .select("id, plate_id, part_id, menge, parts(teilname)")
      .in("plate_id", plateIds);

    const allPartIds = Array.from(new Set((ppRows || []).map((r: any) => r.part_id)));
    const { data: files } = allPartIds.length
      ? await supabase
          .from("part_files")
          .select("part_id, filename, storage_path")
          .in("part_id", allPartIds)
      : { data: [] as any[] };

    const orderShort = String(orderId).slice(0, 8).toUpperCase();
    const customerSafe = sanitize(customerLastName);
    const rootFolder = `${orderShort}_${customerSafe}`;

    const zip = new JSZip();
    let added = 0;

    // Gruppieren nach Drucker
    const platesByPrinter = new Map<string, any[]>();
    for (const p of plates as any[]) {
      const printerName = (p.equipment?.name as string) || "Unbekannter-Drucker";
      const key = sanitize(printerName);
      if (!platesByPrinter.has(key)) platesByPrinter.set(key, []);
      platesByPrinter.get(key)!.push({ ...p, _printerSafe: key });
    }

    for (const [printerSafe, platesOfPrinter] of platesByPrinter) {
      for (let idx = 0; idx < platesOfPrinter.length; idx++) {
        const plate = platesOfPrinter[idx];
        const plateFolder = `${rootFolder}/${printerSafe}/Platte-${idx + 1}`;
        const partsOnPlate = (ppRows || []).filter((r: any) => r.plate_id === plate.id);
        // count duplicates per part on this plate to add suffix
        const seen = new Map<string, number>();
        for (const row of partsOnPlate) {
          const partFiles = (files || []).filter((f: any) => f.part_id === row.part_id);
          const stl = partFiles.find((f: any) => f.filename?.toLowerCase().endsWith(".stl")) || partFiles[0];
          if (!stl) continue;
          const { data: blob } = await supabase.storage.from("part-files").download(stl.storage_path);
          if (!blob) continue;
          const buf = await blob.arrayBuffer();
          const teilname = (row as any).parts?.teilname || "teil";
          const safe = sanitize(teilname);
          const copies = row.menge || 1;
          for (let i = 0; i < copies; i++) {
            const n = (seen.get(row.part_id) || 0) + 1;
            seen.set(row.part_id, n);
            const total = partsOnPlate
              .filter((r: any) => r.part_id === row.part_id)
              .reduce((s: number, r: any) => s + (r.menge || 1), 0);
            const suffix = total > 1 ? `_${n}` : "";
            zip.file(`${plateFolder}/${safe}${suffix}.stl`, buf);
            added++;
          }
        }
      }
    }

    if (added === 0) {
      return new Response(JSON.stringify({ error: "Keine STL-Dateien gefunden" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const zipData = await zip.generateAsync({ type: "uint8array" });
    const storagePath = `orders/${orderId}/gesamt.zip`;
    const { error: upErr } = await supabase.storage.from("print-plates").upload(storagePath, zipData, {
      contentType: "application/zip", upsert: true,
    });
    if (upErr) {
      return new Response(JSON.stringify({ error: upErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const downloadName = `${rootFolder}.zip`;
    const { data: signed } = await supabase.storage
      .from("print-plates")
      .createSignedUrl(storagePath, 60 * 60, { download: downloadName });

    return new Response(JSON.stringify({
      ok: true, path: storagePath, url: signed?.signedUrl,
      fileCount: added, downloadName, plateCount: plates.length,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
