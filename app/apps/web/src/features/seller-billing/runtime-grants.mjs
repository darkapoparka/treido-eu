/** Called by the existing migration/grant transaction, never a standalone runner. */
export async function applySellerBillingGrants(client, role) {
  if (!/^[a-z][a-z0-9_]{1,62}$/.test(role))
    throw new Error("Invalid runtime role.");
  const name = '"' + role + '"';
  await client.query(`
    REVOKE ALL ON treido.billing_catalogue,treido.billing_customers,treido.billing_intents,treido.billing_subscriptions,treido.billing_invoice_observations,treido.billing_paid_intervals,treido.billing_revocations,treido.billing_sync,treido.billing_payment_links FROM ${name};
    GRANT EXECUTE ON FUNCTION treido.lock_billing_registry(uuid,uuid,uuid,text,boolean,text,text) TO ${name};
    GRANT SELECT ON treido.billing_catalogue,treido.billing_customers TO ${name};
    GRANT SELECT,INSERT ON treido.billing_intents,treido.billing_subscriptions,treido.billing_invoice_observations,treido.billing_paid_intervals,treido.billing_revocations,treido.billing_sync,treido.billing_payment_links TO ${name};
    GRANT UPDATE(generation) ON treido.billing_sync TO ${name};
    GRANT UPDATE(state,provider_id,hosted_url,result,first_attempt_at,updated_at) ON treido.billing_intents TO ${name};
    GRANT UPDATE(catalogue_id,item_id,state,cancel_at_period_end,period_end,generation,observed_at,retired_at) ON treido.billing_subscriptions TO ${name};
  `);
}
