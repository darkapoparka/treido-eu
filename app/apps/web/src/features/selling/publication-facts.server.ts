import "server-only";
import type { SellerTransaction } from "../../server/db/database";
import type { VerifiedIdentity } from "../../server/identity/clerk.server";
import { CATEGORY_REGISTRY_VERSION } from "@treido/contracts/categories";
import { readCategoryPublicationPolicy } from "../../server/categories/catalogue.server";
import { authorizeSeller } from "../sellers/persistence.server";
import {
  evaluateSellerReadiness,
  type SellerReadinessFacts,
} from "../sellers/readiness";
import {
  declarationReadiness,
  type DeclarationStatus,
} from "../sellers/setup-model";
import { SellerError } from "../sellers/errors";
import { parseDraftPayload, validId } from "./draft-model";
import {
  publicationFieldIssues,
  type PublicationReview,
} from "./publication-model";
export const FREE_ACTIVE_LIMITS = { personal: 30, business: 100 } as const;
export type PublicationAsset = {
  id: string;
  revision: number;
  state: string;
  position: number;
  checksum: string | null;
  width: number | null;
  height: number | null;
};
/** All writes acquire authority -> usage -> listing -> draft/policy/declaration/media. */
export async function inspectPublication(
  tx: SellerTransaction,
  identity: VerifiedIdentity,
  sellerId: string,
  listingId: string,
  write = false,
) {
  if (!validId(sellerId) || !validId(listingId))
    throw new SellerError("INVALID_INPUT");
  const access = await authorizeSeller(
    tx,
    identity,
    sellerId,
    write ? "listing.publish" : "listing.read",
  );
  const usage = (
    await tx.client.query<{ planId: string; planVersion: number }>(
      'SELECT plan_id AS "planId",plan_version AS "planVersion" FROM treido.seller_usage WHERE seller_id=$1 FOR ' +
        (write ? "UPDATE" : "SHARE"),
      [sellerId],
    )
  ).rows[0];
  const row = (
    await tx.client.query<{
      publication: PublicationReview["publication"];
      moderation: "clear" | "restricted" | "removed";
      revision: number;
      currentRevision: number | null;
      payload: unknown;
      policyVersion: number | null;
    }>(
      'SELECT l.publication,l.moderation_state AS moderation,l.revision,l.current_publication_revision AS "currentRevision",d.payload,d.category_policy_version AS "policyVersion" FROM treido.listings l JOIN treido.listing_drafts d ON d.listing_id=l.id AND d.seller_id=l.seller_id WHERE l.seller_id=$1 AND l.id=$2 FOR ' +
        (write ? "UPDATE" : "SHARE") +
        " OF l,d",
      [sellerId, listingId],
    )
  ).rows[0];
  if (!row) throw new SellerError("NOT_FOUND");
  const payload = parseDraftPayload(row.payload);
  if (!payload) throw new SellerError("NOT_AVAILABLE");
  const fieldIssues = publicationFieldIssues(payload);
  let category: NonNullable<SellerReadinessFacts["publication"]>["category"] =
    "unsupported";
  let policy: Awaited<ReturnType<typeof readCategoryPublicationPolicy>> | null =
    null;
  if (payload.categoryId && row.policyVersion) {
    try {
      if (write)
        await tx.client.query(
          "SELECT treido.lock_publication_policy($1,$2,$3,$4)",
          [
            CATEGORY_REGISTRY_VERSION,
            payload.categoryId,
            "BG",
            row.policyVersion,
          ],
        );
      policy = await readCategoryPublicationPolicy(
        tx,
        payload.categoryId,
        CATEGORY_REGISTRY_VERSION,
        row.policyVersion,
      );
      category = policy.allowed ? "reviewed" : "unreviewed";
    } catch (error) {
      if (!(error instanceof SellerError) || error.code !== "NOT_AVAILABLE")
        throw error;
      category = "stale";
    }
  }
  const declaration = (
    await tx.client.query<{
      revision: number;
      status: DeclarationStatus;
      country: string;
      requirementVersion: number;
    }>(
      'SELECT revision,status,country,requirement_version AS "requirementVersion" FROM treido.seller_declarations WHERE seller_id=$1 ORDER BY revision DESC LIMIT 1',
      [sellerId],
    )
  ).rows[0];
  const assets = (
    await tx.client.query<PublicationAsset>(
      "SELECT id,revision,state,position,derivative_checksum AS checksum,width,height FROM treido.media_assets WHERE seller_id=$1 AND listing_id=$2 AND state<>'detached' ORDER BY position,id LIMIT 13 FOR SHARE",
      [sellerId, listingId],
    )
  ).rows;
  const readyPhotos = assets.filter(
    (a) => a.state === "ready" && a.checksum && a.width && a.height,
  ).length;
  const active = Number(
    (
      await tx.client.query<{ count: string }>(
        "SELECT count(*) FROM treido.listings WHERE seller_id=$1 AND publication='published'",
        [sellerId],
      )
    ).rows[0].count,
  );
  const readiness = evaluateSellerReadiness(access.authority, "publish", {
    restrictions: { publish: "clear" },
    publication: {
      country: "supported",
      declarations:
        access.seller.kind === "personal"
          ? "current"
          : declarationReadiness(declaration ?? null),
      category,
      // Rights, handover and personal-sale acknowledgement are separately required by the publish command.
      listing: fieldIssues.length ? "incomplete" : "valid",
      media: assets.some((a) => a.state === "failed")
        ? "failed"
        : readyPhotos > 0 &&
            readyPhotos === assets.length &&
            assets.length <= 12
          ? "ready"
          : "pending",
      quota:
        usage?.planId === access.seller.kind + "_free" &&
        usage.planVersion === 1
          ? active < FREE_ACTIVE_LIMITS[access.seller.kind] ||
            row.publication === "published"
            ? "available"
            : "exhausted"
          : "unavailable",
      moderation: row.moderation === "clear" ? "eligible" : row.moderation,
    },
  });
  const review: PublicationReview = {
    sellerId,
    listingId,
    revision: row.revision,
    publication: row.publication,
    title: payload.title,
    fieldIssues,
    readyPhotos,
    readiness,
    sellerKind: access.seller.kind,
    media: assets
      .filter((a) => a.state === "ready")
      .map((a) => ({ id: a.id, revision: a.revision })),
    canPublish:
      readiness.status === "allowed" && row.publication !== "published",
    canWithdraw:
      access.context.capabilities.includes("listing.publish") &&
      row.publication === "published",
  };
  return { access, row, payload, policy, declaration, assets, review };
}
