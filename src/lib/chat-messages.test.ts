import { beforeEach, describe, expect, it, vi } from "vitest";

const { insert, from, rpc } = vi.hoisted(() => {
  const insert = vi.fn();
  return { insert, from: vi.fn(() => ({ insert })), rpc: vi.fn() };
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from, rpc } }));
import { persistChatMessage, persistVisitorChatMessage } from "./chat-messages";

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

  it.each(["deleted", "older than 7 days", "inactive"])("renews a %s session and sends the original message once", async () => {
    rpc.mockResolvedValue({ data: false, error: null });
    insert.mockResolvedValue({ error: null });
    const createSession = vi.fn().mockResolvedValue("new-session");
    const result = await persistVisitorChatMessage("old-session", "Meine Frage", createSession);
    expect(rpc).toHaveBeenCalledWith("is_chat_session_writable", { p_session_id: "old-session" });
    expect(createSession).toHaveBeenCalledTimes(1);
    expect(insert).toHaveBeenCalledTimes(1);
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ session_id: "new-session", content: "Meine Frage" }));
    expect(result).toMatchObject({ sessionId: "new-session", renewed: true });
  });

  it("keeps a writable session", async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    insert.mockResolvedValue({ error: null });
    const createSession = vi.fn();
    const result = await persistVisitorChatMessage("active-session", "Hallo", createSession);
    expect(createSession).not.toHaveBeenCalled();
    expect(result).toMatchObject({ sessionId: "active-session", renewed: false });
  });

  it("does not replace sessions on a network or permission error", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "offline" } });
    const createSession = vi.fn();
    await expect(persistVisitorChatMessage("old-session", "Hallo", createSession)).rejects.toThrow();
    expect(createSession).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it("keeps the message unsent if replacement creation fails", async () => {
    rpc.mockResolvedValue({ data: false, error: null });
    await expect(persistVisitorChatMessage("old-session", "Hallo", vi.fn().mockResolvedValue(null))).rejects.toThrow();
    expect(insert).not.toHaveBeenCalled();
  });
});