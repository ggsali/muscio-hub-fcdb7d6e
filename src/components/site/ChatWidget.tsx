import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MessageCircle, X, Send, Bot, User, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";

interface Message {
  id?: string;
  role: "user" | "assistant" | "admin";
  content: string;
  created_at?: string;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/website-chat`;
const SESSION_KEY = "3dmuscio_chat_session";

const triggerWords = [
  "mitarbeiter", "mensch", "person", "sprechen", "anrufen",
  "rückruf", "direkt", "persönlich", "meldet sich", "weiterleiten",
  "telefon", "ansprechpartner", "jemanden erreichen",
];

const shouldNotify = (userMessage: string): boolean => {
  const lower = userMessage.toLowerCase();
  return triggerWords.some(word => lower.includes(word));
};

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
    // Poll for admin replies (RLS no longer allows anon realtime on chat_messages)
    const interval = setInterval(async () => {
      const { data } = await supabase.rpc("get_chat_messages", { p_session_id: sessionId });
      if (!data) return;
      setMessages(prev => {
        const existingIds = new Set(prev.map(m => m.id).filter(Boolean));
        const newAdmin = (data as Message[]).filter(m => m.role === "admin" && !existingIds.has(m.id));
        if (newAdmin.length === 0) return prev;
        if (!open) setHasUnread(true);
        return [...prev, ...newAdmin];
      });
    }, 4000);
    return () => clearInterval(interval);
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
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
      body: JSON.stringify({ messages: allMessages.slice(-20).map(m => ({ role: m.role === "admin" ? "assistant" : m.role, content: m.content })) }),
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
    if (shouldNotify(text)) {
      supabase.functions.invoke("send-sms-notification", {
        body: {
          message: text,
          customerName: userInfo.name || "Unbekannt",
          customerEmail: userInfo.email || "",
          sessionId: sid,
        },
      }).catch(console.error);
    }
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

      {open && (
        <div className="fixed inset-0 sm:inset-auto sm:bottom-24 sm:right-6 z-50 w-screen sm:w-[360px] h-[100dvh] sm:h-auto sm:max-h-[520px] flex flex-col bg-card border border-border sm:rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-200">
          <div className="px-4 py-2 bg-primary flex items-center gap-3 flex-shrink-0">
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
                <div className={cn("max-w-[75%] rounded-2xl px-3 py-2 text-sm leading-snug break-words", msg.role === "user" ? "bg-primary text-primary-foreground rounded-tr-sm" : "bg-muted text-foreground rounded-tl-sm")}>
                  {msg.content ? (
                    <ReactMarkdown
                      components={{
                        a: ({ href = "", children }) => {
                          // Treat 3dmuscio.com URLs as internal navigation
                          let internalHref: string | null = null;
                          try {
                            if (/^https?:\/\//i.test(href)) {
                              const u = new URL(href);
                              if (/(^|\.)3dmuscio\.com$/i.test(u.hostname)) {
                                internalHref = u.pathname + u.search + u.hash;
                              }
                            } else if (href.startsWith("/")) {
                              internalHref = href;
                            }
                          } catch {}

                          if (!internalHref) {
                            return (
                              <a href={href} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 font-medium hover:opacity-80">
                                {children}
                              </a>
                            );
                          }
                          return (
                            <a
                              href={internalHref}
                              onClick={(e) => {
                                e.preventDefault();
                                setOpen(false);
                                window.history.pushState({}, "", internalHref!);
                                window.dispatchEvent(new PopStateEvent("popstate"));
                              }}
                              className="underline underline-offset-2 font-medium hover:opacity-80 cursor-pointer"
                            >
                              {children}
                            </a>
                          );
                        },
                        p: ({ children }) => <p className="m-0 whitespace-pre-wrap">{children}</p>,
                        ul: ({ children }) => <ul className="list-disc pl-3 my-1 space-y-0.5">{children}</ul>,
                        ol: ({ children }) => <ol className="list-decimal pl-3 my-1 space-y-0.5">{children}</ol>,
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  ) : (
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

      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:scale-105 transition-transform flex items-center justify-center"
          aria-label="Chat öffnen"
        >
          <MessageCircle className="w-6 h-6" />
          {hasUnread && <span className="absolute top-2 right-2 w-3 h-3 bg-red-500 rounded-full border-2 border-primary" />}
        </button>
      )}
    </>
  );
}
