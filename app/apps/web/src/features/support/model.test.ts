import { describe, expect, it } from "vitest";
import { parseSupportCommand, supportTransition, supportText } from "./model";
const base = { actorKey: "a".repeat(64), requestId: "12345678-1234-4234-8234-123456789012", kind: "create", title: "My account", topic: "account", body: "Please help" };
describe("private support command contract", () => {
  it("normalizes bounded human text without treating it as instructions or markup", () => {
    expect(parseSupportCommand({...base, body: " <script>not executed</script> "}).body).toBe("<script>not executed</script>");
    expect(parseSupportCommand({...base, title: "  Личен акаунт  "}).title).toBe("Личен акаунт");
  });
  it.each([null, [], {}, {...base, topic: "refund-money"}, {...base, actorKey: "foreign"}, {...base, requestId: "not-an-id"}, {...base, title: "x"}, {...base, body: "\u0000"}, {...base, body: "x".repeat(4001)}, {...base, kind: "reply", ticketId: base.requestId, expectedRevision: 0}])("rejects invalid input %#", raw => expect(() => parseSupportCommand(raw)).toThrow());
  it("requires explicit reopening and operator-only internal notes", () => {
    expect(() => supportTransition("resolved", "reply", false)).toThrow("CONFLICT");
    expect(() => supportTransition("open", "reopen", true)).toThrow("CONFLICT");
    expect(() => supportTransition("open", "note", false)).toThrow("FORBIDDEN");
    expect(supportTransition("resolved", "reopen", false)).toBe("open");
    expect(supportTransition("open", "reply", true)).toBe("waiting");
    expect(supportTransition("waiting", "reply", false)).toBe("open");
    expect(supportTransition("waiting", "resolve", true)).toBe("resolved");
    expect(supportTransition("resolved", "note", true)).toBe("resolved");
  });
  it("keeps multiline Bulgarian and rejects empty input", () => {
    expect(supportText("Помощ\nза акаунта", 1, 4000)).toContain("\n");
    expect(() => supportText(" \n ", 1, 4000)).toThrow();
  });
});
