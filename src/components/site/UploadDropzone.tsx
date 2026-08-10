import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { isAcceptedModel, setPendingUploads } from "@/lib/pendingUpload";

interface UploadDropzoneProps {
  className?: string;
  /** Kompakte Variante für schmale Spalten */
  compact?: boolean;
}

/**
 * Prominente Drag-&-Drop-Fläche. Übergibt die Datei an den Online-Kalkulator,
 * damit Preis, Material und Farbe direkt gewählt werden können.
 */
export const UploadDropzone = ({ className, compact = false }: UploadDropzoneProps) => {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  const handleFiles = (files: File[]) => {
    const accepted = files.filter((f) => isAcceptedModel(f.name));
    if (accepted.length === 0) {
      toast.error("Bitte eine STL-, STEP-, 3MF- oder OBJ-Datei wählen.");
      return;
    }
    setPendingUploads(accepted);
    navigate("/kalkulator-online");
  };

  return (
    <div
      className={cn(
        "h-full rounded-2xl border-2 border-dashed bg-card/60 p-6 text-center transition-all cursor-pointer",
        "flex flex-col items-center justify-center gap-4 min-h-[16rem]",
        over ? "border-primary bg-card shadow-lg" : "border-primary/30 hover:border-primary hover:bg-card",
        className,
      )}
      role="button"
      tabIndex={0}
      aria-label="CAD-Datei hochladen und Preis berechnen"
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        handleFiles(Array.from(e.dataTransfer.files));
      }}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".stl,.step,.stp,.3mf,.obj"
        className="hidden"
        onChange={(e) => {
          handleFiles(Array.from(e.target.files || []));
          e.target.value = "";
        }}
      />

      <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center shadow-[0_10px_20px_-5px_hsl(var(--primary)/0.45)]">
        <UploadCloud className="w-8 h-8 text-primary-foreground" />
      </div>

      <div>
        <h3 className="font-heading text-xl font-bold text-foreground">CAD-Daten hochladen</h3>
        <p className="text-sm text-muted-foreground mt-1">
          STL, STEP, 3MF oder OBJ hierher ziehen
        </p>
      </div>

      {!compact && (
        <div className="w-full space-y-2">
          <div className="text-[10px] text-left uppercase tracking-widest font-bold text-muted-foreground/70">
            Unterstützte Formate
          </div>
          <div className="flex flex-wrap gap-2">
            {[".stl", ".step", ".3mf", ".obj"].map((f) => (
              <span
                key={f}
                className="px-2 py-1 bg-card border border-border text-[10px] font-bold rounded uppercase text-muted-foreground"
              >
                {f}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default UploadDropzone;
