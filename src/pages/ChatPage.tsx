import React, { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Send, MessageCircle, ArrowLeft, Trash2, Bot } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";

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
  const isMobile = useIsMobile();
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

  const activeConv = sessions.find(s => s.id === selectedSession);

  return (
    <div className="flex h-[calc(100vh-56px)] md:h-screen overflow-hidden">
      {/* Konversationsliste */}
      <div className={cn(
        "flex-col w-full md:w-80 border-r border-border bg-background",
        isMobile && selectedSession ? "hidden" : "flex"
      )}>
        <div className="p-4 border-b border-border">
          <h2 className="font-bold text-lg">Konversationen</h2>
        </div>
        <div className="flex-1 overflow-y-auto">
          {sessions.map(conv => (
            <button
              key={conv.id}
              onClick={() => handleSelectSession(conv.id)}
              className={cn(
                "w-full flex items-center gap-3 p-4 hover:bg-muted border-b border-border text-left transition-colors group relative",
                selectedSession === conv.id && "bg-muted"
              )}
            >
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-bold text-primary">{(conv.user_name || "?")[0]?.toUpperCase()}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center mb-0.5">
                  <span className="font-medium text-sm truncate">{conv.user_name || "Unbekannt"}</span>
                  <span className="text-xs text-muted-foreground flex-shrink-0 ml-2">
                    {formatDistanceToNow(new Date(conv.updated_at), { addSuffix: true, locale: de })}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground truncate">{conv.last_message}</p>
              </div>
              {(conv.unread_count || 0) > 0 && (
                <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center flex-shrink-0 font-bold">
                  {conv.unread_count}
                </span>
              )}
              <button
                onClick={(e) => handleDeleteSession(conv.id, e)}
                className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/10 hover:text-destructive transition-all"
                aria-label="Löschen"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </button>
          ))}
          {sessions.length === 0 && (
            <p className="text-center text-muted-foreground text-sm p-8">Keine Konversationen</p>
          )}
        </div>
      </div>

      {/* Chat-Fenster */}
      <div className={cn(
        "flex-col flex-1 bg-background min-w-0",
        isMobile && !selectedSession ? "hidden" : "flex"
      )}>
        {selectedSession ? (
          <>
            <div className="flex items-center gap-3 p-4 border-b border-border bg-background">
              <button
                className="md:hidden p-2 -ml-2 rounded-lg hover:bg-muted transition-colors"
                onClick={() => setSelectedSession(null)}
                aria-label="Zurück"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-bold text-primary">{(activeConv?.user_name || "?")[0]?.toUpperCase()}</span>
              </div>
              <div className="min-w-0">
                <p className="font-medium text-sm truncate">{activeConv?.user_name || "Anonym"}</p>
                {activeConv?.user_email && (
                  <p className="text-xs text-muted-foreground truncate">{activeConv.user_email}</p>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map(msg => (
                <div key={msg.id} className={cn("flex", msg.role !== "user" ? "justify-end" : "justify-start")}>
                  <div className={cn(
                    "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm",
                    msg.role === "user"
                      ? "bg-muted text-foreground rounded-tl-sm"
                      : msg.role === "admin"
                        ? "bg-primary text-primary-foreground rounded-tr-sm"
                        : "bg-secondary text-secondary-foreground rounded-tr-sm"
                  )}>
                    {msg.role === "assistant" && (
                      <span className="text-[10px] flex items-center gap-1 mb-1 opacity-70">
                        <Bot className="w-3 h-3" /> KI-Assistent
                      </span>
                    )}
                    <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                    <p className={cn(
                      "text-[10px] mt-1 text-right",
                      msg.role === "admin" ? "text-primary-foreground/70" : "text-muted-foreground"
                    )}>
                      {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true, locale: de })}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            <div className="p-4 border-t border-border bg-background">
              <div className="flex gap-2 items-end">
                <Textarea
                  value={reply}
                  onChange={e => setReply(e.target.value)}
                  placeholder="Nachricht schreiben..."
                  className="flex-1 min-h-[44px] max-h-32 resize-none rounded-2xl"
                  onKeyDown={e => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendReply();
                    }
                  }}
                  disabled={sending}
                />
                <Button
                  size="icon"
                  onClick={handleSendReply}
                  disabled={!reply.trim() || sending}
                  className="h-11 w-11 rounded-full flex-shrink-0"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Wähle eine Konversation aus</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
