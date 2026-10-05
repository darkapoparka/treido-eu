/** Called ONLY by the original reviewed migration/grant transaction. */
export async function applyOrderAftercareGrants(client, role) {
  if (!/^[a-z][a-z0-9_]{1,62}$/.test(role))
    throw new Error("Invalid runtime role.");
  const quoted = '"' + role + '"';
  await client.query(
    "REVOKE ALL ON treido.order_service_policies,treido.order_financial_policies,treido.quote_aftercare_acceptances,treido.order_cases,treido.order_case_events,treido.order_aftercare_receipts,treido.order_fulfilments,treido.order_fulfilment_events,treido.order_refund_intents,treido.order_refund_lines,treido.order_refund_observations,treido.order_aftercare_operator_grants FROM " +
      quoted,
  );
  await client.query(
    "GRANT SELECT ON treido.order_service_policies,treido.order_financial_policies,treido.order_aftercare_operator_grants TO " +
      quoted,
  );
  await client.query(
    "GRANT SELECT,INSERT ON treido.quote_aftercare_acceptances,treido.order_cases,treido.order_case_events,treido.order_aftercare_receipts,treido.order_fulfilments,treido.order_fulfilment_events,treido.order_refund_intents,treido.order_refund_lines,treido.order_refund_observations TO " +
      quoted,
  );
  await client.query(
    "GRANT UPDATE(state,revision,appeal_until,updated_at) ON treido.order_cases TO " +
      quoted,
  );
  await client.query(
    "GRANT UPDATE(state,revision,carrier,tracking_reference,description,updated_at) ON treido.order_fulfilments TO " +
      quoted,
  );
  await client.query(
    "GRANT UPDATE(state,revision,first_attempt_at,provider_id,provider_status,settlement_state,generation,reconcile_at,updated_at) ON treido.order_refund_intents TO " +
      quoted,
  );
  await client.query(
    "GRANT EXECUTE ON FUNCTION treido.lock_order_aftercare_registry(text,uuid,uuid,text,boolean,text,text),treido.lock_order_aftercare_operator(uuid,text,text,text) TO " +
      quoted,
  );
}
