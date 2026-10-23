import { beforeEach, describe, expect, it, vi } from "vitest";

const { insert, from } = vi.hoisted(() => {
  const insert = vi.fn();
  return { insert, from: vi.fn(() => ({ insert })) };
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from } }));
import { persistChatMessage } from "./chat-messages";

describe("chat message persistence", () => {
  beforeEach(() => vi.clearAllMocks());

  it("persists a customer message without requiring public SELECT access", async () => {
    insert.mockResolvedValue({ error: null });
    const message = await persistChatMessage("session-123", "user", "Meine Frage");
    expect(from).toHaveBeenCalledWith("chat_messages");
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ session_id: "session-123", role: "user", content: "Meine Frage", id: message.id }));
    expect(message.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("does not report a blocked insert as a delivered message", async () => {
    insert.mockResolvedValue({ error: { code: "42501" } });
    await expect(persistChatMessage("session-123", "user", "Meine Frage")).rejects.toThrow();
  });
});