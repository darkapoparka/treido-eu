import "server-only";
import Stripe from "stripe";
import { randomUUID } from "node:crypto";
import { inTransaction, type SellerDatabase } from "../../server/db/database";
import {
  hasVerifiedRecentAuthentication,
  type VerifiedIdentity,
} from "../../server/identity/clerk.server";
import { authorizeSeller, inputHash } from "../sellers/persistence.server";
import { SellerError } from "../sellers/errors";
import { libraryActorKey } from "../library/cursor.server";
import { parseResource } from "./model";
import { paymentBindings, verifiedStripe } from "./bindings.server";
import { sellerBinding, connectAccountFacts } from "./registry.server";

export async function readConnectReadiness(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  sellerId: string,
) {
  const binding = paymentBindings();
  const initial = await inTransaction(database, async (tx) => {
    await authorizeSeller(tx, identity, sellerId, "seller.read");
    return sellerBinding(tx, sellerId, binding);
  });
  const stripe = await verifiedStripe(binding),
    account = await stripe.accounts.retrieve(initial.connectedAccount);
  return inTransaction(database, async (tx) => {
    await authorizeSeller(tx, identity, sellerId, "seller.read");
    const current = await sellerBinding(tx, sellerId, binding);
    if (current.id !== initial.id || current.connectedAccount !== account.id)
      throw new SellerError("CONFLICT");
    // Only safe current capability/requirement facts leave the server. No bank,
    // representative, identity document, email or provider link is retained.
    // A seller can have different reviewed sale policies. Capability facts do
    // not select a settlement merchant or authorize a payable checkout.
    return {
      ...connectAccountFacts(account),
      settlementMerchant: null,
      policyQualified: false,
      ready: false,
    };
  });
}
export async function createConnectOnboarding(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  raw: unknown,
) {
  const command = parseResource(raw);
  if (command.actorKey !== libraryActorKey(identity))
    throw new SellerError("FORBIDDEN");
  if (!hasVerifiedRecentAuthentication(identity))
    throw new SellerError("FORBIDDEN");
  const binding = paymentBindings(),
    stripe = await verifiedStripe(binding);
  const intent = await inTransaction(database, async (tx) => {
    const access = await authorizeSeller(
        tx,
        identity,
        command.id,
        "payment.setup",
      ),
      mapping = await sellerBinding(tx, command.id, binding);
    await tx.client.query(
      `SELECT pg_advisory_xact_lock(hashtextextended($1,0))`,
      ["connect-onboarding:" + mapping.id],
    );
    const path = `/app/sellers/${command.id}/settings/payments`;
    const parameters: Stripe.AccountLinkCreateParams = {
      account: mapping.connectedAccount,
      type: "account_onboarding",
      refresh_url: new URL(path + "/refresh", binding.origin).href,
      return_url: new URL(path, binding.origin).href,
    };
    const prior = (
      await tx.client.query<{
        id: string;
        hash: string;
        bindingId: string;
        parameters: Stripe.AccountLinkCreateParams;
        recoverable: boolean;
      }>(
        `SELECT id,input_hash AS hash,binding_id AS "bindingId",parameters,created_at>clock_timestamp()-interval '5 minutes' AS recoverable FROM treido.connect_onboarding_intents WHERE seller_id=$1 AND actor_id=$2 AND request_id=$3`,
        [command.id, access.user.id, command.requestId],
      )
    ).rows[0];
    if (prior) {
      if (
        prior.hash !== inputHash(command) ||
        prior.bindingId !== mapping.id ||
        inputHash(prior.parameters) !== inputHash(parameters) ||
        !prior.recoverable
      )
        throw new SellerError("CONFLICT");
      // Recover a lost nonfinancial link response using its original provider
      // key and parameters. An expired link requires a new explicit intent.
      return { id: prior.id, mapping, parameters: prior.parameters };
    }
    const quota = (
      await tx.client.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM treido.connect_onboarding_intents WHERE seller_id=$1 AND created_at>clock_timestamp()-interval '1 hour'`,
        [command.id],
      )
    ).rows[0];
    if (quota.n >= 10) throw new SellerError("QUOTA_EXCEEDED");
    const id = randomUUID();
    await tx.client.query(
      `INSERT INTO treido.connect_onboarding_intents(id,seller_id,actor_id,request_id,input_hash,binding_id,operation_key,parameters,state) VALUES($1,$2,$3,$4,$5,$6,$7,$8,'creating')`,
      [
        id,
        command.id,
        access.user.id,
        command.requestId,
        inputHash(command),
        mapping.id,
        `treido:onboarding:v1:${id}`,
        parameters,
      ],
    );
    return { id, mapping, parameters };
  });
  const account = await stripe.accounts.retrieve(
    intent.mapping.connectedAccount,
  );
  if (
    account.country !== "BG" ||
    account.controller?.stripe_dashboard?.type !== "express" ||
    account.controller?.requirement_collection !== "stripe"
  )
    throw new SellerError("NOT_AVAILABLE");
  let link: Stripe.AccountLink;
  try {
    link = await stripe.accountLinks.create(intent.parameters, {
      idempotencyKey: `treido:onboarding:v1:${intent.id}`,
    });
  } catch {
    await database.pool.query(
      `UPDATE treido.connect_onboarding_intents SET state='reconciling' WHERE id=$1`,
      [intent.id],
    );
    throw new SellerError("NOT_AVAILABLE");
  }
  await inTransaction(database, async (tx) => {
    await authorizeSeller(tx, identity, command.id, "payment.setup");
    const current = await sellerBinding(tx, command.id, binding);
    if (current.id !== intent.mapping.id) throw new SellerError("FORBIDDEN");
    await tx.client.query(
      `UPDATE treido.connect_onboarding_intents SET state='issued' WHERE id=$1`,
      [intent.id],
    );
  });
  const url = new URL(link.url);
  if (
    url.protocol !== "https:" ||
    !["connect.stripe.com", "onboarding.stripe.com"].includes(url.hostname)
  )
    throw new SellerError("NOT_AVAILABLE");
  // This ephemeral link only reaches the currently authorized human. A return
  // redirect simply reloads provider facts; it never marks onboarding complete.
  return { url: link.url };
}
