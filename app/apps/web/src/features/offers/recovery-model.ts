import { onlyKeys } from "../inventory/model";
import { SellerError } from "../sellers/errors";
import { parseOfferCommand, type OfferCommand } from "./model";

/** The action envelope binds the human without changing the established
 * financial command, input hash or allocation transaction on exact replay. */
export type OfferMutation = { actorKey: string; command: OfferCommand };
export type OfferRecoveryView = {
  actorKey: string;
  sellerId: string | null;
  threadId: string;
  requestId: string;
  state: "recorded" | "not_applied" | "unrecorded";
  acceptedRevision: number | null;
  currentRevision: number;
  offerId: string | null;
};
export function parseOfferMutation(raw: unknown): OfferMutation {
  if (
    !onlyKeys(raw, ["actorKey", "command"]) ||
    typeof raw.actorKey !== "string" ||
    !/^[a-f0-9]{64}$/.test(raw.actorKey)
  )
    throw new SellerError("INVALID_INPUT");
  return { actorKey: raw.actorKey, command: parseOfferCommand(raw.command) };
}
export function restoreOfferMutation(
  raw: unknown,
  scope: { actorKey: string; sellerId: string | null; threadId: string },
): OfferMutation | null {
  try {
    const mutation = parseOfferMutation(
      typeof raw === "string" ? JSON.parse(raw) : raw,
    );
    return mutation.actorKey === scope.actorKey &&
      mutation.command.sellerId === scope.sellerId &&
      mutation.command.threadId === scope.threadId
      ? mutation
      : null;
  } catch {
    return null;
  }
}
/** Only an advanced, currently locked monotonic revision can rule out a still
 * unrecorded command. Same-revision absence is not proof of network failure. */
export function offerRecoveryState(
  expectedRevision: number,
  currentRevision: number,
  recorded: boolean,
): OfferRecoveryView["state"] {
  if (recorded) return "recorded";
  return currentRevision > expectedRevision ? "not_applied" : "unrecorded";
}
