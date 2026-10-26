import { supabase } from "@/integrations/supabase/client";

// Public inserts cannot SELECT the private message row back.
export async function persistChatMessage(
  sessionId: string,
  role: "user" | "assistant",
  content: string,
) {
  const message = {
    id: crypto.randomUUID(),
    session_id: sessionId,
    role,
    content,
    created_at: new Date().toISOString(),
  };
  const { error } = await supabase.from("chat_messages").insert(message);
  if (error) throw new Error("Nachricht konnte nicht gespeichert werden. Bitte versuche es erneut.");
  return message;
}

// Check only the public boolean helper, never SELECT private session rows.
export async function persistVisitorChatMessage(
  sessionId: string,
  content: string,
  createSession: () => Promise<string | null>,
) {
  const { data: writable, error } = await supabase.rpc("is_chat_session_writable", {
    p_session_id: sessionId,
  });
  if (error || typeof writable !== "boolean") {
    throw new Error("Chat-Sitzung konnte nicht geprüft werden. Bitte versuche es erneut.");
  }
  const sid = writable ? sessionId : await createSession();
  if (!sid) throw new Error("Chat-Sitzung konnte nicht erstellt werden. Bitte versuche es erneut.");
  const message = await persistChatMessage(sid, "user", content);
  return { sessionId: sid, message, renewed: sid !== sessionId };
}