export async function applyPromotionGrants(client, role) {
  if (!/^[a-z_][a-z0-9_]{0,62}$/.test(role))
    throw new Error("Invalid runtime role");
  const recipient = '"' + role + '"';
  const immutable = [
    "promotion_reviews",
    "promotion_purchases",
    "promotion_intervals",
    "promotion_bump_signals",
    "promotion_events",
    "promotion_receipts",
    "promotion_provider_events",
    "promotion_provider_signals",
    "promotion_metrics",
    "promotion_remedy_reviews",
    "promotion_measurement_choices",
  ];
  const mutable = [
    "promotion_campaigns",
    "promotion_attempts",
    "promotion_reservations",
  ];
  for (const table of [
    "promotion_products",
    "promotion_capacity",
    "promotion_measurement_policies",
    ...immutable,
    ...mutable,
  ]) {
    await client.query(
      `REVOKE ALL ON treido.${table} FROM PUBLIC, ${recipient}`,
    );
    await client.query(`GRANT SELECT ON treido.${table} TO ${recipient}`);
  }
  for (const table of [...immutable, ...mutable])
    await client.query(`GRANT INSERT ON treido.${table} TO ${recipient}`);
  await client.query(
    `GRANT UPDATE(listing_id,product_id,revision,state,reason,updated_at) ON treido.promotion_campaigns TO ${recipient}`,
  );
  await client.query(
    `GRANT UPDATE(state,provider_id,checkout_session_id,checkout_url,updated_at) ON treido.promotion_attempts TO ${recipient}`,
  );
  await client.query(
    `GRANT UPDATE(status,expires_at) ON treido.promotion_reservations TO ${recipient}`,
  );
  // Lock-only update privileges allow current approval recheck without granting a commercial field.
  await client.query(
    `GRANT UPDATE(id) ON treido.promotion_products, treido.promotion_capacity TO ${recipient}`,
  );
  await client.query(
    `GRANT UPDATE(id) ON treido.promotion_measurement_policies TO ${recipient}`,
  );
  // Expired minimised event measurements only; purchase/history/consent/audit remain immutable.
  await client.query(
    `GRANT DELETE ON treido.promotion_metrics TO ${recipient}`,
  );
  await client.query(
    `REVOKE ALL ON FUNCTION treido.promotion_keep_provider_identity() FROM PUBLIC, ${recipient}`,
  );
  await client.query(
    `REVOKE ALL ON FUNCTION treido.promotion_keep_live_metric() FROM PUBLIC, ${recipient}`,
  );
  await client.query(
    `REVOKE ALL ON FUNCTION treido.promotion_registry_version() FROM PUBLIC, ${recipient}`,
  );
}
