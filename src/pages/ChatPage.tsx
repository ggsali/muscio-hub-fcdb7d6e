import React, { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Send, MessageCircle, User, Bot, Circle, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface ChatSession {
  id: string;
  user_name: string | null;
  user_email: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  last_message?: string;
  unread_count?: number;
}

interface ChatMessage {
  id: string;
  session_id: string;
  role: "user" | "assistant" | "admin";
  content: string;
  created_at: string;
  is_read: boolean;
}

export default function ChatPage() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadSessions();

    const channel = supabase
      .channel("admin-chat-dashboard")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, () => {
        loadSessions();
        if (selectedSession) loadMessages(selectedSession);
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_sessions" }, () => {
        loadSessions();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedSession]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadSessions = async () => {
    const { data } = await supabase
      .from("chat_sessions")
      .select("*")
      .order("updated_at", { ascending: false });

    if (data) {
      const enriched = await Promise.all((data as ChatSession[]).map(async (s) => {
        const { data: msgs } = await supabase
          .from("chat_messages")
          .select("content, is_read, role")
          .eq("session_id", s.id)
          .order("created_at", { ascending: false })
          .limit(1);
        const { count } = await supabase
          .from("chat_messages")
          .select("*", { count: "exact", head: true })
          .eq("session_id", s.id)
          .eq("is_read", false)
          .eq("role", "user");
        return {
          ...s,
          last_message: msgs?.[0]?.content || "",
          unread_count: count || 0,
        };
      }));
      setSessions(enriched);
    }
  };

  const loadMessages = async (sid: string) => {
    const { data } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("session_id", sid)
      .order("created_at");
    if (data) setMessages(data as ChatMessage[]);

    await supabase
      .from("chat_messages")
      .update({ is_read: true })
      .eq("session_id", sid)
      .eq("role", "user");
  };

  const handleSelectSession = (sid: string) => {
    setSelectedSession(sid);
    loadMessages(sid);
  };

  const handleSendReply = async () => {
    if (!reply.trim() || !selectedSession || sending) return;
    setSending(true);
    await supabase.from("chat_messages").insert({
      session_id: selectedSession,
      role: "admin",
      content: reply.trim(),
    });
    setReply("");
    setSending(false);
    await loadMessages(selectedSession);
    await loadSessions();
  };

  const handleDeleteSession = async (sid: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await supabase.from("chat_sessions").delete().eq("id", sid);
    if (selectedSession === sid) {
      setSelectedSession(null);
      setMessages([]);
    }
    toast.success("Konversation gelöscht");
    loadSessions();
  };

  const selectedSessionData = sessions.find(s => s.id === selectedSession);
  const totalUnread = sessions.reduce((sum, s) => sum + (s.unread_count || 0), 0);

  return (
    <div className="p-6 animate-fade-in h-full">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            Live-Chat
            {totalUnread > 0 && (
              <span className="w-6 h-6 bg-primary rounded-full text-[11px] text-primary-foreground flex items-center justify-center font-bold">
                {totalUnread}
              </span>
            )}
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">Website-Chat der 3D Print Studio</p>
        </div>
      </div>

      <div className="flex bg-card border border-border rounded-xl overflow-hidden" style={{ height: "calc(100vh - 180px)" }}>
        {/* Sidebar */}
        <div className="w-72 border-r border-border flex flex-col flex-shrink-0">
          <div className="px-4 py-3 border-b border-border">
            <p className="text-xs text-muted-foreground">{sessions.length} Konversationen</p>
          </div>
          <div className="flex-1 overflow-y-auto">
            {sessions.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                <MessageCircle className="w-10 h-10 mx-auto mb-3 opacity-20" />
                <p>Noch keine Chat-Anfragen</p>
                <p className="text-xs mt-1 opacity-60">Besucher der Website können über das Chat-Widget schreiben</p>
              </div>
            ) : sessions.map(s => (
              <button
                key={s.id}
                onClick={() => handleSelectSession(s.id)}
                className={cn(
                  "w-full text-left px-4 py-3 border-b border-border/50 hover:bg-muted transition-colors group relative",
                  selectedSession === s.id && "bg-primary/10 border-l-2 border-l-primary"
                )}
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span className="font-medium text-sm truncate">{s.user_name || "Anonym"}</span>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground flex-shrink-0">
                      {formatDistanceToNow(new Date(s.updated_at), { addSuffix: true, locale: de })}
                    </span>
                    <button
                      onClick={(e) => handleDeleteSession(s.id, e)}
                      className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-destructive/10 hover:text-destructive transition-all ml-1"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                {s.user_email && (
                  <p className="text-xs text-muted-foreground truncate">{s.user_email}</p>
                )}
                <div className="flex items-center justify-between mt-1">
                  <p className="text-xs text-muted-foreground truncate flex-1">{s.last_message}</p>
                  {(s.unread_count || 0) > 0 && (
                    <span className="ml-2 w-5 h-5 bg-primary rounded-full text-[10px] text-primary-foreground flex items-center justify-center font-bold flex-shrink-0">
                      {s.unread_count}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {!selectedSession ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <MessageCircle className="w-14 h-14 mx-auto mb-4 opacity-20" />
                <p className="font-medium">Konversation auswählen</p>
                <p className="text-sm mt-1 opacity-60">Klicke links auf eine Chat-Anfrage</p>
              </div>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="px-5 py-3.5 border-b border-border bg-card/50 flex items-center gap-3 flex-shrink-0">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-sm">{selectedSessionData?.user_name || "Anonym"}</p>
                  {selectedSessionData?.user_email && (
                    <p className="text-xs text-muted-foreground">{selectedSessionData.user_email}</p>
                  )}
                </div>
                <div className="ml-auto flex items-center gap-1.5">
                  <Circle className="w-2 h-2 fill-green-500 text-green-500" />
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(selectedSessionData?.updated_at || ""), { addSuffix: true, locale: de })}
                  </span>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-5 space-y-3">
                {messages.map(msg => (
                  <div key={msg.id} className={cn("flex gap-2.5", msg.role !== "user" ? "justify-end" : "justify-start")}>
                    {msg.role === "user" && (
                      <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
                        <User className="w-3.5 h-3.5 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex flex-col gap-1 max-w-[70%]">
                      {msg.role === "assistant" && (
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Bot className="w-3 h-3" /> KI-Assistent
                        </span>
                      )}
                      <div className={cn(
                        "rounded-2xl px-4 py-2.5 text-sm",
                        msg.role === "user"
                          ? "bg-muted text-foreground rounded-tl-sm"
                          : msg.role === "admin"
                            ? "bg-primary text-primary-foreground rounded-tr-sm"
                            : "bg-secondary text-secondary-foreground rounded-tl-sm"
                      )}>
                        {msg.content}
                      </div>
                      <span className="text-[10px] text-muted-foreground px-1">
                        {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true, locale: de })}
                      </span>
                    </div>
                    {msg.role !== "user" && (
                      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        {msg.role === "admin" ? <User className="w-3.5 h-3.5 text-primary" /> : <Bot className="w-3.5 h-3.5 text-primary" />}
                      </div>
                    )}
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>

              {/* Reply Input */}
              <div className="p-4 border-t border-border flex gap-2 flex-shrink-0">
                <input
                  className="flex-1 bg-input border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
                  placeholder="Als Admin antworten... (Enter zum Senden)"
                  value={reply}
                  onChange={e => setReply(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendReply(); } }}
                  disabled={sending}
                />
                <Button
                  onClick={handleSendReply}
                  disabled={!reply.trim() || sending}
                  size="icon"
                  className="rounded-xl h-10 w-10 flex-shrink-0"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
