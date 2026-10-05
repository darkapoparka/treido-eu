import "server-only";
import {
  inTransaction,
  type SellerDatabase,
  type SellerTransaction,
} from "../../server/db/database";
import type { VerifiedIdentity } from "../../server/identity/clerk.server";
import { authorizeSeller, inputHash } from "../sellers/persistence.server";
import { SellerError } from "../sellers/errors";
import { validId } from "../selling/draft-model";
import {
  emptyContact,
  emptyDelivery,
  parseServicePayload,
  type ServiceSection,
  type ServicePayload,
  type ServiceView,
  type ServiceCommand,
} from "./model";

const capability = (section: ServiceSection) =>
  section === "contact" ? "profile.manage" : "delivery.manage";
async function record(
  tx: SellerTransaction,
  sellerId: string,
  section: ServiceSection,
) {
  return (
    await tx.client.query<{
      revision: number;
      payload: ServicePayload;
      updatedAt: Date;
    }>(
      `SELECT revision,payload,updated_at AS "updatedAt" FROM treido.seller_service_settings WHERE seller_id=$1 AND section=$2`,
      [sellerId, section],
    )
  ).rows[0];
}
export function readServiceSettings(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  sellerId: string,
  section: ServiceSection,
): Promise<ServiceView> {
  if (!["contact", "delivery"].includes(section))
    throw new SellerError("INVALID_INPUT");
  return inTransaction(database, async (tx) => {
    const { seller } = await authorizeSeller(
      tx,
      identity,
      sellerId,
      capability(section),
    );
    const row = await record(tx, sellerId, section);
    const payload = row
      ? parseServicePayload(section, row.payload)
      : section === "contact"
        ? { ...emptyContact }
        : { ...emptyDelivery };
    if (!payload) throw new SellerError("NOT_AVAILABLE");
    return {
      sellerId,
      name: seller.name,
      section,
      revision: row?.revision ?? 0,
      payload,
      savedAt: row?.updatedAt.toISOString() ?? null,
    };
  });
}
export function saveServiceSettings(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  input: ServiceCommand,
): Promise<ServiceView> {
  if (
    !input ||
    !validId(input.sellerId) ||
    !validId(input.requestId) ||
    !["contact", "delivery"].includes(input.section) ||
    !Number.isSafeInteger(input.expectedRevision) ||
    input.expectedRevision < 0
  )
    throw new SellerError("INVALID_INPUT");
  const payload = parseServicePayload(input.section, input.payload);
  if (!payload) throw new SellerError("INVALID_INPUT");
  const hash = inputHash({
    section: input.section,
    payload,
    expectedRevision: input.expectedRevision,
  });
  return inTransaction(database, async (tx) => {
    const { seller, user } = await authorizeSeller(
      tx,
      identity,
      input.sellerId,
      capability(input.section),
      true,
    );
    const current = await record(tx, seller.id, input.section);
    const receipt = (
      await tx.client.query<{ hash: string; revision: number }>(
        `SELECT input_hash AS hash,accepted_revision AS revision FROM treido.seller_service_receipts WHERE seller_id=$1 AND section=$2 AND actor_id=$3 AND request_id=$4`,
        [seller.id, input.section, user.id, input.requestId],
      )
    ).rows[0];
    if (receipt) {
      if (receipt.hash !== hash || receipt.revision !== current?.revision)
        throw new SellerError("CONFLICT");
      return {
        sellerId: seller.id,
        name: seller.name,
        section: input.section,
        revision: current.revision,
        payload: current.payload,
        savedAt: current.updatedAt.toISOString(),
      };
    }
    if ((current?.revision ?? 0) !== input.expectedRevision)
      throw new SellerError("CONFLICT");
    const revision = input.expectedRevision + 1;
    const saved = (
      await tx.client.query<{ updatedAt: Date }>(
        `INSERT INTO treido.seller_service_settings(seller_id,section,revision,payload,updated_by) VALUES($1,$2,$3,$4::jsonb,$5) ON CONFLICT(seller_id,section) DO UPDATE SET revision=EXCLUDED.revision,payload=EXCLUDED.payload,updated_by=EXCLUDED.updated_by,updated_at=clock_timestamp() RETURNING updated_at AS "updatedAt"`,
        [seller.id, input.section, revision, JSON.stringify(payload), user.id],
      )
    ).rows[0];
    await tx.client.query(
      `INSERT INTO treido.seller_service_receipts(seller_id,section,actor_id,request_id,input_hash,accepted_revision) VALUES($1,$2,$3,$4,$5,$6)`,
      [seller.id, input.section, user.id, input.requestId, hash, revision],
    );
    return {
      sellerId: seller.id,
      name: seller.name,
      section: input.section,
      revision,
      payload,
      savedAt: saved.updatedAt.toISOString(),
    };
  });
}
