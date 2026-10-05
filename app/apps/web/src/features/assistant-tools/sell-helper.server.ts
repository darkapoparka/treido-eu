import "server-only";
import { randomUUID } from "node:crypto";
import { inTransaction, type SellerDatabase } from "../../server/db/database";
import type { VerifiedIdentity } from "../../server/identity/clerk.server";
import {
  authorizeHuman,
  authorizeSeller,
  inputHash,
} from "../sellers/persistence.server";
import { SellerError } from "../sellers/errors";
import { parseDraftPayload } from "../selling/draft-model";
import { saveListingDraft } from "../selling/drafts.server";
import {
  assistantActorKey,
  checkAssistantBudget,
  requireAssistantActor,
  requireAssistantStorage,
} from "./storage.server";
import {
  applyHelperEdit,
  editableDraft,
  inspectHelperDraft,
  parseHelperCommand,
  type HelperView,
  type HelperCommand,
  type HelperChange,
} from "./sell-helper-model";
import {
  helperReceipt,
  recordHelperReceipt,
  pendingHelperIntent,
  lockHelperWorkspace,
  ownedDraft,
  proposalColumns,
  type HelperProposalRow,
  type HelperIntentRow,
} from "./helper-storage.server";
import { ASSISTANT_LIMITS } from "./limits";

export async function readSellHelper(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  sellerId: string,
): Promise<HelperView> {
  return inTransaction(database, async (tx) => {
    await requireAssistantStorage(tx);
    const { user } = await authorizeSeller(
      tx,
      identity,
      sellerId,
      "listing.write",
    );
    const revision =
      (
        await tx.client.query<{ revision: number }>(
          "SELECT revision FROM treido.seller_helper_workspaces WHERE user_id=$1 AND seller_id=$2",
          [user.id, sellerId],
        )
      ).rows[0]?.revision ?? 0;
    const proposals = (
      await tx.client.query<HelperProposalRow>(
        `SELECT ${proposalColumns} FROM treido.seller_helper_proposals WHERE user_id=$1 AND seller_id=$2 ORDER BY created_at DESC,id LIMIT 5`,
        [user.id, sellerId],
      )
    ).rows;
    const views: HelperView["proposals"] = [];
    for (const row of proposals) {
      const payload = parseDraftPayload(row.payload);
      if (!payload) throw new SellerError("NOT_AVAILABLE");
      const current = await ownedDraft(tx, sellerId, row.draftId);
      views.push({
        id: row.id,
        draftId: row.draftId,
        draftRevision: row.draftRevision,
        baseHash: row.baseHash,
        proposalHash: row.proposalHash,
        original: row.original,
        edit: editableDraft(payload),
        issues: inspectHelperDraft(payload),
        createdAt: row.createdAt.toISOString(),
        current:
          ["draft", "withdrawn"].includes(current.publication) &&
          current.revision === row.draftRevision &&
          inputHash(current.payload) === row.baseHash,
      });
    }
    const pending = await pendingHelperIntent(tx, user.id, sellerId);
    return {
      actorKey: assistantActorKey(identity),
      sellerId,
      revision,
      proposals: views,
      pending: pending?.command ?? null,
    };
  });
}

/** Stage only after a deliberate confirmed action. The frozen payload goes to
 * the existing saveListingDraft command outside this transaction; no nested
 * commit, direct draft SQL update, media/publication or provider effect. */
