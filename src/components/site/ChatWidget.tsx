import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MessageCircle, X, Send, Bot, User, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Message {
  id?: string;
  role: "user" | "assistant" | "admin";
  content: string;
  created_at?: string;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/website-chat`;
const SESSION_KEY = "3dmuscio_chat_session";

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [hasUnread, setHasUnread] = useState(false);
  const [userInfo, setUserInfo] = useState({ name: "", email: "" });
  const [infoStep, setInfoStep] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem(SESSION_KEY);
    if (saved) {
      try {
        const { sessionId: sid, userInfo: ui } = JSON.parse(saved);
        setSessionId(sid);
        setUserInfo(ui || { name: "", email: "" });
        loadMessages(sid);
      } catch {}
    }
    // Prefill from logged-in user if available
    supabase.auth.getUser().then(({ data }) => {
      const u = data.user;
      if (!u) return;
      setUserInfo(prev => {
        if (prev.name && prev.email) return prev;
        const meta = (u.user_metadata || {}) as any;
        return {
          name: prev.name || meta.full_name || meta.name || (u.email ? u.email.split("@")[0] : ""),
          email: prev.email || u.email || "",
        };
      });
    });
    const openHandler = () => setOpen(true);
    window.addEventListener("open-chat-widget", openHandler);
    return () => window.removeEventListener("open-chat-widget", openHandler);
  }, []);

  useEffect(() => {
    if (!sessionId) return;
    const channel = supabase
      .channel(`chat-${sessionId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", filter: `session_id=eq.${sessionId}` }, (payload) => {
        const msg = payload.new as Message;
        if (msg.role === "admin") {
          setMessages(prev => prev.find(m => m.id === msg.id) ? prev : [...prev, msg]);
          if (!open) setHasUnread(true);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [sessionId, open]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, open]);
  useEffect(() => { if (open) { setHasUnread(false); setTimeout(() => inputRef.current?.focus(), 100); } }, [open]);

  const loadMessages = async (sid: string) => {
    const { data } = await supabase.from("chat_messages").select("*").eq("session_id", sid).order("created_at");
    if (data) setMessages(data as Message[]);
  };

  const createSession = async (name: string, email: string) => {
    const { data } = await supabase.from("chat_sessions").insert({ user_name: name, user_email: email, status: "active" }).select().single();
    if (data) {
      setSessionId(data.id);
      localStorage.setItem(SESSION_KEY, JSON.stringify({ sessionId: data.id, userInfo: { name, email } }));
      return data.id;
    }
    return null;
  };

  const saveMessage = async (sid: string, role: string, content: string) => {
    await supabase.from("chat_messages").insert({ session_id: sid, role, content });
  };

  const streamAI = async (sid: string, allMessages: Message[]) => {
    const resp = await fetch(CHAT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
      body: JSON.stringify({ messages: allMessages.map(m => ({ role: m.role === "admin" ? "assistant" : m.role, content: m.content })) }),
    });
    if (!resp.ok || !resp.body) {
      const err = await resp.json().catch(() => ({ error: "Fehler" }));
      throw new Error(err.error || "Fehler");
    }
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let textBuffer = ""; let streamDone = false; let fullContent = "";
    const placeholderId = `streaming-${Date.now()}`;
    setMessages(prev => [...prev, { id: placeholderId, role: "assistant", content: "" }]);
    while (!streamDone) {
      const { done, value } = await reader.read();
      if (done) break;
      textBuffer += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = textBuffer.indexOf("\n")) !== -1) {
        let line = textBuffer.slice(0, idx);
        textBuffer = textBuffer.slice(idx + 1);
        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (line.startsWith(":") || line.trim() === "" || !line.startsWith("data: ")) continue;
        const jsonStr = line.slice(6).trim();
        if (jsonStr === "[DONE]") { streamDone = true; break; }
        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content as string | undefined;
          if (content) {
            fullContent += content;
            setMessages(prev => prev.map(m => m.id === placeholderId ? { ...m, content: fullContent } : m));
          }
        } catch { textBuffer = line + "\n" + textBuffer; break; }
      }
    }
    if (fullContent) {
      const { data } = await supabase.from("chat_messages").insert({ session_id: sid, role: "assistant", content: fullContent }).select().single();
      if (data) setMessages(prev => prev.map(m => m.id === placeholderId ? (data as Message) : m));
    }
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput(""); setLoading(true);
    let sid = sessionId;
    if (!sid) {
      if (!userInfo.name) { setInfoStep(true); setInput(text); setLoading(false); return; }
      sid = await createSession(userInfo.name, userInfo.email);
      if (!sid) { setLoading(false); return; }
    }
    const userMsg: Message = { role: "user", content: text };
    setMessages(prev => [...prev, userMsg]);
    await saveMessage(sid, "user", text);
    try { await streamAI(sid, [...messages, userMsg]); }
    catch (e: any) { setMessages(prev => [...prev, { role: "assistant", content: `Entschuldigung: ${e.message}` }]); }
    setLoading(false);
  };

  const handleInfoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userInfo.name.trim()) return;
    setInfoStep(false);
    const text = input.trim();
    if (!text) return;
    setInput(""); setLoading(true);
    const sid = await createSession(userInfo.name, userInfo.email);
    if (!sid) { setLoading(false); return; }
    const userMsg: Message = { role: "user", content: text };
    setMessages([userMsg]);
    await saveMessage(sid, "user", text);
    try { await streamAI(sid, [userMsg]); }
    catch (e: any) { setMessages(prev => [...prev, { role: "assistant", content: `Fehler: ${e.message}` }]); }
    setLoading(false);
  };

  return (
    <>
      <button
        onClick={() => setOpen(v => !v)}
        className={cn("fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-200 bg-primary text-primary-foreground hover:scale-105 active:scale-95")}
        aria-label="Chat öffnen"
      >
        {open ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
        {hasUnread && !open && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-destructive rounded-full text-[10px] text-destructive-foreground flex items-center justify-center font-bold">!</span>
        )}
      </button>

      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-[360px] max-h-[520px] flex flex-col bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-200">
          <div className="px-4 py-3 bg-primary flex items-center gap-3 flex-shrink-0">
            <div className="w-8 h-8 rounded-full bg-primary-foreground/20 flex items-center justify-center">
              <Bot className="w-4 h-4 text-primary-foreground" />
            </div>
            <div className="flex-1">
              <p className="text-primary-foreground font-semibold text-sm">3DMuscio Support</p>
              <p className="text-primary-foreground/70 text-xs">KI-Assistent · Live-Chat</p>
            </div>
            <button onClick={() => setOpen(false)} className="text-primary-foreground/80 hover:text-primary-foreground" aria-label="Schliessen">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
            {messages.length === 0 && !infoStep && (
              <div className="text-center py-4">
                <Bot className="w-10 h-10 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Hallo! Wie kann ich dir helfen?</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Frag mich zu 3D-Druck, Preisen oder Bestellungen.</p>
              </div>
            )}

            {infoStep && (
              <form onSubmit={handleInfoSubmit} className="space-y-3 bg-muted rounded-xl p-3">
                <p className="text-sm font-medium">Kurze Vorstellung</p>
                <input className="w-full text-sm bg-background border border-border rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-primary" placeholder="Dein Name *" value={userInfo.name} onChange={e => setUserInfo(p => ({ ...p, name: e.target.value }))} required autoFocus />
                <input className="w-full text-sm bg-background border border-border rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-primary" placeholder="E-Mail (optional)" type="email" value={userInfo.email} onChange={e => setUserInfo(p => ({ ...p, email: e.target.value }))} />
                <button type="submit" className="w-full bg-primary text-primary-foreground rounded-lg py-2 text-sm font-medium hover:bg-primary/90">Chat starten</button>
              </form>
            )}

            {messages.map((msg, i) => (
              <div key={msg.id || i} className={cn("flex gap-2", msg.role === "user" ? "justify-end" : "justify-start")}>
                {msg.role !== "user" && (
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    {msg.role === "admin" ? <User className="w-3.5 h-3.5 text-primary" /> : <Bot className="w-3.5 h-3.5 text-primary" />}
                  </div>
                )}
                <div className={cn("max-w-[75%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed", msg.role === "user" ? "bg-primary text-primary-foreground rounded-tr-sm" : "bg-muted text-foreground rounded-tl-sm")}>
                  {msg.content || (
                    <span className="flex gap-1 items-center">
                      <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </span>
                  )}
                </div>
                {msg.role === "user" && (
                  <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center flex-shrink-0 mt-0.5">
                    <User className="w-3.5 h-3.5 text-secondary-foreground" />
                  </div>
                )}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {!infoStep && (
            <div className="p-3 border-t border-border flex gap-2 flex-shrink-0">
              <input
                ref={inputRef}
                className="flex-1 text-sm bg-input border border-border rounded-xl px-3 py-2 outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
                placeholder="Nachricht schreiben..."
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                disabled={loading}
              />
              <button onClick={handleSend} disabled={!input.trim() || loading} className="w-9 h-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 disabled:opacity-40 transition-all flex-shrink-0">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
