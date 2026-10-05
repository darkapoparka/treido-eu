"use client";
import type { AssistantResult } from "../assistant-tools/actions";
import { changeAssistantInputAction } from "./actions";
import {
  parseInputCommand,
  parseInputResponse,
  type InputCommand,
  type InputChange,
} from "./model";
const inflight = new Map<string, AbortController>();
const scope = (command: InputCommand) => command.actorKey + ":" + command.mode;
export function stopInputRequest(
  actorKey: string,
  inputMode: InputCommand["mode"],
) {
  inflight.get(actorKey + ":" + inputMode)?.abort();
}
export async function submitAssistantInput(
  command: InputCommand,
): Promise<AssistantResult<InputChange>> {
  const parsed = parseInputCommand(command);
  if (parsed.operation.kind !== "execute")
    return changeAssistantInputAction(parsed);
  const controller = new AbortController(),
    key = scope(parsed);
  inflight.set(key, controller);
  try {
    const response = await fetch("/api/assistants/runs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(parsed),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(25000)]),
    });
    if (
      !response.ok ||
      !response.headers.get("content-type")?.startsWith("application/json")
    )
      throw Error();
    const raw = await response.text();
    if (raw.length > 4000) throw Error();
    return parseInputResponse(JSON.parse(raw));
  } finally {
    if (inflight.get(key) === controller) inflight.delete(key);
  }
}
