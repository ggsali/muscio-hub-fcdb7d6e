import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, Send, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export interface KiQuestion {
  key: "zweck" | "belastung" | "einsatzort" | "temperatur" | "flexibilitaet";
  label: string;
  question: string;
  options: string[];
}

export const KI_QUESTIONS: KiQuestion[] = [
  {
    key: "zweck",
    label: "Verwendungszweck",
    question: "Wofür wird dieses Bauteil verwendet?",
    options: ["Halterung", "Gehäuse", "Prototyp", "Ersatzteil", "Dekoration", "Anderes"],
  },
  {
    key: "belastung",
    label: "Belastung",
    question: "Wird das Teil mechanisch belastet?",
    options: ["Ja, stark", "Leicht", "Nein, kaum"],
  },
  {
    key: "einsatzort",
    label: "Einsatzort",
    question: "Innen- oder Aussenbereich?",
    options: ["Innen", "Aussen", "Beides"],
  },
  {
    key: "temperatur",
    label: "Temperatur",
    question: "Temperaturanforderungen?",
    options: ["Normal bis 60°C", "Erhöht bis 100°C", "Hoch über 100°C"],
  },
  {
    key: "flexibilitaet",
    label: "Flexibilität",
    question: "Flexibel oder starr?",
    options: ["Flexibel/gummiartig", "Starr"],
  },
];

type ChatMsg = { id: string; role: "ai" | "user"; text: string };

export interface KiResult {
  material: string;
  begruendung: string;
  answers: Record<string, string>;
}

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
  onResult,
}: {
  fileName: string;
  geometry: string;
  availableMaterials: string[];
  onResult: (r: KiResult) => void;
}) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [typing, setTyping] = useState(false);
  const [index, setIndex] = useState(-1);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [freeText, setFreeText] = useState("");
  const [done, setDone] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  const push = (role: "ai" | "user", text: string) =>
    setMessages((m) => [...m, { id: crypto.randomUUID(), role, text }]);

  const askAi = (text: string, delay = 700) => {
    setTyping(true);
    window.setTimeout(() => {
      setTyping(false);
      push("ai", text);
    }, delay);
  };

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    askAi("Hallo! Ich helfe dir in 5 kurzen Fragen das passende Material zu finden.", 500);
    window.setTimeout(() => {
      askAi(KI_QUESTIONS[0].question, 600);
      setIndex(0);
    }, 900);
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, typing]);

  const finish = async (all: Record<string, string>) => {
    setDone(true);
    setTyping(true);
    try {
      const { data, error } = await supabase.functions.invoke("ki-materialberatung", {
        body: { answers: all, fileName, geometry, availableMaterials },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setTyping(false);
      const material = (data as any).material as string;
      const begruendung = (data as any).begruendung as string;
      push("ai", `Empfehlung: ${material}\n\n${begruendung}`);
      onResult({ material, begruendung, answers: all });
    } catch (e) {
      console.error(e);
      setTyping(false);
      const fallback = availableMaterials[0] || "PLA";
      push("ai", `Empfehlung: ${fallback}\n\nIch konnte gerade keine detaillierte Analyse durchführen – ${fallback} ist für die meisten Anwendungen eine solide Wahl. Du kannst unten jederzeit manuell ein anderes Material wählen.`);
      onResult({
        material: fallback,
        begruendung: "Automatische Empfehlung (KI nicht verfügbar).",
        answers: all,
      });
    }
  };

  const answer = (value: string) => {
    if (index < 0 || index >= KI_QUESTIONS.length || typing) return;
    const q = KI_QUESTIONS[index];
    push("user", value);
    const next = { ...answers, [q.key]: value };
    setAnswers(next);
    setFreeText("");
    const nextIndex = index + 1;
    setIndex(nextIndex);
    if (nextIndex < KI_QUESTIONS.length) {
      askAi(KI_QUESTIONS[nextIndex].question, 700);
    } else {
      window.setTimeout(() => finish(next), 500);
    }
  };

  const current = index >= 0 && index < KI_QUESTIONS.length ? KI_QUESTIONS[index] : null;

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2 bg-muted/30">
        <Sparkles className="w-4 h-4 text-primary" />
        <span className="text-sm font-semibold">Material-Beratung</span>
        {!done && (
          <span className="ml-auto text-xs text-muted-foreground">
            Frage {Math.min(Math.max(index + 1, 1), KI_QUESTIONS.length)} von {KI_QUESTIONS.length}
          </span>
        )}
      </div>

      <div className="max-h-[360px] overflow-y-auto p-4 space-y-3">
        <AnimatePresence initial={false}>
          {messages.map((m) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className={`flex gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {m.role === "ai" && <Avatar />}
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

      {current && !typing && (
        <div className="border-t border-border p-3 space-y-2">
          <div className="flex flex-wrap gap-2">
            {current.options.map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => answer(o)}
                className="px-3 py-1.5 rounded-full border border-border bg-background text-xs font-medium hover:border-primary hover:bg-primary/5 transition-colors"
              >
                {o}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              value={freeText}
              onChange={(e) => setFreeText(e.target.value)}
              placeholder="Oder frei antworten…"
              className="h-9 text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter" && freeText.trim()) {
                  e.preventDefault();
                  answer(freeText.trim());
                }
              }}
            />
            <Button
              size="sm"
              className="h-9"
              disabled={!freeText.trim()}
              onClick={() => answer(freeText.trim())}
            >
              <Send className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}

      {done && !typing && (
        <div className="border-t border-border px-4 py-2.5 text-xs text-muted-foreground flex items-center gap-1.5">
          <Check className="w-3.5 h-3.5 text-primary" /> Beratung abgeschlossen — du kannst das Material unten auch manuell ändern.
        </div>
      )}
    </div>
  );
}
