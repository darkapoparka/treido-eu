import "server-only";
import type { AssistantRunEvent, AssistantRunResult } from "./run-stream";

/** Cancellation stops further provider work and delivery, while the ordinary
 * command keeps its durable emitted-charge and original-request recovery. */
export function assistantRunStream(
  execute: (signal: AbortSignal) => Promise<AssistantRunResult>,
  failure: (error: unknown) => AssistantRunResult,
  requestSignal: AbortSignal,
) {
  const cancellation = new AbortController();
  const signal = AbortSignal.any([requestSignal, cancellation.signal]);
  const encoder = new TextEncoder();
  let stopped = false;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: AssistantRunEvent) => {
        if (!stopped && !signal.aborted)
          controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      };
      send({ type: "progress", stage: "running" });
      void (async () => {
        try {
          signal.throwIfAborted();
          send({ type: "result", result: await execute(signal) });
        } catch (error) {
          send({ type: "result", result: failure(error) });
        } finally {
          if (!stopped) {
            stopped = true;
            controller.close();
          }
        }
      })();
    },
    cancel() {
      stopped = true;
      cancellation.abort();
    },
  });
  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "private, no-store, no-transform",
      "x-content-type-options": "nosniff",
    },
  });
}
