import "server-only";
import { requirePersistedDraftCategory } from "../../server/categories/catalogue.server";
import { randomUUID } from "node:crypto";
import { and, eq, desc, sql } from "drizzle-orm";
import { getCategory } from "@treido/contracts/categories";
import {
  inTransaction,
  type SellerDatabase,
  type SellerTransaction,
} from "../../server/db/database";
import {
  drafts,
  draftSaves,
  listings,
  sellerUsage,
} from "../../server/db/schema";
import type { VerifiedIdentity } from "../../server/identity/clerk.server";
import {
  authorizeSeller,
  ensurePersonalInTransaction,
  inputHash,
} from "../sellers/persistence.server";
import { SellerError } from "../sellers/errors";
import { FREE_DRAFT_LIMITS } from "./draft-quota";
import {
  parseDraftPayload,
  validId,
  type DraftPayload,
  type DraftView,
  type DraftAcknowledgement,
} from "./draft-model";

function payload(input: unknown): DraftPayload {
  const parsed = parseDraftPayload(input);
  if (!parsed) throw new SellerError("INVALID_INPUT");
  return parsed;
}
const acknowledgement = (
  row: typeof drafts.$inferSelect,
): DraftAcknowledgement => ({
  id: row.listingId,
  sellerId: row.sellerId,
  revision: row.revision,
  updatedAt: row.updatedAt.toISOString(),
});
const categoryVersion = (data: DraftPayload) => {
  const category = data.categoryId ? getCategory(data.categoryId) : null;
  return category?.kind === "leaf" ? category.policy.version : null;
};

export async function createDraftInTransaction(
  tx: SellerTransaction,
  identity: VerifiedIdentity,
  sellerId: string,
  requestId: string,
  data: DraftPayload,
): Promise<DraftAcknowledgement> {
  const { user, seller } = await authorizeSeller(
    tx,
    identity,
    sellerId,
    "listing.write",
  );
  await requirePersistedDraftCategory(tx, data.categoryId);
  // Lock order: user -> seller -> ownership/membership -> usage -> listing.
  await tx.client.query(
    "SELECT seller_id FROM treido.seller_usage WHERE seller_id = $1 FOR UPDATE",
    [sellerId],
  );
  const [usage] = await tx.db
    .select()
    .from(sellerUsage)
    .where(eq(sellerUsage.sellerId, sellerId));
  if (
    !usage ||
    usage.planVersion !== 1 ||
    usage.planId !== `${seller.kind}_free`
  )
    throw new SellerError("NOT_AVAILABLE");
  const hash = inputHash(data);
  const [previous] = await tx.db
    .select()
    .from(drafts)
    .where(
      and(
        eq(drafts.sellerId, sellerId),
        eq(drafts.createdBy, user.id),
        eq(drafts.creationKey, requestId),
      ),
    );
  if (previous) {
    const existing = await tx.client.query<{ publication: string }>(
      "SELECT publication FROM treido.listings WHERE seller_id=$1 AND id=$2 FOR SHARE",
      [sellerId, previous.listingId],
    );
    if (
      previous.creationHash !== hash ||
      previous.revision !== 1 ||
      existing.rows[0]?.publication !== "draft"
    )
      throw new SellerError("CONFLICT");
    return acknowledgement(previous);
  }
  // Version-one Free draft limits from billing.md; no browser plan selection.
  const limit = FREE_DRAFT_LIMITS[seller.kind];
  if (usage.draftCount >= limit) throw new SellerError("QUOTA_EXCEEDED");
  const listingId = randomUUID();
  await tx.db.insert(listings).values({ id: listingId, sellerId });
  const [created] = await tx.db
    .insert(drafts)
    .values({
      listingId,
      sellerId,
      payload: data,
      categoryPolicyVersion: categoryVersion(data),
      createdBy: user.id,
      creationKey: requestId,
      creationHash: hash,
    })
    .returning();
  await tx.db
    .update(sellerUsage)
    .set({ draftCount: sql`${sellerUsage.draftCount} + 1` })
    .where(eq(sellerUsage.sellerId, sellerId));
  return acknowledgement(created);
}

export async function createListingDraft(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  input: { sellerId: string | null; requestId: string; payload: unknown },
) {
  if (
    !validId(input.requestId) ||
    (input.sellerId !== null && !validId(input.sellerId))
  )
    throw new SellerError("INVALID_INPUT");
  const data = payload(input.payload);
  return inTransaction(database, async (tx) => {
    const sellerId =
      input.sellerId ?? (await ensurePersonalInTransaction(tx, identity));
    return createDraftInTransaction(
      tx,
      identity,
      sellerId,
      input.requestId,
      data,
    );
  });
}

