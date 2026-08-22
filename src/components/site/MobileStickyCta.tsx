import { useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { isAcceptedModel, setPendingUploads } from "@/lib/pendingUpload";

const HIDDEN_ON = ["/kalkulator-online", "/kunde", "/portal", "/admin"];

/**
 * Permanente Mobile-CTA am unteren Bildschirmrand: Datei wählen und direkt
 * in den Kalkulator springen. Tap-Target > 44px.
 */
export const MobileStickyCta = () => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  if (HIDDEN_ON.some((p) => pathname.startsWith(p))) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-background/85 backdrop-blur-xl border-t border-border px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".stl,.step,.stp,.3mf,.obj,model/stl,model/x.stl-ascii,model/x.stl-binary,application/sla,application/vnd.ms-pki.stl,application/octet-stream,*/*"
        className="hidden"
        onChange={(e) => {
          const accepted = Array.from(e.target.files || []).filter((f) => isAcceptedModel(f.name));
          e.target.value = "";
          if (accepted.length === 0) {
            toast.error("Bitte eine STL-, STEP-, 3MF- oder OBJ-Datei wählen.");
            return;
          }
          setPendingUploads(accepted);
          navigate("/kalkulator-online");
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="w-full min-h-[52px] rounded-xl bg-primary text-primary-foreground font-bold text-[15px] leading-tight flex items-center justify-center gap-2.5 px-3 text-center active:scale-[0.98] transition-transform"
      >
        <UploadCloud className="w-5 h-5" />
        Datei hochladen &amp; Preis berechnen
      </button>
    </div>
  );
};

export default MobileStickyCta;