async function stageHelper(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  command: HelperCommand,
): Promise<HelperChange | HelperIntentRow> {
  return inTransaction(database, async (tx) => {
    await requireAssistantStorage(tx);
    // Exclusive human first: the combined human budget and lock order stay atomic.
    await authorizeHuman(tx, identity, true);
    const { user, seller } = await authorizeSeller(
      tx,
      identity,
      command.sellerId,
      "listing.write",
    );
    const workspace = await lockHelperWorkspace(tx, user.id, command.sellerId),
      hash = inputHash(command);
    const receipt = await helperReceipt(
      tx,
      user.id,
      command.sellerId,
      command.requestId,
    );
    if (receipt) {
      if (receipt.hash !== hash) throw new SellerError("CONFLICT");
      if (receipt.result.draftId)
        await ownedDraft(tx, command.sellerId, receipt.result.draftId);
      return { ...receipt.result, replayed: true };
    }
    const pending = await pendingHelperIntent(tx, user.id, command.sellerId);
    if (pending) {
      if (pending.requestId !== command.requestId || pending.hash !== hash)
        throw new SellerError("CONFLICT");
      await ownedDraft(tx, command.sellerId, pending.draftId);
      return pending;
    }
    if (workspace.revision !== command.expectedRevision)
      throw new SellerError("CONFLICT");
    const op = command.operation,
      revision = workspace.revision + 1;
    await checkAssistantBudget(tx, user.id, op.kind === "prepare");
    if (op.kind === "prepare") {
      const draft = await ownedDraft(tx, command.sellerId, op.draftId);
      if (!["draft", "withdrawn"].includes(draft.publication))
        throw new SellerError("FORBIDDEN");
      if (
        draft.revision !== op.expectedDraftRevision ||
        inputHash(draft.payload) !== op.baseHash
      )
        throw new SellerError("CONFLICT");
      const payload = applyHelperEdit(draft.payload, op.edit, seller.kind);
      const slots = (
        await tx.client.query<{ slot: number }>(
          "SELECT slot FROM treido.seller_helper_proposals WHERE user_id=$1 AND seller_id=$2 AND listing_id<>$3",
          [user.id, command.sellerId, op.draftId],
        )
      ).rows;
      const slot = Array.from(
        { length: ASSISTANT_LIMITS.proposals },
        (_, i) => i + 1,
      ).find((candidate) => !slots.some((row) => row.slot === candidate));
      if (!slot) throw new SellerError("QUOTA_EXCEEDED");
      const id = randomUUID(),
        proposalHash = inputHash({
          draftId: op.draftId,
          draftRevision: draft.revision,
          baseHash: op.baseHash,
          payload,
        });
      await tx.client.query(
        "DELETE FROM treido.seller_helper_proposals WHERE user_id=$1 AND seller_id=$2 AND listing_id=$3",
        [user.id, command.sellerId, op.draftId],
      );
      await tx.client.query(
        "INSERT INTO treido.seller_helper_proposals(user_id,seller_id,id,slot,listing_id,draft_revision,base_hash,proposal_hash,original_edit,proposed_payload) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
        [
          user.id,
          command.sellerId,
          id,
          slot,
          op.draftId,
          draft.revision,
          op.baseHash,
          proposalHash,
          editableDraft(draft.payload),
          payload,
        ],
      );
      const result: HelperChange = {
        revision,
        proposalId: id,
        draftId: op.draftId,
        draftRevision: draft.revision,
        outcome: "prepared",
        replayed: false,
      };
      await tx.client.query(
        "UPDATE treido.seller_helper_workspaces SET revision=$3 WHERE user_id=$1 AND seller_id=$2",
        [user.id, command.sellerId, revision],
      );
      await recordHelperReceipt(tx, user.id, command, hash, result);
      return result;
    }
    const proposal = (
      await tx.client.query<HelperProposalRow>(
        `SELECT ${proposalColumns} FROM treido.seller_helper_proposals WHERE user_id=$1 AND seller_id=$2 AND id=$3`,
        [user.id, command.sellerId, op.proposalId],
      )
    ).rows[0];
    if (!proposal) throw new SellerError("NOT_FOUND");
    const draft = await ownedDraft(tx, command.sellerId, proposal.draftId);
    if (op.kind === "discard") {
      await tx.client.query(
        "DELETE FROM treido.seller_helper_proposals WHERE user_id=$1 AND seller_id=$2 AND id=$3",
        [user.id, command.sellerId, proposal.id],
      );
      const result: HelperChange = {
        revision,
        proposalId: proposal.id,
        draftId: proposal.draftId,
        draftRevision: null,
        outcome: "discarded",
        replayed: false,
      };
      await tx.client.query(
        "UPDATE treido.seller_helper_workspaces SET revision=$3 WHERE user_id=$1 AND seller_id=$2",
        [user.id, command.sellerId, revision],
      );
      await recordHelperReceipt(tx, user.id, command, hash, result);
      return result;
    }
    if (!["draft", "withdrawn"].includes(draft.publication))
      throw new SellerError("FORBIDDEN");
    if (
      proposal.proposalHash !== op.proposalHash ||
      proposal.draftRevision !== op.expectedDraftRevision ||
      draft.revision !== proposal.draftRevision ||
      inputHash(draft.payload) !== proposal.baseHash
    )
      throw new SellerError("CONFLICT");
    const payload = parseDraftPayload(proposal.payload);
    if (
      !payload ||
      inputHash(
        applyHelperEdit(draft.payload, editableDraft(payload), seller.kind),
      ) !== inputHash(payload)
    )
      throw new SellerError("NOT_AVAILABLE");
    const intent: HelperIntentRow = {
      requestId: command.requestId,
      hash,
      revision,
      proposalId: proposal.id,
      draftId: proposal.draftId,
      draftRevision: proposal.draftRevision,
      payload,
      command,
    };
    await tx.client.query(
      "INSERT INTO treido.seller_helper_acceptance_intents(user_id,seller_id,request_id,input_hash,accepted_revision,proposal_id,listing_id,draft_revision,payload,original_command) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
      [
        user.id,
        command.sellerId,
        command.requestId,
        hash,
        revision,
        proposal.id,
        proposal.draftId,
        proposal.draftRevision,
        payload,
        command,
      ],
    );
    await tx.client.query(
      "UPDATE treido.seller_helper_workspaces SET revision=$3 WHERE user_id=$1 AND seller_id=$2",
      [user.id, command.sellerId, revision],
    );
    return intent;
  });
}

