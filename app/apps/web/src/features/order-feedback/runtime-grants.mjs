/** Called ONLY by the original reviewed migration/grant transaction. */
export async function applyOrderFeedbackGrants(client, role) {
  if (!/^[a-z][a-z0-9_]{1,62}$/.test(role))
    throw new Error("Invalid runtime role.");
  const quoted = '"' + role + '"';
  await client.query(
    "REVOKE ALL ON treido.order_feedback_policies,treido.order_purchase_feedback,treido.order_feedback_events,treido.order_feedback_receipts FROM " +
      quoted,
  );
  await client.query(
    "GRANT SELECT ON treido.order_feedback_policies TO " + quoted,
  );
  await client.query(
    "GRANT SELECT,INSERT ON treido.order_purchase_feedback,treido.order_feedback_events,treido.order_feedback_receipts TO " +
      quoted,
  );
  await client.query(
    "GRANT EXECUTE ON FUNCTION treido.lock_order_feedback_policy(uuid,uuid,text,boolean,text,text),treido.order_feedback_eligible(uuid),treido.moderate_order_feedback(uuid,uuid,uuid,integer,text,text,text,text,text,uuid) TO " +
      quoted,
  );
}
