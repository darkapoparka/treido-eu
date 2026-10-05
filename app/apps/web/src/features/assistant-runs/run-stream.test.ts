import { expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { assistantRunStream } from "./run-stream.server";
import { readAssistantRunResponse, RUN_STREAM_LIMIT } from "./run-stream";

const result = {
  ok: true as const,
  data: {
    subject: "human-bg-Черна-камера",
    value: { revision: 1, runId: null, assetId: null, replayed: false },
  },
};
const failure = () => ({ ok: false as const, code: "NOT_AVAILABLE" as const });
const frame = JSON.stringify({ type: "result", result }) + "\n";
function response(text: string) {
  const bytes = new TextEncoder().encode(text);
  return new Response(
    new ReadableStream({
      start(controller) {
        // Includes split UTF-8 code points and delimiters, like real HTTP chunks.
        for (const byte of bytes) controller.enqueue(new Uint8Array([byte]));
        controller.close();
      },
    }),
    { headers: { "content-type": "application/x-ndjson" } },
  );
}
it("accepts split Bulgarian UTF-8 and exactly one final validated acknowledgment", async () => {
  expect(
    await readAssistantRunResponse(
      response('{"type":"progress","stage":"running"}\n' + frame),
    ),
  ).toEqual(result);
});
it("retains JSON preflight failures and rejects non-JSON responses", async () => {
  expect(await readAssistantRunResponse(Response.json(failure()))).toEqual(
    failure(),
  );
  await expect(
    readAssistantRunResponse(new Response("private stack")),
  ).rejects.toThrow();
});
it.each([
  '{"type":"progress","stage":"running"}\n',
  frame.trimEnd(),
  frame + frame,
  frame + '{"type":"progress","stage":"running"}\n',
  '{"type":"progress","stage":"running","private":"secret"}\n' + frame,
  '{"type":"result","result":{"ok":true,"data":{"subject":"wrong"}}}\n',
  '{"type":"progress","stage":"running"}\n{"type":"progress","stage":"running"}\n' +
    frame,
])(
  "disconnects, invalid receipts and duplicate/adulterated events remain unacknowledged: %#",
  async (wire) => {
    await expect(readAssistantRunResponse(response(wire))).rejects.toThrow();
  },
);
it("bounds actual bytes even if Content-Length claims a smaller value", async () => {
  const oversized = response("x".repeat(RUN_STREAM_LIMIT + 1));
  oversized.headers.set("content-length", "1");
  await expect(readAssistantRunResponse(oversized)).rejects.toThrow(
    "too large",
  );
});
it("the route streams advisory progress before the original command finishes", async () => {
  let resolve!: (value: typeof result) => void;
  const run = new Promise<typeof result>((done) => {
    resolve = done;
  });
  const streamed = assistantRunStream(
    () => run,
    failure,
    new AbortController().signal,
  );
  expect(streamed.headers.get("cache-control")).toContain("no-store");
  const reader = streamed.body!.getReader();
  expect(new TextDecoder().decode((await reader.read()).value)).toBe(
    '{"type":"progress","stage":"running"}\n',
  );
  resolve(result);
  expect(new TextDecoder().decode((await reader.read()).value)).toBe(frame);
  expect((await reader.read()).done).toBe(true);
});
it("failed execution exposes the finite error result without leaking provider messages", async () => {
  const streamed = assistantRunStream(
    async () => {
      throw Error("provider key and private prompt");
    },
    failure,
    new AbortController().signal,
  );
  expect(await readAssistantRunResponse(streamed)).toEqual(failure());
});
it("stream cancellation aborts execution and suppresses a late completed receipt", async () => {
  let complete!: (value: typeof result) => void;
  let observed!: AbortSignal;
  const run = new Promise<typeof result>((resolve) => {
    complete = resolve;
  });
  const execute = vi.fn((signal: AbortSignal) => {
    observed = signal;
    return run;
  });
  const streamed = assistantRunStream(
    execute,
    failure,
    new AbortController().signal,
  );
  const reader = streamed.body!.getReader();
  await reader.read();
  await reader.cancel();
  expect(observed.aborted).toBe(true);
  complete(result);
  await Promise.resolve();
  expect((await reader.read()).done).toBe(true);
  expect(execute).toHaveBeenCalledTimes(1);
});
it("an already disconnected caller cannot start execution", async () => {
  const execute = vi.fn(async () => result);
  const streamed = assistantRunStream(execute, failure, AbortSignal.abort());
  expect(await streamed.text()).toBe("");
  expect(execute).not.toHaveBeenCalled();
});
