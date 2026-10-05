import { parseInputResponse, type InputChange } from "./model";
import type { SellerResult } from "../sellers/errors";

export type AssistantRunResult = SellerResult<{
  subject: string;
  value: InputChange;
}>;
export type AssistantRunEvent =
  | { type: "progress"; stage: "running" }
  | { type: "result"; result: AssistantRunResult };
export const RUN_STREAM_LIMIT = 8192;

/** Streamed status is advisory. Only a complete validated command receipt can
 * acknowledge a run; a disconnected stream leaves the original retry pending. */
export async function readAssistantRunResponse(
  response: Response,
): Promise<AssistantRunResult> {
  if (!response.ok || !response.body)
    throw Error("Assistant response unavailable");
  const mime = response.headers.get("content-type")?.split(";")[0].trim();
  if (mime !== "application/json" && mime !== "application/x-ndjson")
    throw Error("Assistant response unavailable");
  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let total = 0;
  let pending = "";
  let progress = false;
  let result: AssistantRunResult | null = null;
  const event = (line: string) => {
    const value = JSON.parse(line);
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw Error("Assistant response invalid");
    if (
      value.type === "progress" &&
      value.stage === "running" &&
      Object.keys(value).length === 2 &&
      !progress &&
      !result
    ) {
      progress = true;
      return;
    }
    if (value.type === "result" && Object.keys(value).length === 2 && !result) {
      result = parseInputResponse(value.result);
      return;
    }
    throw Error("Assistant response invalid");
  };
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      total += chunk.value.byteLength;
      if (total > RUN_STREAM_LIMIT) throw Error("Assistant response too large");
      pending += decoder.decode(chunk.value, { stream: true });
      if (mime === "application/x-ndjson") {
        let boundary: number;
        while ((boundary = pending.indexOf("\n")) !== -1) {
          event(pending.slice(0, boundary));
          pending = pending.slice(boundary + 1);
        }
      }
    }
    pending += decoder.decode();
    if (mime === "application/json")
      return parseInputResponse(JSON.parse(pending));
    if (pending || !result) throw Error("Assistant response incomplete");
    return result;
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  } finally {
    reader.releaseLock();
  }
}
