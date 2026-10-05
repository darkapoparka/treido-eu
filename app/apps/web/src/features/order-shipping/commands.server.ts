import "server-only";
import { randomUUID } from "node:crypto";
import { inTransaction, type SellerDatabase } from "../../server/db/database";
import {
  hasVerifiedRecentAuthentication,
  type VerifiedIdentity,
} from "../../server/identity/clerk.server";
import { inputHash } from "../sellers/persistence.server";
import { SellerError } from "../sellers/errors";
import { parseCommand, parseRecipient, parseRecovery } from "./model";
import { shippingSource } from "./source.server";
import { readShippingOption } from "./registry.server";
import {
  ownedShippingRow,
  ownRecipient,
  priorShippingReceipt,
  shippingActor,
  shippingReceipt,
} from "./storage.server";
import type { ShippingSnapshot } from "./view";

export async function executeShippingCommand(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  raw: unknown,
) {
  const command = parseCommand(raw);
  return inTransaction(database, async (tx) => {
    const buyer = await shippingActor(tx, identity, command.actorKey);
    await tx.client.query(
      "SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
      ["shipping-choice-v1:" + buyer.id],
    );
    const prior = await priorShippingReceipt(
      tx,
      buyer.id,
      command.requestId,
      command,
    );
    if (prior) {
      if (!prior.id) throw new SellerError("CONFLICT");
      const row = await ownedShippingRow(tx, buyer.id, prior.id);
      return {
        id: row.id,
        revision: row.revision,
        requestId: command.requestId,
      };
    }
    const count = (
      await tx.client.query<{ n: number }>(
        "SELECT count(*)::int AS n FROM treido.order_shipping_receipts WHERE buyer_id=$1 AND created_at>clock_timestamp()-interval '1 hour'",
        [buyer.id],
      )
    ).rows[0];
    if (!count || count.n >= 40) throw new SellerError("QUOTA_EXCEEDED");
    if (command.action === "prepare") {
      const supply = await shippingSource(tx, identity, command.source);
      const option = await readShippingOption(
        tx,
        supply,
        command.policyId,
        command.rateId,
      );
      if (
        command.sourceHash !== supply.sourceHash ||
        command.optionHash !== option.optionHash ||
        command.country !== option.binding.country
      )
        throw new SellerError("CONFLICT");
      const recipient = parseRecipient(
        command.recipient,
        option.policy.fields,
        option.policy.requiredFields,
      );
      if (
        option.binding.method === "collection_office" &&
        (!recipient.officeCode ||
          !option.binding.officeCodes?.includes(recipient.officeCode))
      )
        throw new SellerError("INVALID_INPUT");
      const snapshot: ShippingSnapshot = {
        format: "goods-shipping-v1",
        source: command.source,
        sourceHash: supply.sourceHash,
        sellerId: supply.sellerId,
        currency: "EUR",
        language: command.language,
        country: command.country,
        option,
        lines: supply.lines,
        allocationId: supply.allocationId,
        originalSourceExpiresAt: supply.originalSourceExpiresAt,
      };
      const id = randomUUID();
      await tx.client.query(
        "INSERT INTO treido.order_shipping_choices(id,buyer_id,seller_id,snapshot,snapshot_hash,expires_at) VALUES($1,$2,$3,$4,$5,least(clock_timestamp()+make_interval(secs=>$6),$7::timestamptz,coalesce($8::timestamptz,'infinity'::timestamptz)))",
        [
          id,
          buyer.id,
          supply.sellerId,
          snapshot,
          inputHash(snapshot),
          option.policy.reviewSeconds,
          option.rate.validUntil,
          supply.originalSourceExpiresAt,
        ],
      );
      await tx.client.query(
        "INSERT INTO treido.order_shipping_recipients(choice_id,buyer_id,value,retain_until) VALUES($1,$2,$3,clock_timestamp()+make_interval(secs=>$4))",
        [id, buyer.id, recipient, option.policy.unacceptedRecipientSeconds],
      );
      return shippingReceipt(tx, buyer.id, command, id, 0);
    }
    if (!hasVerifiedRecentAuthentication(identity))
      throw new SellerError("FORBIDDEN");
    const initial = await ownedShippingRow(tx, buyer.id, command.choice.id);
    const supply = await shippingSource(tx, identity, initial.snapshot.source);
    const option = await readShippingOption(
      tx,
      supply,
      initial.snapshot.option.policy.id,
      initial.snapshot.option.rate.id,
    );
    const row = await ownedShippingRow(tx, buyer.id, initial.id, true);
    if (
      row.expired ||
      row.state !== "reviewed" ||
      row.revision !== command.choice.revision ||
      row.snapshotHash !== command.choice.snapshotHash ||
      supply.sourceHash !== row.snapshot.sourceHash ||
      option.optionHash !== row.snapshot.option.optionHash ||
      !(await ownRecipient(tx, row)).value
    )
      throw new SellerError("CONFLICT");
    // The original displayed cost and rights are frozen; no fresh tariff overwrites them.
    if (!hasVerifiedRecentAuthentication(identity))
      throw new SellerError("FORBIDDEN");
    await tx.client.query(
      "UPDATE treido.order_shipping_choices SET state='accepted',revision=revision+1,accepted_at=clock_timestamp() WHERE id=$1",
      [row.id],
    );
    return shippingReceipt(tx, buyer.id, command, row.id, row.revision + 1);
  });
}
export async function recoverShippingRequest(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  raw: unknown,
) {
  const command = parseRecovery(raw);
  return inTransaction(database, async (tx) => {
    const buyer = await shippingActor(tx, identity, command.actorKey);
    const receipt = await priorShippingReceipt(tx, buyer.id, command.requestId);
    if (!receipt) return { found: false } as const;
    if (!receipt.id) return { found: true, canceled: true } as const;
    const row = await ownedShippingRow(tx, buyer.id, receipt.id);
    return {
      found: true,
      canceled: false,
      id: row.id,
      revision: row.revision,
    } as const;
  });
}
/** Explicit stop installs an immutable no-write tombstone for a delayed original
 * command. A read that finds no receipt alone cannot prove that command is over. */
export async function stopUnrecordedShippingRequest(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  raw: unknown,
) {
  const command = parseRecovery(raw);
  return inTransaction(database, async (tx) => {
    const buyer = await shippingActor(tx, identity, command.actorKey);
    await tx.client.query(
      "SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
      ["shipping-choice-v1:" + buyer.id],
    );
    const prior = await priorShippingReceipt(tx, buyer.id, command.requestId);
    if (prior?.id)
      return { found: true, canceled: false, id: prior.id } as const;
    if (
      !prior &&
      (
        await tx.client.query<{ n: number }>(
          "SELECT count(*)::int AS n FROM treido.order_shipping_receipts WHERE buyer_id=$1 AND created_at>clock_timestamp()-interval '1 hour'",
          [buyer.id],
        )
      ).rows[0].n >= 80
    )
      throw new SellerError("QUOTA_EXCEEDED");
    if (!prior)
      await tx.client.query(
        "INSERT INTO treido.order_shipping_receipts(buyer_id,request_id,action,accepted_revision) VALUES($1,$2,'abandoned',0)",
        [buyer.id, command.requestId],
      );
    return { found: true, canceled: true } as const;
  });
}
