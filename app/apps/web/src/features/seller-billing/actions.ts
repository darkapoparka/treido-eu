"use server";
import { reverificationError } from "@clerk/nextjs/server";
import { getDatabase } from "../../server/db/database";
import {
  requireVerifiedIdentity,
  hasVerifiedRecentAuthentication,
} from "../../server/identity/clerk.server";
import { validId } from "../selling/draft-model";
import { SellerError } from "../sellers/errors";
import { manageBillingRecovery } from "./recovery.server";
import {
  prepareBillingIntent,
  executeBillingIntent,
  recoverBillingIntent,
} from "./commands.server";

function failure(error: unknown) {
  return {
    ok: false,
    code: error instanceof SellerError ? error.code : "NOT_AVAILABLE",
  } as const;
}
export async function billingRecoveryCommandAction(raw: unknown) {
  try {
    const identity = await requireVerifiedIdentity();
    if (!hasVerifiedRecentAuthentication(identity))
      return reverificationError("strict");
    return {
      ok: true,
      data: await manageBillingRecovery(getDatabase(), identity, raw),
      actorSubject: identity.subject,
    } as const;
  } catch (error) {
    return failure(error);
  }
}
export async function billingCommandAction(raw: unknown) {
  try {
    const identity = await requireVerifiedIdentity();
    if (!hasVerifiedRecentAuthentication(identity))
      return reverificationError("strict");
    const database = getDatabase(),
      intent = await prepareBillingIntent(database, identity, raw);
    return {
      ok: true,
      data: await executeBillingIntent(database, identity, intent),
      actorSubject: identity.subject,
    } as const;
  } catch (error) {
    return failure(error);
  }
}
export async function recoverBillingAction(raw: unknown) {
  try {
    if (!raw || typeof raw !== "object" || Array.isArray(raw))
      throw new SellerError("INVALID_INPUT");
    const x = raw as Record<string, unknown>;
    if (
      Object.keys(x).some(
        (k) => !["sellerId", "requestId", "actorKey"].includes(k),
      ) ||
      !validId(x.sellerId) ||
      !validId(x.requestId) ||
      typeof x.actorKey !== "string" ||
      !/^[a-f0-9]{64}$/.test(x.actorKey)
    )
      throw new SellerError("INVALID_INPUT");
    const identity = await requireVerifiedIdentity();
    return {
      ok: true,
      data: await recoverBillingIntent(
        getDatabase(),
        identity,
        x.sellerId as string,
        x.requestId as string,
        x.actorKey,
      ),
      actorSubject: identity.subject,
    } as const;
  } catch (error) {
    return failure(error);
  }
}
