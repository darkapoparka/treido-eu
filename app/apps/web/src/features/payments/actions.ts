"use server";
import { reverificationError } from "@clerk/nextjs/server";
import { getDatabase } from "../../server/db/database";
import {
  requireVerifiedIdentity,
  hasVerifiedRecentAuthentication,
} from "../../server/identity/clerk.server";
import { SellerError } from "../sellers/errors";
import { createPayableQuote } from "./quotes.server";
import { beginPayment, requestPaymentCancellation } from "./attempts.server";
import { changePaidOrder } from "./orders.server";
import { createConnectOnboarding } from "./connect.server";
import { parseOrderCommand, parseResource } from "./model";

function failure(error: unknown) {
  return {
    ok: false,
    code: error instanceof SellerError ? error.code : "NOT_AVAILABLE",
  } as const;
}
export async function createQuoteAction(raw: unknown) {
  try {
    const identity = await requireVerifiedIdentity();
    return {
      ok: true,
      data: await createPayableQuote(getDatabase(), identity, raw),
    } as const;
  } catch (error) {
    return failure(error);
  }
}
export async function beginPaymentAction(raw: unknown) {
  try {
    const identity = await requireVerifiedIdentity();
    return {
      ok: true,
      data: await beginPayment(getDatabase(), identity, raw),
    } as const;
  } catch (error) {
    return failure(error);
  }
}
export async function cancelPaymentAction(raw: unknown) {
  try {
    const identity = await requireVerifiedIdentity();
    return {
      ok: true,
      data: await requestPaymentCancellation(getDatabase(), identity, raw),
    } as const;
  } catch (error) {
    return failure(error);
  }
}
export async function changeOrderAction(raw: unknown) {
  try {
    const command = parseOrderCommand(raw),
      identity = await requireVerifiedIdentity();
    if (
      command.action === "refund" &&
      !hasVerifiedRecentAuthentication(identity)
    )
      return reverificationError("strict");
    return {
      ok: true,
      data: await changePaidOrder(getDatabase(), identity, command),
    } as const;
  } catch (error) {
    return failure(error);
  }
}
export async function startOnboardingAction(raw: unknown) {
  try {
    const command = parseResource(raw),
      identity = await requireVerifiedIdentity();
    if (!hasVerifiedRecentAuthentication(identity))
      return reverificationError("strict");
    return {
      ok: true,
      data: await createConnectOnboarding(getDatabase(), identity, command),
    } as const;
  } catch (error) {
    return failure(error);
  }
}
