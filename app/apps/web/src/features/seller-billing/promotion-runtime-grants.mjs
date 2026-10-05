export async function applyPromotionPaymentGrants(client, role) {
  if (!/^[a-z][a-z0-9_]{1,62}$/.test(role))
    throw new Error("Invalid runtime role.");
  const name = '"' + role + '"';
  await client.query(`
    REVOKE ALL ON treido.promotion_payment_bindings,treido.promotion_customer_bindings,treido.promotion_checkout_intents FROM ${name};
    GRANT SELECT ON treido.promotion_payment_bindings,treido.promotion_customer_bindings TO ${name};
    GRANT SELECT,INSERT ON treido.promotion_checkout_intents TO ${name};
    GRANT UPDATE(first_attempt_at,checkout_session_id) ON treido.promotion_checkout_intents TO ${name};
    GRANT EXECUTE ON FUNCTION treido.lock_promotion_payment_bindings(uuid,uuid,uuid,uuid,text,boolean,text,text) TO ${name};
  `);
}
