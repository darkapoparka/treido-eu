import { getDatabase } from "../../../../server/db/database";
import { requireBackendBindings } from "../../../../server/config/backend-bindings.server";
import { boundedJson } from "../../../../server/jobs/http.server";
import { SellerError } from "../../../../features/sellers/errors";
import {
  assistantInputIdentity,
  inputFailure,
} from "../../../../features/assistant-runs/identity.server";
import {
  parseInputCommand,
  INPUT_LIMITS,
} from "../../../../features/assistant-runs/model";
import { changeAssistantInput } from "../../../../features/assistant-runs/commands.server";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const configured = requireBackendBindings(),
      url = new URL(request.url);
    if (
      url.search ||
      url.origin !== configured.application.origin ||
      request.headers.get("origin") !== configured.application.origin
    )
      throw new SellerError("FORBIDDEN");
    let raw: unknown;
    try {
      raw = await boundedJson(request, INPUT_LIMITS.commandBytes);
    } catch {
      throw new SellerError("INVALID_INPUT");
    }
    const command = parseInputCommand(raw);
    if (command.operation.kind !== "execute")
      throw new SellerError("INVALID_INPUT");
    const identity = await assistantInputIdentity(),
      value = await changeAssistantInput(
        getDatabase(),
        identity,
        command,
        assistantInputIdentity,
        request.signal,
      );
    return Response.json(
      { ok: true, data: { subject: identity.subject, value } },
      { headers: { "cache-control": "private, no-store" } },
    );
  } catch (error) {
    return Response.json(inputFailure(error), {
      headers: { "cache-control": "private, no-store" },
    });
  }
}
