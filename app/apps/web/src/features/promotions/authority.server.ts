import "server-only";
import { createHmac } from "node:crypto";
import type { SellerTransaction } from "../../server/db/database";
import type { VerifiedIdentity } from "../../server/identity/clerk.server";
import { authorizeSeller } from "../sellers/persistence.server";
import { publicDiscoveryKey } from "../catalog/public-discovery.server";

export async function authorizePromotion(
  tx: SellerTransaction,
  identity: VerifiedIdentity,
  sellerId: string,
  exclusive = false,
) {
  const access = await authorizeSeller(
    tx,
    identity,
    sellerId,
    "marketing.manage",
    exclusive,
  );
  const actorKey = createHmac("sha256", publicDiscoveryKey())
    .update("promotion-actor-v1:" + identity.subject + ":" + sellerId)
    .digest("hex");
  return { ...access, actorKey };
}
