/** Parent calls after the existing billing grants and reviewed 0047, in its grant transaction. */
export async function applyBillingRecoveryGrants(client, role) {
  if (!/^[a-z][a-z0-9_]{1,62}$/.test(role))
    throw new Error("Invalid runtime role.");
  const name = '"' + role + '"';
  await client.query(`
    REVOKE ALL ON treido.billing_recovery_requests FROM ${name};
    GRANT SELECT,INSERT ON treido.billing_recovery_requests TO ${name};
    GRANT UPDATE(state,updated_at) ON treido.billing_recovery_requests TO ${name};
    GRANT UPDATE(change_invoice_id) ON treido.billing_intents TO ${name};
  `);
}
