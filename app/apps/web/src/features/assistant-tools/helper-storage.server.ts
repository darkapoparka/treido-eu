import "server-only";
import type { SellerTransaction } from "../../server/db/database";
import { SellerError } from "../sellers/errors";
import { parseDraftPayload, type DraftPayload } from "../selling/draft-model";
import type {
  HelperCommand,
  HelperChange,
  HelperEdit,
} from "./sell-helper-model";
export type HelperProposalRow = {
  id: string;
  draftId: string;
  draftRevision: number;
  baseHash: string;
  proposalHash: string;
  original: HelperEdit;
  payload: DraftPayload;
  createdAt: Date;
};
export type HelperIntentRow = {
  requestId: string;
  hash: string;
  revision: number;
  proposalId: string;
  draftId: string;
  draftRevision: number;
  payload: DraftPayload;
  command: HelperCommand;
};
export const proposalColumns = `id,listing_id AS "draftId",draft_revision AS "draftRevision",base_hash AS "baseHash",
  proposal_hash AS "proposalHash",original_edit AS original,proposed_payload AS payload,created_at AS "createdAt"`;
export const intentColumns = `request_id AS "requestId",input_hash AS hash,accepted_revision AS revision,
  proposal_id AS "proposalId",listing_id AS "draftId",draft_revision AS "draftRevision",payload,original_command AS command`;
export async function lockHelperWorkspace(
  tx: SellerTransaction,
  userId: string,
  sellerId: string,
) {
  await tx.client.query(
    "INSERT INTO treido.seller_helper_workspaces(user_id,seller_id) VALUES($1,$2) ON CONFLICT DO NOTHING",
    [userId, sellerId],
  );
  const workspace = (
    await tx.client.query<{ revision: number }>(
      "SELECT revision FROM treido.seller_helper_workspaces WHERE user_id=$1 AND seller_id=$2 FOR UPDATE",
      [userId, sellerId],
    )
  ).rows[0];
  if (!workspace) throw new SellerError("NOT_AVAILABLE");
  return workspace;
}
export async function helperReceipt(
  tx: SellerTransaction,
  userId: string,
  sellerId: string,
  requestId: string,
) {
  return (
    (
      await tx.client.query<{ hash: string; result: HelperChange }>(
        "SELECT input_hash AS hash,result FROM treido.seller_helper_receipts WHERE user_id=$1 AND seller_id=$2 AND request_id=$3",
        [userId, sellerId, requestId],
      )
    ).rows[0] ?? null
  );
}
export async function recordHelperReceipt(
  tx: SellerTransaction,
  userId: string,
  command: HelperCommand,
  hash: string,
  result: HelperChange,
) {
  await tx.client.query(
    "INSERT INTO treido.seller_helper_receipts(user_id,seller_id,request_id,input_hash,accepted_revision,operation,result) VALUES($1,$2,$3,$4,$5,$6,$7)",
    [
      userId,
      command.sellerId,
      command.requestId,
      hash,
      result.revision,
      command.operation.kind,
      result,
    ],
  );
}
export async function pendingHelperIntent(
  tx: SellerTransaction,
  userId: string,
  sellerId: string,
) {
  return (
    (
      await tx.client.query<HelperIntentRow>(
        `SELECT ${intentColumns} FROM treido.seller_helper_acceptance_intents WHERE user_id=$1 AND seller_id=$2 LIMIT 1`,
        [userId, sellerId],
      )
    ).rows[0] ?? null
  );
}
export async function ownedDraft(
  tx: SellerTransaction,
  sellerId: string,
  draftId: string,
) {
  const row = (
    await tx.client.query<{
      revision: number;
      payload: unknown;
      publication: string;
    }>(
      `SELECT d.revision,d.payload,l.publication
    FROM treido.listings l JOIN treido.listing_drafts d ON d.seller_id=l.seller_id AND d.listing_id=l.id
    WHERE l.seller_id=$1 AND l.id=$2 FOR SHARE OF l`,
      [sellerId, draftId],
    )
  ).rows[0];
  if (!row) throw new SellerError("FORBIDDEN");
  const payload = parseDraftPayload(row.payload);
  if (!payload) throw new SellerError("NOT_AVAILABLE");
  return { ...row, payload };
}
