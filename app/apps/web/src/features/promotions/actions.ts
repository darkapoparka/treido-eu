"use server";
import { reverificationError } from "@clerk/nextjs/server";
import { getDatabase } from "../../server/db/database";
import {
  hasVerifiedRecentAuthentication,
  requireVerifiedIdentity,
} from "../../server/identity/clerk.server";
import { referencePreviewEnabled } from "../catalog/queries.server";
import { backendConfigured } from "../sellers/backend-status.server";
import { SellerError } from "../sellers/errors";
import { parseCommand } from "./model";
import { executePromotion, recoverPromotion } from "./commands.server";
import { readPromotions } from "./queries.server";
import { promotionPaymentBridge } from "./payment-bridge.server";
import { createPromotionPayment } from "./provider.server";
function connected() {
  if (referencePreviewEnabled() || !backendConfigured())
    throw new SellerError("NOT_AVAILABLE");
}
function failure(error: unknown) {
  return {
    ok: false as const,
    code:
      error instanceof SellerError ? error.code : ("NOT_AVAILABLE" as const),
  };
}
export async function readPromotionsAction(sellerId: string) {
  try {
    connected();
    const identity = await requireVerifiedIdentity();
    return {
      ok: true as const,
      data: {
        subject: identity.subject,
        view: await readPromotions(getDatabase(), identity, sellerId),
      },
    };
  } catch (error) {
    return failure(error);
  }
}
export async function changePromotionAction(raw: unknown) {
  try {
    connected();
    const command = parseCommand(raw),
      identity = await requireVerifiedIdentity();
    if (
      command.action === "purchase" &&
      !hasVerifiedRecentAuthentication(identity)
    )
      return reverificationError("strict");
    const bridge = promotionPaymentBridge(),
      database = getDatabase();
    const ack = await executePromotion(database, identity, command, bridge);
    if (command.action === "purchase" && ack.attemptId && bridge)
      await createPromotionPayment(database, ack.attemptId, bridge, identity);
    return {
      ok: true as const,
      data: {
        subject: identity.subject,
        ack,
      },
    };
  } catch (error) {
    return failure(error);
  }
}
export async function recoverPromotionAction(raw: unknown) {
  try {
    connected();
    const command = parseCommand(raw),
      identity = await requireVerifiedIdentity();
    return {
      ok: true as const,
      data: {
        subject: identity.subject,
        ack: await recoverPromotion(getDatabase(), identity, command),
      },
    };
  } catch (error) {
    return failure(error);
  }
}
