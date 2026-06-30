import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import JSZip from "npm:jszip@3.10.1";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { plateId } = await req.json();
    if (!plateId) {
      return new Response(JSON.stringify({ error: "plateId fehlt" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: plate } = await supabase.from("print_plates").select("*").eq("id", plateId).single();
    if (!plate) {
      return new Response(JSON.stringify({ error: "Druckplatte nicht gefunden" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: ppRows } = await supabase
      .from("print_plate_parts")
      .select("part_id, menge, parts(teilname)")
      .eq("plate_id", plateId);

    const partIds = (ppRows || []).map((r: any) => r.part_id);
    if (!partIds.length) {
      return new Response(JSON.stringify({ error: "Keine Teile auf der Platte" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: files } = await supabase
      .from("part_files")
      .select("part_id, filename, storage_path")
      .in("part_id", partIds);

    const zip = new JSZip();
    let added = 0;
    for (const row of ppRows || []) {
      const partFiles = (files || []).filter((f: any) => f.part_id === row.part_id);
      const stlFile = partFiles.find((f: any) => f.filename.toLowerCase().endsWith(".stl")) || partFiles[0];
      if (!stlFile) continue;
      const { data: blob } = await supabase.storage.from("part-files").download(stlFile.storage_path);
      if (!blob) continue;
      const buf = await blob.arrayBuffer();
      const teilname = (row as any).parts?.teilname || "teil";
      const safe = teilname.replace(/[^a-z0-9_\-]+/gi, "_");
      for (let i = 1; i <= (row.menge || 1); i++) {
        const suffix = (row.menge || 1) > 1 ? `_${i}` : "";
        zip.file(`${safe}${suffix}_${stlFile.filename}`, buf);
        added++;
      }
    }

    if (added === 0) {
      return new Response(JSON.stringify({ error: "Keine STL-Dateien gefunden" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const zipData = await zip.generateAsync({ type: "uint8array" });
    const path = `${plate.order_id || "general"}/${plateId}_${Date.now()}.zip`;
    const { error: upErr } = await supabase.storage.from("print-plates").upload(path, zipData, {
      contentType: "application/zip", upsert: true,
    });
    if (upErr) {
      return new Response(JSON.stringify({ error: upErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabase.from("print_plates").update({
      zip_path: path,
      status: plate.status === "geplant" ? "zip_erstellt" : plate.status,
    }).eq("id", plateId);

    const { data: signed } = await supabase.storage.from("print-plates").createSignedUrl(path, 60 * 60);
    return new Response(JSON.stringify({ ok: true, path, url: signed?.signedUrl, fileCount: added }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
