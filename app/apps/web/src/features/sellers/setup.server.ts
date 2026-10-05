import "server-only";
import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import {
  inTransaction,
  type SellerDatabase,
  type SellerTransaction,
} from "../../server/db/database";
import {
  sellers,
  sellerProfiles,
  sellerDeclarations,
  sellerOnboarding,
  sellerSetupReceipts,
  signupIntents,
  drafts,
} from "../../server/db/schema";
import type { VerifiedIdentity } from "../../server/identity/clerk.server";
import {
  authorizeHuman,
  authorizeSeller,
  inputHash,
} from "./persistence.server";
import { SellerError } from "./errors";
import { validId } from "../selling/draft-model";
import { readFreeCatalogueLimits } from "./free-catalogue.server";
import { evaluateSellerReadiness, type SellerReadiness } from "./readiness";
import {
  BUSINESS_SETUP_VERSION,
  declarationComplete,
  declarationReadiness,
  emptyDeclaration,
  parseBusinessProfile,
  parseTraderDeclaration,
  parseSignupIntent,
  validRevision,
  type BusinessSetupView,
  type SetupAcknowledgement,
  type SetupStep,
  type SignupIntentView,
} from "./setup-model";

async function setupRecords(tx: SellerTransaction, sellerId: string) {
  const [progress] = await tx.db
    .select()
    .from(sellerOnboarding)
    .where(eq(sellerOnboarding.sellerId, sellerId));
  const [profile] = await tx.db
    .select()
    .from(sellerProfiles)
    .where(eq(sellerProfiles.sellerId, sellerId));
  const [declaration] = await tx.db
    .select({
      status: sellerDeclarations.status,
      requirementVersion: sellerDeclarations.requirementVersion,
      country: sellerDeclarations.country,
    })
    .from(sellerDeclarations)
    .where(eq(sellerDeclarations.sellerId, sellerId))
    .orderBy(desc(sellerDeclarations.revision))
    .limit(1);
  return { progress, profile, declaration };
}

/** An authorised editing projection; private declarations require their own capability. */
export function readSellerSetup(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  sellerId: string,
): Promise<BusinessSetupView> {
  return inTransaction(database, async (tx) => {
    const { seller, context } = await authorizeSeller(
      tx,
      identity,
      sellerId,
      "seller.read",
    );
    if (seller.kind !== "business") throw new SellerError("NOT_FOUND");
    const { progress, profile, declaration } = await setupRecords(tx, sellerId);
    const [privateDeclaration] = context.capabilities.includes(
      "declaration.manage",
    )
      ? await tx.db
          .select()
          .from(sellerDeclarations)
          .where(eq(sellerDeclarations.sellerId, sellerId))
          .orderBy(desc(sellerDeclarations.revision))
          .limit(1)
      : [];
    const [firstDraft] = context.capabilities.includes("listing.read")
      ? await tx.db
          .select({ id: drafts.listingId })
          .from(drafts)
          .where(eq(drafts.sellerId, sellerId))
          .limit(1)
      : [];
    return {
      sellerId,
      revision: progress?.revision ?? 0,
      lastStep: progress?.lastStep ?? "details",
      profile: {
        name: seller.name,
        description: profile?.description ?? "",
        locality: profile?.locality ?? "",
      },
      declaration: context.capabilities.includes("declaration.manage")
        ? privateDeclaration
          ? {
              country: "BG",
              legalName: privateDeclaration.legalName,
              registrationNumber: privateDeclaration.registrationNumber,
              contactEmail: privateDeclaration.contactEmail,
              contactAddress: privateDeclaration.contactAddress,
              accurate: privateDeclaration.accurate,
            }
          : { ...emptyDeclaration }
        : null,
      declarationStatus: declarationReadiness(declaration ?? null),
      canEditProfile: context.capabilities.includes("profile.manage"),
      canEditDeclaration: context.capabilities.includes("declaration.manage"),
      hasDraft: context.capabilities.includes("listing.read")
        ? Boolean(firstDraft)
        : null,
      canCreateDraft: context.capabilities.includes("listing.write"),
      savedAt: progress?.updatedAt.toISOString() ?? null,
    };
  });
}

