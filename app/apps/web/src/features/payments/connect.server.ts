import "server-only";
import Stripe from "stripe";
import { randomUUID } from "node:crypto";
import { inTransaction, type SellerDatabase, type SellerTransaction } from "../../server/db/database";
import { hasVerifiedRecentAuthentication, type VerifiedIdentity } from "../../server/identity/clerk.server";
import { authorizeSeller, inputHash } from "../sellers/persistence.server";
import { SellerError } from "../sellers/errors";
import { libraryActorKey } from "../library/cursor.server";
import { parseResource } from "./model";
import { paymentBindings, verifiedStripe } from "./bindings.server";
import { sellerBinding, connectAccountFacts, accountReadiness } from "./registry.server";
import { canReadConnectStatus } from "./connect-status";

async function authorizeStatus(tx: SellerTransaction, identity: VerifiedIdentity, sellerId: string) {
  const access = await authorizeSeller(tx, identity, sellerId, "seller.read");
  if (!canReadConnectStatus(access.context.capabilities)) throw new SellerError("FORBIDDEN");
  return access;
}
export async function readConnectReadiness(database: SellerDatabase, identity: VerifiedIdentity, sellerId: string) {
  // Authorize before resolving configuration or doing any provider I/O. A generic
  // listing member must not receive payment requirements or probe the binding.
  const initial = await inTransaction(database, async (tx) => {
    await authorizeStatus(tx, identity, sellerId);
    const binding = paymentBindings();
    return { binding, mapping: await sellerBinding(tx, sellerId, binding) };
  });
  const stripe = await verifiedStripe(initial.binding);
  const account = await stripe.accounts.retrieve(initial.mapping.connectedAccount);
  return inTransaction(database, async (tx) => {
    await authorizeStatus(tx, identity, sellerId);
    const current = await sellerBinding(tx, sellerId, initial.binding);
    if (current.id !== initial.mapping.id || current.connectedAccount !== account.id) throw new SellerError("CONFLICT");
    const deadline = account.requirements?.current_deadline;
    return {
      ...connectAccountFacts(account),
      eventuallyDue: account.requirements?.eventually_due ?? [],
      requirementsDeadline: typeof deadline === "number" && Number.isFinite(deadline) && deadline > 0 ? new Date(deadline * 1000).toISOString() : null,
      supportedAccount: account.country === "BG" && account.default_currency === "eur",
      platformAccountReady: accountReadiness(account, "platform").ready,
      sellerAccountReady: accountReadiness(account, "seller").ready,
      // A capability check is not a selected commercial policy. Keep this old
      // contract fail-closed; quote creation still loads the exact approved terms.
      settlementMerchant: null,
      policyQualified: false,
      ready: false,
    };
  });
}
export async function createConnectOnboarding(database: SellerDatabase, identity: VerifiedIdentity, raw: unknown) {
  const command = parseResource(raw);
  if (command.actorKey !== libraryActorKey(identity) || !hasVerifiedRecentAuthentication(identity)) throw new SellerError("FORBIDDEN");
  const intent = await inTransaction(database, async (tx) => {
    const access = await authorizeSeller(tx, identity, command.id, "payment.setup");
    const binding = paymentBindings();
    const mapping = await sellerBinding(tx, command.id, binding);
    await tx.client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", ["connect-onboarding:" + mapping.id]);
    const path = `/app/sellers/${command.id}/settings/payments`;
    const parameters: Stripe.AccountLinkCreateParams = {
      account: mapping.connectedAccount,
      type: "account_onboarding",
      refresh_url: new URL(path + "/refresh", binding.origin).href,
      return_url: new URL(path, binding.origin).href,
    };
    const prior = (await tx.client.query<{
      id: string; hash: string; bindingId: string; parameters: Stripe.AccountLinkCreateParams; recoverable: boolean;
    }>(`SELECT id,input_hash AS hash,binding_id AS "bindingId",parameters,created_at>clock_timestamp()-interval '5 minutes' AS recoverable FROM treido.connect_onboarding_intents WHERE seller_id=$1 AND actor_id=$2 AND request_id=$3`, [command.id, access.user.id, command.requestId])).rows[0];
    if (prior) {
      if (prior.hash !== inputHash(command) || prior.bindingId !== mapping.id || inputHash(prior.parameters) !== inputHash(parameters) || !prior.recoverable) throw new SellerError("CONFLICT");
      return { id: prior.id, mapping, parameters: prior.parameters, binding };
    }
    const quota = (await tx.client.query<{ n: number }>("SELECT count(*)::int AS n FROM treido.connect_onboarding_intents WHERE seller_id=$1 AND created_at>clock_timestamp()-interval '1 hour'", [command.id])).rows[0];
    if (quota.n >= 10) throw new SellerError("QUOTA_EXCEEDED");
    const id = randomUUID();
    await tx.client.query(`INSERT INTO treido.connect_onboarding_intents(id,seller_id,actor_id,request_id,input_hash,binding_id,operation_key,parameters,state) VALUES($1,$2,$3,$4,$5,$6,$7,$8,'creating')`, [id, command.id, access.user.id, command.requestId, inputHash(command), mapping.id, `treido:onboarding:v1:${id}`, parameters]);
    return { id, mapping, parameters, binding };
  });
  const stripe = await verifiedStripe(intent.binding);
  const account = await stripe.accounts.retrieve(intent.mapping.connectedAccount);
  if (account.id !== intent.mapping.connectedAccount || account.country !== "BG" || account.controller?.stripe_dashboard?.type !== "express" || account.controller?.requirement_collection !== "stripe") throw new SellerError("NOT_AVAILABLE");
  // The external reads above may have outlived a membership or registry change.
  // Reauthorize immediately before issuing a privileged, single-use hosted link.
  await inTransaction(database, async (tx) => {
    await authorizeSeller(tx, identity, command.id, "payment.setup");
    if (!hasVerifiedRecentAuthentication(identity)) throw new SellerError("FORBIDDEN");
    const mapping = await sellerBinding(tx, command.id, intent.binding);
    if (mapping.id !== intent.mapping.id || mapping.connectedAccount !== account.id) throw new SellerError("CONFLICT");
  });
  let link: Stripe.AccountLink;
  try {
    link = await stripe.accountLinks.create(intent.parameters, { idempotencyKey: `treido:onboarding:v1:${intent.id}` });
  } catch {
    await database.pool.query("UPDATE treido.connect_onboarding_intents SET state='reconciling' WHERE id=$1 AND state<>'issued'", [intent.id]);
    throw new SellerError("NOT_AVAILABLE");
  }
  await inTransaction(database, async (tx) => {
    await authorizeSeller(tx, identity, command.id, "payment.setup");
    const current = await sellerBinding(tx, command.id, intent.binding);
    if (current.id !== intent.mapping.id || current.connectedAccount !== account.id) throw new SellerError("FORBIDDEN");
    await tx.client.query("UPDATE treido.connect_onboarding_intents SET state='issued' WHERE id=$1", [intent.id]);
  });
  const url = new URL(link.url);
  if (url.protocol !== "https:" || !["connect.stripe.com", "onboarding.stripe.com"].includes(url.hostname)) throw new SellerError("NOT_AVAILABLE");
  // An idempotent replay can return an already expired nonfinancial link. Let
  // the UI explicitly renew its intent instead of looping into an expired URL.
  if (!Number.isFinite(link.expires_at) || link.expires_at * 1000 <= Date.now()) throw new SellerError("CONFLICT");
  return { url: link.url };
}
