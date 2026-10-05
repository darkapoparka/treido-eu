"use server";
import { reverificationError } from "@clerk/nextjs/server";
import { getDatabase } from "../../server/db/database";
import {
  requireVerifiedIdentity,
  hasVerifiedRecentAuthentication,
} from "../../server/identity/clerk.server";
import { SellerError } from "../sellers/errors";
import { parseAftercareCommand } from "./model";
import { executeOrderCase, recoverOrderAftercare } from "./cases.server";
import {
  prepareOrderRefund,
  executeOrderRefund,
} from "./refund-commands.server";
import { changeOrderFulfilment } from "./fulfilment.server";
import { decideOrderCase } from "./operators.server";
import { moderateOrderFeedback } from "../order-feedback/moderation.server";
function failure(error: unknown) {
  return {
    ok: false,
    code: error instanceof SellerError ? error.code : "NOT_AVAILABLE",
  } as const;
}
export async function aftercareAction(raw: unknown) {
  try {
    const command = parseAftercareCommand(raw),
      identity = await requireVerifiedIdentity();
    if (
      (command.action === "prepare_refund" ||
        command.action === "execute_refund") &&
      !hasVerifiedRecentAuthentication(identity)
    )
      return reverificationError("strict");
    const database = getDatabase();
    const data =
      command.action === "prepare_refund"
        ? await prepareOrderRefund(database, identity, command)
        : command.action === "execute_refund"
          ? await executeOrderRefund(database, identity, command)
          : command.action === "record_tracking" ||
              command.action === "confirm_delivery"
            ? await changeOrderFulfilment(database, identity, command)
            : await executeOrderCase(database, identity, command);
    return { ok: true, data } as const;
  } catch (error) {
    return failure(error);
  }
}
export async function recoverAftercareAction(raw: unknown) {
  try {
    return {
      ok: true,
      data: await recoverOrderAftercare(
        getDatabase(),
        await requireVerifiedIdentity(),
        raw,
      ),
    } as const;
  } catch (error) {
    return failure(error);
  }
}
export async function orderCaseDecisionAction(raw: unknown) {
  try {
    const identity = await requireVerifiedIdentity();
    if (!hasVerifiedRecentAuthentication(identity))
      return reverificationError("strict");
    return {
      ok: true,
      data: await decideOrderCase(getDatabase(), identity, raw),
    } as const;
  } catch (error) {
    return failure(error);
  }
}
export async function orderFeedbackDecisionAction(raw: unknown) {
  try {
    const identity = await requireVerifiedIdentity();
    if (!hasVerifiedRecentAuthentication(identity))
      return reverificationError("strict");
    return {
      ok: true,
      data: await moderateOrderFeedback(getDatabase(), identity, raw),
    } as const;
  } catch (error) {
    return failure(error);
  }
}

export async function recoverOperatorDecisionAction(raw: unknown) {
  try {
    const { recoverOperatorDecision } =
      await import("./operator-recovery.server");
    return {
      ok: true,
      data: await recoverOperatorDecision(
        getDatabase(),
        await requireVerifiedIdentity(),
        raw,
      ),
    } as const;
  } catch (error) {
    return failure(error);
  }
}
