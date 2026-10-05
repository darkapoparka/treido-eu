import "server-only";
import {
  inTransaction,
  type SellerDatabase,
  type SellerTransaction,
} from "../../server/db/database";
import type { VerifiedIdentity } from "../../server/identity/clerk.server";
import { authorizeSeller, inputHash } from "../sellers/persistence.server";
import { SellerError } from "../sellers/errors";
import {
  parseBusinessProfile,
  validRevision,
  type BusinessProfile,
} from "../sellers/setup-model";
import { validId } from "../selling/draft-model";
import type {
  PersonalProfileView,
  PersonalProfileCommand,
} from "./personal-profile-model";

async function projectProfile(
  tx: SellerTransaction,
  seller: { id: string; name: string; revision: number },
): Promise<PersonalProfileView> {
  const profile = (
    await tx.client.query<Omit<BusinessProfile, "name">>(
      `SELECT description,locality FROM treido.seller_profiles WHERE seller_id=$1`,
      [seller.id],
    )
  ).rows[0];
  return {
    sellerId: seller.id,
    revision: seller.revision,
    profile: {
      name: seller.name,
      description: profile?.description ?? "",
      locality: profile?.locality ?? "",
    },
  };
}
export function readPersonalProfile(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  sellerId: string,
): Promise<PersonalProfileView> {
  return inTransaction(database, async (tx) => {
    const { seller } = await authorizeSeller(
      tx,
      identity,
      sellerId,
      "profile.manage",
    );
    if (seller.kind !== "personal") throw new SellerError("FORBIDDEN");
    return projectProfile(tx, seller);
  });
}
/** Uses the same public seller projection; it cannot change seller kind or private declarations. */
export function savePersonalProfile(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  input: PersonalProfileCommand,
): Promise<PersonalProfileView> {
  if (
    !input ||
    !validId(input.sellerId) ||
    !validId(input.requestId) ||
    !validRevision(input.expectedRevision)
  )
    throw new SellerError("INVALID_INPUT");
  const profile = parseBusinessProfile(input.profile);
  if (!profile) throw new SellerError("INVALID_INPUT");
  const hash = inputHash({ expectedRevision: input.expectedRevision, profile });
  return inTransaction(database, async (tx) => {
    const { seller, user } = await authorizeSeller(
      tx,
      identity,
      input.sellerId,
      "profile.manage",
      true,
    );
    if (seller.kind !== "personal") throw new SellerError("FORBIDDEN");
    const previous = (
      await tx.client.query<{ hash: string; revision: number }>(
        `SELECT input_hash AS hash,accepted_revision AS revision FROM treido.personal_profile_receipts WHERE seller_id=$1 AND actor_id=$2 AND request_id=$3`,
        [seller.id, user.id, input.requestId],
      )
    ).rows[0];
    if (previous) {
      if (previous.hash !== hash || previous.revision !== seller.revision)
        throw new SellerError("CONFLICT");
      return projectProfile(tx, seller);
    }
    if (seller.revision !== input.expectedRevision)
      throw new SellerError("CONFLICT");
    const revision = seller.revision + 1;
    await tx.client.query(
      `UPDATE treido.seller_accounts SET name=$2,revision=$3 WHERE id=$1`,
      [seller.id, profile.name, revision],
    );
    await tx.client.query(
      `INSERT INTO treido.seller_profiles(seller_id,description,locality) VALUES($1,$2,$3) ON CONFLICT(seller_id) DO UPDATE SET description=EXCLUDED.description,locality=EXCLUDED.locality`,
      [seller.id, profile.description, profile.locality],
    );
    await tx.client.query(
      `INSERT INTO treido.personal_profile_receipts(seller_id,actor_id,request_id,input_hash,accepted_revision) VALUES($1,$2,$3,$4,$5)`,
      [seller.id, user.id, input.requestId, hash, revision],
    );
    return { sellerId: seller.id, revision, profile };
  });
}
