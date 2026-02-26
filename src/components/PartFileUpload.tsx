import React, { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Upload, Trash2, Download, FileText, Image, Box } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PartFile {
  id: string;
  filename: string;
  storage_path: string;
  file_type: string;
  file_size_bytes: number;
  created_at: string;
}

interface Props {
  partId?: string;      // null for unsaved parts
  orderId?: string;
  customerId?: string;
  disabled?: boolean;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function fileIcon(type: string) {
  if (type?.startsWith("image")) return <Image className="w-4 h-4 text-primary" />;
  if (type?.includes("pdf")) return <FileText className="w-4 h-4 text-destructive" />;
  return <Box className="w-4 h-4 text-muted-foreground" />;
}

export default function PartFileUpload({ partId, orderId, customerId, disabled }: Props) {
  const [files, setFiles] = useState<PartFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!partId) return;
    const { data } = await supabase.from("part_files").select("*").eq("part_id", partId).order("created_at");
    if (data) setFiles(data as PartFile[]);
  }, [partId]);

  useEffect(() => { load(); }, [load]);

  const uploadFile = async (file: File) => {
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${orderId ?? "no-order"}/${partId ?? "no-part"}/${Date.now()}_${file.name}`;
    const { error } = await supabase.storage.from("part-files").upload(path, file, { upsert: false });
    if (!error) {
      await supabase.from("part_files").insert({
        part_id: partId ?? null,
        order_id: orderId ?? null,
        customer_id: customerId ?? null,
        filename: file.name,
        storage_path: path,
        file_type: file.type,
        file_size_bytes: file.size,
      });
      await load();
    }
    setUploading(false);
  };

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList) return;
    for (const f of Array.from(fileList)) await uploadFile(f);
  };

  const handleDelete = async (f: PartFile) => {
    await supabase.storage.from("part-files").remove([f.storage_path]);
    await supabase.from("part_files").delete().eq("id", f.id);
    await load();
  };

  const handleDownload = async (f: PartFile) => {
    const { data } = await supabase.storage.from("part-files").createSignedUrl(f.storage_path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  return (
    <div className="space-y-2">
      {/* Upload zone */}
      {!disabled && (
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
          onClick={() => inputRef.current?.click()}
          className={`border-2 border-dashed rounded-md px-3 py-2.5 flex items-center gap-2 cursor-pointer transition-colors text-xs ${
            dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
          }`}
        >
          <Upload className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
          <span className="text-muted-foreground">
            {uploading ? "Hochladen..." : "Dateien hier ablegen oder klicken"}
          </span>
          <input ref={inputRef} type="file" multiple className="hidden" accept=".stl,.3mf,.pdf,.png,.jpg,.jpeg,.webp,.step,.obj" onChange={e => handleFiles(e.target.files)} />
        </div>
      )}

      {/* File list */}
      {files.length > 0 && (
        <div className="space-y-1">
          {files.map(f => (
            <div key={f.id} className="flex items-center gap-2 px-2 py-1.5 rounded bg-muted/30 border border-border/50 text-xs group">
              {fileIcon(f.file_type)}
              <span className="flex-1 truncate text-foreground font-medium">{f.filename}</span>
              <span className="text-muted-foreground flex-shrink-0">{formatBytes(f.file_size_bytes)}</span>
              <button onClick={() => handleDownload(f)} className="text-muted-foreground hover:text-primary transition-colors opacity-0 group-hover:opacity-100">
                <Download className="w-3.5 h-3.5" />
              </button>
              {!disabled && (
                <button onClick={() => handleDelete(f)} className="text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