export type SaveSellerSetupInput = {
  sellerId: string;
  expectedRevision: number;
  requestId: string;
  section: "details" | "declaration";
  submit: boolean;
  payload: unknown;
};
export async function saveSellerSetup(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  input: SaveSellerSetupInput,
): Promise<SetupAcknowledgement> {
  if (
    !input ||
    !validId(input.sellerId) ||
    !validId(input.requestId) ||
    !validRevision(input.expectedRevision) ||
    !["details", "declaration"].includes(input.section) ||
    typeof input.submit !== "boolean" ||
    (input.section === "details" && input.submit)
  )
    throw new SellerError("INVALID_INPUT");
  const profile =
    input.section === "details" ? parseBusinessProfile(input.payload) : null;
  const declaration =
    input.section === "declaration"
      ? parseTraderDeclaration(input.payload)
      : null;
  if (
    (!profile && !declaration) ||
    (input.submit && (!declaration || !declarationComplete(declaration)))
  )
    throw new SellerError("INVALID_INPUT");
  const hash = inputHash({
    section: input.section,
    submit: input.submit,
    payload: profile ?? declaration,
    expectedRevision: input.expectedRevision,
    requirementVersion: BUSINESS_SETUP_VERSION,
  });
  return inTransaction(database, async (tx) => {
    // Shared lock order with draft/team commands: human -> seller -> membership.
    // The exclusive seller lock also serialises first setup saves with no progress row.
    const { user, seller } = await authorizeSeller(
      tx,
      identity,
      input.sellerId,
      input.section === "details" ? "profile.manage" : "declaration.manage",
      true,
    );
    if (seller.kind !== "business") throw new SellerError("FORBIDDEN");
    const { progress } = await setupRecords(tx, input.sellerId);
    const currentRevision = progress?.revision ?? 0;
    const [receipt] = await tx.db
      .select()
      .from(sellerSetupReceipts)
      .where(
        and(
          eq(sellerSetupReceipts.sellerId, input.sellerId),
          eq(sellerSetupReceipts.userId, user.id),
          eq(sellerSetupReceipts.requestId, input.requestId),
        ),
      );
    if (receipt) {
      if (
        receipt.inputHash !== hash ||
        receipt.acceptedRevision !== currentRevision ||
        !progress
      )
        throw new SellerError("CONFLICT");
      return {
        sellerId: input.sellerId,
        revision: currentRevision,
        step: progress.lastStep,
        savedAt: receipt.acceptedAt.toISOString(),
      };
    }
    if (currentRevision !== input.expectedRevision)
      throw new SellerError("CONFLICT");
    const revision = currentRevision + 1;
    const step: SetupStep = profile
      ? "declaration"
      : input.submit
        ? "review"
        : "declaration";
    const savedAt = new Date();
    if (profile) {
      await tx.db
        .update(sellers)
        .set({ name: profile.name, revision: seller.revision + 1 })
        .where(eq(sellers.id, input.sellerId));
      await tx.db
        .insert(sellerProfiles)
        .values({
          sellerId: input.sellerId,
          description: profile.description,
          locality: profile.locality,
        })
        .onConflictDoUpdate({
          target: sellerProfiles.sellerId,
          set: { description: profile.description, locality: profile.locality },
        });
    }
    if (declaration) {
      await tx.db.insert(sellerDeclarations).values({
        id: randomUUID(),
        sellerId: input.sellerId,
        revision,
        requirementVersion: BUSINESS_SETUP_VERSION,
        ...declaration,
        status: input.submit ? "review_required" : "draft",
        submittedBy: user.id,
        submittedAt: input.submit ? savedAt : null,
      });
    }
    await tx.db
      .insert(sellerOnboarding)
      .values({
        sellerId: input.sellerId,
        revision,
        lastStep: step,
        updatedAt: savedAt,
      })
      .onConflictDoUpdate({
        target: sellerOnboarding.sellerId,
        set: { revision, lastStep: step, updatedAt: savedAt },
      });
    await tx.db.insert(sellerSetupReceipts).values({
      sellerId: input.sellerId,
      userId: user.id,
      requestId: input.requestId,
      inputHash: hash,
      acceptedRevision: revision,
      acceptedAt: savedAt,
    });
    return {
      sellerId: input.sellerId,
      revision,
      step,
      savedAt: savedAt.toISOString(),
    };
  });
}

