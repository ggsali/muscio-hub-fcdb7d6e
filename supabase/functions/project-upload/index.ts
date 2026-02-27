import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const url = new URL(req.url);
  const path = url.pathname.split("/").filter(Boolean);

  // GET /project-upload/link/:token  → validate token
  if (req.method === "GET" && path[1] === "link" && path[2]) {
    const token = path[2];
    const { data, error } = await supabase
      .from("upload_links")
      .select("id, title, beschreibung, max_files, expires_at, customer_id, order_id")
      .eq("token", token)
      .eq("aktiv", true)
      .single();

    if (error || !data) {
      return new Response(JSON.stringify({ error: "Link nicht gefunden oder abgelaufen" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: "Link ist abgelaufen" }), {
        status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // POST /project-upload/upload  → upload file + push to NAS
  if (req.method === "POST" && path[1] === "upload") {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const token = formData.get("token") as string;
    const uploaderName = formData.get("uploader_name") as string ?? "";
    const uploaderEmail = formData.get("uploader_email") as string ?? "";

    if (!file || !token) {
      return new Response(JSON.stringify({ error: "Fehlende Parameter" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate token
    const { data: link, error: linkError } = await supabase
      .from("upload_links")
      .select("*")
      .eq("token", token)
      .eq("aktiv", true)
      .single();

    if (linkError || !link) {
      return new Response(JSON.stringify({ error: "Ungültiger Upload-Link" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (link.expires_at && new Date(link.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: "Link ist abgelaufen" }), {
        status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Upload to storage
    const storagePath = `${link.id}/${Date.now()}_${file.name}`;
    const fileBuffer = await file.arrayBuffer();
    const { error: storageError } = await supabase.storage
      .from("project-uploads")
      .upload(storagePath, fileBuffer, { contentType: file.type, upsert: false });

    if (storageError) {
      return new Response(JSON.stringify({ error: "Fehler beim Speichern: " + storageError.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Push to NAS via WebDAV
    const webdavUrl = Deno.env.get("WEBDAV_URL");
    const webdavUser = Deno.env.get("WEBDAV_USERNAME");
    const webdavPass = Deno.env.get("WEBDAV_PASSWORD");

    let nasSynced = false;
    let nasPath = "";

    if (webdavUrl && webdavUser && webdavPass) {
      try {
        const credentials = btoa(`${webdavUser}:${webdavPass}`);
        // Create folder for this upload link
        const folderPath = `${webdavUrl.replace(/\/$/, "")}/${link.id}/`;
        await fetch(folderPath, {
          method: "MKCOL",
          headers: { Authorization: `Basic ${credentials}` },
        }).catch(() => {}); // Ignore if folder already exists

        nasPath = `${folderPath}${file.name}`;
        const nasRes = await fetch(nasPath, {
          method: "PUT",
          headers: {
            Authorization: `Basic ${credentials}`,
            "Content-Type": file.type || "application/octet-stream",
          },
          body: fileBuffer,
        });
        nasSynced = nasRes.ok;
      } catch (e) {
        console.error("WebDAV error:", e);
      }
    }

    // Save file record
    const { data: fileRecord } = await supabase.from("upload_link_files").insert({
      upload_link_id: link.id,
      filename: file.name,
      storage_path: storagePath,
      file_type: file.type,
      file_size_bytes: file.size,
      nas_path: nasPath || null,
      nas_synced: nasSynced,
      uploader_name: uploaderName || null,
      uploader_email: uploaderEmail || null,
    }).select().single();

    return new Response(JSON.stringify({ success: true, file: fileRecord, nas_synced: nasSynced }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ error: "Not found" }), {
    status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
