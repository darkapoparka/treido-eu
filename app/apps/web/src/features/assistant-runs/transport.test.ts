import { afterEach, expect, it, vi } from "vitest";
vi.mock("./actions", () => ({ changeAssistantInputAction: vi.fn() }));
import { stopInputRequest, submitAssistantInput } from "./transport";
import type { InputCommand } from "./model";

afterEach(() => vi.unstubAllGlobals());
it("retains cancellation after response headers while waiting for the final receipt", async () => {
  const command: InputCommand = {
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
  let sentSignal!: AbortSignal;
  let signalReady!: () => void;
  const ready = new Promise<void>((resolve) => {
    signalReady = resolve;
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init: RequestInit) => {
      sentSignal = init.signal!;
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(
            new TextEncoder().encode('{"type":"progress","stage":"running"}\n'),
          );
          sentSignal.addEventListener(
            "abort",
            () => controller.error(new Error("Cancelled")),
            { once: true },
          );
        },
      });
      signalReady();
      return new Response(stream, {
        headers: { "content-type": "application/x-ndjson" },
      });
    }),
  );
  const pending = submitAssistantInput(command);
  const rejected = expect(pending).rejects.toThrow("Cancelled");
  await ready;
  // Response headers have arrived; consume the initial advisory frame first.
  await new Promise((resolve) => setTimeout(resolve, 0));
  stopInputRequest(command.actorKey, command.mode);
  expect(sentSignal.aborted).toBe(true);
  await rejected;
});