export function readSignupIntent(
  database: SellerDatabase,
  identity: VerifiedIdentity,
): Promise<SignupIntentView> {
  return inTransaction(database, async (tx) => {
    let user;
    try {
      user = await authorizeHuman(tx, identity, false);
    } catch (error) {
      if (error instanceof SellerError && error.code === "NOT_FOUND")
        return { intent: null, revision: 0 };
      throw error;
    }
    const [row] = await tx.db
      .select({
        intent: signupIntents.intent,
        revision: signupIntents.revision,
      })
      .from(signupIntents)
      .where(eq(signupIntents.userId, user.id));
    return row ?? { intent: null, revision: 0 };
  });
}
export async function completeSignupIntent(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  input: {
    intent: unknown;
    expectedRevision: number;
    requestId: string;
  },
): Promise<SignupIntentView> {
  const intent = input ? parseSignupIntent(input.intent) : undefined;
  if (
    intent === undefined ||
    !validRevision(input.expectedRevision) ||
    !validId(input.requestId)
  )
    throw new SellerError("INVALID_INPUT");
  const hash = inputHash({ intent, expectedRevision: input.expectedRevision });
  return inTransaction(database, async (tx) => {
    const user = await authorizeHuman(tx, identity, true);
    const [row] = await tx.db
      .select()
      .from(signupIntents)
      .where(eq(signupIntents.userId, user.id));
    if (row?.lastRequestId === input.requestId) {
      if (row.lastInputHash !== hash) throw new SellerError("CONFLICT");
      return { intent: row.intent, revision: row.revision };
    }
    if ((row?.revision ?? 0) !== input.expectedRevision)
      throw new SellerError("CONFLICT");
    const revision = input.expectedRevision + 1;
    await tx.db
      .insert(signupIntents)
      .values({
        userId: user.id,
        intent,
        revision,
        lastRequestId: input.requestId,
        lastInputHash: hash,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: signupIntents.userId,
        set: {
          intent,
          revision,
          lastRequestId: input.requestId,
          lastInputHash: hash,
          updatedAt: new Date(),
        },
      });
    return { intent, revision };
  });
}

/** Advisory only. Publish/payment commands must reload their complete facts. */
export function readSellerReadiness(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  sellerId: string,
): Promise<readonly SellerReadiness[]> {
  return inTransaction(database, async (tx) => {
    const { authority, seller } = await authorizeSeller(
      tx,
      identity,
      sellerId,
      "seller.read",
    );
    const { declaration } = await setupRecords(tx, sellerId);
    const usage = await readFreeCatalogueLimits(tx, sellerId, seller.kind);
    const draftQuota =
      usage.draftCount < usage.drafts ? "available" : "exhausted";
    return ["draft", "publish", "checkout", "payout"].map((operation) =>
      evaluateSellerReadiness(
        authority,
        operation as "draft" | "publish" | "checkout" | "payout",
        {
          restrictions: {
            draft: "clear",
            publish: "clear",
            checkout: "clear",
            payout: "clear",
          },
          draft: { quota: draftQuota },
          publication: {
            country: "unavailable",
            declarations: declarationReadiness(declaration ?? null),
            category: "unavailable",
            listing: "unavailable",
            media: "unavailable",
            quota: "unavailable",
            moderation: "unavailable",
          },
          checkout: {
            order: "unavailable",
            payments: "unavailable",
            payouts: "unavailable",
            terms: "unavailable",
            allocation: "unavailable",
          },
          payout: { provider: "unavailable", settlement: "unavailable" },
        },
      ),
    );
  });
}
