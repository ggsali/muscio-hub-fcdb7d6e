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