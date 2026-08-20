import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Sparkles, X, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type ChatMsg = { id: string; role: "assistant" | "user"; text: string };

export interface KiResult {
  material: string;
  begruendung: string;
  transcript: string;
}

const START_TEXT =
  "Hallo! Ich bin die Material-Beratung von 3DMuscio. Erzähl mir kurz: wofür wird dein Bauteil verwendet? Du kannst mir jederzeit Rückfragen stellen oder Materialien vergleichen lassen.";

const startTextFor = (partNames: string[]) => {
  if (partNames.length > 1) {
    return `Hallo! Ich bin die Material-Beratung von 3DMuscio. Du hast ${partNames.length} Teile hochgeladen (${partNames.join(", ")}).\n\nGehören die Teile alle zum gleichen Bauteil bzw. zur gleichen Baugruppe, oder hat jedes Teil eine eigene Funktion? Bei unterschiedlichen Funktionen empfehle ich dir pro Teil ein passendes Material.`;
  }
  return START_TEXT;
};

const QUICK_REPLIES = ["Halterung", "Gehäuse", "Prototyp", "Ersatzteil", "Dekoration", "Sichtteil"];

const Avatar = () => (
  <div className="w-8 h-8 shrink-0 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px] font-bold">
    3DM
  </div>
);

const Typing = () => (
  <div className="flex items-center gap-1 px-4 py-3">
    {[0, 1, 2].map((i) => (
      <span
        key={i}
        className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce"
        style={{ animationDelay: `${i * 0.15}s` }}
      />
    ))}
  </div>
);

export default function KiMaterialChat({
  fileName,
  geometry,
  availableMaterials,
  partNames = [],
  onResult,
  mobileFullscreen,
  onClose,
  onAcceptRecommendation,
  recommendedMaterialName,
}: {
  fileName: string;
  geometry: string;
  availableMaterials: string[];
  partNames?: string[];
  onResult: (r: KiResult) => void;
  mobileFullscreen?: boolean;
  onClose?: () => void;
  onAcceptRecommendation?: () => void;
  recommendedMaterialName?: string;
}) {
  const [messages, setMessages] = useState<ChatMsg[]>([
    { id: "start", role: "assistant", text: startTextFor(partNames) },
  ]);
  const [typing, setTyping] = useState(false);
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, typing]);

  const send = async (text: string) => {
    const value = text.trim();
    if (!value || typing) return;
    setInput("");
    const history: ChatMsg[] = [
      ...messages,
      { id: crypto.randomUUID(), role: "user", text: value },
    ];
    setMessages(history);
    setTyping(true);
    try {
      const { data, error } = await supabase.functions.invoke("ki-materialberatung", {
        body: {
          messages: history.map((m) => ({ role: m.role, content: m.text })),
          fileName,
          geometry,
          availableMaterials,
          partNames,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);

      const antwort = (data as any).antwort as string;
      const empfehlung = (data as any).empfehlung as string | null;
      const begruendung = ((data as any).begruendung as string | null) || "";

      setTyping(false);
      const withReply: ChatMsg[] = [
        ...history,
        { id: crypto.randomUUID(), role: "assistant", text: antwort },
      ];
      setMessages(withReply);

      if (empfehlung) {
        onResult({
          material: empfehlung,
          begruendung: begruendung || antwort,
          transcript: withReply
            .map((m) => `${m.role === "user" ? "Kunde" : "KI"}: ${m.text}`)
            .join("\n"),
        });
      }
    } catch (e) {
      console.error(e);
      setTyping(false);
      setMessages((m) => [
        ...m,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          text: "Entschuldige, ich konnte gerade nicht antworten. Versuch es bitte nochmals — oder wähle das Material unten direkt selbst aus.",
        },
      ]);
    }
  };

  const showQuick = messages.length === 1 && !typing;
  const quickOptions = partNames.length > 1
    ? ["Alle Teile gehören zusammen", "Jedes Teil hat eine eigene Funktion"]
    : QUICK_REPLIES;

  const showAccept = mobileFullscreen && recommendedMaterialName && onAcceptRecommendation;

  return (
    <div
      className={
        mobileFullscreen
          ? "fixed inset-0 z-50 bg-background flex flex-col"
          : "rounded-2xl border border-border bg-card overflow-hidden"
      }
    >
      <div
        className={
          mobileFullscreen
            ? "px-4 py-3 border-b border-border flex items-center justify-between bg-muted/30 shrink-0"
            : "px-4 py-3 border-b border-border flex items-center gap-2 bg-muted/30"
        }
      >
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold">
            {mobileFullscreen ? "KI-Materialberatung" : "Material-Beratung"}
          </span>
        </div>
        {mobileFullscreen ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Schliessen"
            className="p-1.5 rounded-full hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        ) : (
          <span className="ml-auto text-xs text-muted-foreground">Frag alles, was du wissen willst</span>
        )}
      </div>

      <div
        className={
          mobileFullscreen
            ? "flex-1 overflow-y-auto p-4 space-y-3"
            : "max-h-[420px] min-h-[260px] overflow-y-auto p-4 space-y-3"
        }
      >
        <AnimatePresence initial={false}>
          {messages.map((m) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className={`flex gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {m.role === "assistant" && <Avatar />}
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
                  m.role === "user"
                    ? "bg-primary text-primary-foreground rounded-tr-sm"
                    : "bg-muted rounded-tl-sm"
                }`}
              >
                {m.text}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {typing && (
          <div className="flex gap-2 items-center">
            <Avatar />
            <div className="bg-muted rounded-2xl rounded-tl-sm">
              <Typing />
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {showAccept && (
        <div className="border-t border-primary/30 bg-primary/10 p-4">
          <p className="text-sm font-semibold text-foreground">
            Empfohlen: <span className="text-primary">{recommendedMaterialName}</span>
          </p>
          <Button className="w-full mt-3 gap-2" onClick={onAcceptRecommendation}>
            <Check className="w-4 h-4" />
            Material übernehmen
          </Button>
        </div>
      )}

      <div
        className={
          mobileFullscreen
            ? "sticky bottom-0 border-t border-border bg-background p-3 space-y-2 pb-[env(safe-area-inset-bottom)]"
            : "border-t border-border p-3 space-y-2"
        }
      >
        {showQuick && (
          <div className="flex flex-wrap gap-2">
            {quickOptions.map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => send(o)}
                className="px-3 py-1.5 rounded-full border border-border bg-background text-xs font-medium hover:border-primary hover:bg-primary/5 transition-colors"
              >
                {o}
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Nachricht schreiben oder Frage stellen…"
            className="h-9 text-base"
            style={{ fontSize: "16px" }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && input.trim()) {
                e.preventDefault();
                send(input);
              }
            }}
          />
          <Button size="sm" className="h-9" disabled={!input.trim() || typing} onClick={() => send(input)}>
            <Send className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
