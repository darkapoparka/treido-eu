export async function applyNotificationDeliveryGrants(client, role) {
  if (!/^[a-z][a-z0-9_]{1,62}$/.test(role))
    throw new Error("Invalid runtime role.");
  const tables = (
    await client.query(
      `SELECT to_regclass('treido.notification_email_preferences') IS NOT NULL AS preferences,to_regclass('treido.notification_email_receipts') IS NOT NULL AS receipts,to_regclass('treido.notification_email_deliveries') IS NOT NULL AS deliveries`,
    )
  ).rows[0];
  if (!tables.preferences && !tables.receipts && !tables.deliveries) return;
  if (!tables.preferences || !tables.receipts || !tables.deliveries)
    throw new Error("Partial notification email storage.");
  const name = `"${role}"`;
  await client.query(
    `REVOKE UPDATE,DELETE ON treido.notification_email_preferences,treido.notification_email_deliveries,treido.notification_email_receipts FROM ${name}`,
  );
  await client.query(
    `GRANT SELECT,INSERT ON treido.notification_email_preferences,treido.notification_email_deliveries,treido.notification_email_receipts TO ${name}`,
  );
  await client.query(
    `GRANT UPDATE(revision,consent_generation,saved_search_email,message_email,language,consent_version,consent_at,updated_at) ON treido.notification_email_preferences TO ${name}`,
  );
  await client.query(
    `GRANT UPDATE(state,first_attempt_at,request_payload,mail_binding,provider_key,provider_id,provider_state,submitted_at,last_checked_at,retry_at,updated_at) ON treido.notification_email_deliveries TO ${name}`,
  );
  await client.query(
    `REVOKE ALL ON FUNCTION treido.account_remove_optional_data_before_notification(uuid,uuid) FROM ${name}; GRANT EXECUTE ON FUNCTION treido.account_remove_optional_data(uuid,uuid) TO ${name}`,
  );
  await client.query(
    `GRANT EXECUTE ON FUNCTION treido.repair_any_due_v2() TO ${name}`,
  );
}
