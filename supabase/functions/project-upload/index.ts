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

  // GET /project-upload/link/:token → validate token
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

  // POST /project-upload/presign → get a presigned upload URL for direct client upload
  if (req.method === "POST" && path[1] === "presign") {
    const { token, filename, contentType } = await req.json();

    if (!token || !filename) {
      return new Response(JSON.stringify({ error: "Fehlende Parameter" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Sanitize filename to prevent path traversal
    const safeName = String(filename).replace(/[^a-zA-Z0-9._\-]/g, "_").replace(/^\.+/, "_").slice(0, 200);
    if (!safeName || safeName === "_") {
      return new Response(JSON.stringify({ error: "Ungültiger Dateiname" }), {
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

    const storagePath = `${link.id}/${Date.now()}_${safeName}`;


    // Create a presigned upload URL (valid for 1 hour)
    const { data: signedData, error: signError } = await supabase.storage
      .from("project-uploads")
      .createSignedUploadUrl(storagePath);

    if (signError || !signedData) {
      return new Response(JSON.stringify({ error: "Fehler beim Erstellen der Upload-URL: " + signError?.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      signedUrl: signedData.signedUrl,
      token: signedData.token,
      storagePath,
      linkId: link.id,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // POST /project-upload/confirm → after client upload, save metadata + push to NAS
  if (req.method === "POST" && path[1] === "confirm") {
    const { token, storagePath, linkId, filename, fileSize, fileType, uploaderName, uploaderEmail } = await req.json();

    if (!token || !storagePath || !linkId) {
      return new Response(JSON.stringify({ error: "Fehlende Parameter" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate token again
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

    // 1. Save file record FIRST (so upload is never lost even if NAS fails)
    const { data: fileRecord, error: insertError } = await supabase.from("upload_link_files").insert({
      upload_link_id: linkId,
      filename,
      storage_path: storagePath,
      file_type: fileType || null,
      file_size_bytes: fileSize || null,
      nas_path: null,
      nas_synced: false,
      uploader_name: uploaderName || null,
      uploader_email: uploaderEmail || null,
    }).select().single();

    if (insertError) {
      console.error("Insert error:", insertError);
      return new Response(JSON.stringify({ error: "Fehler beim Speichern: " + insertError.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Push to NAS via WebDAV with 25s timeout
    const webdavUrl = Deno.env.get("WEBDAV_URL");
    const webdavUser = Deno.env.get("WEBDAV_USERNAME");
    const webdavPass = Deno.env.get("WEBDAV_PASSWORD");

    let nasSynced = false;
    let nasPath = "";

    if (webdavUrl && webdavUser && webdavPass) {
      console.log("Starting NAS sync for:", storagePath, "WebDAV URL:", webdavUrl);
      try {
        const { data: fileData, error: downloadError } = await supabase.storage
          .from("project-uploads")
          .download(storagePath);

        if (downloadError) {
          console.error("Storage download error:", downloadError.message);
        } else if (fileData) {
          const credentials = btoa(`${webdavUser}:${webdavPass}`);
          const folderPath = `${webdavUrl.replace(/\/$/, "")}/${linkId}/`;

          // Create folder (ignore if exists), 10s timeout
          const mkcolAbort = new AbortController();
          const mkcolTimer = setTimeout(() => mkcolAbort.abort(), 10000);
          await fetch(folderPath, {
            method: "MKCOL",
            headers: { Authorization: `Basic ${credentials}` },
            signal: mkcolAbort.signal,
          }).catch((e) => console.log("MKCOL (ignored):", e.message));
          clearTimeout(mkcolTimer);

          nasPath = `${folderPath}${filename}`;
          console.log("Uploading to NAS path:", nasPath);

          const putAbort = new AbortController();
          const putTimer = setTimeout(() => putAbort.abort(), 25000);
          const nasRes = await fetch(nasPath, {
            method: "PUT",
            headers: {
              Authorization: `Basic ${credentials}`,
              "Content-Type": fileType || "application/octet-stream",
            },
            body: fileData,
            signal: putAbort.signal,
          });
          clearTimeout(putTimer);

          nasSynced = nasRes.ok;
          const nasBody = await nasRes.text();
          if (!nasRes.ok) {
            console.error("NAS upload failed:", nasRes.status, nasBody);
          } else {
            console.log("NAS upload success:", nasRes.status);
          }

          // Update DB record with NAS result
          await supabase.from("upload_link_files").update({
            nas_synced: nasSynced,
            nas_path: nasSynced ? nasPath : null,
          }).eq("id", fileRecord.id);
        }
      } catch (e) {
        console.error("WebDAV error:", (e as Error).message);
      }
    }

    return new Response(JSON.stringify({ success: true, file: fileRecord, nas_synced: nasSynced }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ error: "Not found" }), {
    status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