async function finishAcceptance(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  intent: HelperIntentRow,
  failure: "CONFLICT" | "probe" | null,
): Promise<HelperChange | null> {
  return inTransaction(database, async (tx) => {
    await requireAssistantStorage(tx);
    await authorizeHuman(tx, identity, true);
    const { user } = await authorizeSeller(
      tx,
      identity,
      intent.command.sellerId,
      "listing.write",
    );
    await lockHelperWorkspace(tx, user.id, intent.command.sellerId);
    const receipt = await helperReceipt(
      tx,
      user.id,
      intent.command.sellerId,
      intent.requestId,
    );
    if (receipt) {
      if (receipt.hash !== intent.hash) throw new SellerError("CONFLICT");
      return { ...receipt.result, replayed: true };
    }
    const pending = await pendingHelperIntent(
      tx,
      user.id,
      intent.command.sellerId,
    );
    if (
      !pending ||
      pending.hash !== intent.hash ||
      pending.requestId !== intent.requestId
    )
      throw new SellerError("CONFLICT");
    await ownedDraft(tx, intent.command.sellerId, intent.draftId);
    // Existing immutable draft receipt is authoritative even if another editor
    // has since advanced the draft. Recovery acknowledges the original save only.
    const saved = (
      await tx.client.query<{ hash: string; revision: number }>(
        "SELECT input_hash AS hash,accepted_revision AS revision FROM treido.draft_save_receipts WHERE seller_id=$1 AND listing_id=$2 AND user_id=$3 AND request_id=$4",
        [intent.command.sellerId, intent.draftId, user.id, intent.requestId],
      )
    ).rows[0];
    const expectedHash = inputHash({
      expectedRevision: intent.draftRevision,
      payload: intent.payload,
    });
    const accepted = saved?.hash === expectedHash ? saved : null;
    if (!saved && failure === "probe") return null;
    if (saved && !accepted) failure = "CONFLICT";
    if (!saved && !failure) throw new SellerError("NOT_AVAILABLE");
    const result: HelperChange = {
      revision: intent.revision,
      proposalId: intent.proposalId,
      draftId: intent.draftId,
      draftRevision: accepted?.revision ?? null,
      outcome: accepted ? "applied" : "conflict",
      replayed: false,
    };
    await recordHelperReceipt(tx, user.id, intent.command, intent.hash, result);
    await tx.client.query(
      "DELETE FROM treido.seller_helper_acceptance_intents WHERE user_id=$1 AND seller_id=$2 AND request_id=$3",
      [user.id, intent.command.sellerId, intent.requestId],
    );
    if (accepted)
      await tx.client.query(
        "DELETE FROM treido.seller_helper_proposals WHERE user_id=$1 AND seller_id=$2 AND id=$3",
        [user.id, intent.command.sellerId, intent.proposalId],
      );
    return result;
  });
}
export async function changeSellHelper(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  raw: unknown,
): Promise<HelperChange> {
  const command = parseHelperCommand(raw);
  requireAssistantActor(identity, command.actorKey);
  const staged = await stageHelper(database, identity, command);
  if (!("command" in staged)) return staged;
  // An earlier save may already have committed, even if the listing is now
  // published or edited. Reconcile its immutable receipt before calling save
  // again; current helper/resource authority is still rechecked inside the probe.
  const recovered = await finishAcceptance(database, identity, staged, "probe");
  if (recovered) return { ...recovered, replayed: true };
  let failure: "CONFLICT" | null = null;
  try {
    await saveListingDraft(database, identity, {
      sellerId: command.sellerId,
      draftId: staged.draftId,
      expectedRevision: staged.draftRevision,
      requestId: staged.requestId,
      payload: staged.payload,
    });
  } catch (error) {
    if (error instanceof SellerError && error.code === "CONFLICT")
      failure = "CONFLICT";
    else throw error; // Unknown/denied outcomes retain the durable original intent.
  }
  const result = await finishAcceptance(database, identity, staged, failure);
  if (!result) throw new SellerError("NOT_AVAILABLE");
  return result;
}
