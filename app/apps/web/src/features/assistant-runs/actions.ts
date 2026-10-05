"use server";
import { getDatabase } from "../../server/db/database";
import type { AssistantResult } from "../assistant-tools/actions";
import { requireAssistantActor } from "../assistant-tools/storage.server";
import { SellerError } from "../sellers/errors";
import { assistantInputIdentity, inputFailure } from "./identity.server";
import { readAssistantInput } from "./queries.server";
import { changeAssistantInput } from "./commands.server";
import { signInputUpload } from "./media.server";
import {
  mode,
  uuid,
  record,
  keys,
  parseInputCommand,
  type InputView,
  type InputChange,
} from "./model";
export async function readAssistantInputAction(
  rawMode: unknown,
): Promise<AssistantResult<InputView>> {
  try {
    const inputMode = mode(rawMode),
      identity = await assistantInputIdentity();
    return {
      ok: true,
      data: {
        subject: identity.subject,
        value: await readAssistantInput(getDatabase(), identity, inputMode),
      },
    };
  } catch (error) {
    return inputFailure(error);
  }
}
export async function changeAssistantInputAction(
  raw: unknown,
): Promise<AssistantResult<InputChange>> {
  try {
    const command = parseInputCommand(raw);
    if (command.operation.kind === "execute")
      throw new SellerError("INVALID_INPUT");
    const identity = await assistantInputIdentity();
    return {
      ok: true,
      data: {
        subject: identity.subject,
        value: await changeAssistantInput(
          getDatabase(),
          identity,
          command,
          assistantInputIdentity,
        ),
      },
    };
  } catch (error) {
    return inputFailure(error);
  }
}
export async function signAssistantInputUploadAction(
  raw: unknown,
): Promise<AssistantResult<{ url: string; headers: Record<string, string> }>> {
  try {
    const input = record(raw);
    keys(input, ["actorKey", "assetId"]);
    const id = uuid(input.assetId),
      identity = await assistantInputIdentity();
    if (typeof input.actorKey !== "string")
      throw new SellerError("INVALID_INPUT");
    requireAssistantActor(identity, input.actorKey);
    return {
      ok: true,
      data: {
        subject: identity.subject,
        value: await signInputUpload(
          getDatabase(),
          identity,
          id,
          assistantInputIdentity,
        ),
      },
    };
  } catch (error) {
    return inputFailure(error);
  }
}
