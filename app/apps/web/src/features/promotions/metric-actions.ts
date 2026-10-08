"use server";
import { headers } from "next/headers";
import { getDatabase } from "../../server/db/database";
import { requireVerifiedIdentity } from "../../server/identity/clerk.server";
import { backendConfigured } from "../sellers/backend-status.server";
import { readBuyerReferenceMode } from "../catalog/buyer-data-mode.server";
import { SellerError } from "../sellers/errors";
import { recordPromotionMetric } from "./metrics.server";
export async function recordPromotionMetricAction(
  token: unknown,
  kind: unknown,
) {
  try {
    if (!backendConfigured() || (await readBuyerReferenceMode()))
      throw new SellerError("NOT_AVAILABLE");
    const identity = await requireVerifiedIdentity(),
      agent = (await headers()).get("user-agent") ?? "";
    return {
      ok: true as const,
      data: await recordPromotionMetric(
        getDatabase(),
        identity,
        token,
        kind,
        agent,
      ),
    };
  } catch (error) {
    return {
      ok: false as const,
      code:
        error instanceof SellerError ? error.code : ("NOT_AVAILABLE" as const),
    };
  }
}
