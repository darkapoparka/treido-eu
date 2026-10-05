"use server";
import { getDatabase } from "../../server/db/database";
import { requireVerifiedIdentity } from "../../server/identity/clerk.server";
import { backendConfigured } from "../sellers/backend-status.server";
import { referencePreviewEnabled } from "../catalog/queries.server";
import { SellerError } from "../sellers/errors";
import {
  readPromotionMeasurementChoice,
  changePromotionMeasurementChoice,
} from "./measurement-policy.server";
function connected() {
  if (!backendConfigured() || referencePreviewEnabled())
    throw new SellerError("NOT_AVAILABLE");
}
function failure(error: unknown) {
  return {
    ok: false as const,
    code:
      error instanceof SellerError ? error.code : ("NOT_AVAILABLE" as const),
  };
}
export async function readPromotionMeasurementAction() {
  try {
    connected();
    const identity = await requireVerifiedIdentity();
    return {
      ok: true as const,
      data: {
        subject: identity.subject,
        view: await readPromotionMeasurementChoice(getDatabase(), identity),
      },
    };
  } catch (error) {
    return failure(error);
  }
}
export async function changePromotionMeasurementAction(raw: unknown) {
  try {
    connected();
    const identity = await requireVerifiedIdentity();
    return {
      ok: true as const,
      data: {
        subject: identity.subject,
        ack: await changePromotionMeasurementChoice(
          getDatabase(),
          identity,
          raw,
        ),
      },
    };
  } catch (error) {
    return failure(error);
  }
}
