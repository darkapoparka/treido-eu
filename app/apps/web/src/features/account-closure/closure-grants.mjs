// Canonical owner invokes only inside the original reviewed grant transaction.
export async function applyAccountClosureGrants(client, role) {
  if (!/^[a-z_][a-z0-9_]{0,62}$/.test(role))
    throw new Error("Invalid runtime role");
  const recipient = '"' + role + '"';
  const tables = [
    "account_lifecycle_workspaces",
    "account_closure_policies",
    "account_lifecycle_bindings",
    "account_execution_plans",
    "account_lifecycle_effects",
    "account_lifecycle_receipts",
    "account_effect_observations",
    "account_lifecycle_status_events",
  ];
  for (const table of tables) {
    await client.query(
      `REVOKE ALL ON treido.${table} FROM PUBLIC, ${recipient}`,
    );
    await client.query(`GRANT SELECT ON treido.${table} TO ${recipient}`);
  }
  for (const table of [
    "account_lifecycle_workspaces",
    "account_execution_plans",
    "account_lifecycle_effects",
    "account_lifecycle_receipts",
  ])
    await client.query(`GRANT INSERT ON treido.${table} TO ${recipient}`);
  await client.query(
    `GRANT UPDATE(revision,locale,browse_scope) ON treido.account_lifecycle_workspaces TO ${recipient}`,
  );
  for (const signature of [
    "account_read_approved_binding(uuid)",
    "account_read_approved_policy(uuid)",
    "account_read_closure_plan(uuid,uuid,boolean)",
    "account_lock_security_effect(uuid,text,text)",
    "account_read_personal_closure_subscriptions(uuid)",
    "account_closure_obligations(uuid)",
    "account_assert_clear(uuid)",
    "account_accept_closure(uuid,uuid,text,uuid)",
    "account_cancel_closure(uuid,uuid)",
    "account_claim_effect(uuid,uuid,uuid,uuid)",
    "account_record_effect(uuid,uuid,text,text,text)",
    "account_remove_optional_data(uuid,uuid)",
    "account_finish_closure(uuid,uuid,uuid,uuid)",
  ]) {
    await client.query(
      `REVOKE ALL ON FUNCTION treido.${signature} FROM PUBLIC`,
    );
    await client.query(
      `GRANT EXECUTE ON FUNCTION treido.${signature} TO ${recipient}`,
    );
  }
  // No generic DELETE, source-account UPDATE, registry INSERT or provider-setting grant.
}
