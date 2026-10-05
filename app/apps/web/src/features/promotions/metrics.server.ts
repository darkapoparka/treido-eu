import "server-only";
import { inTransaction, type SellerDatabase } from "../../server/db/database";
import type { VerifiedIdentity } from "../../server/identity/clerk.server";
import { authorizeHuman } from "../sellers/persistence.server";
import { publicDiscoveryKey } from "../catalog/public-discovery.server";
import { requireBackendBindings } from "../../server/config/backend-bindings.server";
import { SellerError } from "../sellers/errors";
import { promotionPaymentBridge } from "./payment-bridge.server";
import { verifyPlacement } from "./projection.server";
import { currentEligible } from "./eligibility.server";
import { campaign, databaseTime } from "./storage.server";
import {
  publishedJoins,
  publishedEligibility,
} from "../catalog/publication-eligibility.server";
import { publicInventoryJoin } from "../inventory/public-sql";
import { promotionAvailability } from "./eligibility.server";
import {
  promotionPaidJoins,
  promotionPaidEligibility,
} from "./paid-eligibility.server";
import { approvedMeasurementPolicy } from "./measurement-policy.server";

export function measuredTraffic(
  userAgent: string,
  environment: string,
  operator: boolean,
) {
  return (
    environment === "production" &&
    !operator &&
    userAgent.length > 0 &&
    userAgent.length <= 512 &&
    !/bot|crawler|spider|headless|playwright|puppeteer|selenium|test|monitor/i.test(
      userAgent,
    )
  );
}
/** Token proves issued placement, not human attention. Authenticated on-screen event counts are disclosed as measured subset. */
export async function recordPromotionMetric(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  token: unknown,
  kind: unknown,
  userAgent: string,
) {
  if (kind !== "impression" && kind !== "click")
    throw new SellerError("INVALID_INPUT");
  const bridge = promotionPaymentBridge();
  if (!bridge) throw new SellerError("NOT_AVAILABLE");
  const environment = requireBackendBindings().environment;
  return inTransaction(database, async (tx) => {
    const user = await authorizeHuman(tx, identity, false),
      now = await databaseTime(tx),
      placement = verifyPlacement(token, publicDiscoveryKey(), now.getTime());
    const policy = await approvedMeasurementPolicy(tx);
    if (!policy) return { recorded: false };
    const choice = (
      await tx.client.query<{ allowed: boolean }>(
        `SELECT allowed FROM treido.promotion_measurement_choices WHERE user_id=$1 AND policy_id=$2 ORDER BY revision DESC LIMIT 1`,
        [user.id, policy.id],
      )
    ).rows[0];
    if (choice?.allowed !== true) return { recorded: false };
    const operator = (
      await tx.client.query<{ allowed: boolean }>(
        `SELECT treido.lock_operator_grant($1,'reports.read') OR treido.lock_operator_grant($1,'moderation.write') AS allowed`,
        [user.id],
      )
    ).rows[0].allowed;
    if (!measuredTraffic(userAgent, environment, operator))
      return { recorded: false };
    const row = (
      await tx.client.query<{ sellerId: string; internal: boolean }>(
        `SELECT pc.seller_id AS "sellerId",EXISTS(SELECT 1 FROM treido.personal_seller_owners own WHERE own.seller_id=pc.seller_id AND own.user_id=$2) OR EXISTS(SELECT 1 FROM treido.seller_memberships m WHERE m.seller_id=pc.seller_id AND m.user_id=$2 AND m.status='active') AS internal FROM treido.promotion_campaigns pc WHERE pc.id=$1`,
        [placement.campaignId, user.id],
      )
    ).rows[0];
    if (!row || row.internal) return { recorded: false };
    const c = await campaign(tx, row.sellerId, placement.campaignId),
      listing = c ? await currentEligible(tx, row.sellerId, c.listingId) : null;
    if (
      !c ||
      !(
        c.state === "active" ||
        (c.state === "completed" &&
          c.productId === "bump_once_v1" &&
          c.reason === null)
      ) ||
      !listing ||
      listing.id !== placement.listingId ||
      listing.revision !== placement.listingRevision
    )
      return { recorded: false };
    const eligible = (
      await tx.client.query(
        `SELECT pc.id ${publishedJoins} ${publicInventoryJoin} ${promotionPaidJoins} WHERE pc.id=$1 AND p.revision=$6 AND ${promotionPaidEligibility} AND ${publishedEligibility} AND ${promotionAvailability}`,
        [
          c.id,
          bridge.binding.platformAccount,
          bridge.binding.environment,
          bridge.binding.applicationId,
          bridge.binding.livemode,
          placement.listingRevision,
        ],
      )
    ).rows[0];
    if (!eligible) return { recorded: false };
    if (
      kind === "click" &&
      !(
        await tx.client.query(
          `SELECT 1 FROM treido.promotion_metrics WHERE campaign_id=$1 AND placement_id=$2 AND kind='impression'`,
          [c.id, placement.placementId],
        )
      ).rows[0]
    )
      return { recorded: false };
    const inserted = await tx.client.query(
      `INSERT INTO treido.promotion_metrics(campaign_id,placement_id,kind,policy_version,expires_at) VALUES($1,$2,$3,'visible-v1',$4) ON CONFLICT DO NOTHING`,
      [
        c.id,
        placement.placementId,
        kind,
        new Date(now.getTime() + policy.retentionDays * 86400000),
      ],
    );
    return { recorded: inserted.rowCount === 1 };
  });
}