export async function saveListingDraft(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  input: {
    sellerId: string;
    draftId: string;
    expectedRevision: number;
    requestId: string;
    payload: unknown;
  },
): Promise<DraftAcknowledgement> {
  if (
    !validId(input.sellerId) ||
    !validId(input.draftId) ||
    !validId(input.requestId) ||
    !Number.isSafeInteger(input.expectedRevision) ||
    input.expectedRevision < 1
  )
    throw new SellerError("INVALID_INPUT");
  const data = payload(input.payload);
  return inTransaction(database, async (tx) => {
    const { user } = await authorizeSeller(
      tx,
      identity,
      input.sellerId,
      "listing.write",
    );
    const locked = await tx.client.query<{ publication: string }>(
      "SELECT publication FROM treido.listings WHERE seller_id = $1 AND id = $2 FOR UPDATE",
      [input.sellerId, input.draftId],
    );
    if (!locked.rows[0]) throw new SellerError("FORBIDDEN");
    // Published snapshots are immutable; withdraw before editing and republish explicitly.
    if (!["draft", "withdrawn"].includes(locked.rows[0].publication))
      throw new SellerError("FORBIDDEN");
    const [draft] = await tx.db
      .select()
      .from(drafts)
      .where(
        and(
          eq(drafts.sellerId, input.sellerId),
          eq(drafts.listingId, input.draftId),
        ),
      );
    if (!draft) throw new SellerError("NOT_FOUND");
    const hash = inputHash({
      expectedRevision: input.expectedRevision,
      payload: data,
    });
    const [receipt] = await tx.db
      .select()
      .from(draftSaves)
      .where(
        and(
          eq(draftSaves.sellerId, input.sellerId),
          eq(draftSaves.listingId, input.draftId),
          eq(draftSaves.userId, user.id),
          eq(draftSaves.requestId, input.requestId),
        ),
      );
    if (receipt) {
      if (
        receipt.inputHash !== hash ||
        receipt.acceptedRevision !== draft.revision
      )
        throw new SellerError("CONFLICT");
      return acknowledgement(draft);
    }
    if (draft.revision !== input.expectedRevision)
      throw new SellerError("CONFLICT");
    await requirePersistedDraftCategory(tx, data.categoryId);
    const [saved] = await tx.db
      .update(drafts)
      .set({
        payload: data,
        revision: draft.revision + 1,
        updatedAt: sql`now()`,
        categoryPolicyVersion: categoryVersion(data),
      })
      .where(
        and(
          eq(drafts.sellerId, input.sellerId),
          eq(drafts.listingId, input.draftId),
          eq(drafts.revision, input.expectedRevision),
        ),
      )
      .returning();
    if (!saved) throw new SellerError("CONFLICT");
    await tx.db
      .update(listings)
      .set({ revision: saved.revision })
      .where(
        and(
          eq(listings.sellerId, input.sellerId),
          eq(listings.id, input.draftId),
        ),
      );
    await tx.db.insert(draftSaves).values({
      sellerId: input.sellerId,
      listingId: input.draftId,
      userId: user.id,
      requestId: input.requestId,
      inputHash: hash,
      acceptedRevision: saved.revision,
    });
    return acknowledgement(saved);
  });
}

export async function readListingDraft(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  sellerId: string,
  draftId: string,
): Promise<DraftView & { publication: "draft" | "published" | "withdrawn" }> {
  if (!validId(draftId)) throw new SellerError("INVALID_INPUT");
  return inTransaction(database, async (tx) => {
    await authorizeSeller(tx, identity, sellerId, "listing.read");
    const [row] = await tx.db
      .select({ draft: drafts, publication: listings.publication })
      .from(drafts)
      .innerJoin(
        listings,
        and(
          eq(listings.id, drafts.listingId),
          eq(listings.sellerId, drafts.sellerId),
        ),
      )
      .where(and(eq(drafts.sellerId, sellerId), eq(drafts.listingId, draftId)));
    if (!row) throw new SellerError("FORBIDDEN");
    return {
      ...acknowledgement(row.draft),
      payload: payload(row.draft.payload),
      publication: row.publication,
    };
  });
}

export function listListingDrafts(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  sellerId: string,
) {
  return inTransaction(database, async (tx) => {
    await authorizeSeller(tx, identity, sellerId, "listing.read");
    const rows = await tx.db
      .select({
        id: drafts.listingId,
        revision: drafts.revision,
        updatedAt: drafts.updatedAt,
        payload: drafts.payload,
      })
      .from(drafts)
      .where(eq(drafts.sellerId, sellerId))
      .orderBy(desc(drafts.updatedAt), desc(drafts.listingId))
      .limit(50);
    return rows.map((row) => ({
      id: row.id,
      revision: row.revision,
      updatedAt: row.updatedAt.toISOString(),
      title: row.payload.title,
      priceMinor: row.payload.priceMinor,
      currency: "EUR" as const,
    }));
  });
}
