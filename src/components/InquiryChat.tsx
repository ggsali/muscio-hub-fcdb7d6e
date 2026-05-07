import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Loader2, Mail, ArrowDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Msg = {
  id: string;
  inquiry_id: string;
  direction: "in" | "out";
  from_email: string;
  from_name: string | null;
  to_email: string;
  subject: string | null;
  body: string;
  created_at: string;
};

export default function InquiryChat({
  inquiryId,
  customerName,
  initialMessage,
  initialFrom,
  initialAt,
}: {
  inquiryId: string;
  customerName: string;
  initialMessage: string;
  initialFrom: string;
  initialAt: string;
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const endRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("inquiry_messages" as any)
      .select("*")
      .eq("inquiry_id", inquiryId)
      .order("created_at", { ascending: true });
    if (error) console.error(error);
    setMessages((data as any) || []);
    setLoading(false);
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  };

  useEffect(() => { load(); }, [inquiryId]);

  // Realtime
  useEffect(() => {
    const ch = supabase
      .channel(`inquiry-msgs-${inquiryId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "inquiry_messages", filter: `inquiry_id=eq.${inquiryId}` }, (payload) => {
        setMessages((prev) => [...prev, payload.new as Msg]);
        setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [inquiryId]);

  const send = async () => {
    const msg = text.trim();
    if (!msg) return;
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("inquiry-reply", {
        body: { inquiry_id: inquiryId, message: msg },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setText("");
      toast({ title: "Gesendet", description: "E-Mail wurde an den Kunden gesendet." });
      load();
    } catch (err: any) {
      console.error(err);
      toast({ title: "Fehler", description: err?.message || "Konnte nicht senden.", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const fmt = (s: string) => new Date(s).toLocaleString("de-CH", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="flex flex-col border border-border rounded-lg bg-card overflow-hidden">
      <div className="px-4 py-2.5 border-b border-border flex items-center gap-2 bg-muted/30">
        <Mail className="w-4 h-4 text-primary" />
        <span className="text-sm font-medium">E-Mail-Konversation</span>
        <span className="text-xs text-muted-foreground ml-auto">{customerName}</span>
      </div>

      <div className="max-h-[420px] overflow-y-auto p-4 space-y-3 bg-background/50">
        {/* Original-Anfrage immer oben anzeigen */}
        <div className="flex justify-start">
          <div className="max-w-[80%] rounded-2xl rounded-tl-sm bg-muted px-4 py-2.5">
            <div className="text-[10px] text-muted-foreground mb-1">{initialFrom} · {fmt(initialAt)}</div>
            <div className="text-sm whitespace-pre-wrap break-words">{initialMessage}</div>
          </div>
        </div>

        {loading && (
          <div className="flex justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
        )}

        {messages.map((m) => {
          const isOut = m.direction === "out";
          return (
            <div key={m.id} className={`flex ${isOut ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${isOut ? "bg-primary text-primary-foreground rounded-tr-sm" : "bg-muted rounded-tl-sm"}`}>
                <div className={`text-[10px] mb-1 ${isOut ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                  {isOut ? "Du" : (m.from_name || m.from_email)} · {fmt(m.created_at)}
                </div>
                <div className="text-sm whitespace-pre-wrap break-words">{m.body}</div>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      <div className="border-t border-border p-3 bg-card">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Antwort an den Kunden schreiben… (wird per E-Mail an info@3dmuscio.com gesendet)"
          rows={3}
          className="text-sm resize-none mb-2"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send(); }
          }}
        />
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground">⌘/Strg + Enter zum Senden</span>
          <Button size="sm" onClick={send} disabled={sending || !text.trim()} className="gap-2">
            {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            Senden
          </Button>
        </div>
      </div>
    </div>
  );
}
