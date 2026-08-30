import React, { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "@/lib/router-compat";
import { Upload, CheckCircle, AlertCircle, FileText, Image, Box, X, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

const SUPABASE_PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID;
const EDGE_URL = `https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/project-upload`;

interface LinkInfo {
  id: string;
  title: string;
  beschreibung: string | null;
  max_files: number;
}

interface UploadedFile {
  name: string;
  size: number;
  status: "uploading" | "done" | "error";
  nas_synced?: boolean;
  error?: string;
  progress?: number;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function fileIcon(name: string) {
  const ext = name.split(".").pop()?.toLowerCase();
  if (["png", "jpg", "jpeg", "webp", "gif"].includes(ext ?? "")) return <Image className="w-4 h-4 text-primary" />;
  if (ext === "pdf") return <FileText className="w-4 h-4 text-destructive" />;
  return <Box className="w-4 h-4 text-muted-foreground" />;
}

export default function ProjectUploadPage() {
  const { token } = useParams<{ token: string }>();
  const [link, setLink] = useState<LinkInfo | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [uploaderName, setUploaderName] = useState("");
  const [uploaderEmail, setUploaderEmail] = useState("");
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [allDone, setAllDone] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!token) return;
    fetch(`${EDGE_URL}/link/${token}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) setNotFound(true);
        else setLink(d);
      })
      .catch(() => setNotFound(true));
  }, [token]);

  const uploadFile = useCallback(async (file: File) => {
    const fileEntry: UploadedFile = { name: file.name, size: file.size, status: "uploading", progress: 0 };
    setFiles(prev => [...prev, fileEntry]);

    const updateFile = (patch: Partial<UploadedFile>) =>
      setFiles(prev => prev.map(f =>
        f.name === file.name && f.status === "uploading" ? { ...f, ...patch } : f
      ));

    try {
      // Step 1: Get presigned upload URL
      const presignRes = await fetch(`${EDGE_URL}/presign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, filename: file.name, contentType: file.type }),
      });
      const presignData = await presignRes.json();

      if (!presignRes.ok || !presignData.signedUrl) {
        updateFile({ status: "error", error: presignData.error ?? "Fehler beim Vorbereiten des Uploads" });
        return;
      }

      updateFile({ progress: 10 });

      // Step 2: Upload directly to storage via XHR PUT to signed URL (avoids CORS issues)
      updateFile({ progress: 30 });
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const pct = 30 + Math.round((e.loaded / e.total) * 50);
            updateFile({ progress: pct });
          }
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(`HTTP ${xhr.status}: ${xhr.responseText}`));
        };
        xhr.onerror = () => reject(new Error("Netzwerkfehler beim Upload"));
        xhr.open("PUT", presignData.signedUrl);
        xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
        xhr.send(file);
      });
      updateFile({ progress: 80 });

      updateFile({ progress: 90 });

      // Step 3: Confirm upload + trigger NAS sync
      const confirmRes = await fetch(`${EDGE_URL}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          storagePath: presignData.storagePath,
          linkId: presignData.linkId,
          filename: file.name,
          fileSize: file.size,
          fileType: file.type,
          uploaderName,
          uploaderEmail,
        }),
      });
      const confirmData = await confirmRes.json();

      if (confirmData.success) {
        updateFile({ status: "done", progress: 100, nas_synced: confirmData.nas_synced });
      } else {
        updateFile({ status: "error", error: confirmData.error ?? "Fehler beim Bestätigen" });
      }
    } catch (err: any) {
      updateFile({ status: "error", error: err?.message ?? "Verbindungsfehler" });
    }
  }, [token, uploaderName, uploaderEmail]);

  const handleFiles = useCallback((fileList: FileList | null) => {
    if (!fileList) return;
    Array.from(fileList).forEach(f => uploadFile(f));
  }, [uploadFile]);

  const removeFile = (name: string) => setFiles(prev => prev.filter(f => f.name !== name));

  const doneCount = files.filter(f => f.status === "done").length;
  const uploadingCount = files.filter(f => f.status === "uploading").length;

  if (notFound) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto" />
          <h1 className="text-xl font-bold">Link nicht gefunden</h1>
          <p className="text-muted-foreground text-sm">Dieser Upload-Link ist ungültig oder abgelaufen.</p>
        </div>
      </div>
    );
  }

  if (!link) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (allDone) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center space-y-4 max-w-md">
          <CheckCircle className="w-16 h-16 text-primary mx-auto" />
          <h1 className="text-2xl font-bold">Danke!</h1>
          <p className="text-muted-foreground">{doneCount} Datei{doneCount !== 1 ? "en" : ""} erfolgreich übermittelt. Wir melden uns bei dir.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-xl space-y-6">
        {/* Header */}
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold">{link.title}</h1>
          {link.beschreibung && <p className="text-muted-foreground text-sm">{link.beschreibung}</p>}
        </div>

        {/* Contact fields */}
        <div className="bg-card border border-border rounded-lg p-4 space-y-3">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Deine Angaben</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={uploaderName} onChange={e => setUploaderName(e.target.value)} placeholder="Max Mustermann" />
            </div>
            <div className="space-y-1.5">
              <Label>E-Mail</Label>
              <Input value={uploaderEmail} onChange={e => setUploaderEmail(e.target.value)} placeholder="max@beispiel.ch" type="email" />
            </div>
          </div>
        </div>

        {/* Upload zone */}
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
          onClick={() => inputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${
            dragOver ? "border-primary bg-primary/5 scale-[1.01]" : "border-border hover:border-primary/50 hover:bg-muted/30"
          }`}
        >
          <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <p className="font-medium">Dateien hier ablegen</p>
          <p className="text-muted-foreground text-sm mt-1">oder klicken zum Auswählen</p>
          <p className="text-muted-foreground text-xs mt-2">STL, 3MF, STEP, OBJ, PDF, Bilder – auch grosse Dateien</p>
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            accept=".stl,.3mf,.step,.obj,.pdf,.png,.jpg,.jpeg,.webp,.zip,.rar,.7z,model/stl,model/x.stl-ascii,model/x.stl-binary,application/sla,application/vnd.ms-pki.stl,application/octet-stream,*/*"
            onChange={e => handleFiles(e.target.files)}
          />
        </div>

        {/* File list */}
        {files.length > 0 && (
          <div className="space-y-2">
            {files.map((f, i) => (
              <div key={i} className="flex items-center gap-3 bg-card border border-border rounded-lg px-3 py-2.5">
                {f.status === "uploading" ? (
                  <Loader2 className="w-4 h-4 animate-spin text-primary flex-shrink-0" />
                ) : f.status === "done" ? (
                  <CheckCircle className="w-4 h-4 text-primary flex-shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {fileIcon(f.name)}
                    <span className="font-medium text-sm truncate">{f.name}</span>
                  </div>
                  <div className="text-xs text-muted-foreground flex gap-2 mt-0.5">
                    <span>{formatBytes(f.size)}</span>
                    {f.status === "uploading" && (
                      <span className="text-primary">
                        {f.progress != null && f.progress > 0 ? `${f.progress}% hochgeladen...` : "Wird vorbereitet..."}
                      </span>
                    )}
                    {f.status === "done" && (
                      <span className="text-primary">{f.nas_synced ? "✓ NAS gespeichert" : "✓ Gespeichert"}</span>
                    )}
                    {f.status === "error" && <span className="text-destructive">{f.error ?? "Fehler"}</span>}
                  </div>
                  {/* Progress bar */}
                  {f.status === "uploading" && f.progress != null && (
                    <div className="mt-1.5 h-1 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all duration-300"
                        style={{ width: `${f.progress}%` }}
                      />
                    </div>
                  )}
                </div>
                {f.status !== "uploading" && (
                  <button onClick={() => removeFile(f.name)} className="text-muted-foreground hover:text-foreground">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Submit */}
        {doneCount > 0 && uploadingCount === 0 && (
          <Button className="w-full" onClick={() => setAllDone(true)}>
            <CheckCircle className="w-4 h-4 mr-2" />
            Fertig – {doneCount} Datei{doneCount !== 1 ? "en" : ""} übermittelt
          </Button>
        )}
      </div>
    </div>
  );
}
