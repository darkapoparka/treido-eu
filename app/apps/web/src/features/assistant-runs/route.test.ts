import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ identity: vi.fn(), change: vi.fn() }));
vi.mock("../../server/db/database", () => ({ getDatabase: () => ({}) }));
vi.mock("../../server/config/backend-bindings.server", () => ({
  requireBackendBindings: () => ({
    application: { origin: "https://treido.test" },
  }),
}));
vi.mock("./identity.server", async () => {
  const { SellerError } = await import("../sellers/errors");
  return {
    assistantInputIdentity: mocks.identity,
    inputFailure: (error: unknown) => ({
      ok: false,
      code: error instanceof SellerError ? error.code : "NOT_AVAILABLE",
    }),
  };
});
vi.mock("./commands.server", () => ({ changeAssistantInput: mocks.change }));
import { POST } from "../../app/api/assistants/runs/route";
import { SellerError } from "../sellers/errors";
import { readAssistantRunResponse } from "./run-stream";

const origin = "https://treido.test";
const command = {
  actorKey: "a".repeat(64),
  requestId: "10000000-0000-4000-8000-000000000001",
  expectedRevision: 1,
  mode: "text",
  operation: {
    kind: "execute",
    runId: "10000000-0000-4000-8000-000000000002",
    confirmed: true,
  },
};
function request(body: unknown = command, source = origin, suffix = "") {
  return new Request(origin + "/api/assistants/runs" + suffix, {
    method: "POST",
    headers: { origin: source, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.identity.mockResolvedValue({ subject: "user_alice" });
  mocks.change.mockResolvedValue({
    revision: 2,
    runId: command.operation.runId,
    assetId: null,
    replayed: false,
  });
});
it.each(["https://foreign.test", "null", ""])(
  "rejects foreign/missing Origin %s before identity or execution",
  async (source) => {
    const response = await POST(request(command, source));
    expect(await readAssistantRunResponse(response)).toEqual({
      ok: false,
      code: "FORBIDDEN",
    });
    expect(mocks.identity).not.toHaveBeenCalled();
    expect(mocks.change).not.toHaveBeenCalled();
  },
);
it("rejects query-parameter execution and non-execute commands", async () => {
  expect(
    await readAssistantRunResponse(
      await POST(request(command, origin, "?run=foreign")),
    ),
  ).toEqual({ ok: false, code: "FORBIDDEN" });
  expect(
    await readAssistantRunResponse(
      await POST(
        request({
          ...command,
          operation: {
            kind: "cancel",
            runId: command.operation.runId,
            assetId: null,
            confirmed: true,
          },
        }),
      ),
    ),
  ).toEqual({ ok: false, code: "INVALID_INPUT" });
  expect(mocks.change).not.toHaveBeenCalled();
});
it("does not start a stream or execute for an unsigned-in caller", async () => {
  mocks.identity.mockRejectedValue(new SellerError("UNAUTHENTICATED"));
  const response = await POST(request());
  expect(response.headers.get("content-type")).toContain("application/json");
  expect(await readAssistantRunResponse(response)).toEqual({
    ok: false,
    code: "UNAUTHENTICATED",
  });
  expect(mocks.change).not.toHaveBeenCalled();
});
it("streams the original validated receipt with server-derived identity and cancellation signal", async () => {
  const response = await POST(request());
  expect(response.headers.get("content-type")).toContain(
    "application/x-ndjson",
  );
  expect(await readAssistantRunResponse(response)).toMatchObject({
    ok: true,
    data: {
      subject: "user_alice",
      value: { revision: 2, runId: command.operation.runId },
    },
  });
  expect(mocks.change).toHaveBeenCalledTimes(1);
  expect(mocks.change.mock.calls[0][1]).toEqual({ subject: "user_alice" });
  expect(mocks.change.mock.calls[0][2]).toEqual(command);
  expect(mocks.change.mock.calls[0][4]).toBeInstanceOf(AbortSignal);
});
it("foreign resource failures expose only the ordinary finite denial", async () => {
  mocks.change.mockRejectedValue(new SellerError("NOT_FOUND"));
  expect(await readAssistantRunResponse(await POST(request()))).toEqual({
    ok: false,
    code: "NOT_FOUND",
  });
});
it("a provider failure cannot become a fabricated receipt or leak its raw message", async () => {
  mocks.change.mockRejectedValue(Error("private provider response"));
  const wire = await (await POST(request())).text();
  expect(wire).not.toContain("private provider");
  expect(wire).not.toContain("user_alice");
  expect(wire).toContain('"code":"NOT_AVAILABLE"');
});
